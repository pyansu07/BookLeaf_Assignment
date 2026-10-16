import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const draftResponseMock = vi.fn();
vi.mock("../modules/ai/ai.service", () => ({
  classifyAndPrioritize: vi.fn().mockResolvedValue(null),
  draftResponse: (...args: unknown[]) => draftResponseMock(...args),
}));

import request from "supertest";
import { createApp } from "../app";
import { createTestAdmin, createTestAuthor, cleanupTestData } from "./testUtils";

const app = createApp();
const createdUserIds: string[] = [];

async function createTicket(token: string, subject: string) {
  const res = await request(app)
    .post("/api/tickets")
    .set("Authorization", `Bearer ${token}`)
    .send({ subject, description: "Description long enough to pass validation." });
  return res.body.ticket.id as string;
}

describe("AI draft caching", () => {
  beforeEach(() => {
    draftResponseMock.mockReset();
  });

  afterAll(async () => {
    await cleanupTestData(createdUserIds);
  });

  it("generates once, serves the cached draft on reopen, and regenerates on request", async () => {
    const admin = await createTestAdmin();
    const author = await createTestAuthor();
    createdUserIds.push(admin.user.id, author.user.id);
    const ticketId = await createTicket(author.token, "Cache check");

    draftResponseMock.mockResolvedValueOnce("First draft").mockResolvedValueOnce("Second draft");

    const first = await request(app).get(`/api/tickets/${ticketId}/ai-draft`).set("Authorization", `Bearer ${admin.token}`);
    expect(first.body).toMatchObject({ draft: "First draft", cached: false });

    const reopened = await request(app).get(`/api/tickets/${ticketId}/ai-draft`).set("Authorization", `Bearer ${admin.token}`);
    expect(reopened.body).toMatchObject({ draft: "First draft", cached: true });
    expect(draftResponseMock).toHaveBeenCalledTimes(1);

    const regenerated = await request(app)
      .get(`/api/tickets/${ticketId}/ai-draft?regenerate=true`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(regenerated.body).toMatchObject({ draft: "Second draft", cached: false });
    expect(draftResponseMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed generation, so the next open retries", async () => {
    const admin = await createTestAdmin();
    const author = await createTestAuthor();
    createdUserIds.push(admin.user.id, author.user.id);
    const ticketId = await createTicket(author.token, "Failure then retry");

    draftResponseMock.mockResolvedValueOnce(null).mockResolvedValueOnce("Recovered draft");

    const failed = await request(app).get(`/api/tickets/${ticketId}/ai-draft`).set("Authorization", `Bearer ${admin.token}`);
    expect(failed.body.draft).toBeNull();

    const retried = await request(app).get(`/api/tickets/${ticketId}/ai-draft`).set("Authorization", `Bearer ${admin.token}`);
    expect(retried.body).toMatchObject({ draft: "Recovered draft", cached: false });
  });

  it("invalidates the cached draft when the admin changes the category", async () => {
    const admin = await createTestAdmin();
    const author = await createTestAuthor();
    createdUserIds.push(admin.user.id, author.user.id);
    const ticketId = await createTicket(author.token, "Category change");

    draftResponseMock.mockResolvedValueOnce("Draft for general").mockResolvedValueOnce("Draft for ISBN");

    await request(app).get(`/api/tickets/${ticketId}/ai-draft`).set("Authorization", `Bearer ${admin.token}`);
    await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ category: "ISBN_METADATA" });

    const after = await request(app).get(`/api/tickets/${ticketId}/ai-draft`).set("Authorization", `Bearer ${admin.token}`);
    expect(after.body).toMatchObject({ draft: "Draft for ISBN", cached: false });
  });

  it("never exposes the cached draft to the author", async () => {
    const admin = await createTestAdmin();
    const author = await createTestAuthor();
    createdUserIds.push(admin.user.id, author.user.id);
    const ticketId = await createTicket(author.token, "Draft privacy");

    draftResponseMock.mockResolvedValueOnce("Internal draft text");
    await request(app).get(`/api/tickets/${ticketId}/ai-draft`).set("Authorization", `Bearer ${admin.token}`);

    const detail = await request(app).get(`/api/tickets/${ticketId}`).set("Authorization", `Bearer ${author.token}`);
    const list = await request(app).get("/api/tickets").set("Authorization", `Bearer ${author.token}`);

    expect(JSON.stringify(detail.body)).not.toContain("Internal draft text");
    expect(detail.body.ticket).not.toHaveProperty("aiDraft");
    expect(JSON.stringify(list.body)).not.toContain("Internal draft text");
  });

  it("forbids authors from requesting AI drafts", async () => {
    const author = await createTestAuthor();
    createdUserIds.push(author.user.id);
    const ticketId = await createTicket(author.token, "Author draft attempt");

    const res = await request(app).get(`/api/tickets/${ticketId}/ai-draft`).set("Authorization", `Bearer ${author.token}`);
    expect(res.status).toBe(403);
  });
});

describe("admin queue ordering", () => {
  afterAll(async () => {
    await cleanupTestData(createdUserIds);
  });

  it("lists unresolved tickets before resolved ones, then by priority, then oldest first", async () => {
    const admin = await createTestAdmin();
    const author = await createTestAuthor();
    createdUserIds.push(admin.user.id, author.user.id);

    const resolvedCritical = await createTicket(author.token, "Resolved critical");
    const oldLow = await createTicket(author.token, "Old open low");
    const newLow = await createTicket(author.token, "New open low");
    const openHigh = await createTicket(author.token, "Open high");

    const patch = (id: string, body: object) =>
      request(app).patch(`/api/tickets/${id}`).set("Authorization", `Bearer ${admin.token}`).send(body);
    await patch(resolvedCritical, { priority: "CRITICAL", status: "RESOLVED" });
    await patch(oldLow, { priority: "LOW" });
    await patch(newLow, { priority: "LOW" });
    await patch(openHigh, { priority: "HIGH" });

    const res = await request(app).get("/api/tickets").set("Authorization", `Bearer ${admin.token}`);
    const ids: string[] = res.body.tickets.map((t: { id: string }) => t.id);
    const position = (id: string) => ids.indexOf(id);

    expect(position(openHigh)).toBeLessThan(position(oldLow));
    expect(position(oldLow)).toBeLessThan(position(newLow));
    expect(position(newLow)).toBeLessThan(position(resolvedCritical));
  });
});

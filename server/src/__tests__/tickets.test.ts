import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { createTestAdmin, createTestAuthor, cleanupTestData } from "./testUtils";

const app = createApp();
const createdUserIds: string[] = [];

describe("ticket lifecycle", () => {
  afterAll(async () => {
    await cleanupTestData(createdUserIds);
  });

  it("creates a ticket, lets an admin reply, and the author can see the public reply but not internal notes", async () => {
    const admin = await createTestAdmin();
    const author = await createTestAuthor();
    createdUserIds.push(admin.user.id, author.user.id);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${author.token}`)
      .send({
        bookId: author.book!.id,
        subject: "Royalty seems low",
        description: "I sold copies but the royalty pending looks off to me.",
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.ticket.status).toBe("OPEN");
    const ticketId = createRes.body.ticket.id;

    const noteRes = await request(app)
      .post(`/api/tickets/${ticketId}/replies`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ body: "Internal: verify sales report before replying.", isInternalNote: true });
    expect(noteRes.status).toBe(201);

    const publicReplyRes = await request(app)
      .post(`/api/tickets/${ticketId}/replies`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ body: "Thanks for reaching out, here is the breakdown...", isInternalNote: false });
    expect(publicReplyRes.status).toBe(201);

    const authorView = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${author.token}`);
    expect(authorView.status).toBe(200);
    expect(authorView.body.ticket.replies).toHaveLength(1);
    expect(authorView.body.ticket.replies[0].isInternalNote).toBe(false);

    const adminView = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(adminView.body.ticket.replies).toHaveLength(2);

    // replying to an admin-only reply moves the ticket to IN_PROGRESS
    const updatedTicket = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(updatedTicket.body.ticket.status).toBe("IN_PROGRESS");
  });

  it("rejects an author trying to post an internal note", async () => {
    const author = await createTestAuthor();
    createdUserIds.push(author.user.id);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${author.token}`)
      .send({ subject: "General question", description: "Just a general account question here." });
    const ticketId = createRes.body.ticket.id;

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/replies`)
      .set("Authorization", `Bearer ${author.token}`)
      .send({ body: "trying to sneak an internal note", isInternalNote: true });

    expect(res.status).toBe(403);
  });

  it("prevents an author from replying to someone else's ticket", async () => {
    const authorA = await createTestAuthor();
    const authorB = await createTestAuthor();
    createdUserIds.push(authorA.user.id, authorB.user.id);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${authorA.token}`)
      .send({ subject: "Author A's ticket", description: "This ticket belongs to author A only." });
    const ticketId = createRes.body.ticket.id;

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/replies`)
      .set("Authorization", `Bearer ${authorB.token}`)
      .send({ body: "trying to reply to a ticket I do not own" });

    expect(res.status).toBe(403);
  });

  it("rejects ticket creation with too-short description instead of a 500", async () => {
    const author = await createTestAuthor();
    createdUserIds.push(author.user.id);

    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${author.token}`)
      .send({ subject: "Hi", description: "short" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("allows an admin to override category/priority and assign the ticket to themselves", async () => {
    const admin = await createTestAdmin();
    const author = await createTestAuthor();
    createdUserIds.push(admin.user.id, author.user.id);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${author.token}`)
      .send({ subject: "ISBN looks wrong", description: "The ISBN on Amazon does not match my physical copy." });
    const ticketId = createRes.body.ticket.id;

    const updateRes = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ category: "ISBN_METADATA", priority: "CRITICAL", assignToSelf: true });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.ticket.category).toBe("ISBN_METADATA");
    expect(updateRes.body.ticket.categoryOverridden).toBe(true);
    expect(updateRes.body.ticket.priority).toBe("CRITICAL");
    expect(updateRes.body.ticket.assignedAdmin.id).toBe(admin.user.id);
  });

  it("forbids an author from updating ticket status (admin-only action)", async () => {
    const author = await createTestAuthor();
    createdUserIds.push(author.user.id);

    const createRes = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${author.token}`)
      .send({ subject: "Status check", description: "Trying to change my own ticket status." });
    const ticketId = createRes.body.ticket.id;

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${author.token}`)
      .send({ status: "RESOLVED" });

    expect(res.status).toBe(403);
  });
});

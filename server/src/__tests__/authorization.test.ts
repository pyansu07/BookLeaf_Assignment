import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { createTestAdmin, createTestAuthor, cleanupTestData } from "./testUtils";

const app = createApp();
const createdUserIds: string[] = [];

describe("author data isolation", () => {
  afterAll(async () => {
    await cleanupTestData(createdUserIds);
  });

  it("only returns the logged-in author's own books", async () => {
    const authorA = await createTestAuthor();
    const authorB = await createTestAuthor();
    createdUserIds.push(authorA.user.id, authorB.user.id);

    const res = await request(app).get("/api/books").set("Authorization", `Bearer ${authorA.token}`);
    expect(res.status).toBe(200);
    expect(res.body.books).toHaveLength(1);
    expect(res.body.books[0].id).toBe(authorA.book!.id);
  });

  it("forbids an author from reading another author's book by id", async () => {
    const authorA = await createTestAuthor();
    const authorB = await createTestAuthor();
    createdUserIds.push(authorA.user.id, authorB.user.id);

    const res = await request(app)
      .get(`/api/books/${authorB.book!.id}`)
      .set("Authorization", `Bearer ${authorA.token}`);
    expect(res.status).toBe(403);
  });

  it("forbids an admin from using the author-only books route", async () => {
    const admin = await createTestAdmin();
    createdUserIds.push(admin.user.id);

    const res = await request(app).get("/api/books").set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(403);
  });

  it("forbids an author from creating a ticket against another author's book", async () => {
    const authorA = await createTestAuthor();
    const authorB = await createTestAuthor();
    createdUserIds.push(authorA.user.id, authorB.user.id);

    const res = await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${authorA.token}`)
      .send({ bookId: authorB.book!.id, subject: "Test subject", description: "Test description long enough" });

    expect(res.status).toBe(400);
  });

  it("lets an admin see tickets across all authors", async () => {
    const admin = await createTestAdmin();
    const author = await createTestAuthor();
    createdUserIds.push(admin.user.id, author.user.id);

    await request(app)
      .post("/api/tickets")
      .set("Authorization", `Bearer ${author.token}`)
      .send({ subject: "Admin visibility check", description: "Checking admin can see all tickets" });

    const res = await request(app).get("/api/tickets").set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.tickets.some((t: { subject: string }) => t.subject === "Admin visibility check")).toBe(true);
  });
});

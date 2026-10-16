import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { createTestAuthor, cleanupTestData } from "./testUtils";

const app = createApp();
const createdUserIds: string[] = [];

describe("auth", () => {
  afterAll(async () => {
    await cleanupTestData(createdUserIds);
  });

  it("logs in with correct credentials and returns a token", async () => {
    const { user } = await createTestAuthor(false);
    createdUserIds.push(user.id);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf("string");
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.role).toBe("AUTHOR");
  });

  it("rejects an incorrect password", async () => {
    const { user } = await createTestAuthor(false);
    createdUserIds.push(user.id);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  it("rejects an unknown email without leaking whether the account exists", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "whatever123" });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password");
  });

  it("rejects malformed login payloads with a 400, not a 500", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects requests to protected routes with no token", async () => {
    const res = await request(app).get("/api/books");
    expect(res.status).toBe(401);
  });

  it("rejects requests with a garbage token", async () => {
    const res = await request(app).get("/api/books").set("Authorization", "Bearer garbage.token.value");
    expect(res.status).toBe(401);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

const completeWithAiMock = vi.fn();
vi.mock("../modules/ai/aiProvider", () => ({
  completeWithAi: (...args: unknown[]) => completeWithAiMock(...args),
}));

import { classifyAndPrioritize, draftResponse } from "../modules/ai/ai.service";

describe("AI classification and drafting (provider mocked, no paid calls)", () => {
  afterEach(() => {
    completeWithAiMock.mockReset();
  });

  it("parses a valid classification response from the model", async () => {
    completeWithAiMock.mockResolvedValue('{"category":"ROYALTY_PAYMENTS","priority":"HIGH"}');

    const result = await classifyAndPrioritize({
      subject: "No royalty in 6 months",
      description: "I have not received any royalty payout in six months.",
    });

    expect(result).toEqual({ category: "ROYALTY_PAYMENTS", priority: "HIGH" });
  });

  it("handles a response wrapped in markdown code fences", async () => {
    completeWithAiMock.mockResolvedValue('```json\n{"category":"PRINTING_QUALITY","priority":"MEDIUM"}\n```');

    const result = await classifyAndPrioritize({
      subject: "Blurry pages",
      description: "My author copies arrived with blurry print and misaligned pages.",
    });

    expect(result).toEqual({ category: "PRINTING_QUALITY", priority: "MEDIUM" });
  });

  it("returns null (not a throw) when the model returns invalid JSON", async () => {
    completeWithAiMock.mockResolvedValue("I think this is a royalty issue, high priority.");

    const result = await classifyAndPrioritize({ subject: "x", description: "y" });
    expect(result).toBeNull();
  });

  it("returns null when the model returns an out-of-schema category", async () => {
    completeWithAiMock.mockResolvedValue('{"category":"NOT_A_REAL_CATEGORY","priority":"HIGH"}');

    const result = await classifyAndPrioritize({ subject: "x", description: "y" });
    expect(result).toBeNull();
  });

  it("returns null when the provider is down/rate-limited (ticket creation must still work)", async () => {
    completeWithAiMock.mockResolvedValue(null);

    const result = await classifyAndPrioritize({ subject: "x", description: "y" });
    expect(result).toBeNull();
  });

  it("drafts a response using only the category-relevant knowledge base section", async () => {
    completeWithAiMock.mockImplementation(async (req: { system: string; user: string }) => {
      expect(req.system).toContain("80/20 royalty split");
      expect(req.system).not.toContain("free reprint"); // printing KB section should not leak in
      return "Thank you for reaching out about your royalty...";
    });

    const draft = await draftResponse({
      subject: "Royalty question",
      description: "Why is my royalty so low?",
      category: "ROYALTY_PAYMENTS" as never,
      authorName: "Test Author",
    });

    expect(draft).toContain("royalty");
  });

  it("returns null when drafting fails so admins can still write manually", async () => {
    completeWithAiMock.mockResolvedValue(null);

    const draft = await draftResponse({
      subject: "x",
      description: "y",
      category: "GENERAL_INQUIRY" as never,
      authorName: "Test Author",
    });

    expect(draft).toBeNull();
  });
});

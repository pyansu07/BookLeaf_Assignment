import { z } from "zod";
import { TicketCategory, TicketPriority } from "@prisma/client";
import { completeWithAi } from "./aiProvider";
import { CATEGORY_LABELS, KB_BY_CATEGORY, TONE_GUIDELINES } from "./knowledgeBase";

const CATEGORY_VALUES = Object.values(TicketCategory) as [TicketCategory, ...TicketCategory[]];
const PRIORITY_VALUES = Object.values(TicketPriority) as [TicketPriority, ...TicketPriority[]];

const classificationSchema = z.object({
  category: z.enum(CATEGORY_VALUES),
  priority: z.enum(PRIORITY_VALUES),
});

export interface ClassificationResult {
  category: TicketCategory;
  priority: TicketPriority;
}

export interface TicketContext {
  subject: string;
  description: string;
  bookTitle?: string | null;
  bookStatus?: string | null;
}

function stripCodeFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
}

/**
 * Classification + priority scoring in a single call (one round trip instead
 * of two) to keep token/API cost down.
 */
export async function classifyAndPrioritize(ticket: TicketContext): Promise<ClassificationResult | null> {
  const categoryList = CATEGORY_VALUES.map((c) => `${c} (${CATEGORY_LABELS[c]})`).join(", ");

  const system = `You are a ticket triage assistant for BookLeaf Publishing, a self-publishing company. Classify the support ticket into exactly one category and assign a priority. Respond with strict JSON only, no prose, no markdown fences: {"category": "<ONE_OF_${CATEGORY_VALUES.join("|")}>", "priority": "<ONE_OF_${PRIORITY_VALUES.join("|")}>"}.

Category guide: ${categoryList}.

Priority guide:
- CRITICAL: money owed for a long time with no explanation, data/ISBN errors affecting a live book, or anything suggesting the author may escalate publicly.
- HIGH: ISBN/metadata errors, quality defects, royalty clearly overdue beyond the 45-day window.
- MEDIUM: standard status questions, distribution/availability issues, royalty amount questions.
- LOW: cosmetic requests, general informational questions (e.g. "can I update my bio").`;

  const user = `Subject: ${ticket.subject}
Book: ${ticket.bookTitle ?? "General / Account Level"}${ticket.bookStatus ? ` (status: ${ticket.bookStatus})` : ""}
Description: ${ticket.description}`;

  // Generous budget: reasoning-capable models (e.g. gpt-oss-120b) spend a chunk of
  // max_tokens on an internal reasoning trace before emitting the final JSON.
  const raw = await completeWithAi({ system, user, maxTokens: 300, jsonMode: true });
  if (!raw) return null;

  try {
    const parsed = JSON.parse(stripCodeFence(raw));
    return classificationSchema.parse(parsed);
  } catch {
    return null;
  }
}

export interface DraftContext extends TicketContext {
  category: TicketCategory;
  authorName: string;
  royaltyPending?: number | null;
}

/**
 * Only the KB section for the ticket's own category is sent, not the whole
 * knowledge base, to keep the prompt small and cheap.
 */
export async function draftResponse(ctx: DraftContext): Promise<string | null> {
  const kbSection = KB_BY_CATEGORY[ctx.category];

  const system = `You are a BookLeaf Publishing support representative drafting a reply to an author. Write in BookLeaf's voice per these tone guidelines:
${TONE_GUIDELINES}

Relevant BookLeaf policy for this category (${CATEGORY_LABELS[ctx.category]}):
${kbSection}

Rules:
- Only use facts given to you in the ticket context below. Never invent specific dates, amounts, or statuses that were not provided.
- Keep it to 3-5 short paragraphs, plain text (no markdown headers).
- Sign off as "The BookLeaf Team".`;

  const user = `Author: ${ctx.authorName}
Book: ${ctx.bookTitle ?? "General / Account Level"}${ctx.bookStatus ? ` (status: ${ctx.bookStatus})` : ""}
${ctx.royaltyPending != null ? `Royalty pending for this book: Rs. ${ctx.royaltyPending}` : ""}
Subject: ${ctx.subject}
Author's message: ${ctx.description}

Draft a reply.`;

  // Same reasoning-token headroom as classification, plus room for a 3-5 paragraph draft.
  const raw = await completeWithAi({ system, user, maxTokens: 900 });
  return raw?.trim() ?? null;
}

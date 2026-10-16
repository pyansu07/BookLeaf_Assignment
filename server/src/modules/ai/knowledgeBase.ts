import type { TicketCategory } from "@prisma/client";

/**
 * Knowledge base is split per category so a draft call only sends the ~150-200
 * tokens relevant to that ticket, instead of the full BookLeaf KB on every request.
 */
export const KB_BY_CATEGORY: Record<TicketCategory, string> = {
  ROYALTY_PAYMENTS: `
- 80/20 royalty split: 80% of net profit goes to the author, 20% to BookLeaf.
- Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart), and shipping charges.
- Royalties are calculated quarterly and paid within 45 days of the quarter ending.
- Minimum payout threshold is Rs. 1,000; amounts below this roll over to the next quarter.
- Payouts are via bank transfer to the account linked in the author's dashboard.
- Authors can see a line-by-line breakdown per platform in their dashboard.`.trim(),

  ISBN_METADATA: `
- Every book gets a unique ISBN assigned by BookLeaf, registered under BookLeaf's publisher imprint.
- An ISBN error (duplicate, wrong book linked) is treated as HIGH priority and escalated to the production team immediately.
- Give a 48-hour resolution timeline for ISBN/metadata escalations.`.trim(),

  PRINTING_QUALITY: `
- In-house printing (Delhi) handles most orders; overflow goes to Repro India or Epitome Books.
- Standard print turnaround is 5-7 business days from order confirmation.
- Quality issues (misprints, binding defects, color problems) get a free reprint after verification.
- Ask the author to share photos of the defective copy before the reprint is arranged.`.trim(),

  DISTRIBUTION_AVAILABILITY: `
- Books are listed on Amazon India, Flipkart, Amazon US, Amazon UK, and the BookLeaf Store.
- New listings go live 7-10 business days after publication is complete.
- "Currently Unavailable" on a platform is usually a stock sync issue; BookLeaf can trigger a re-sync, live again within 24-48 hours.`.trim(),

  PRODUCTION_UPDATES: `
- Production stages: Manuscript Received -> Editing (if opted) -> Cover Design -> Typesetting -> Proofreading -> ISBN Assignment -> Printing -> Distribution Setup -> Published & Live.
- Authors are emailed at each stage. Delays usually happen at Cover Design (waiting on author approval) and Proofreading (revision rounds).
- Be honest about the reason for delay and give a specific updated timeline; don't blame the author even if the delay is on their side.`.trim(),

  GENERAL_INQUIRY: `
- BookLeaf offers two packages: Standard Free (no upfront cost) and Bestseller Breakthrough (paid, with marketing/distribution add-ons).
- Metadata updates (e.g. book description) can be submitted via the dashboard or by emailing the team; changes reflect on platforms within 3-5 business days.
- BookLeaf operates in India and the US.`.trim(),
};

export const TONE_GUIDELINES = `
- Always empathetic and professional; authors are partners, not customers to manage.
- Acknowledge the author's concern before offering a solution.
- Be specific: use real numbers, dates, and statuses from the ticket context instead of vague reassurance.
- If something is BookLeaf's fault (delayed royalty, ISBN error), own it directly, no deflection.
- If escalation/investigation is needed, give a concrete timeline (e.g. "within 48 hours") instead of an open-ended promise.
- End with a clear next step.`.trim();

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  ROYALTY_PAYMENTS: "Royalty & Payments",
  ISBN_METADATA: "ISBN & Metadata Issues",
  PRINTING_QUALITY: "Printing & Quality",
  DISTRIBUTION_AVAILABILITY: "Distribution & Availability",
  PRODUCTION_UPDATES: "Book Status & Production Updates",
  GENERAL_INQUIRY: "General Inquiry",
};

# Approach Write-Up

## What I prioritized

AI integration and architecture/code quality carry the most weight (25% each), so I treated the ticket lifecycle — create → classify → triage → respond → close — and its AI touch points as the core product, with dashboard polish and file uploads secondary. Every AI failure mode (no key, timeout, rate limit, bad JSON, out-of-schema output) degrades to a manual path instead of breaking ticket creation, and this is tested with the provider mocked. I preferred a smaller feature set I can demonstrably vouch for over a larger one I can't.

Second was the data model and authorization. I read the sample JSON before designing the schema — 10 authors, 18 books, two in production with null financials, several with zero payouts — and modelled `User` / `AuthorProfile` / `Book` / `Ticket` / `TicketReply` around it, with money as `Decimal`. Every service function re-checks resource ownership server-side, not just the JWT role, and internal notes and AI drafts are removed from author responses on the server, not hidden in the UI.

## Trade-offs I made

- **One combined AI call for category + priority** instead of two: half the cost and latency, at the price of a slightly richer prompt.
- **Category-scoped knowledge base**: drafts get only the KB section for the ticket's category plus the tone guidelines, not the whole KB on every call.
- **Draft on open, cached on the ticket**: the brief wants a draft when an admin opens a ticket, which naively means an LLM call per page view. The draft is generated on the first open of an unanswered ticket and stored; reopening is free, and the cache clears only when it goes stale (a new message, or a category change that changes the KB section).
- **Unresolved-first queue**: sorted unresolved → priority → oldest, with tickets past the 48-hour escalation window flagged, so urgent and aging work is visible at a glance.
- **Socket.IO** over raw WebSockets: a heavier dependency, but reconnects and per-author rooms came for free.
- **One `TicketReply` table** for replies and internal notes (a boolean flag): the privacy rule is enforced once at the query layer rather than across two models.
- **File uploads left as UI-only**, as the brief marks them bonus; that time went into AI quality and tests.
- **Free-tier hosting** (Render + Vercel): zero cost, at the price of a cold start after idle, documented in the README.

## How I'd evolve this into production

1. **SLA-driven escalation**: re-raise priority automatically as an unresolved ticket ages, and alert on breaches, rather than only flagging them in the queue.
2. **Pagination and search** on the queue — fine at demo scale, not at 1,200 books a month.
3. **One bounded retry** on AI calls before falling back, to absorb transient provider errors.
4. **Audit log** of status/category/priority/assignment changes (who and when), alongside the existing AI-vs-override flags.
5. **AI quality and cost metrics**: per-call token logging, plus how often admins override the classification or send drafts unedited — the real signal for whether the AI is helping.
6. **Attachments** via presigned S3 uploads with virus scanning.

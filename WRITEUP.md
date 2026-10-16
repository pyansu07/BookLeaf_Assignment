# Approach Write-Up

## What I prioritized

The evaluation criteria weight AI integration and architecture/code quality at 25% each, so I treated the ticket lifecycle (create → classify → triage → respond → close) and its AI touch points as the core product, and everything else — dashboard stats, UI polish, file uploads — as secondary. Concretely: the backend's three AI functions (classify+priority, draft) are unit-tested with the provider mocked, every failure mode (no key, timeout, bad JSON, out-of-schema output) degrades to a manual fallback rather than breaking ticket creation, and the knowledge base is split per-category so drafting never ships the whole KB in a prompt. I'd rather have a smaller feature set that's demonstrably correct than a larger one I can't vouch for in the follow-up conversation.

Second priority was the data model and authorization boundaries, since "architecture & code quality" and "API design" together are 40% of the score. I read the actual sample JSON before touching the schema (10 authors, 18 books, two still in production with null financial fields, several with zero royalty paid) and designed `User`/`AuthorProfile`/`Book`/`Ticket`/`TicketReply` around what that data actually looks like, rather than a generic guess. Every service function that touches a resource re-checks ownership server-side, not just the JWT role — this is tested directly (an author gets 403 reading another author's book, replying to another author's ticket, or creating a ticket against a book they don't own).

## Trade-offs I made

- **No file uploads**, despite the UI having a (disabled) attachment field — the assignment explicitly marks this as bonus. Spending the time on AI prompt quality and test coverage instead felt like the better trade given the weighting.
- **Socket.IO over raw WebSockets/polling** — slightly heavier dependency, but its reconnect-and-room abstraction meant I didn't have to hand-roll presence tracking in the time available, and "real-time or near-real-time" in the brief doesn't mandate a specific transport.
- **Single combined AI call for classification+priority** rather than two separate calls — this halves per-ticket AI cost and latency, at the cost of a slightly more complex single prompt. Given "cost awareness" is explicitly called out as part of the AI Integration criterion, this felt like the right trade.
- **No deployment** for this submission — I spent the available time on getting the core flow, security boundaries, and AI fallback behavior verifiably correct (live-tested through the actual browser UI in both roles, not just curl) rather than provisioning hosting. The README documents exact deploy steps for Railway/Render + a static host, and the app is fully runnable locally with three documented commands.
- **Shared `TicketReply` table for both public replies and internal notes** (one boolean flag) instead of two separate tables — they share every other column, and the privacy boundary is enforced once at the query layer rather than duplicated across two models.

## How I'd evolve this into production

1. **Attachments** via presigned S3 uploads, scanned before author/admin can view them.
2. **Pagination + search** on the ticket queue once ticket volume exceeds a page — currently unpaginated, which is fine at demo scale but wouldn't hold at BookLeaf's actual 1,200 books/month volume.
3. **A retry-once-then-fallback policy** for AI calls, instead of fallback on the first failure, to ride out transient provider blips without burdening the admin.
4. **An audit log** of status/category/priority/assignment changes (who, when) — today only the AI-suggestion-vs-override is tracked, which is useful for measuring AI accuracy but not for ops accountability.
5. **SLA-aware prioritization** — the priority score is currently a single AI judgment at ticket creation; a production version would re-escalate priority automatically the longer a ticket sits untouched (e.g. an OPEN Critical/High ticket older than 24h should surface itself more aggressively in the queue, not just sort by priority-then-age as it does now).
6. **Token-bucket cost tracking** on the AI module — right now cost control is structural (one combined call, category-scoped KB, lazy drafting); at production scale I'd add actual per-call token/cost logging to catch regressions.

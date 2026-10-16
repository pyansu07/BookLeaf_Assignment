# BookLeaf Author Support & Communication Portal

A two-sided support ticketing system for BookLeaf Publishing: authors raise queries about their books/royalties, and BookLeaf's ops team triages, classifies, prioritizes, and responds to them with AI assistance.

Built for the BookLeaf Technical Assignment (Assignment 1 of 2).

## Contents

- [Quick start](#quick-start)
- [Demo credentials](#demo-credentials)
- [Architecture](#architecture)
- [AI integration](#ai-integration)
- [API reference](#api-reference)
- [Security](#security)
- [Testing](#testing)
- [Deployment](#deployment)
- [Known limitations / what I'd do with more time](#known-limitations--what-id-do-with-more-time)

## Quick start

Requires Node.js 20+, and PostgreSQL (local install, or Docker).

### 1. Database

```bash
docker run -d --name bookleaf-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bookleaf -p 5432:5432 postgres:16-alpine
```

If port 5432 is already in use locally, map to another port (e.g. `-p 5433:5432`) and adjust `DATABASE_URL` below accordingly.

### 2. Backend

```bash
cd server
cp .env.example .env     # edit DATABASE_URL/JWT_SECRET if needed; AI_API_KEY is optional
npm install
npx prisma migrate dev --name init
npm run seed              # loads the 10 authors / 18 books from bookleaf_sample_data.json + 2 demo tickets
npm run dev                # http://localhost:4000
```

### 3. Frontend

```bash
cd client
npm install
npm run dev                # http://localhost:5173 (proxies /api and /socket.io to :4000)
```

Open http://localhost:5173.

### Environment variables (server/.env)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `JWT_SECRET` | yes | Any long random string |
| `PORT` | no | Defaults to 4000 |
| `CORS_ORIGIN` | no | Defaults to `http://localhost:5173` |
| `AI_PROVIDER` | no | `openai` (default) or `anthropic` |
| `AI_API_KEY` | no | Leave blank to run with AI fully disabled (see [AI integration](#ai-integration)) |
| `AI_MODEL` | no | Defaults to `gpt-4o-mini` |
| `AI_BASE_URL` | no | Overrides the OpenAI-compatible endpoint (e.g. `https://api.groq.com/openai/v1` for Groq) |

## Demo credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@bookleaf.com` | `Admin@123` |
| Author (any of the 10 seeded authors) | e.g. `priya.sharma@email.com` | `Author@123` |

All ten author emails are in `server/prisma/data/bookleaf_sample_data.json`.

## Architecture

**Modular monolith**, not microservices — a 4-day, two-portal ticketing app doesn't need network boundaries between its own modules.

```
server/
  src/
    modules/
      auth/      - login, JWT issuance, password hashing
      books/     - author's own books (read-only)
      tickets/   - ticket CRUD, replies, internal notes, filters
      ai/        - classification, priority scoring, response drafting
    middleware/  - requireAuth, requireRole, centralized error handler
    lib/         - prisma client, JWT helpers, typed AppError
    realtime.ts  - Socket.IO setup (auth handshake + room-based broadcast)
  prisma/        - schema, migration, seed script
client/
  src/
    pages/author/  - Dashboard, My Books, Submit Query, My Tickets
    pages/admin/   - Ticket Queue, Ticket Detail (manage/respond/notes)
    context/       - AuthContext (JWT in localStorage, axios header)
    lib/           - api.ts (axios), socket.ts (Socket.IO client)
```

Each module has a `*.routes.ts` (HTTP), `*.service.ts` (business logic + Prisma calls), and `*.schema.ts` (Zod validation) — handlers stay thin, logic is testable without spinning up Express.

### Data model

Schema derived from the actual shape of `bookleaf_sample_data.json`, not guessed in advance:

- `User` (role `AUTHOR` | `ADMIN`) holds login credentials.
- `AuthorProfile` is a 1:1 extension of `User` holding the author-specific fields (author code, phone, city, joined date) — keeps `User` role-agnostic instead of nullable-author-field soup.
- `Book` belongs to `AuthorProfile`. Money fields (`mrp`, `royaltyPaid`, `royaltyPending`, etc.) are `Decimal(10,2)`/`Decimal(12,2)`, never `Float`, to avoid rounding drift on currency.
- `Ticket` belongs to `AuthorProfile` and optionally to a `Book` (null = General/Account level). Stores both the admin-set `category`/`priority` and the AI's original suggestion (`aiSuggestedCategory`/`aiSuggestedPriority`) plus override flags, so the UI can show "AI suggested X, admin changed to Y" instead of discarding that signal.
- `TicketReply` covers both public replies and private internal notes via `isInternalNote` — one table, not two, since they share every other field and the privacy rule is a single boolean filter at the query layer (`tickets.service.ts` strips internal notes before returning a ticket to an author, it's never filtered in the UI).

Indexes on `status`, `category`, `priority`, `authorProfileId`, and `createdAt` on `Ticket` support the admin queue's filters without a sequential scan at scale.

### Real-time updates

Socket.IO over a single namespace. On connect, the JWT from the handshake is verified and the socket is placed into a room: `author:{authorProfileId}` for authors, `admins` for admin users. A reply or status/category/priority change emits to both the owning author's room and the shared `admins` room, so:
- an author sees a reply land on their "My Tickets" page without refreshing;
- every admin's Ticket Queue updates live when any author submits a new ticket.

Plain WebSockets/polling would also satisfy the assignment; Socket.IO was chosen for its automatic reconnect and room abstraction, which avoided writing that plumbing by hand in the time available.

## AI integration

Three real calls, implemented in `server/src/modules/ai/`:

1. **Classification + priority** (`classifyAndPrioritize`) — **one combined LLM call**, not two, returning `{"category": ..., "priority": ...}` as strict JSON. Combining them halves the per-ticket AI cost versus calling classification and priority scoring separately, with no quality loss since both decisions read the same ticket text.
2. **Response drafting** (`draftResponse`) — triggered on-demand when an admin opens a ticket and clicks "Generate AI draft", **not** on every page load. Sends only the knowledge-base section relevant to that ticket's category (`knowledgeBase.ts` splits the KB by the 6 assignment categories), not the entire BookLeaf knowledge base — a Royalty ticket's prompt never carries the Printing & Quality or ISBN policy text. This keeps each draft prompt to a few hundred tokens instead of the full KB (~1500+ tokens) on every call.

### Prompt strategy

- The classification system prompt lists the 6 exact categories (`Royalty & Payments`, `ISBN & Metadata Issues`, `Printing & Quality`, `Distribution & Availability`, `Book Status & Production Updates`, `General Inquiry`) and a priority rubric distilled directly from the assignment's examples (e.g. "6 months no royalty" → high/critical; "update my bio" → low).
- The drafting system prompt includes BookLeaf's communication tone guidelines verbatim (acknowledge concern first, be specific with real numbers/dates, own BookLeaf's mistakes, give concrete escalation timelines, end with a next step) plus only the category-relevant KB excerpt, and is explicitly told **not to invent** royalty amounts, dates, or statuses that weren't provided in the ticket/book context — the only numbers it can use are the ones the backend hands it from the real `Book` row (e.g. `royaltyPending`).
- The admin never auto-sends a draft: `getAiDraft` only returns a suggestion to the textarea; `POST /tickets/:id/replies` is a separate, explicit action.

### Error handling / graceful degradation

`aiProvider.ts` wraps every call: missing `AI_API_KEY` short-circuits to `null` before any network request; a non-2xx response, timeout (20s abort), or malformed JSON is caught and also resolves to `null` — never thrown. Every caller treats `null` as "AI unavailable" and falls back:
- Ticket creation always succeeds; without a usable classification it defaults to `GENERAL_INQUIRY` / `MEDIUM`, which the admin can override.
- The draft endpoint returns `{"draft": null}`; the admin UI shows "AI draft is unavailable right now... Please write a response manually" and the textarea stays fully usable.
- Classification JSON is also validated against the Zod enum schema after parsing — if the model returns an out-of-schema category, that's treated the same as a failed call (`null`), not trusted blindly.

This is unit-tested in `server/src/__tests__/ai.test.ts` by mocking the provider to return `null`/invalid JSON and asserting the service degrades instead of throwing.

### Cost awareness

- Classification + priority is one call per ticket (not two).
- Drafting sends one KB category section (~150-250 tokens) instead of the full KB.
- Drafting is lazy — only called when an admin explicitly asks for a draft, not on every ticket view or on ticket creation.
- No ticket history or full KB is ever sent wholesale; each call is scoped to exactly the ticket + the single relevant KB section.

### Model choice

The `openai` provider path talks to any OpenAI-compatible `/chat/completions` endpoint, controlled by `AI_BASE_URL`. This repo is currently configured against **Groq's OpenAI-compatible endpoint running `openai/gpt-oss-120b`** (set via `AI_PROVIDER=openai`, `AI_BASE_URL=https://api.groq.com/openai/v1`, `AI_MODEL=openai/gpt-oss-120b`) — Groq's inference is fast and the free tier is sufficient for this assignment's volume. `gpt-4o-mini` (OpenAI) or Claude Haiku (`AI_PROVIDER=anthropic`) work as drop-in alternatives with no code changes, since every provider goes through the same `completeWithAi` interface in `aiProvider.ts`.

One implementation detail worth calling out: `gpt-oss-120b` is a **reasoning model** — it spends part of its `max_tokens` budget on an internal reasoning trace before emitting the final answer. The classification call budgets 300 tokens and drafting budgets 900 (not 60/500) specifically to leave room for that reasoning trace; too low a budget silently truncates the model into emitting nothing, which (correctly) gets treated as an AI failure and falls back to manual/default handling.

## API reference

All routes are under `/api`. Protected routes require `Authorization: Bearer <token>`.

| Method | Path | Role | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | public | Email/password login, returns `{ token, user }`. Rate-limited to 10 attempts/15min/IP. |
| `GET` | `/api/auth/me` | any | Current user from the token. |
| `GET` | `/api/books` | AUTHOR | The logged-in author's own books. |
| `GET` | `/api/books/:id` | AUTHOR | One book (403 if it's not yours). |
| `GET` | `/api/tickets` | any | AUTHOR: own tickets. ADMIN: all tickets, filterable via `?status=&category=&priority=&assignedToMe=&from=&to=`. |
| `POST` | `/api/tickets` | AUTHOR | Create a ticket `{ bookId?, subject, description }`. Runs AI classification server-side. |
| `GET` | `/api/tickets/:id` | any | Full ticket incl. replies. Authors get internal notes filtered out; 403 if it's not your ticket. |
| `PATCH` | `/api/tickets/:id` | ADMIN | Update `{ status?, category?, priority?, assignToSelf? }`. |
| `POST` | `/api/tickets/:id/replies` | any | Add `{ body, isInternalNote? }`. Authors can't set `isInternalNote`; can only reply to their own ticket. |
| `GET` | `/api/tickets/:id/ai-draft` | ADMIN | `{ draft: string \| null }` — null means AI unavailable, write manually. |
| `GET` | `/health` | public | Liveness check. |

Errors are always `{ "error": { "code": "...", "message": "...", "details"?: [...] } }` with a meaningful HTTP status (400/401/403/404/409), never a bare 500 for expected failure modes. Zod validation failures return 400 with per-field `details`.

## Security

- Passwords hashed with bcrypt (cost 10).
- JWT (12h expiry) carries `userId`, `role`, and `authorProfileId`; verified on every protected route via `requireAuth` middleware.
- Role-based access enforced server-side in every service function, not just the UI: an author's `GET /books`, `GET /tickets/:id`, and `POST /tickets/:id/replies` all re-check `authorProfileId` ownership against the resource, not just the JWT role. See `server/src/__tests__/authorization.test.ts`.
- Internal notes are filtered out of the response for authors in `tickets.service.ts` (`getTicketById`) — never sent to the client and then hidden in the UI, which would leak them to anyone inspecting network traffic.
- Role/`authorProfileId` are only ever set server-side from the DB at login; there's no endpoint that accepts a client-supplied role or profile id.
- Login is rate-limited (10/15min/IP) against credential stuffing.
- CORS restricted to `CORS_ORIGIN` (the Vite dev origin / deployed frontend origin).
- `AI_API_KEY` lives only in `server/.env`, read via `process.env` in `config/env.ts`; never sent to or readable from the frontend bundle.

## Testing

```bash
cd server
npm test
```

24 tests across 4 files (Vitest + Supertest against a real Postgres instance):

- `auth.test.ts` — login success/failure, malformed payload → 400 not 500, no-token/garbage-token → 401.
- `authorization.test.ts` — an author only ever sees their own books; 403 reading another author's book; 403 creating a ticket against another author's book; admin sees tickets across all authors.
- `tickets.test.ts` — full lifecycle (create → internal note → public reply → status flips to `IN_PROGRESS`), internal notes hidden from the author's view but visible to admin, author blocked from posting internal notes, author blocked from replying to someone else's ticket, 400 on invalid payload, admin override of category/priority/assignment, author blocked from changing ticket status.
- `ai.test.ts` — classification parses valid/fenced JSON, returns `null` (not a throw) on invalid JSON / out-of-schema values / provider failure, and drafting only includes the category-relevant KB section. **The AI provider is mocked** (`vi.mock("../modules/ai/aiProvider")`) so no paid API call happens in CI.

## Deployment

Not deployed for this submission (see note in the brief write-up on time allocation). To deploy:

- **Backend**: any Node host with a Postgres add-on (Railway/Render both work well for this). Set the env vars above, run `npx prisma migrate deploy && npm run seed` once, then `npm run build && npm start`. `GET /health` is the liveness probe.
- **Frontend**: `npm run build` in `client/` produces a static `dist/` deployable to Vercel/Netlify/any static host. Set the dev proxy's targets (`/api`, `/socket.io`) to the deployed backend URL, or configure `VITE_API_URL`-style env handling if hosting on a different origin than the backend (not currently needed since both were run same-origin via the Vite proxy locally).

## Known limitations / what I'd do with more time

- **File attachments** are UI-only (per the assignment, this is explicitly marked as bonus/not required) — the input is present and disabled with a note; wiring real upload (e.g. S3 presigned URLs) is the obvious next step.
- **No pagination** on the ticket queue — fine at seed-data scale (a handful of tickets), would need cursor pagination once ticket volume grows past a page.
- **No password reset / account management UI** — out of scope per the assignment ("simple email/password is fine").
- **Socket.IO auth is JWT-only, no reconnect-with-refresh** — a token expiring mid-session (12h) would require a re-login rather than a silent refresh; acceptable for a 4-day assignment, not for production.
- **AI drafting is single-shot**, no retry/backoff — a transient provider error just falls back to manual entry rather than retrying once. Reasonable given the "degrade gracefully" requirement, but a production system would add a bounded retry before falling back.
- **Test database is the dev database**, not an isolated test DB — fine for this assignment's scope but in production CI I'd point `DATABASE_URL` at a dedicated ephemeral test database (or testcontainers) rather than running Vitest against the seeded dev data.
- Given more time, I'd add: pagination + search on the ticket queue, a "reopen" workflow for CLOSED tickets, author-side file uploads, and a small audit log of who changed a ticket's status/category/priority and when (useful for ops accountability, not just the AI-vs-admin-override flags that exist today).

@AGENTS.md

# CAConnect — Claude Code Project Context

## Status

V1 is built, deployed, and live at https://www.bevritti.in (Vercel + Supabase,
ap-south-1). All 5 core features, dashboard, email reminder cron, onboarding,
marketing pages, Google sign-in, and plan limits are in place. RLS verified
under attack, 29 unit tests on the deadline engine, a 20-assertion security
suite for the anonymous upload route (`npm run security-check`).

**Open item — config, not code:** Resend can only send to the account owner's
own address until a domain is verified at resend.com/domains. Use
`bevritti.in` (now owned) — e.g. `reminders@bevritti.in` — then set
`RESEND_FROM_EMAIL` in Vercel. Until this is done, the reminder cron runs,
fails cleanly on send, and retries the next day rather than marking anything
as sent. The user will handle this later; do not treat it as a bug to fix in
code.

Two Definition of Done criteria from the build plan are go-to-market, not
buildable: 20 CAs actively using it, and 5 saying they would pay.

**Current phase:** V2, team & retention features. See "V2 Roadmap" below for
what's in scope, what's deferred, and why.

## What We Are Building
CAConnect is an AI-powered practice management tool for small Indian CA firms (1-5 people).
Phase 1 (V1, done): CA-side SaaS only. No marketplace yet.
Phase 2 (V2, next): Two-sided marketplace where users can find, compare, and book CAs, plus team features for growing firms.

## The Problem We Solve
- Small CA firms run their entire practice on WhatsApp and Excel
- Compliance deadlines (ITR, GST, ROC) are tracked manually — missed = client penalties
- Document collection from clients is chaotic — no tracking, all over WhatsApp
- Drafting IT notice responses takes 1-2 hours per notice — AI can do it in 30 seconds
- Fee tracking and follow-ups are manual and unpredictable

## Target User
- Solo CAs or small CA firms (1-5 people) in India
- Managing 20-100 clients across ITR, GST, ROC, company registration services
- Currently using: Tally (accounting only), WhatsApp, Excel, memory
- Willing to pay: ₹999-₹2999/month if it saves them 2+ hours/day

## Tech Stack
- Frontend: Next.js (App Router, currently v16) + Tailwind CSS + shadcn/ui
- Backend: Next.js API Routes (no separate backend in V1)
- Database: Supabase (PostgreSQL) — use Row Level Security always
- Auth: Supabase Auth (email + Google OAuth)
- File Storage: Supabase Storage (for client documents)
- AI: OpenAI via the Responses API, behind a provider abstraction in `lib/ai/`
  - Model is set by the `OPENAI_MODEL` env var (default `gpt-5.6-sol`, chosen
    by benchmark — run `npm run compare-models` before changing it)
  - Never import the OpenAI SDK outside `lib/ai/` — call sites use `lib/ai/provider.ts`
  - We may switch to Claude later; the abstraction is what makes that a one-file change
- Email: Resend (transactional emails and deadline reminders)
- Deployment: Vercel

## V1 Features (Build These Only)
1. Client Management — add/edit clients with PAN, GSTIN, service type tags
2. Compliance Deadline Tracker — pre-loaded Indian deadlines, per-client status
3. Document Collection — checklist per client, unique upload link, no client login needed
4. Fee Tracker — log fee per service, mark paid/overdue, monthly revenue view
5. AI IT Notice Drafter — paste notice or upload PDF → get draft response (ONE AI feature, done well)

## What NOT to Build in V1
- No marketplace or public CA profiles
- No mobile app
- No payment gateway (Razorpay etc.) — just track fees manually for now
- No multi-user/team features
- No complex AI features beyond the IT notice drafter
- No Tally integration

(Multi-user/team features are now IN SCOPE for V2, below — this list describes
V1 only, which is done.)

## V2 Roadmap — Team & Retention Features (current phase)

Decided 2026-09-04, via `/plan-ceo-review`. Full reasoning in that session;
summary here so it survives context resets.

**The call:** V2 per the vision doc is "Marketplace + Team Features." We are
building the TEAM half only right now, not the marketplace half.

**Why:** the vision doc's own roadmap sequences Phase 3 ("Grow Supply," 100
paying CA firms) before Phase 4 ("Marketplace"). We have zero real external
CAs yet — both remaining V1 Definition of Done criteria (20 CAs using it, 5
willing to pay) are still open. Building public profiles, search, booking and
reviews now means designing a two-sided marketplace with no supply, no
demand, and nothing real to review or book — every design choice would be a
guess. The team features below make V1 stickier for the CAs who do join,
which is the actual prerequisite for the marketplace making sense at all.

**Marketplace features (CA Public Profile, User-Facing Marketplace, Booking
System, Reviews & Ratings, Fixed Price Packages) are explicitly DEFERRED.**
Do not build them until the DoD criteria above are met. Revisit then.

### The four features, in build order

1. **AI Client Email Drafter** — build first. Near-zero schema risk, reuses
   `lib/ai/provider.ts` and `lib/ai/openai.ts` unchanged. New: a prompt file
   under `lib/ai/prompts/`, a `client_emails` table, a UI modeled on
   `components/notices/notice-drafter.tsx`. Ships fast, no architecture
   decisions pending.

2. **Firm/staff data model** — the one-way door, built next while there's no
   time pressure from features already sitting on top of it. Confirmed shape:
   a *real multi-user firm*, not lightweight tagging — a second person gets
   their own login and sees only what they're assigned.

   - New tables: `firms (id, owner_id)`, `firm_members (firm_id, user_id, role)`
     with `role` an enum (`owner`, `staff`).
   - Every existing table keeps its `user_id` column, but RLS policies change
     shape from `user_id = auth.uid()` to
     `user_id IN (select firm_id from firm_members where user_id = auth.uid())`
     — meaning `user_id` on domain tables becomes "the firm," not "the person,"
     and a firm's `owner_id` is itself a firm_member row. Every policy in
     `supabase/migrations/0001_init.sql` needs this rewrite; treat it as one
     migration, not a drift.
   - New: invite-by-email flow (a signup path that joins an existing firm
     instead of creating one), and a role check in `lib/auth.ts` alongside
     `requireUser()`.
   - This changes `lib/supabase/admin.ts`'s "three call sites" invariant not
     at all — firm-scoped RLS is still RLS, still not the service-role client.

3. **Staff Task Assignment** — built directly on #2. Assign a client or
   deadline to a `firm_member`; a staff login sees only their queue. Reuses
   `lib/deadlines/queries.ts` and `lib/clients/queries.ts` with an added
   assignee filter — the bucket-by-urgency logic in
   `lib/deadlines/queries.ts` does not change.

4. **Client Portal** — reuses the exact token-auth pattern already built and
   security-tested for document uploads: `lib/documents/tokens.ts`'s 32-byte
   CSPRNG tokens and the `/upload/[token]` public route group. Same shape,
   read-only, persistent instead of one-time — a client's link shows filing
   status, documents, and fees rather than accepting one upload.

**WhatsApp Integration** (the real Meta Business API, not the `wa.me`
prefilled links already shipped in `components/documents/share-link-dialog.tsx`)
is paid and approval-gated externally. Start the Meta WhatsApp Business
verification process in parallel from day one — it has lead time — but the
code integration happens last, after approval clears.

## Database Schema Overview
- users: CA accounts (managed by Supabase Auth)
- profiles: CA firm details, one row per auth user
- clients: each CA's client list (linked to user)
- client_services: service tags per client (ITR, GST, ROC etc.)
- deadline_templates: seeded global Indian compliance rules
- deadlines: compliance deadlines per client per service per period
- document_requests / document_request_items / documents: document collection
- fees: fee records per client per service (amounts in paise, never floats)
- notices: IT notice text + AI-drafted responses

## Coding Rules
- Always use TypeScript — no JavaScript files
- Always use Row Level Security (RLS) in Supabase — never bypass it
  - The ONLY exception is the anonymous client-upload flow, which cannot
    satisfy `user_id = auth.uid()` because the client has no account:
    `app/api/upload/[token]/route.ts` and `lib/documents/public.ts`.
    The scheduled reminder job `app/api/cron/reminders/route.ts` is the third
    and last, since a cron run has no user either; it is guarded by CRON_SECRET.
    Those are the only service-role call sites. Do not add others — if RLS
    is blocking you elsewhere, the policy or the query is wrong.
  - Signed URLs for private storage use the CA's own session, not admin;
    the storage policies already scope them to their user_id prefix.
- Every API route must verify the authenticated user before any DB query
- Use server components in Next.js App Router wherever possible
- Client components only when needed for interactivity
- All forms use React Hook Form + Zod validation
- Never store sensitive data (PAN, GSTIN) unencrypted in client state
- Error messages shown to users must be human-readable, not technical
- Money is stored as integer paise. Format for display via `lib/format.ts`

## Indian Compliance Context (Important for AI Feature)
- ITR filing deadline: 31 July (individuals), 31 October (audit cases)
- GSTR-1 filing: 11th of every month (monthly filers)
- GSTR-3B filing: 20th of every month
- TDS return: quarterly (15 July, 15 October, 15 January, 15 May)
- ROC annual return: within 60 days of AGM
- IT notices are formal — responses must be in proper legal language
- All amounts in Indian Rupees (₹)

## Folder Structure
app/                  → Next.js App Router pages
app/(marketing)/      → Public landing, pricing, how-it-works
app/(auth)/           → Login/signup pages
app/(dashboard)/      → Protected CA dashboard pages
app/upload/[token]/   → Public client upload page (no login)
app/api/              → API routes
components/           → Reusable UI components
components/ui/        → shadcn/ui base components
lib/                  → Utilities, Supabase client, helpers
lib/supabase/         → Supabase client (server + browser + admin)
lib/ai/               → AI provider abstraction + prompts
lib/deadlines/        → Compliance templates + deadline generation
lib/validations/      → Zod schemas shared by forms and API routes
supabase/migrations/  → SQL schema + RLS policies
types/                → TypeScript types
hooks/                → Custom React hooks

## gstack
Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.
Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review,
/design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy,
/canary, /benchmark, /browse, /qa, /qa-only, /design-review, /setup-browser-cookies,
/setup-deploy, /retro, /investigate, /document-release, /document-generate, /codex,
/cso, /autoplan, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade, /learn.

## Skill Routing
When the user request matches an available skill, invoke it.
- Product/feature ideas → /office-hours
- Strategy/scope decisions → /plan-ceo-review
- Architecture/data flow → /plan-eng-review
- Design system/UI plan → /plan-design-review or /design-consultation and /ui-ux-pro-max
- Full review pipeline → /autoplan
- Bugs/unexpected errors → /investigate
- QA on the running app → /qa or /qa-only
- Code review before merging → /review
- Visual/UI polish → /design-review
- Create PR and ship → /ship
- Security audit → /cso

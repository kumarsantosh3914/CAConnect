@AGENTS.md

# CAConnect — Claude Code Project Context

## What We Are Building
CAConnect is an AI-powered practice management tool for small Indian CA firms (1-5 people).
Phase 1 (current): CA-side SaaS only. No marketplace yet.
Phase 2 (later): Two-sided marketplace where users can find, compare, and book CAs.

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
  - Model is set by the `OPENAI_MODEL` env var (default `gpt-5.6-terra`)
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

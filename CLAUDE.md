@AGENTS.md

# CAConnect — Claude Code Project Context

## Status

V1 is built, deployed, and live at https://www.bevritti.in (Vercel + Supabase,
ap-southeast-1). All 5 core features, dashboard, email reminder cron, onboarding,
marketing pages, Google sign-in, and plan limits are in place. RLS verified
under attack, 71 unit tests, and a 39-assertion security suite covering both
token-authenticated anonymous surfaces — the upload route and the client
portal (`npm run security-check`, needs `npm run dev` running).

**Open item — config, not code:** Resend can only send to the account owner's
own address until a domain is verified at resend.com/domains. Use
`bevritti.in` (now owned) — e.g. `reminders@bevritti.in` — then set
`RESEND_FROM_EMAIL` in Vercel. Until this is done, the reminder cron runs,
fails cleanly on send, and retries the next day rather than marking anything
as sent. The user will handle this later; do not treat it as a bug to fix in
code.

Two Definition of Done criteria from the build plan are go-to-market, not
buildable: 20 CAs actively using it, and 5 saying they would pay.

**Current phase:** V2, team & retention features. All four features (AI Client
Email Drafter, firm/staff data model, staff task assignment, client portal) are
done and gated by plan — see "Plan gating" below. WhatsApp is BUILT and
switched off, waiting on Meta approval only (see "WhatsApp Integration"). Work
has now started on the marketplace half of V2, at the user's explicit
direction — see "Marketplace" below.

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

1. **AI Client Email Drafter** — DONE (2026-09-04). Live at `/client-emails`,
   a 5th tab on the client profile, and a nav entry. Four topics
   (deadline reminder, document follow-up, fee reminder, custom), each
   pulling verified facts from the existing deadlines/documents/fees queries
   rather than a blank text box — see `lib/client-emails/context.ts` and
   `lib/ai/prompts/client-email.ts`. Also generalized `lib/ai/provider.ts`
   from a notice-only method to a feature-agnostic `streamText()`, and
   factored the AI rate limit + monthly cap into `lib/ai/guard.ts` /
   `lib/ai/usage.ts`, shared across notices and client emails so usage
   cannot be doubled by splitting it across features. RLS and the shared
   quota both verified live before this shipped.

2. **Firm/staff data model** — DONE (2026-09-04), migrations 0005 and 0006,
   applied to production and verified live. A firm is its own entity; domain
   rows carry `firm_id` for tenancy and `created_by` for provenance. Team
   management lives at `/team`, invites are accepted at `/invite/[token]`.
   Read `supabase/migrations/0005_firms_and_staff.sql` before touching RLS —
   its header explains why legacy firm ids equal the founder's auth uid, which
   is what let the migration run with zero data movement and zero storage
   objects moved.

   Two rules that are enforced in the database, not just the UI: only an owner
   can invite, remove people, or change the plan; and joining an existing firm
   only ever happens through `accept_firm_invite()`, never through an insert
   policy. An early draft allowed any authenticated user to insert themselves
   into any firm they knew the id of — see the migration header.

   Migrations are now applied with `npx supabase db push` (the CLI is linked).
   Run `./scripts/migration-dryrun/run.sh` first for anything touching RLS.

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

3. **Staff Task Assignment** — DONE (2026-09-04), migrations 0007 and 0008,
   applied to production. `clients.assigned_to` and `deadlines.assigned_to`
   both reference `auth.users` with `on delete set null`. `listClients()` and
   `listDeadlines()` take an `assignedTo` filter; the bucket-by-urgency logic
   did not change. New deadlines inherit the client's assignee at sync time
   (`lib/deadlines/sync.ts`) so assigning a client once covers everything
   generated for it afterwards.

   Assignment is a **filter, not a permission**. Any firm member can still see
   and edit any of the firm's rows — RLS stays firm-scoped. `/deadlines?assigned=me`
   is the queue view; `?assigned=unassigned` finds work nobody owns. Read the
   header of `supabase/migrations/0007_assignment.sql` before changing this:
   making assignment an RLS boundary would mean a staff member cannot cover
   for a colleague who is on leave, which is exactly what a 3-person firm needs
   to do. Two guards do exist, both server-side: `assignDeadline()` and
   `updateClient()` reject an assignee who is not a member of the firm, and
   removing a member clears their assignments first so no row points at a
   stranger.

   `toAssignable()` lives in `lib/team/assignable.ts`, deliberately NOT marked
   `'use client'` — Server Components import it too, and marking it client-only
   500s every page that does.

   Migration 0008 exists because `firm_members_delete_by_owner` queried
   `firm_members` from inside its own policy: Postgres raised 42P17 (infinite
   recursion) and member removal silently failed with the UI reporting success.
   The fix is the same `security definer` pattern the other helpers use
   (`auth_owned_firm_ids()`). Any policy on `firm_members` that needs to read
   `firm_members` must go through such a function. The dry-run harness now
   covers removal (`scripts/migration-dryrun/03_invites.sql`) — it did not
   before, which is why this reached production.

4. **Client Portal** — DONE (2026-09-05), migration 0009, applied to production
   and verified live. One permanent read-only link per client at
   `/portal/[token]`, managed from a "Portal" tab on the client profile.

   The token primitive now lives in `lib/tokens.ts` (`generateShareToken`,
   `isValidTokenFormat`) and is shared with document uploads —
   `lib/documents/tokens.ts` re-exports it so no upload call site changed. Two
   generators would drift, and the weaker one becomes the way in.

   `lib/portal/public.ts` is the FOURTH and last service-role call site, for
   the same reason as the other anonymous surface: no `auth.uid()` exists, so
   the token is the credential. Its header lists what the portal may show and
   what it must not. The exclusions are deliberate, not oversights: **draft
   fees** (the CA's own unsent figure), **notices and their AI drafts** (work
   product, and an unreviewed draft in a client's hands is actively harmful),
   internal notes, PAN/GSTIN, and which staff member is assigned. Every query
   is an allow-list of columns, so a column added to `fees` later cannot
   silently surface on a client-facing page.

   Two things worth knowing before changing this:

   - The `client_portals_all_firm` policy checks `client_id in (select id from
     clients)` on top of the usual `firm_id` test. That second clause is not
     redundant — `firm_id` comes from the caller's own session, so a row
     pairing MY firm with ANOTHER firm's client passes the firm test and would
     mint a working portal onto a stranger's client. Do not route it through a
     `security definer` helper; the point is that RLS on `clients` applies.
   - Recording a view goes INSIDE the page's `Promise.all`. A supabase-js
     builder is a thenable that only issues its request when awaited, so
     `void admin.rpc(...)` built a query and sent nothing — the CA saw "Not
     opened yet" forever, which is the one question the feature exists to
     answer.

   Revocation is `is_active = false`, not an `expires_at`; a portal is a
   standing window, not a task with an end. `client_id` is unique, so
   "New link" updates the token in place — an insert-instead-of-update would
   leave the old link alive, and a revocation that does not revoke is worse
   than none. Re-enabling a revoked portal always mints a fresh token.

### Plan gating (2026-09-05)

The V2 features shipped ungated: `lib/plans.ts` capped only clients and AI
drafts, so a free Starter firm got unlimited staff seats and unlimited client
portals — the exact bundle the vision doc prices at ₹2,999/month, and roadmap
Phase 5 ("ACV grows to ₹2,499/firm") depends on. Now gated:

| | Starter | Solo | Pro | Team |
|---|---|---|---|---|
| Seats (incl. owner) | 1 | 1 | 3 | ∞ |
| Client portal | — | — | yes | yes |

**Pro gets 3 seats deliberately, deviating from the vision doc**, whose pricing
table gives Pro no multi-user at all. That table contradicts the doc's own
persona for the tier — Priya, a "3-person firm with 120+ clients" — and 150
clients is not a one-person workload. Decided with the user on 2026-09-05.

Three rules, all of which have a reason:

- **Enforced in server actions, not RLS.** A plan cap is a billing rule, not a
  tenancy boundary. Same place and shape as the existing client cap in
  `app/(dashboard)/clients/actions.ts`. RLS stays about who owns what.
- **Pending invites count against seats**, or a one-seat firm sends five
  invitations and all five land — the cap discovered by the fifth person at the
  moment they accept. Expired invites do NOT count, since they can never be
  accepted and the owner has no way to reclaim that seat.
- **Downgrading never breaks a live client portal.** `createClientPortal`
  refuses on a plan without portals, and "New link" routes through it so a
  downgraded firm cannot rotate a token either — but existing links keep
  serving. The person a dead link punishes is the CA's client, who did nothing
  and cannot fix it. `revokeClientPortal` is deliberately never gated: turning
  something off must always be possible.

Known and accepted: `accept_firm_invite()` does not re-check the seat cap, so
an invite sent on Pro can still be accepted after a downgrade to Solo. Invites
expire, which bounds the window, and closing it would mean teaching the
SECURITY DEFINER RPC about plan tiers for a case that cannot happen without a
manual downgrade. Revisit if self-serve billing ever lands.

The pricing page and landing page read seats and portal entitlement straight
off `PLANS`, but the feature-comparison rows are hand-maintained — update
`app/(marketing)/pricing/page.tsx` when you change a limit.

### WhatsApp Integration — BUILT, switched off (2026-09-05)

Migration 0010, `lib/whatsapp/`, `app/api/webhooks/whatsapp/`. Everything is
in place and inert; the only thing left is Meta's approval, which is not ours
to give. `.env.example` carries the full setup order — **do that in order**,
the business verification is the long pole.

- **The flag is deliberately separate from the credentials.** `whatsappStatus()`
  requires `WHATSAPP_ENABLED=true` AND the credentials. Having keys in the
  environment must never be enough to start messaging a CA's real clients; a
  half-configured deploy that did would be a trust incident, not a bug. It
  returns a *reason* when off, so the cron reports
  `"whatsapp": "disabled (…)"` rather than silently doing nothing — which is
  indistinguishable from broken.
- **Templates are a contract, not documentation.** Meta must pre-approve every
  business-initiated message, and the parameter count must match exactly or
  every send fails with a 132000 error. `lib/whatsapp/templates.ts` holds the
  exact body text to register. Editing a word on one side and not the other
  breaks sending or silently reorders parameters, so the unit tests count
  `{{n}}` placeholders against the params built.
- **`email_log` became `message_log`** with a `channel` column, and the dedupe
  key is now `(channel, kind, subject_id, variant)`. Without `channel`, a
  deadline emailed at T-1 could never also go out on WhatsApp — the second
  channel would collide and vanish.
- **One reminder per deadline, not one per channel.** The cron tries WhatsApp
  first (India reads WhatsApp, ignores email), falls back to email, and skips
  email entirely if WhatsApp already went. On a WhatsApp failure it KEEPS the
  claim with the error recorded rather than releasing it — releasing would
  retry tomorrow and tell the client about the same filing twice.
- **The webhook's HMAC is its only security.** `app/api/webhooks/whatsapp` is
  public and unauthenticated. It verifies `X-Hub-Signature-256` over the RAW
  body — parse-then-reserialise changes key order and the signature never
  matches — with a constant-time compare, and it only ever UPDATEs status onto
  rows we already wrote. It never inserts, so even a forged callback that
  somehow passed could not put data into the system. It is a service-role call
  site for the same reason the cron is: a webhook has no user.
- The `wa.me` prefilled links in `components/documents/share-link-dialog.tsx`
  are unchanged and need no approval. Those stay the manual path; the API is
  for automation.

### Marketplace — BUILT (2026-09-05), migration 0011

Previously deferred pending 20 CAs / 5 paying. The user directed us to build it
anyway on 2026-09-05; that decision is theirs, and it is recorded here so the
earlier "do not build" note above is not read as still binding.

All five features are live: CA Public Profile (`/ca/[slug]`), User-Facing
Marketplace (`/find-a-ca`), Booking System, Reviews & Ratings, Fixed Price
Packages. The CA manages all of it from `/marketplace`.

**This migration introduced the first public reads in CAConnect.** Until 0011
nothing was readable by `anon`. Marketplace data is public by definition, so
profiles, packages and reviews have real `anon` SELECT policies rather than
another service-role call site — the count stays at five. Two rules keep that
safe:

- Every public policy filters on a publish flag, and packages and reviews
  check the PARENT profile's flag through a join rather than a copy of it on
  their own row. Unpublishing a firm hides its packages and reviews in the same
  instant, with nothing left behind.
- **No contact details live on a public table.** RLS is row-level, not
  column-level, so a public row is public in full. Rather than reach for
  column grants, the CA's email and phone simply are not on `ca_profiles` —
  the booking form is the contact channel. Do not add them.

**Consumers never get accounts** (decided with the user). A booking mints a
32-byte token, the same credential shape as upload links and portals, and that
link is where the consumer sees their booking and later reviews it. So
`reviews.booking_id` is UNIQUE and NOT NULL: "only real bookings can review" is
a schema guarantee, not something code has to remember. A review is offered
only after the CA marks the work completed.

Consumer writes go through three SECURITY DEFINER functions —
`create_booking`, `booking_by_token`, `create_review` — the same pattern as
`accept_firm_invite()`. A permissive anon INSERT on `bookings` would let anyone
set status, commission or client_id; instead every trustworthy value is derived
in the database from rows the caller cannot choose. The price comes from the
package row, never the request body.

**Commission is RECORDED, NEVER COLLECTED.** There is no payment gateway
(that is V3), so the CA and client settle directly exactly as fees already do.
`bookings` stores `quoted_amount_paise`, `commission_rate_bps` (basis points,
800 = 8%) and a frozen `commission_paise`, so GMV and commission-owed are
measurable from the first booking and nothing needs re-modelling when payments
land. Per the vision doc the bearer is `consumer` — the CA keeps their full
fee — and `booking_by_token` deliberately does not return the commission
columns: what the platform earns is not the buyer's business.

Two behaviours worth keeping:

- Accepting a booking creates a client automatically. If the firm is at its
  plan's client cap the booking is STILL accepted and the CA is told
  separately — refusing inbound revenue over a billing limit would be the
  wrong trade every time.
- A CA can read their reviews but there is no insert, update or delete policy
  for them. A CA who could edit their own reviews makes the whole rating
  worthless.

The CA is not emailed from the booking action: it runs as `anon` for a
logged-out visitor, and a function that handed out CA emails to anyone who
asked would be a harvesting endpoint. The reminder cron notifies them instead,
where the service-role key can see firm addresses safely.

Not built, deliberately: featured/premium placement is only a column
(`is_featured`) and an ordering rule — there is no billing for it.

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
- client_portals: one persistent read-only link per client (V2)
- message_log: what was sent, per channel (email/whatsapp), with dedupe + delivery status
- ca_profiles / ca_packages: the opt-in public listing and its fixed prices (V2)
- bookings: consumer enquiries; commission recorded, never collected (V2)
- reviews: one per booking, which is what makes them verified (V2)

## Design notes

**Statutory ledger — the visual direction (2026-09-05).** Chosen with the user
after a frontend engineer's feedback that the site read as "vibe coded". The
old look — Geist + untouched shadcn defaults + a palette where 59 of 62 tokens
were pure greyscale — is the exact fingerprint of a generated Next.js app, and
it was recognisable in about a second.

The identity is carried by **structure, not colour**: hairline rules where a
template puts card borders, ruled schedules instead of feature-card grids,
figures right-aligned and tabular, section labels set like clause markers.
That was deliberate — warm cream + display serif + terracotta is *itself* an
AI house style now, so the ground is cool paper (a government form) rather than
cream.

- `--brand` is the stamp ochre and is spent SPARINGLY: section markers and one
  label on the drafted reply. It is deliberately **not** `--primary`, so
  buttons stay ink navy and read authoritative rather than branded. The moment
  ochre is on every button it stops meaning anything.
- `--verified` is a filing green for filed/paid states, kept distinct from the
  brand so semantic colour never competes with identity.
- `--radius` is `0.25rem`. Ten-pixel rounding reads as a consumer app.
- `--rule` is a first-class token because hairlines do the work here.

**Typefaces are chosen from the subject:** Public Sans was drawn for the US Web
Design System — a face for government forms; Source Serif carries the register
of a statutory letter in headings; IBM Plex Mono has true tabular figures, and
every screen is a column of rupees and due dates.

**Fonts have silently broken twice.** `app/globals.css` maps `--font-sans` /
`--font-mono` / `--font-heading` onto the `--font-body` / `--font-mono-figures`
/ `--font-display` variables that `app/layout.tsx` defines via next/font. Once
`--font-sans` referenced itself; once the mapping was left pointing at deleted
Geist variables. Both times every page fell back to the browser serif and
rendered in Times. `html` now sets `font-family` directly rather than relying
on `@apply font-sans`. **If text ever looks like a Word document, check those
three lines against layout.tsx before anything else.**

**Dark mode is written but dormant.** A full dark palette exists under `.dark`,
but nothing in the app ever sets that class — there is no theme provider. It is
ready if one is added; until then it is unreachable, not broken.

**Product screenshots** live in `public/product/` and are captured from a real
seeded account. They are the landing page's main credibility asset — re-shoot
them whenever the app chrome changes, or the marketing page will advertise a
product that no longer looks like that.

**Two audiences.** Since the marketplace shipped, the marketing header serves
both CAs and people looking to hire one. The concrete problem is that the
header's primary button is "Start free" even on `/find-a-ca`, and `/signup`
tells whoever clicks it to "set up your firm". Consumer entry points
(`/find-a-ca`, `/ca/[slug]`) do exist and work; it is the shared CTA that
misdirects. Open, and the user's call.

## Coding Rules
- Always use TypeScript — no JavaScript files
- Always use Row Level Security (RLS) in Supabase — never bypass it
  - The ONLY exception is the anonymous client-upload flow, which cannot
    satisfy `user_id = auth.uid()` because the client has no account:
    `app/api/upload/[token]/route.ts` and `lib/documents/public.ts`.
    The scheduled reminder job `app/api/cron/reminders/route.ts` is the third,
    since a cron run has no user either; it is guarded by CRON_SECRET. The
    fourth is `lib/portal/public.ts` (with `app/api/portal/[token]/document/[id]`),
    the client portal — same anonymous, token-as-credential shape as uploads.
    The fifth is `app/api/webhooks/whatsapp/route.ts`, which has no user either
    and is authenticated by an HMAC over the raw body instead.
    Those five are the only service-role call sites. Do not add others — if RLS
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
app/portal/[token]/   → Public client portal, read-only (no login)
app/booking/[token]/  → Public consumer booking + review (no login)
app/(marketing)/find-a-ca, /ca/[slug] → Public marketplace
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

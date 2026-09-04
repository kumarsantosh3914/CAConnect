# CAConnect

AI-powered practice management for small Indian CA firms (1–5 people).

V1 is CA-side only: client management, a compliance deadline tracker, document
collection, fee tracking, and an AI drafter for Income Tax and GST notices.
No marketplace, no mobile app, no payment gateway — those are V2 and V3.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript, Tailwind 4 |
| UI | shadcn/ui on Base UI |
| Database, auth, storage | Supabase (PostgreSQL) with RLS on every table |
| AI | OpenAI via the Responses API, behind `lib/ai/provider.ts` |
| Email | Resend |
| Hosting | Vercel |

## Setup

```bash
npm install
cp .env.example .env.local     # then fill it in
```

Apply the migrations in `supabase/migrations/` in order — either with the
Supabase CLI (`npx supabase db push`) or by pasting them into the SQL Editor.

```bash
npm run dev
```

### Environment

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | everything |
| `SUPABASE_SERVICE_ROLE_KEY` | anonymous uploads and the reminder cron. **Server only.** |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | the notice drafter |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | deadline reminder emails |
| `NEXT_PUBLIC_APP_URL` | building client-facing upload links |
| `CRON_SECRET` | guards `/api/cron/reminders` |

## Architecture notes

**Row Level Security is the authorisation model.** Every table carries
`user_id` and a `user_id = auth.uid()` policy. Queries do not filter by
`user_id` themselves — adding a redundant filter would hide a broken policy
rather than expose it.

**Three service-role call sites, and no more.** The key bypasses RLS, so it is
confined to code paths that cannot have a session:

- `app/api/upload/[token]/route.ts` — a client uploading without an account
- `lib/documents/public.ts` — rendering that upload page
- `app/api/cron/reminders/route.ts` — a scheduled job with no user

Anywhere else, if RLS is blocking a query, the policy or the query is wrong.

**Money is integer paise.** Never floats. `lib/format.ts` converts at the edges.

**The AI vendor is swappable.** `lib/ai/openai.ts` is the only file that
imports the OpenAI SDK. Everything calls `lib/ai/provider.ts`. Moving to
Claude means adding a sibling implementation and changing one import.

**Deadline generation is idempotent.** `lib/deadlines/sync.ts` can run on every
client save. New occurrences are inserted with `ignoreDuplicates`, so a filing
already marked Filed is never reset; untagging a service withdraws only
future, still-pending rows and leaves history alone.

## Scripts

```bash
npm run dev              # Next dev server (Turbopack)
npm run build            # production build
npm run lint             # eslint
npm run security-check   # security suite for the anonymous upload route
```

`security-check` needs the dev server running. It exercises the one route
where authorisation is a token rather than RLS — run it after any change to
that route, its helpers, or the storage policies.

## Deployment

Push to a Vercel project and set every variable above. `vercel.json` schedules
the reminder cron for 03:30 UTC (09:00 IST) daily.

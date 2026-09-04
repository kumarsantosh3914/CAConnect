# Deploying CAConnect to Vercel

Ten minutes, in this order. Steps 3 and 4 are the ones people skip and then
spend an hour debugging.

## 1. Import the repo

In the Vercel dashboard for the account you want (**santoshs-projects-add3f33f**):

**Add New → Project → Import** `kumarsantosh3914/CAConnect`

Framework auto-detects as Next.js. Leave the build settings alone — the
defaults are correct.

**Do not deploy yet.** Add the environment variables first, or the first build
will fail on missing Supabase keys.

## 2. Environment variables

Add each to **Production, Preview and Development**. Copy the values from your
local `.env.local` — they are not in this repo, deliberately.

| Variable | Where the value comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://qekvwxakncodrluzrxtr.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` — **secret, server only** |
| `OPENAI_API_KEY` | `.env.local` — **secret** |
| `OPENAI_MODEL` | `gpt-5.6-sol` |
| `RESEND_API_KEY` | `.env.local` |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` until a domain is verified |
| `CRON_SECRET` | `.env.local` |

**`NEXT_PUBLIC_APP_URL`** — leave unset ONLY if you have no custom domain.

The app falls back to `VERCEL_PROJECT_PRODUCTION_URL`, which is what makes the
first deploy work with no configuration. But that variable reports the
`.vercel.app` alias, not your custom domain — and if that alias is not actually
serving your project, every client upload link 404s while the site itself looks
completely healthy.

**The moment you attach a custom domain, set this explicitly:**

    NEXT_PUBLIC_APP_URL=https://www.bevritti.in

Then redeploy. Verify by creating a document request and reading the generated
link: it must be your domain. This is the one setting whose failure is visible
to your CA's client and invisible to you.

Now hit **Deploy**.

## 3. Point Supabase Auth at the deployed domain

Without this, signup and login appear to work and then bounce users to
localhost. It is the most common post-deploy failure.

Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: `https://<your-project>.vercel.app`
- **Redirect URLs**, add both:
  - `https://<your-project>.vercel.app/auth/callback`
  - `https://*-santoshs-projects-add3f33f.vercel.app/auth/callback` (preview builds)

## 4. Check the region

Supabase dashboard → **Settings → General → Region**.

If the project is not in `ap-south-1` (Mumbai), every query your Indian CAs
make pays a cross-continent round trip. Fixing it means recreating the project
and re-running the migrations, so it is far cheaper to check now than later.

## 5. Verify the deploy

Work through these against the live URL, in order:

- [ ] Landing page loads
- [ ] Sign up with a real email, confirm it, land on onboarding
- [ ] Add a client with a service tag — deadlines appear
- [ ] Create a document request, open the WhatsApp link, and **check the URL
      in the message is the Vercel domain, not localhost**
- [ ] Open that link on a phone and upload a photo
- [ ] Paste a notice into the drafter and get a reply
- [ ] Trigger the cron by hand:
      `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/reminders`

## 6. What will still be broken, and why

**Google sign-in** returns an error. The button is wired, but the provider is
not configured. To enable it: create OAuth credentials in Google Cloud Console,
add the callback `https://qekvwxakncodrluzrxtr.supabase.co/auth/v1/callback`,
then paste the client ID and secret into Supabase → Authentication → Providers
→ Google. Email and password work without any of this.

**Reminder emails only reach your own address.** Resend refuses other
recipients until a domain is verified. Verify one at resend.com/domains, then
change `RESEND_FROM_EMAIL` to an address on it. Until then the cron runs, fails
cleanly, and retries the next day rather than marking the email as sent.

**Cron on Hobby** runs once a day and the exact minute is not guaranteed. The
schedule in `vercel.json` is 03:30 UTC, which is 09:00 IST — the right time for
a reminder to land, and within Hobby's limits.

## 7. After it is live

- Watch the first real signup end to end before telling anyone about it.
- Run `npm run security-check` against production once, with the dev server
  pointed at the deployed database, to confirm the upload route behaves the
  same there.
- Consider making the GitHub repo private. It currently exposes
  `lib/ai/prompts/notice-response.ts`, which is the most valuable file in the
  product.

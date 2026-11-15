# Launch checklist

The v1 app (`~/Documents/squadcal`) stores everything in one `squadcal` key/value table that **any
visitor can read** (verified 2026-11-15: an anonymous request returned all 94 rows, every crew).
v2 replaces it with proper tables under row-level security. Same Supabase project
(`zlzkefhhzrzbturapjth`, org "Suvesiu").

## 1. Database (5 min)
1. Supabase dashboard → SQL editor → paste `supabase/migrations/001_crewcal_v2.sql` → Run.
2. Paste `supabase/verify.sql` → Run. Expect **"Whossup RLS: all checks passed"**. Anything starting
   with `FAIL:` means stop and investigate.
3. Advisors → Security: should show no "RLS disabled" errors for the new tables.

## 2. AI function
    supabase login                       # with the account that owns the Suvesiu org
    supabase link --project-ref zlzkefhhzrzbturapjth
    supabase secrets set GEMINI_API_KEY=...        # a NEW key: the old one lived in the v1 client once
    supabase secrets set ALLOW_ORIGIN=https://<your domain>
    supabase functions deploy ai
Optional: `AI_FREE_MONTHLY` (default 25; keep in sync with `js/config.js`), `GEMINI_MODEL`.

## 3. Auth settings
- Sign In / Providers → **Allow anonymous sign-ins: ON** (guest accounts: invite links and "Get started" need no email).
- Run `supabase/migrations/003_open_join.sql` (new crews join without approval).

URL configuration:
- Site URL = your app URL; add the same URL to Redirect URLs (magic links, confirmations, password reset).
- Email templates: put the Whossup name in the subject lines.
- Turn on "Confirm email" and leaked-password protection. Set a custom SMTP sender before real users
  arrive: Supabase's built-in mailer is rate-limited to a few emails per hour.

## 4. Hosting
Any static host works (no build). Cheapest options:
- **GitHub Pages**: needs the repo public (or a paid plan for private Pages).
- **Cloudflare Pages / Netlify**: free with a private repo; connect the repo, output dir = `/`.
Use HTTPS (the service worker only registers on https).

## 5. Before inviting people
- Replace `hello@whossup.app` (`js/config.js`, `legal.html`) with an inbox you own.
- Read `legal.html`. It's a plain-language draft; have it checked before charging money.
- Affiliate IDs: booking links currently carry none. Sign up for Booking.com / Skyscanner /
  GetYourGuide partner programmes and add your IDs in `bookingLinks()` (`js/logic.js`).

## 6. After everyone has moved to v2
- Run `supabase/migrations/002_lock_old_table.sql` (makes the old table unreachable from browsers; keeps the data).
- `supabase functions delete gemini`: the old function accepts the public anon key, so anyone can spend your quota.

## Later: Pro billing
The upgrade sheet collects a waitlist (`waitlist` table). When ready: Stripe Checkout + a webhook edge
function that sets `profiles.plan = 'pro'` with the service role. The client never writes `plan`.

# CrewCal

**Find the day everyone's free.** Your crew marks their busy days; CrewCal shows the dates that work
for all of you, then helps you plan it, split the bill and chat in one place.

- **Shared availability**: one personal calendar, visible to every crew you're in. The calendar
  highlights days when everyone (iridescent) or most people are free, ranks the best days and finds
  multi-day trip windows. Import busy days from any `.ics` export.
- **Plans & ideas**: create plans, RSVP (in / maybe / can't), see who's free for each idea, export to calendar.
- **AI Discover**: find real events (grounded in Google Search) and group-friendly places, and see
  instantly how many of the crew can make each one. Trip planner with a budget estimate, booking links
  and AI local tips. The crew brief suggests what to do next.
- **Money**: shared expenses, per-currency balances and the fewest payments that settle everyone up.
- **Chat**: realtime group chat per crew.
- **Crews**: invite links, admin approval, roles, multiple crews per person.
- PWA: installable, works offline for the app shell, dark and light themes.

## Run it

    python3 serve.py            # http://localhost:8755/
    open http://localhost:8755/?demo=1     # demo crew, no account, data stays in the browser

No build step and no npm: plain ES modules plus a vendored `lib/supabase.js` (v2.45.4).

## Test

    python3 scripts/test.py     # logic + permission tests (test.html), headless Chrome
    python3 scripts/flows.py    # opens every sheet/dialog at phone + desktop size, fails on console errors
    python3 scripts/shots.py    # screenshots of every screen (light/dark, phone/desktop) into ./shots

`scripts/cdp.py` drives Chrome over the DevTools protocol with only the Python stdlib.

## How it's built

| Path | What |
|---|---|
| `js/api.js` | `SupabaseApi`, the production backend |
| `js/demo.js` | `DemoApi`, the same interface in the browser; mirrors the database's permission rules |
| `js/logic.js` | Pure functions: best days, free windows, event fit, balances, settle-up, .ics import/export, trip budget |
| `js/store.js` | App state and every action (optimistic updates, realtime chat, refresh on focus) |
| `js/ui.js` | Bottom sheets / dialogs, fields, chips |
| `js/views/*` | Calendar, Plans (+ Discover, trip planner), Chat, Money, Crew (+ profile, Pro), onboarding |
| `supabase/migrations/001_crewcal_v2.sql` | Schema + row-level security, the source of truth for who can see what |
| `supabase/verify.sql` | Security self-test: tries every attack as throwaway users, then rolls back |
| `supabase/functions/ai` | Edge function: auth, crew-membership check, monthly quota, server-side prompts, Gemini |

Security model: the browser is never trusted. Every read and write is checked by Postgres RLS;
crews can only be created and joined through `create_group` / `join_group`; nobody can promote or
approve themselves; `plan` (free/pro) is writable only by the server.

Launch steps: see [LAUNCH.md](LAUNCH.md).

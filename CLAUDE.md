# What's Cooking?

A mobile-first web app that settles a household's nightly dinner decision.
Nobody fills in a preference form. Any member starts the evening's
round; six sampled dishes go up; everyone votes; any member ends it. A scoring
formula that weights the least-happy member heavily — plus karma that gives
ground to people who keep losing — picks the winner. Cooked dishes log to a
calendar and feed back into recency and sampling.

The original build plan (all ten steps done) is at
`~/.claude/plans/i-m-making-a-website-prancy-creek.md`. It is history, not a
roadmap — new work does not need to follow it.

## Stack

Next.js 16 (App Router, TypeScript) · Supabase (Postgres, Auth, RLS, Realtime)
· Tailwind v4 · lucide-react · Vercel · vitest.

Supabase schema work goes through the **Supabase MCP server** (`.mcp.json`,
hosted HTTP + OAuth). Migrations are applied with `apply_migration` and
mirrored into `supabase/migrations/` so the schema lives in git. Note that
`execute_sql` returns only the **last** statement's result — a multi-statement
query silently hides the earlier ones.

## Where things live

```
src/lib/scoring/config.ts     every tunable constant, and nowhere else
src/lib/scoring/*.ts          sample, score, taste, karma, dates, random — pure
src/lib/rounds.ts             startRound / closeRound
src/lib/history.ts            calendar, karma board, dish stats
src/lib/dishes.ts             the repertoire
src/lib/taste.ts              the vote history that preference is learned from
src/lib/household.ts          getViewer / requireHousehold / requireNoHousehold
src/lib/*-actions.ts          server actions, one file per area
src/lib/supabase/             browser + server clients, realtime auth, types
src/proxy.ts                  session refresh (Next 16's rename of middleware)
src/app/(app)/                the four tabs, behind a household check
src/app/(onboarding)/         welcome / create / join
public/mark.svg               the brand mark, as supplied
src/app/icon.svg              tab icon — the mark on a ground tile, generated
src/app/apple-icon.png        180px home-screen icon, same tile, generated
supabase/migrations/          mirrored from MCP
```

Route groups do the gating, not the proxy: `(app)` sends anyone without a
household to `/welcome`; `(onboarding)` requires a session and each page
asserts its own precondition. The proxy only refreshes the session — it has no
business making a database round-trip on every request.

## Product rules

- **Auth** is magic link only, custom SMTP via Resend. No passwords.
- **One household per person**, enforced by a unique constraint on
  `household_members.user_id`.
- **Joining** takes a 6-character code plus a household password.
- **Any member** can add a dish; only its creator or the leader can edit or
  archive it.
- **Nothing gates voting.** There is no rating step and no `dish_ratings`
  table: preference is learned from the votes people already cast each evening.
  Someone who joined an hour ago votes tonight, and a household with fifty
  dishes is no harder to join than one with six. This was the point of removing
  rating — do not reintroduce a form that has to be filled in before playing.
- **Rounds are manual.** Any member starts tonight's round, any member ends it.
  There is no 4 PM cutoff, no timer, no cron job, and no `closes_at` column.
  Whoever hasn't voted when a round ends is simply excluded from scoring.
- **Results show the winning dish and nothing else** — no score breakdown.
- **Aggregate taste is never shown.** A member sees their own taste on
  `/dishes`, and nowhere does the UI publish what the household collectively
  thinks of a dish. It is an input to the formula, not a scoreboard; showing it
  invites people to vote against the number instead of saying what they want.
- Refuse to end a round with zero votes; nudge someone to vote first.

## Scoring

Every constant lives in `src/lib/scoring/config.ts`. Scoring and sampling are
pure TypeScript — Postgres does storage and RLS only, so the formula never
exists in two languages.

```
PER-MEMBER SCORE (voters only)
  m = taste(-2..+2, learned) + tonight_vote
  tonight: Yum +2 | Meh 0 | Yuck -3
  never voted on it -> taste 0, so a new member is neither helped nor punished
  a voter who skipped one dish abstains on it; no opinion is invented

TASTE (per member per dish, learned from closed rounds only)
  taste = sum(w*v) / (sum(w) + 2)      w = 0.99^days, v = Yum +2|Meh 0|Yuck -2
  the shrinkage (+2) is what makes one yum worth 0.67 and not 2
  |taste| < 2 falls out of the algebra; no clamp needed
  Yuck is -2 here and -3 above on purpose: the extra point is tonight's veto,
  not a lasting opinion, and dropping it keeps m in [-5, +4]
  tonight's open round is excluded, or one tap would count twice

DISH SCORE
  2*min(m) + mean(m) - recency + karma + jitter

RECENCY (days since last cooked)
  0-2d: 4.0 | 3-5d: 2.0 | 6-9d: 0.8 | 10-14d: 0.3 | 15d+: 0

KARMA (per member, after each round)
  top-voted dish lost -> +1.0 ; won -> -0.75
  decay *= 0.905 per day (~7-day half-life, decided), clamp [-3, +3]
  someone who disliked everything still has a top choice: whatever they
  disliked least
  dish karma term = 0.5 * mean(karma of voters who said Yum tonight)

JITTER uniform(-0.15, +0.15), seeded on (round_id, dish_id) — deterministic
TIEBREAK higher min -> older last_cooked -> stable random
```

Determinism is a design constraint, not an accident: jitter and the final
tiebreak are both seeded on `(round, dish)`, so scoring the same round twice
cannot produce two different winners. Otherwise "End voting" would be a coin
flip anyone could re-roll by refreshing.

**Sampling**, 6 dishes frozen at round start: 3 highest household taste not
cooked in 7 days, 2 with the fewest lifetime votes, 1 wildcard not cooked in 15
days. If a slot can't be filled, relax its window (7→3→0, 15→7→0) then draw at
random. Under 6 active dishes, show them all — this is the day-one path.

On day one every taste is 0, so the favourite slot falls through to fewest
lifetime votes and then the seeded coin. That is how a household bootstraps: the
exploration slots keep putting unfamiliar dishes up, and voting on them is what
teaches the app anyone's taste in the first place. Nothing else feeds it.

## Conventions

- **Next 16 renamed Middleware to Proxy.** Session refresh goes in `proxy.ts`
  at the `src/` root, not `middleware.ts`. Check
  `node_modules/next/dist/docs/` before reaching for older App Router habits.
- **No emojis in the UI, ever.** Icons come from `lucide-react`. The one
  illustration is the brand mark (`public/mark.svg`), and it appears in exactly
  two places: the landing hero at 150px and the login header at 48px. Its
  detail turns to mush below about 40px, so it is not an icon — reach for
  lucide instead. It is decorative wherever the name is already in the markup,
  so both uses carry `alt=""`.
- Design tokens live in `src/app/globals.css` under `@theme`. Use the semantic
  names (`bg-ground`, `text-ink-soft`, `border-line`), never raw hex.
- `ink-soft` and `ink-faint` are tuned to clear WCAG AA (7.19 and 4.53 against
  ground). They carry real content, not decoration — check contrast before
  lightening either.
- Fraunces is the display face and carries dish names; the `.font-display`
  class also engages its `SOFT` and `WONK` axes, which is the whole point of
  choosing it. Figtree handles UI text.
- Single light theme by design. No dark mode.
- Phone-first: 440px cap, bottom tab bar, safe-area insets on all edges.
- Icon-only or icon-plus-span buttons need an explicit `aria-label`; the
  accessible name does not reliably compute from a nested span.

## Things that will bite you

- **This Supabase project grants nothing by default.** RLS policies alone still
  leave every query with "permission denied", while every new table is handed
  TRUNCATE/TRIGGER/REFERENCES for `anon`. A new table needs the same treatment
  as the others: revoke everything, then grant the narrowest thing that works.
- **`SECURITY DEFINER` functions in `public` become `/rest/v1/rpc/` endpoints.**
  RLS helpers therefore live in the `private` schema, which PostgREST does not
  expose. Only `create_household` and `join_household` are meant to be callable.
- **Realtime joins happily as `anon` and then receives nothing.** The browser
  client loads its session lazily, so call `authorizeRealtime()` from
  `src/lib/supabase/realtime.ts` before any `.subscribe()`. A dead channel
  looks exactly like a quiet one.
- **RLS filters, it does not refuse.** An update you are not allowed to make
  succeeds against zero rows. Read the row count if you need to tell someone
  "that isn't yours" — see `updateDish`.
- **React 19 resets a form once its action settles.** Anything worth keeping
  after a failure has to come back out of the action as a default value. Never
  the password.
- **`households` has column-level grants**, so `select("*")` fails on it —
  `password_hash` is readable by nobody. List the columns.
- **Dates are calendar days in the household's timezone**, compared as
  `YYYY-MM-DD` strings. Never build a `Date` from local time; a round scored at
  11pm in Kolkata must not decide it happened tomorrow.

## Testing

- `npm test` — vitest over the scoring module and the calendar maths (47 tests).
- `npm run lint` — **run it before committing.** It catches React hooks rules
  that `npm run build` does not.
- `npm run build` — type-checks as well as compiles.
- For anything involving two people, create a stand-in member with SQL through
  the MCP server (insert into `auth.users`, then `household_members`,
  `member_karma`) and drive the other side from the browser.
  Delete the stand-in afterwards; the cascade cleans up.
- Driving Chrome: click by element `ref` from `read_page`. Coordinate clicks
  frequently miss on the first attempt after a navigation. Chrome also throttles
  background tabs, so a second tab will not visibly update until focused — that
  is the browser, not the code.
- If a page renders like an older version of itself, the dev server is serving
  a stale compiled route. Restart `next dev`.

## Deployment

The product is **What's Cooking?**; the domain is still
`whatsfordinner.online`. Renamed 2026-09-21 without moving the domain, which
was deliberate — the four places the origin is written down have to move
together (see below), and Resend's verification and Supabase's URL config are
both pinned to it. The name appears in `layout.tsx` metadata, the landing hero,
the login title and `global-error.tsx`, and nowhere near a URL.

Live at **https://whatsfordinner.online** — Vercel, deploying automatically
on every push to `main`. Verified in production on 2026-09-21: HTTPS with HSTS,
and the proxy gating `/tonight`, `/dishes`, `/household` and `/calendar` to
`/login` with `next` intact.

- **The apex is canonical**; `www` 308-redirects to it, keeping path and query.
  `NEXT_PUBLIC_SITE_URL`, `og:url` and Supabase's site URL all agree on
  `https://whatsfordinner.online`. Settled 2026-09-21 — if it ever moves, all
  four have to move together, and the env var is baked in at build time so it
  needs a redeploy.
- Supabase → Authentication → URL Configuration must keep both the production
  origin and `http://localhost:3000/**`, or local dev breaks.
- Resend is verified on the domain: magic links reach arbitrary addresses, not
  just the Resend account owner's.

## State of the data

Still the testing phase. As of 2026-09-21 the Supabase project holds one
household with three accounts in it, nine dishes (eight active) and two rounds
carrying 18 votes — all of it the owner's own test accounts, not other people's
dinners. Wiping and reseeding is fair game while that stays true, and the owner
has asked for a clean slate before.

Those 18 votes are now the *only* record of who likes what: with `dish_ratings`
gone, deleting a closed round deletes the taste it taught. The 2026-09-21 round
was deleted and re-run once, on purpose, to exercise the new scoring path.

It will stop being true. Once real housemates are in, fixture rounds and
stand-in members stop being harmless: that history feeds recency, sampling,
karma and now taste itself, so fake rows would skew real dinners. At that point
use a Supabase branch through the MCP server (`create_branch`) for anything
needing a second person or backfilled history, and update this section.

## Open decisions

- There is no way to change a household password once it is set.
- `household_members` has a delete policy so a member can leave, but no UI for
  it, and nothing transfers leadership if the leader goes.

@AGENTS.md

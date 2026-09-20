# What's for Dinner?

A mobile-first web app that settles a household's nightly dinner decision.
Everyone rates the household's dish list once. Any member starts the evening's
round; six sampled dishes go up; everyone votes; any member ends it. A scoring
formula that weights the least-happy member heavily — plus karma that gives
ground to people who keep losing — picks the winner. Cooked dishes log to a
calendar and feed back into recency and sampling.

Full plan: `~/.claude/plans/i-m-making-a-website-prancy-creek.md`

## Stack

Next.js 16 (App Router, TypeScript) · Supabase (Postgres, Auth, RLS, Realtime)
· Tailwind v4 · lucide-react · deployed on Vercel.

Supabase schema work goes through the **Supabase MCP server** (`.mcp.json`,
hosted HTTP + OAuth). Migrations are applied with `apply_migration` and
mirrored into `supabase/migrations/` so the schema lives in git.

## Product rules

- **Auth** is magic link only, custom SMTP via Resend. No passwords.
- **One household per person**, enforced by a unique constraint on
  `household_members.user_id`.
- **Joining** takes a 6-character code plus a household password.
- **Any member** can add a dish; only its creator or the leader can edit or
  archive it.
- **Rating is a hard gate** — a member cannot vote while any active dish is
  unrated, including a dish someone added today.
- **Rounds are manual.** Any member starts tonight's round, any member ends it.
  There is no 4 PM cutoff, no timer, no cron job, and no `closes_at` column.
  Whoever hasn't voted when a round ends is simply excluded from scoring.
- **Results show the winning dish and nothing else** — no score breakdown.
- Refuse to end a round with zero votes; nudge someone to vote first.

## Scoring

Every constant lives in `src/lib/scoring/config.ts`. Scoring and sampling are
pure TypeScript — Postgres does storage and RLS only, so the formula never
exists in two languages.

```
PER-MEMBER SCORE (voters only)
  m = baseline_rating(-2..+2) + tonight_vote
  tonight: Yum +2 | Meh 0 | Yuck -3
  unrated dish -> baseline 0

DISH SCORE
  2*min(m) + mean(m) - recency + karma + jitter

RECENCY (days since last cooked)
  0-2d: 4.0 | 3-5d: 2.0 | 6-9d: 0.8 | 10-14d: 0.3 | 15d+: 0

KARMA (per member, after each round)
  top-voted dish lost -> +1.0 ; won -> -0.75
  decay *= 0.905 per day (~14d half-life), clamp [-3, +3]
  dish karma term = 0.5 * mean(karma of voters who said Yum tonight)

JITTER uniform(-0.15, +0.15), seeded on (round_id, dish_id) — deterministic
TIEBREAK higher min -> older last_cooked -> stable random
```

**Sampling**, 6 dishes frozen at round start: 3 highest household baseline not
cooked in 7 days, 2 with the fewest lifetime votes, 1 wildcard not cooked in 15
days. If a slot can't be filled, relax its window (7→3→0, 15→7→0) then draw at
random. Under 6 active dishes, show them all — this is the day-one path.

## Conventions

- **Next 16 renamed Middleware to Proxy.** Session refresh goes in `proxy.ts`
  at the `src/` root, not `middleware.ts`. Check
  `node_modules/next/dist/docs/` before reaching for older App Router habits.
- **No emojis in the UI, ever.** Icons come from `lucide-react`.
- Design tokens live in `src/app/globals.css` under `@theme`. Use the semantic
  names (`bg-ground`, `text-ink-soft`, `border-line`), never raw hex.
- Fraunces is the display face and carries dish names; the `.font-display`
  class also engages its `SOFT` and `WONK` axes, which is the whole point of
  choosing it. Figtree handles UI text.
- Single light theme by design. No dark mode.
- Phone-first: 440px cap, bottom tab bar, safe-area insets on all edges.

## Commits

Each commit does one meaningful thing and is verified working before the next
one starts.

1. ✅ Scaffold, design tokens, AppShell
2. ✅ Register the Supabase MCP server
3. ✅ Schema + RLS (one migration, mirrored to `supabase/migrations/`)
4. ✅ Auth: magic link, `proxy.ts`, `/login`, `/auth/callback`
5. ✅ Household create / join
6. ✅ Dishes + rating gate
7. ✅ Scoring module + vitest
8. ✅ Voting: start, vote, end
9. ✅ Dashboard: calendar + karma
10. ◐ Deploy + polish — polish done, pushed to a private GitHub repo;
    the Vercel import needs your account

@AGENTS.md

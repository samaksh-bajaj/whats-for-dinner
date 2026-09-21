# What's for Dinner?

A mobile-first web app that settles a household's nightly dinner decision.

Nobody fills in a preference form. Any member starts the evening's round; six
sampled dishes go up; everyone votes; any member ends it. A scoring formula
that weights the least-happy member heavily — plus karma that gives ground to
people who keep losing — picks the winner. Voting is also how the app learns
what each person thinks of each dish, so a new housemate joins and votes the
same evening. Cooked dishes log to a calendar and feed back into recency and
sampling.

**Stack:** Next.js 16 (App Router, TypeScript) · Supabase (Postgres, Auth, RLS,
Realtime) · Tailwind v4 · lucide-react · deployed on Vercel at
[whatsfordinner.online](https://whatsfordinner.online).

## Running it locally

```bash
npm install
cp .env.example .env.local   # fill in the two Supabase values
npm run dev
```

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page (the publishable key) |
| `NEXT_PUBLIC_SITE_URL` | production only — the origin magic links return to |

Sign-in is magic-link only, so the Supabase project also needs:

- **Authentication → URL Configuration**: the site URL, and `<origin>/**` in
  the redirect list. Both `http://localhost:3000` and the deployed URL.
- **Authentication → Emails → SMTP**: custom SMTP (Resend works on its free
  tier). Without it Supabase's built-in sender only delivers to members of
  your own Supabase organization.

## Commands

```bash
npm run dev     # local dev server
npm run build   # production build, with type checking
npm run lint    # eslint
npm test        # vitest — scoring, sampling, karma, calendar maths
```

## How it fits together

```
src/lib/scoring/          every constant, the sampler, the score, karma — pure
src/lib/rounds.ts         startRound / closeRound
src/lib/history.ts        calendar, karma board, dish stats
src/proxy.ts              session refresh (Next 16 renamed Middleware to Proxy)
src/app/(app)/            the four tabs, behind a household check
src/app/(onboarding)/     create / join a household
supabase/migrations/      the schema, mirrored from the Supabase MCP server
```

Scoring and sampling are pure TypeScript so the formula never exists in two
languages: Postgres does storage and row-level security, and nothing else.
Every tunable number lives in `src/lib/scoring/config.ts`.

## Database

The schema is applied through the Supabase MCP server and mirrored into
`supabase/migrations/`. Every table has RLS, scoped through
`private.my_household_id()` — a `SECURITY DEFINER` helper in a schema
PostgREST does not expose, so the policies cannot be called as API endpoints.
Creating and joining a household go through `create_household()` and
`join_household()` rather than table writes, which is what keeps a join code
from being usable to read a household you have not joined.

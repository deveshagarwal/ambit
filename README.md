# Ambit

Autonomous, agentic networking. Members build a node once through a conversational
agent; from then on the community lives as a knowledge graph that your agent searches
on your behalf. Ask for what you need in plain language and it connects you to the
people who can actually help. Earn karma by helping others.

Invite-only during early launch: the public landing collects a waitlist, and real
members join with one-time invite codes so the network grows with real density.

## How it works

1. Request access: the landing page (`/`) collects emails into a waitlist. Hand out
   invite codes to let people in (see the invite loop below).
2. Build your agent persona (`/onboard`): paste your LinkedIn/bio and a short survey;
   the agent extracts skills, experiences, industries, offers, and needs into the graph.
   A brand-new member must enter a valid, unused invite code here.
3. Ask (`/ask`): talk to the network. Your need is embedded, ranked against everyone's
   offer-side vectors with a graph trust boost, and the best people come back with a
   reason for each.
4. Connect: request an intro. A connection edge is recorded, the helper earns cred, and
   the outcome is logged.
5. Community (`/community`): explore the real latent space. In a demo environment
   (`AMBIT_SANDBOX=1`) a sandbox lets you "act as" any seeded member and reseed. This is
   off by default so it can never impersonate a real account in production.

## Architecture

- Next.js 16 / React 19 / Tailwind 4, app router.
- Postgres data layer behind one `query()` seam (`src/lib/store/`): PGlite locally (zero
  setup), hosted Postgres (Vercel Postgres / Neon) in production via `DATABASE_URL`.
  Facts are reified, bitemporal, confidence-scored edges; outcomes are logged from day one.
- AI brain: provider-agnostic OpenAI-compatible client (`src/lib/ai.ts`), defaults to
  DeepSeek. Every AI path has a deterministic fallback, so the app runs with no key.
- See `docs/backend-architecture.md` (the decision doc) and `docs/BACKEND.md` (the running
  implementation, schema, and deploy steps).

## Setup

    npm install
    cp .env.example .env.local   # REQUIRED: Clerk keys; optional: AI_API_KEY, ADMIN_SECRET
    npm run dev                  # uses local PGlite, seeds 45 members on first hit

Clerk keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) are required: the
middleware runs `clerkMiddleware` on every request and the app 500s without them. No
database setup is needed locally. Without an AI key the app uses heuristic onboarding,
keyword need-parsing, and vector + overlap matching. With a key set, the AI paths light up.
Set `AMBIT_SANDBOX=1` locally if you want the `/community` act-as picker and reseed button.

## The invite loop

Invites are one-time codes stored in Postgres. Set `ADMIN_SECRET` to a long random
string, then drive the loop with the admin route:

    # see who's on the waitlist
    curl -H "x-admin-secret: $ADMIN_SECRET" https://YOUR_APP/api/admin/invites

    # mint 5 invite codes
    curl -X POST -H "x-admin-secret: $ADMIN_SECRET" -H "content-type: application/json" \
      -d '{"count":5,"note":"first cohort"}' https://YOUR_APP/api/admin/invites

Email the codes out; each unlocks one persona build at `/onboard`.

## Deploy (Vercel)

1. Push to GitHub, import into Vercel.
2. Add a Postgres store in the Vercel project (Storage -> Postgres); it injects
   `POSTGRES_URL`, which the app picks up automatically.
3. Add Clerk keys (live), `AI_API_KEY` (optional brain), and `ADMIN_SECRET`. Leave
   `AMBIT_SANDBOX` unset in production. Deploy. Schema and seed run on first boot.

## Key files

- src/lib/store/: query layer, schema, repo, graph + vector seams.
- src/lib/match.ts: the matching cascade (vector + graph trust boost + optional LLM rerank).
- src/lib/agent.ts: onboarding/persona extraction, need parsing, the organism turn.
- src/lib/seed.ts: synthetic community generator.
- src/app/api/*: onboard/persona, ask, organism, connect, requests, session, sandbox,
  feed, space, waitlist, and admin/invites routes.
- src/lib/store/access.ts: waitlist + one-time invite code storage and redemption.

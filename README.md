# Weave

Autonomous, agentic networking. Members build a node once through a conversational
agent; from then on the community lives as a knowledge graph that your agent searches
on your behalf. Ask for what you need in plain language and it connects you to the
people who can actually help. Earn karma by helping others.

## How it works

1. Build your agent persona (`/onboard`): import LinkedIn and a short survey; the agent
   extracts skills, experiences, industries, offers, and needs into the graph.
2. Ask (`/ask`): talk to the network. Your need is embedded, ranked against everyone's
   offer-side vectors with a graph trust boost, and the best people come back with a
   reason for each.
3. Connect: request an intro. A connection edge is recorded, the helper earns cred, and
   the outcome is logged.
4. Community (`/community`): explore the real latent space. A demo sandbox lets you "act
   as" any seeded member and reseed at will.

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
    cp .env.example .env.local   # add AI_API_KEY for the real DeepSeek brain (optional)
    npm run dev                  # uses local PGlite, seeds 45 members on first hit

No database setup is needed locally. Without an AI key the app uses heuristic onboarding,
keyword need-parsing, and vector + overlap matching. With a key set, the AI paths light up.

## Deploy (Vercel)

1. Push to GitHub, import into Vercel.
2. Add a Postgres store in the Vercel project (Storage -> Postgres); it injects
   `POSTGRES_URL`, which the app picks up automatically.
3. Add `AI_API_KEY` if using a real brain. Deploy. Schema and seed run on first boot.

## Key files

- src/lib/store/: query layer, schema, repo, graph + vector seams.
- src/lib/match.ts: the matching cascade (vector + graph trust boost + optional LLM rerank).
- src/lib/agent.ts: onboarding/persona extraction, need parsing, the organism turn.
- src/lib/seed.ts: synthetic community generator.
- src/app/api/*: onboard, ask, organism, connect, session, sandbox, feed, space routes.

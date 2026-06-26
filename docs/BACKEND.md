# Weave backend

This is the running implementation of the architecture in `backend-architecture.md`.
Phases 0 and 1 are built: the app runs on Postgres behind swappable seams, with a
reified bitemporal edge model and an outcome log feeding the feedback loop.

## One query layer, two backends

`src/lib/store/client.ts` exposes `query()` / `queryOne()` over Postgres. The backend
is chosen by environment, and nothing above this file knows which is running:

- **Local dev (no `DATABASE_URL`)**: PGlite, an in-process Postgres that persists to
  `./data/weave-pg`. Zero setup. `git clone` and `npm run dev` just works.
- **Production (`DATABASE_URL` or `POSTGRES_URL` set)**: node-postgres pool against a
  hosted Postgres (Vercel Postgres / Neon).

Both speak the same Postgres SQL, so the schema and every query are portable. PGlite's
file storage is ephemeral on serverless, so production must set a connection string.

## Schema (`src/lib/store/schema.ts`)

| Table | Purpose |
|---|---|
| `members` | identity, headline, bio, karma, is_synthetic |
| `edges` | reified, bitemporal, confidence-scored facts. predicate = skill/experience/industry/interest/offer/need. `valid_from`/`valid_to` (world time), `observed_at`/`recorded_at` (system time), `invalidated_at` (invalidate, never delete), plus `weight`, `confidence`, `source` |
| `asks` | posted needs with parsed tags and status |
| `connections` | recorded intros (graph edges between people) |
| `karma_events` | cred ledger |
| `outcomes` | the feedback loop: every `surfaced` / `intro_requested` / `accepted` / `declined`, with score. Labeled training data for future ranking models |

Facts are exposed to callers in the legacy `Attribute` shape (`type` = predicate,
`value` = object_value) by `repo.ts`, so the rest of the app does not deal with the
edge model directly. Only currently-valid facts (`invalidated_at IS NULL AND valid_to
future-or-null`) are returned.

## Seams (swap implementation without touching callers)

- **GraphStore** (`src/lib/store/graph.ts`): `neighborIds`, `expand` (trust paths) via
  Postgres recursive CTEs now. Swap-later: Apache AGE / Neo4j when multi-hop matching is
  load-bearing or edges exceed ~10^8.
- **VectorStore + Embedder** (`src/lib/store/vector.ts`): homegrown TF-IDF over offer-side
  facts, L2-normalized, ranked by cosine in JS. Offers and needs are asymmetric (a
  member's vector is what they can provide, so an incoming need matches an offer).
  Swap-later: a hosted embedding model + pgvector/Qdrant, same interface.
- **Embeddings for the viz** (`src/lib/embed.ts`): full-attribute vectors plus a
  deterministic 3-d projection for the community latent-space canvas.

## Matching cascade (`src/lib/match.ts`)

1. Offer-side vector similarity over the whole community (`rankByOfferSimilarity`).
2. Light graph trust boost: people within 1-2 hops of the asker rank slightly higher.
3. Shortlist (top ~12).
4. If an AI key is set, LLM rerank with full attribute context; else cosine ranking with
   a templated reason.

Every surfaced match is written to `outcomes`; every requested intro too. That log is the
substrate for the learned rankers in later phases.

## Environment

```
DATABASE_URL=            # hosted Postgres for production (Vercel injects POSTGRES_URL)
AI_API_KEY=              # DeepSeek (OpenAI-compatible); fallbacks run without it
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-chat
```

## Local development

```
npm install
npm run dev        # uses PGlite at ./data/weave-pg, seeds 45 synthetic members on first hit
```

Reset local data: delete `./data/weave-pg` (it reseeds on the next request), or POST
`/api/sandbox` to reseed just the synthetic members.

## Deploy to Vercel

1. Push the repo to GitHub and import it into Vercel.
2. In the Vercel project, add a Postgres store (Storage tab -> Postgres). Vercel injects
   `POSTGRES_URL`, which `client.ts` picks up automatically.
3. Add the AI env vars (`AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`) if using a real key.
4. Deploy. The schema is created on first boot (idempotent `CREATE TABLE IF NOT EXISTS`),
   and the synthetic community seeds on the first request.

Route handlers and DB-touching server components run on the Node runtime (`pg` and PGlite
need Node). `next.config.ts` keeps `pg` and `@electric-sql/pglite` out of the bundle.

## What is built vs deferred (per the architecture doc)

- Built: Postgres-with-seams (Phase 0), reified bitemporal edges + outcome logging
  (Phase 1), the matching cascade and graph trust boost, asymmetric offer/need vectors.
- Deferred behind triggers: hosted embeddings + pgvector/Qdrant, Apache AGE / Neo4j,
  Splink entity resolution, Debezium CDC, learned rankers (GraphSAGE / two-tower).

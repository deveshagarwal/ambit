# Weave Research: Ingestion & Extraction

Turning conversations, LinkedIn imports, and member activity into structured knowledge-graph (KG) updates. This is the highest-leverage and highest-risk part of the Weave backend: extraction quality determines match quality, and extraction cost dominates per-member economics at millions of users.

## Key mechanisms

**LLM-based information extraction.** Modern KG population leans on LLMs to do entity, relation, and attribute extraction in one pass, guided by a target schema. The dominant pattern is *schema/ontology-guided extraction via structured outputs* (function calling / JSON schema), which forces the model to emit a typed object (e.g. `{skills: [...], offers: [...], needs: [...]}`) instead of free text. This is far more reliable than prompting for prose and parsing it. Surveys of generative IE confirm the field has converged on constrained, schema-driven generation ([Springer survey](https://link.springer.com/article/10.1007/s11704-024-40555-y)).

**Confidence scoring.** Per-field confidence is essential for a high-precision graph. The practical method is to read token log-probabilities for each emitted field and threshold on them, enabling *field-level* override rather than discarding the whole extraction ([confidence-scoring method](https://medium.com/@vatvenger/confidence-unlocked-a-method-to-measure-certainty-in-llm-outputs-1d921a4ca43c)). Newer verifier-based approaches (e.g. CONSTRUCT) score trust per field for any LLM's structured output ([trustworthiness scoring](https://arxiv.org/pdf/2603.18014)). Low-confidence fields become candidates for human confirmation rather than silent writes.

**Canonicalization before write.** Extracted strings ("React.js", "ReactJS", "react") must map to canonical nodes before they touch the graph. The discipline is: deduplicate and assign stable canonical IDs, then write idempotently. In a graph store this is `MERGE` on a node keyed by canonical ID, which makes the pipeline idempotent (run it ten times, same graph state) provided a uniqueness constraint exists so MERGE does an index lookup instead of a full label scan ([Neo4j entity resolution](https://neo4j.com/developer/industry-use-cases/agnostic/entity-resolution/), [dedup/canonicalization](https://scrapingant.com/blog/data-deduplication-and-canonicalization-in-scraped)). Dedup-at-write keeps the graph clean continuously; dedup-later (periodic entity-resolution jobs) catches near-duplicates that slipped through. Weave needs both.

**Streaming vs batch.** A member finishing a conversation should see their graph update quickly (streaming, event-driven write-back), but bulk LinkedIn imports and re-extraction sweeps are batch. Netflix's real-time graph consumes Kafka topics at ~1M messages/sec to keep a graph current, because batch warehouses cannot deliver the latency ([Netflix real-time graph](https://netflixtechblog.com/how-and-why-netflix-built-a-real-time-distributed-graph-part-1-ingesting-and-processing-data-80113e124acc)). The standard answer is a hybrid (Lambda-style) pipeline: a queue for durable, ordered, replayable writes plus a batch path for backfills ([batch vs streaming](https://medium.com/@krthiak/data-ingestion-design-patterns-batch-streaming-cdc-a-practical-guide-30867b49de33)).

## Tools/frameworks compared (tradeoffs at scale)

**Microsoft GraphRAG.** End-to-end pipeline: LLM entity/relationship extraction, claim extraction, then Leiden community detection and LLM community summaries. Excellent for *retrieval over a document corpus*, but indexing is expensive; Microsoft itself shipped LazyGraphRAG and auto-tuning to cut cost ([GraphRAG project](https://www.microsoft.com/en-us/research/project/graphrag/)). Weave's data is per-member profiles, not a static corpus, so GraphRAG's community-summarization machinery is overkill, though its extraction prompts are a useful reference.

**LangChain `LLMGraphTransformer`.** Prompts an LLM with a schema to emit nodes and relationships; quick to stand up and schema-constrainable. Good prototyping ergonomics, weaker on retrieval control ([Memgraph comparison](https://memgraph.com/blog/improved-knowledge-graph-creation-langchain-llamaindex)).

**LlamaIndex `PropertyGraphIndex`.** More levers for structured extraction and triplet organization; generally outperforms a hand-rolled LangChain setup for turning unstructured docs into queryable graphs ([LlamaIndex vs LangChain](https://medium.com/@tredencestudio/building-better-knowledge-graphs-llamaindex-versus-langchain-9661eefb1bb4)). Best fit if Weave wants a framework rather than raw extraction calls.

**REBEL.** A 400M seq2seq model doing end-to-end relation extraction over 200+ relation types with no ontology ([REBEL](https://github.com/Babelscape/rebel)). Cheap and fast, but fine-tuned LLMs now beat it on accuracy ([zero-shot RE](https://arxiv.org/pdf/2310.05028)). Viable as a cheap *first-pass* extractor to cut LLM volume.

**Diffbot.** A pre-built 10B-entity graph from web crawl; great for *enriching* company/person nodes, but its fixed schema gives little control and full extraction means chaining several paid APIs ([Diffbot](https://www.dbpedia.org/blog/the-diffbot-knowledge-graph-and-extraction-tools/), [alternatives](https://www.scraperapi.com/comparisons/diffbot-alternative/)). Use it to canonicalize companies, not as the primary extractor.

## Recommendation for Weave

Build a thin custom pipeline rather than adopt a heavy framework:

1. **Extractor:** DeepSeek (or any OpenAI-compatible model) with a strict JSON-schema function call producing typed `skills/experiences/industries/interests/offers/needs`, plus per-field log-prob confidence.
2. **Two-speed ingestion:** push every extraction onto a durable queue (Kafka or a lighter managed queue early on); a streaming consumer does canonicalize-then-`MERGE` write-back for live updates, a batch path handles LinkedIn bulk imports and nightly re-extraction.
3. **Canonicalization layer:** maintain canonical skill/company dictionaries; map extracted strings via embedding similarity + alias tables before write; enforce uniqueness constraints so upserts are idempotent index lookups, not scans.
4. **Precision gates:** auto-write high-confidence fields; surface low-confidence ones to the member through the organism agent ("Add *GraphQL* to your skills?"). Member confirmation is the cheapest, highest-precision validator and it doubles as engagement ([KG validation HITL](https://www.sciencedirect.com/science/article/pii/S030645732500086X)).
5. **Cost control:** use the provider Batch API (~50% cheaper) for non-urgent re-extraction and imports ([batch cost savings](https://www.prompts.ai/blog/batch-processing-for-llm-cost-savings)); optionally a REBEL/regex cheap first pass to skip the LLM when nothing new is said.

Defer GraphRAG/Diffbot; revisit Diffbot only for company-node enrichment.

## Pitfalls

- **Hallucinated triples.** LLMs invent facts and over-emit frequent relations; never write unverified high-stakes claims ([TRACE-KG](https://arxiv.org/pdf/2604.03496)). Confidence thresholds + member confirmation mitigate this.
- **MERGE without constraints** silently degrades into full label scans at scale ([Neo4j ER](https://neo4j.com/developer/industry-use-cases/agnostic/entity-resolution/)).
- **No canonicalization** fragments the graph ("React" vs "ReactJS"), wrecking match recall.
- **Extracting on every message** burns tokens; gate on novelty.
- **Streaming complexity:** exactly-once and ordering are hard; start with at-least-once + idempotent writes ([event-driven systems](https://dev.to/devcorner/building-modern-data-systems-event-driven-architecture-messaging-queues-batch-processing-etl--51hm)).

## Sources

- https://link.springer.com/article/10.1007/s11704-024-40555-y
- https://medium.com/@vatvenger/confidence-unlocked-a-method-to-measure-certainty-in-llm-outputs-1d921a4ca43c
- https://arxiv.org/pdf/2603.18014
- https://neo4j.com/developer/industry-use-cases/agnostic/entity-resolution/
- https://scrapingant.com/blog/data-deduplication-and-canonicalization-in-scraped
- https://netflixtechblog.com/how-and-why-netflix-built-a-real-time-distributed-graph-part-1-ingesting-and-processing-data-80113e124acc
- https://medium.com/@krthiak/data-ingestion-design-patterns-batch-streaming-cdc-a-practical-guide-30867b49de33
- https://www.microsoft.com/en-us/research/project/graphrag/
- https://memgraph.com/blog/improved-knowledge-graph-creation-langchain-llamaindex
- https://medium.com/@tredencestudio/building-better-knowledge-graphs-llamaindex-versus-langchain-9661eefb1bb4
- https://github.com/Babelscape/rebel
- https://arxiv.org/pdf/2310.05028
- https://www.dbpedia.org/blog/the-diffbot-knowledge-graph-and-extraction-tools/
- https://www.scraperapi.com/comparisons/diffbot-alternative/
- https://www.sciencedirect.com/science/article/pii/S030645732500086X
- https://www.prompts.ai/blog/batch-processing-for-llm-cost-savings
- https://arxiv.org/pdf/2604.03496
- https://dev.to/devcorner/building-modern-data-systems-event-driven-architecture-messaging-queues-batch-processing-etl--51hm

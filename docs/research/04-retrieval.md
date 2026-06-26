# Retrieval and Matching: The "Who Can Help" Query

Research for Weave, an agentic professional networking app where members are nodes in a knowledge graph and a conversational organism agent matches plainly-stated needs to people who can help.

## Key mechanisms

**Hybrid retrieval is the consensus pattern.** Pure vector search misses relationship and multi-hop questions; pure graph traversal misses fuzzy semantic similarity. The winning pattern runs both, then fuses: take vector hits as seed nodes, expand context via graph traversal, and merge rankings with Reciprocal Rank Fusion (RRF). Benchmarks attribute 15-30% gains in faithfulness and relevancy to hybrid over vector-only, but only with disciplined depth limits, reranking, and caching ([Calmops](https://calmops.com/algorithms/graphrag-hybrid-retrieval/), [Medium/Graph Praxis](https://medium.com/graph-praxis/hybrid-vector-graph-retrieval-patterns-11fdbd800e3e)). For Weave, a need becomes a query embedding plus structured filters (industry, location, availability), retrieves candidate people via ANN, then traverses the graph for trust paths (shared connections, prior successful intros) before reranking.

**Sparse plus dense beats either alone.** Combine BM25 (exact term, rare-skill names like "Rust" or "FDA 510(k)") with dense embeddings (paraphrase, "I need help raising a seed round" matching "early-stage fundraising advisor"). Weaviate's native BM25 + vector fusion is a reference implementation ([tensorblue](https://tensorblue.com/blog/vector-database-comparison-pinecone-weaviate-qdrant-milvus-2025)).

**Embeddings for people and needs.** Embed offers and needs separately so a need vector matches an offer vector (a near-two-tower setup), rather than embedding whole profiles. Top MTEB retrieval models are now 8B-class (Qwen3-Embedding), but smaller hosted models (OpenAI text-embedding-3, Cohere, BGE) are the practical choice for cost and latency ([Ailog](https://app.ailog.fr/en/blog/guides/choosing-embedding-models), [MTEB maintenance paper](https://arxiv.org/pdf/2506.21182)).

**Reranking.** A cross-encoder or LLM reranks the top ~50-100 candidates. Cross-encoders (BGE-reranker-v2 ~0.74 NDCG@10) and Cohere Rerank add ~100-300ms; LLM rerank is more accurate on nuance but 10x the cost and can hit 15s+ if candidates are scored sequentially ([ZeroEntropy](https://zeroentropy.dev/articles/llm-as-reranker-guide/), [Medium/Vaibhav Dixit](https://medium.com/@vaibhav-p-dixit/reranking-in-rag-cross-encoders-cohere-rerank-flashrank-c7d40c685f6a)).

**Matching as bipartite + link prediction.** "Who can help" is need->offer bipartite matching, refined over time by link prediction trained on connection outcomes. Node embeddings (node2vec) and inductive GNNs (GraphSAGE) capture graph structure; GraphSAGE generalizes to unseen nodes, critical for new members ([arxiv 2508.14059](https://arxiv.org/pdf/2508.14059), [PinSage/arxiv 1806.01973](https://arxiv.org/pdf/1806.01973)). The agent itself can do multi-hop reasoning via Self-Ask / self-query planning, converting language into structured filters then chaining traversals ([arxiv 2606.05901](https://arxiv.org/html/2606.05901)).

## Tech compared (tradeoffs at scale)

**ANN indexes.** HNSW gives lowest latency and highest in-memory recall (~0.95) but is RAM-heavy and awkward to update; best under ~100M vectors in RAM. IVF-PQ trades recall (~0.89) for tiny memory; the move once the index outgrows RAM. DiskANN serves billion-scale from SSD with a compressed in-RAM index, the choice when RAM is the hard cap at 100M-1B+ ([abhik.ai](https://www.abhik.ai/concepts/embeddings/ann-comparison), [Couchbase](https://www.couchbase.com/blog/diskann/), [BigData Boutique](https://bigdataboutique.com/blog/hnsw-vs-ivfflat-how-to-choose-the-right-vector-index)).

**Vector databases.** pgvector keeps everything in Postgres (no new service); good under ~10M vectors, and pgvectorscale pushes far higher (471 QPS at 99% recall on 50M vs Qdrant's ~41 QPS in one benchmark). Qdrant excels at filtered queries with sub-5ms p50. Weaviate leads on hybrid BM25+vector fusion. Milvus's disaggregated architecture is the most mature for billion-scale sharding. Pinecone is fastest to ship but cost grows; common path is Pinecone early, self-host (Qdrant/Milvus) past ~50-100M vectors or ~$500+/mo ([tensorblue](https://tensorblue.com/blog/vector-database-comparison-pinecone-weaviate-qdrant-milvus-2025), [vecstore](https://vecstore.app/blog/vector-database-performance-compared)).

**Graph databases / combined.** Neo4j adds a vector index (Lucene-backed) but without index-parameter tuning, so it is weaker than dedicated vector stores; still strong when you need similarity AND deep traversal together. Neptune is managed but its vector index updates are non-atomic. pgvector + Apache AGE (Cypher on Postgres) keeps graph and vector in one engine, attractive for an MVP already on SQLite/Postgres ([Zilliz](https://zilliz.com/blog/pgvector-vs-neo4j-a-comprehensive-vector-database-comparison), [TigerVector/arxiv 2501.11216](https://arxiv.org/pdf/2501.11216), [DEV/Apache AGE](https://dev.to/k1hara/comparison-between-apache-age-and-other-popular-graph-databases-1c9g)).

**Filtering at scale.** Decide pre- vs post-filtering per query by selectivity: pre-filter when the structured constraint is highly selective, post-filter when it is broad; learned query planners now do this adaptively ([arxiv 2602.17914](https://arxiv.org/pdf/2602.17914)).

## Recommendation for Weave

Stay on Postgres and grow inside it. Use **pgvector (HNSW index) + Apache AGE** so vectors, structured attributes, and the graph live in one transactional store, removing sync complexity at MVP and into the low millions. Replace the homegrown TF-IDF/random-projection embeddings with a hosted model (OpenAI text-embedding-3-small or Cohere embed) and embed needs and offers as separate vectors. Retrieval pipeline: BM25 + dense hybrid -> RRF fusion -> AGE graph expansion for trust paths -> cross-encoder or Cohere rerank on top ~50, with DeepSeek only generating the human-readable "why" for the final shortlist (cheaper and lower-latency than LLM reranking everything). Log every accepted/declined intro and karma signal as labeled edges; that becomes link-prediction and learning-to-rank training data and, later, a GraphSAGE/two-tower model. Migration triggers: when ANN exceeds ~10-50M vectors or filtered-query latency degrades, move vectors to **Qdrant** (best filtering) or **Milvus** (billion-scale) while keeping the graph in Postgres/AGE or a dedicated Neo4j. Defer GNNs until you have outcome data; they are costly to train and tune at scale.

## Pitfalls

- Letting embedding freshness lag. New members and updated needs must be embedded in near-real-time, or the agent recommends stale matches; use an event-driven re-embed on profile change, batch backfill otherwise.
- Unbounded graph traversal. Without depth/fanout limits, multi-hop expansion explodes latency and pulls in irrelevant nodes.
- Reranking the whole candidate set with an LLM: 10x cost and seconds of latency; rerank a capped top-k only.
- Trusting a single ANN index choice forever; recall/latency/RAM tradeoffs flip as you cross 10M, 100M, 1B vectors.
- Cold-start and popularity bias: transductive node2vec cannot embed brand-new members, and outcome-trained ranking over-favors already-popular nodes. Prefer inductive methods and add fairness/diversity constraints.
- Filter selectivity ignored: applying broad filters as pre-filters (or selective ones as post-filters) tanks throughput.

## Sources (URLs)

- https://calmops.com/algorithms/graphrag-hybrid-retrieval/
- https://medium.com/graph-praxis/hybrid-vector-graph-retrieval-patterns-11fdbd800e3e
- https://arxiv.org/pdf/2507.03608
- https://tensorblue.com/blog/vector-database-comparison-pinecone-weaviate-qdrant-milvus-2025
- https://vecstore.app/blog/vector-database-performance-compared
- https://www.abhik.ai/concepts/embeddings/ann-comparison
- https://www.couchbase.com/blog/diskann/
- https://bigdataboutique.com/blog/hnsw-vs-ivfflat-how-to-choose-the-right-vector-index
- https://zilliz.com/blog/pgvector-vs-neo4j-a-comprehensive-vector-database-comparison
- https://arxiv.org/pdf/2501.11216
- https://dev.to/k1hara/comparison-between-apache-age-and-other-popular-graph-databases-1c9g
- https://zeroentropy.dev/articles/llm-as-reranker-guide/
- https://medium.com/@vaibhav-p-dixit/reranking-in-rag-cross-encoders-cohere-rerank-flashrank-c7d40c685f6a
- https://app.ailog.fr/en/blog/guides/choosing-embedding-models
- https://arxiv.org/pdf/2506.21182
- https://arxiv.org/pdf/2508.14059
- https://arxiv.org/pdf/1806.01973
- https://arxiv.org/html/2606.05901
- https://arxiv.org/pdf/2602.17914
- https://www.hopsworks.ai/dictionary/two-tower-embedding-model
- https://eng.snap.com/embedding-based-retrieval

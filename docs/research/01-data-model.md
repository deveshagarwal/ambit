# Weave Data Model & Ontology

Research brief for the people/skills/needs knowledge graph powering Weave. Target: millions of members, hundreds of millions of edges. Author: data architecture research, 2026-06.

## Key mechanisms

A people graph is not a generic social graph. It mixes **identity entities** (members), **concept entities** (skills, industries, roles, interests), and **event-like relationships** (offers, needs/asks, connections, karma events). Three mechanisms matter most at scale:

1. **Typed nodes and edges over a curated ontology.** LinkedIn's knowledge graph standardizes "the professional world" as entity taxonomies (members, jobs, companies, skills, titles, schools) plus typed intra- and inter-entity relationships, with confidence scores attached and many relationships ML-inferred rather than user-declared ([LinkedIn Engineering](https://www.linkedin.com/blog/engineering/knowledge/building-the-linkedin-knowledge-graph), [Qi He](https://www.linkedin.com/pulse/linkedin-knowledge-graph-enriches-data-value-qi-he)). The graph is explicitly *dynamic*: entities and edges are added and change continuously ([ML in LinkedIn KG](https://www.linkedin.com/pulse/machine-learning-linkedin-knowledge-graph-qi-he)).

2. **Reified, weighted relationships.** A `(member)-[HAS_SKILL {confidence, source, level}]->(skill)` edge needs its own properties. Both LPG edges and RDF-star support this; a plain RDF triple cannot carry edge metadata without reification or RDF-star ([AI Business on RDF-star](https://aibusiness.com/data/ending-the-rdf-vs-property-graph-debate-with-rdf-)).

3. **Temporal / bitemporal validity.** Skills, offers, and needs expire. Bitemporal modeling tracks **valid time** (true in the world) separately from **transaction/ingestion time** (when the system learned it). Zep's agent memory graph stores four timestamps per edge (valid-from, valid-to, observed, recorded) and *invalidates rather than deletes* superseded facts, so an agent reasons over the current slice while keeping history ([Zep](https://www.getzep.com/ai-agents/temporal-knowledge-graph/), [bitemporal overview](https://www.emergentmind.com/topics/bitemporal-modeling)). This is directly relevant to Weave's conversational organism, which must reason about what a member needs *now*.

## Options compared (with tradeoffs at scale)

**Data model.**
- **RDF / triplestore (e.g. GraphDB, Blazegraph):** strongest semantics via OWL/SHACL reasoning and standard vocabularies, ideal for interoperating with ESCO/schema.org. Cost: edge metadata requires reification or RDF-star, and triple counts explode. Five properties per node becomes ~11 triples; a 100M-triple RDF store is roughly equivalent to a 10M-node LPG, an order of magnitude of overhead ([DZone](https://dzone.com/articles/rdf-triple-stores-vs-labeled-property-graphs-whats), [Enterprise Knowledge](https://enterprise-knowledge.com/cutting-through-the-noise-an-introduction-to-rdf-lpg-graphs/)). Triplestores generally trail LPGs on large-scale traversal analytics.
- **Labeled Property Graph (Neo4j, NebulaGraph, TigerGraph, JanusGraph):** native edge properties, faster traversals, the mainstream choice for social-style workloads. Weaker formal semantics than OWL ([datawalk](https://datawalk.com/property-graph-vs-rdf/)).
- **Relational-with-graph-extension (Postgres + pgvector, recursive CTEs, or Apache AGE):** keeps Weave's existing SQL mental model and ACID; vectors and rows coexist. Deep multi-hop traversals are slower than a native graph engine, but most Weave queries are 1-2 hops (need -> matching people).
- **Hybrid:** LPG for traversal + a separate vector index for semantic match + optional RDF/OWL only for the *skill ontology* layer.

**Engines at million-to-billion scale.**
- **Neo4j:** lowest average query latency and CPU in independent benchmarks; cited as scaling to ~200B nodes / 1T relationships, but horizontal write-sharding (Fabric) is operationally heavy ([MDPI eval](https://www.mdpi.com/2076-3417/13/9/5770), [NebulaGraph benchmark](https://nebula-graph.io/posts/performance-comparison-neo4j-janusgraph-nebula-graph)).
- **NebulaGraph:** built for hundreds of billions of vertices / trillions of edges; slower than Neo4j on small data but clearly faster at large scale; natively distributed ([NebulaGraph](https://nebula-graph.io/posts/best-graph-database-for-enterprise)).
- **TigerGraph:** very fast multi-hop (vendor claims up to 377x on 2-hop) ([NebulaGraph comparison](https://nebula-graph.io/posts/best-graph-database-for-enterprise)).
- **JanusGraph:** open, scales on Cassandra/HBase, but consistently 3-4x slower than Neo4j in benchmarks.

**Taxonomy / ontology.**
- **ESCO:** ~13,890 multilingual Level-4 skill concepts, an OWL ontology, with a free official **crosswalk to O*NET** ([ESCO model](https://data.europa.eu/esco/model), [ESCO-O*NET crosswalk](https://esco.ec.europa.eu/en/about-esco/data-science-and-esco/crosswalk-between-esco-and-onet)).
- **O*NET:** rich US occupation/skill data.
- **schema.org** (`Person`, `Occupation`, `knowsAbout`) for interop.
- **Free-text + embeddings vs controlled vocabulary:** the production pattern is *both*. Map free text to canonical concepts with bi-encoder / contrastive models and cosine similarity over embeddings ([SkillMatch / contrastive bi-encoder](https://arxiv.org/pdf/2601.09119), [ESCoE taxonomy](http://escoe-website.s3.amazonaws.com/wp-content/uploads/2018/08/29113127/ESCoE-DP-2018-13.pdf)). LinkedIn does exactly this: mine phrases, disambiguate via co-occurrence, de-dup with word2vec, then a classifier links text to canonical entities with a confidence score ([LinkedIn Engineering](https://www.linkedin.com/blog/engineering/knowledge/building-the-linkedin-knowledge-graph)).

## Recommendation for Weave

1. **Adopt an LPG model now; defer a distributed engine.** Stay on a relational base (Postgres + pgvector + Apache AGE) for the next phase: ACID, one store for rows + vectors + 1-2 hop graph, and a clean migration from SQLite. Move to **NebulaGraph** only when traversal depth or edge counts (>~10^8 active edges, 3+ hop matching) actually hurt. Do not start on a billion-scale distributed engine you do not yet need.
2. **Model everything as typed nodes/edges with edge properties.** Reify offers, needs, connections, and karma as first-class edges (or event nodes) carrying `weight`, `confidence`, `source`. Make every fact edge **bitemporal** (valid-from/valid-to + recorded), and invalidate rather than delete, mirroring Zep so the organism reasons over the current slice with full history.
3. **Standardize skills against ESCO, keep free text alongside.** Store both the raw member text and a linked canonical ESCO concept (with the O*NET crosswalk for US labor data), resolved by an embedding bi-encoder with a confidence threshold; low-confidence matches stay free-text and feed taxonomy growth.
4. **Plan for supernodes from day one** (popular skills/industries will be hubs).

## Pitfalls

- **Supernodes.** A "JavaScript" skill or a "Tech" industry node will accrue millions of edges; traversals fan out from milliseconds to seconds ([Expero](https://www.experoinc.com/expero-resources/dse-graph-partitioning-part-2-taming-your-supernodes), [Oboe scalability](https://oboe.com/learn/knowledge-graphs-for-software-architecture-1nfdlhx/scalability-and-production-deployment-4)). Mitigate with per-vertex edge limits (Nebula's `max_edge_returned_per_vertex` / Gremlin `limit`), hub replication, and "vertex-centric" indexes so you filter edges before expanding. Never match needs by exhaustively traversing a hub skill node; match via the vector index, then verify on the graph.
- **Sharding a power-law graph** by random node id breaks community locality; partition to keep dense neighborhoods co-located and rebalance as it grows.
- **RDF triple explosion** if you go full-semantic too early; reserve OWL/RDF for the ontology layer, not member data.
- **Ontology drift / governance.** ESCO versions change; pin a version, version your own extensions, and keep `valid-time` on concept mappings so re-canonicalization is auditable.
- **Trusting declared edges.** Like LinkedIn, attach confidence and let ML-inferred edges coexist with self-declared ones.

## Sources

- https://www.linkedin.com/blog/engineering/knowledge/building-the-linkedin-knowledge-graph
- https://www.linkedin.com/pulse/linkedin-knowledge-graph-enriches-data-value-qi-he
- https://www.linkedin.com/pulse/machine-learning-linkedin-knowledge-graph-qi-he
- https://enterprise-knowledge.com/cutting-through-the-noise-an-introduction-to-rdf-lpg-graphs/
- https://dzone.com/articles/rdf-triple-stores-vs-labeled-property-graphs-whats
- https://aibusiness.com/data/ending-the-rdf-vs-property-graph-debate-with-rdf-
- https://datawalk.com/property-graph-vs-rdf/
- https://www.mdpi.com/2076-3417/13/9/5770
- https://nebula-graph.io/posts/performance-comparison-neo4j-janusgraph-nebula-graph
- https://nebula-graph.io/posts/best-graph-database-for-enterprise
- https://data.europa.eu/esco/model
- https://esco.ec.europa.eu/en/about-esco/data-science-and-esco/crosswalk-between-esco-and-onet
- https://arxiv.org/pdf/2601.09119
- http://escoe-website.s3.amazonaws.com/wp-content/uploads/2018/08/29113127/ESCoE-DP-2018-13.pdf
- https://www.getzep.com/ai-agents/temporal-knowledge-graph/
- https://www.emergentmind.com/topics/bitemporal-modeling
- https://www.experoinc.com/expero-resources/dse-graph-partitioning-part-2-taming-your-supernodes
- https://oboe.com/learn/knowledge-graphs-for-software-architecture-1nfdlhx/scalability-and-production-deployment-4

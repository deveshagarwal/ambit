# Weave Research 03 — Freshness & Accuracy: Keeping the Graph True Over Time

Weave's value collapses if the graph lies. A "need" that closed last month, two nodes that are secretly the same person, a skill someone abandoned in 2022, or a credential nobody verified all degrade match quality and erode trust. This document covers the mechanisms and named technologies for keeping a millions-node professional knowledge graph accurate as reality drifts underneath it.

## Key mechanisms

**Entity resolution (ER).** At scale you cannot compare every pair (a billion comparisons at 45k members). The standard pipeline is blocking/indexing to generate candidate pairs, then pairwise scoring, then clustering into entities. Classic scoring uses the Fellegi-Sunter probabilistic model, which weighs agreement and disagreement per attribute and originated in 1969 administrative record linkage ([Splink docs](https://moj-analytical-services.github.io/splink/index.html)). Modern ER adds embedding-based blocking and matching: Ditto used Sentence-BERT to block and a fine-tuned transformer to match, cutting candidate pairs from 10M to 0.6M and matching time from 6.49h to 1.69h on one GPU ([Megagon/Ditto](https://arxiv.org/pdf/2004.00584); [VLDB blocking study](https://vldb.org/pvldb/vol14/p2459-thirumuruganathan.pdf)). A 2024 VLDB Journal study benchmarked 12 pretrained models across 17 datasets for blocking and matching ([VLDB Journal](https://link.springer.com/article/10.1007/s00778-024-00879-4)).

**Staleness and decay.** Facts have time-validity. The cleanest formalism is half-life decay: validity V(t) = V0 · e^(-λΔt) with λ = ln(2)/half-life. HALO classifies facts as active vs inactive, assigns each a half-life, and expires those whose validity drops below a threshold, improving downstream reasoning (MRR 45.45 to 47.88 on ICEWS14) ([HALO](https://arxiv.org/html/2505.07509v1)). Half-lives are domain-dependent, from ~700 years for math to ~1.4 years for breaking news ([Atlan](https://atlan.com/know/llm-knowledge-base-staleness/)). The most dangerous decay is the silent stale edge: true once, false now, never updated ([Neo4j decay](https://isuruig.medium.com/knowledge-graph-decay-how-your-neo4j-graph-quietly-diverges-from-reality-376d9452220b)). Temporal-KG practice attaches metadata (time_added, last_accessed, valid_from/valid_to) so a changed fact invalidates the old one rather than overwriting it ([Zep](https://www.getzep.com/ai-agents/temporal-knowledge-graph/)).

**Truth discovery and provenance.** When sources disagree, do not just majority-vote: weight sources by reliability and iterate. TruthFinder co-estimates fact confidence and source trustworthiness in a mutual-reinforcement loop ([Truth Discovery survey](https://research.usq.edu.au/download/0139ae81792a5393de4828ffbb80aa8d97319c6b921e9f06249b3004f9fcd000/2291991/A_Survey_on_Truth_Discovery_Concepts_Methods_Applications_and_Opportunities.pdf)); evolving-truth variants handle facts that legitimately change over time ([Evolving Truth](https://pmc.ncbi.nlm.nih.gov/articles/PMC4688022/)). Every belief should carry provenance/lineage (which source, when, with what confidence) so conflicts are resolvable and auditable ([Neo4j lineage](https://neo4j.com/blog/graph-database/what-is-data-lineage/)).

**Member-driven correction and feedback.** Outcomes are the strongest signal Weave owns. A successful, karma-rewarded connection reinforces the offer/need/skill edges that produced it; an ignored or rejected match decays them. This is a closed loop: confirmed introductions raise source/edge confidence, "this is no longer relevant" actively expires a need, and an active-learning labeling queue (Zingg's model) turns member corrections into training data for the matcher.

**Change data capture (CDC).** To stay consistent without nightly full recompute, stream row-level changes from the primary store and recompute only affected blocks/embeddings/clusters. Debezium emits Postgres/MySQL/Mongo changes to Kafka for incremental indexing and search-index invalidation ([Debezium/Confluent](https://www.confluent.io/resources/kafka-summit-2020/change-data-capture-pipelines-with-debezium-and-kafka-streams/); [Conduktor CDC](https://www.conduktor.io/glossary/what-is-change-data-capture-cdc-fundamentals)).

## Tools/approaches compared (tradeoffs at scale)

- **Splink** (open source, Fellegi-Sunter on DuckDB/Spark/Athena): transparent, explainable weights, scales to many millions on Spark, full data residency, free. You own infra, tuning, and serving. Best when the team wants control ([Splink vs AWS](https://github.com/moj-analytical-services/splink/discussions/2026)).
- **Zingg** (open source, ML + active learning): learns from a small human-labeled set, ideal for a correction loop; needs Spark and labeling effort.
- **dedupe.io / Python Record Linkage Toolkit**: great for prototyping and modest scale; weaker past low millions ([Awesome-ER](https://github.com/OlivierBinette/Awesome-Entity-Resolution)).
- **Senzing**: real-time, no-training entity API, strong precision; commercial license, less customizable.
- **AWS Entity Resolution**: a managed framework brokering backends (Senzing, Experian); low ops, AWS lock-in, less transparency ([Splink vs AWS](https://github.com/moj-analytical-services/splink/discussions/2026)).
- **Embedding/LLM ER (Ditto, Sentence-BERT blocking, LLM matchers)**: best on noisy free-text profiles; GPU cost and latency rise at scale; pairs well as a reranker over cheap blocks ([Ditto](https://arxiv.org/pdf/2004.00584); [Semantic ER](https://towardsdatascience.com/the-rise-of-semantic-entity-resolution/)).

## Recommendation for Weave

Run a hybrid pipeline. Use the **embeddings you already compute as the blocker** (cosine top-k candidates), then score with **Splink's Fellegi-Sunter model** for explainable, auditable match probabilities; cluster into person-entities with confidence-scored golden records. Reserve a **DeepSeek LLM pass only as a reranker** on the handful of ambiguous mid-confidence pairs, not on every pair. Store every attribute with **provenance and valid_from/valid_to plus a confidence score**, never a bare overwrite. Apply **per-attribute half-life decay** (HALO-style) with domain-tuned half-lives: short for needs (weeks) and current role (months), long for credentials and past experience; auto-flag or expire facts below threshold and prompt re-verification. Close the loop: **connection outcomes and karma reweight edge confidence**, and member "no longer relevant" / "wrong person" actions feed a Zingg-style active-learning queue. Drive incremental maintenance with **Debezium CDC** so only touched entities re-resolve. Adopt **Senzing or AWS Entity Resolution only if** ER ops become a distraction and you accept lock-in.

## Pitfalls

- Overwriting instead of versioning destroys the lineage you need to resolve future conflicts.
- One global decay rate is wrong: needs and credentials must not decay alike.
- Naive majority voting lets prolific low-quality sources win; weight by reliability ([Truth Finding](https://arxiv.org/pdf/1503.00303)).
- Silent stale edges are invisible until a bad match exposes them; schedule active re-verification.
- LLM/embedding ER on every pair is cost-prohibitive at millions; keep it as a reranker.
- Aggressive auto-merge of distinct people is hard to reverse and erodes trust; require confidence thresholds and human review for merges.
- Full nightly recompute will not survive scale; incremental CDC is mandatory.

## Sources (URLs)

- HALO half-life outdated-fact filtering: https://arxiv.org/html/2505.07509v1
- Neo4j knowledge graph decay: https://isuruig.medium.com/knowledge-graph-decay-how-your-neo4j-graph-quietly-diverges-from-reality-376d9452220b
- LLM knowledge base staleness (decay rates): https://atlan.com/know/llm-knowledge-base-staleness/
- Temporal knowledge graphs (Zep): https://www.getzep.com/ai-agents/temporal-knowledge-graph/
- Survey on Truth Discovery: https://research.usq.edu.au/download/0139ae81792a5393de4828ffbb80aa8d97319c6b921e9f06249b3004f9fcd000/2291991/A_Survey_on_Truth_Discovery_Concepts_Methods_Applications_and_Opportunities.pdf
- On the Discovery of Evolving Truth: https://pmc.ncbi.nlm.nih.gov/articles/PMC4688022/
- Truth Finding on the Deep Web: https://arxiv.org/pdf/1503.00303
- Splink docs (Fellegi-Sunter): https://moj-analytical-services.github.io/splink/index.html
- Splink vs AWS Entity Resolution discussion: https://github.com/moj-analytical-services/splink/discussions/2026
- Awesome-Entity-Resolution (tool list): https://github.com/OlivierBinette/Awesome-Entity-Resolution
- Ditto / deep entity matching: https://arxiv.org/pdf/2004.00584
- Deep learning for blocking (VLDB): https://vldb.org/pvldb/vol14/p2459-thirumuruganathan.pdf
- Pretrained embeddings for ER (VLDB Journal 2024): https://link.springer.com/article/10.1007/s00778-024-00879-4
- The Rise of Semantic Entity Resolution: https://towardsdatascience.com/the-rise-of-semantic-entity-resolution/
- Debezium/Kafka CDC pipelines: https://www.confluent.io/resources/kafka-summit-2020/change-data-capture-pipelines-with-debezium-and-kafka-streams/
- CDC fundamentals (Conduktor): https://www.conduktor.io/glossary/what-is-change-data-capture-cdc-fundamentals
- Data lineage on graphs (Neo4j): https://neo4j.com/blog/graph-database/what-is-data-lineage/

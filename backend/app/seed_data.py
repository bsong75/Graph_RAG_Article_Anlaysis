"""Fictional sample dataset: research papers, authors, institutions, topics, citations.

All papers, authors, and institutions are invented for demo purposes.
The citation graph is intentionally interconnected so multi-hop questions
("what builds on knowledge graph research?") have interesting answers.
"""

INSTITUTIONS = [
    "Auroral Institute of Technology",
    "Bayside University",
    "Cascadia AI Lab",
    "Delta Research Institute",
    "Meridian University",
]

# name -> institution
AUTHORS = {
    "Elena Vasquez": "Cascadia AI Lab",
    "Marcus Chen": "Bayside University",
    "Priya Raghavan": "Auroral Institute of Technology",
    "Tomas Lindgren": "Delta Research Institute",
    "Aisha Okafor": "Meridian University",
    "Daniel Kovacs": "Bayside University",
    "Yuki Tanaka": "Auroral Institute of Technology",
    "Sofia Marchetti": "Cascadia AI Lab",
    "Omar Haddad": "Delta Research Institute",
    "Ingrid Bergström": "Meridian University",
    "Rafael Ortiz": "Cascadia AI Lab",
    "Mei-Ling Wu": "Bayside University",
    "Jonas Petersen": "Auroral Institute of Technology",
    "Fatima Al-Rashid": "Delta Research Institute",
    "Viktor Sokolov": "Meridian University",
    "Hannah Osei": "Cascadia AI Lab",
}

PAPERS = [
    {
        "id": "p01",
        "title": "Attention-Based Graph Neural Networks for Molecular Property Prediction",
        "year": 2019,
        "authors": ["Priya Raghavan", "Yuki Tanaka", "Jonas Petersen"],
        "topics": ["Graph Neural Networks", "Attention Mechanisms"],
        "cites": [],
        "abstract": (
            "We introduce an attention-based message passing architecture for predicting "
            "molecular properties directly from graph-structured chemical data. Attention "
            "weights over neighboring atoms let the model focus on chemically relevant "
            "substructures, improving accuracy on solubility and toxicity benchmarks by 12% "
            "over standard graph convolutional baselines."
        ),
    },
    {
        "id": "p02",
        "title": "Knowledge Graph Embeddings: A Survey of Methods and Benchmarks",
        "year": 2020,
        "authors": ["Elena Vasquez", "Sofia Marchetti"],
        "topics": ["Knowledge Graphs", "Representation Learning"],
        "cites": [],
        "abstract": (
            "This survey reviews translational, bilinear, and neural approaches to embedding "
            "knowledge graph entities and relations into continuous vector spaces. We compare "
            "twenty methods on link prediction and triple classification benchmarks, and "
            "identify evaluation pitfalls including test-set leakage and inconsistent negative "
            "sampling protocols."
        ),
    },
    {
        "id": "p03",
        "title": "Retrieval-Augmented Generation for Open-Domain Question Answering",
        "year": 2021,
        "authors": ["Marcus Chen", "Aisha Okafor", "Daniel Kovacs"],
        "topics": ["Retrieval-Augmented Generation", "Question Answering"],
        "cites": [],
        "abstract": (
            "We combine a dense passage retriever with a sequence-to-sequence generator so the "
            "model conditions its answers on retrieved evidence rather than parametric memory "
            "alone. The approach improves exact-match scores on open-domain QA benchmarks and "
            "produces answers that can be attributed to source passages."
        ),
    },
    {
        "id": "p04",
        "title": "GraphRAG: Combining Knowledge Graphs with Retrieval-Augmented Generation",
        "year": 2023,
        "authors": ["Elena Vasquez", "Marcus Chen", "Hannah Osei"],
        "topics": ["Knowledge Graphs", "Retrieval-Augmented Generation"],
        "cites": ["p02", "p03"],
        "abstract": (
            "We propose GraphRAG, which retrieves an initial set of entities via vector "
            "similarity and then expands context by traversing typed relationships in a "
            "knowledge graph. Structured expansion surfaces multi-hop evidence that pure "
            "vector retrieval misses, improving answer faithfulness on questions requiring "
            "relational reasoning by 18 points."
        ),
    },
    {
        "id": "p05",
        "title": "Scaling Laws for Sparse Mixture-of-Experts Language Models",
        "year": 2022,
        "authors": ["Tomas Lindgren", "Omar Haddad", "Viktor Sokolov"],
        "topics": ["Large Language Models", "Model Scaling"],
        "cites": [],
        "abstract": (
            "We characterize how loss scales with parameter count, expert count, and training "
            "tokens for sparsely activated mixture-of-experts language models. Sparse models "
            "reach the quality of dense counterparts with roughly a quarter of the training "
            "compute, but returns diminish sharply beyond 256 experts per layer."
        ),
    },
    {
        "id": "p06",
        "title": "Temporal Graph Networks for Dynamic Fraud Detection",
        "year": 2021,
        "authors": ["Priya Raghavan", "Ingrid Bergström"],
        "topics": ["Graph Neural Networks", "Fraud Detection"],
        "cites": ["p01"],
        "abstract": (
            "Financial fraud patterns evolve over time, and static graph models fail to track "
            "them. We extend attention-based graph networks with continuous-time memory "
            "modules that update node states as transactions stream in, detecting fraud rings "
            "on a payments network with 31% fewer false positives than daily-batch baselines."
        ),
    },
    {
        "id": "p07",
        "title": "Entity Resolution at Scale with Contrastive Learning",
        "year": 2022,
        "authors": ["Sofia Marchetti", "Mei-Ling Wu"],
        "topics": ["Information Extraction", "Representation Learning"],
        "cites": ["p02"],
        "abstract": (
            "Merging duplicate entities is a core bottleneck when building knowledge graphs "
            "from heterogeneous sources. We train entity encoders with a contrastive objective "
            "over weakly labeled record pairs, resolving 40 million records with precision "
            "matching rule-based systems that took months to engineer."
        ),
    },
    {
        "id": "p08",
        "title": "Text-to-Cypher: Natural Language Interfaces for Graph Databases",
        "year": 2023,
        "authors": ["Daniel Kovacs", "Yuki Tanaka", "Fatima Al-Rashid"],
        "topics": ["Knowledge Graphs", "Semantic Parsing"],
        "cites": ["p02"],
        "abstract": (
            "We study how large language models translate natural language questions into "
            "Cypher queries over property graphs. Prompting with the graph schema and a "
            "handful of examples yields 78% execution accuracy, and an execution-feedback "
            "repair loop that retries failed queries recovers half of the remaining errors."
        ),
    },
    {
        "id": "p09",
        "title": "Hallucination Mitigation in Large Language Models via Grounded Retrieval",
        "year": 2023,
        "authors": ["Marcus Chen", "Aisha Okafor"],
        "topics": ["Large Language Models", "Retrieval-Augmented Generation"],
        "cites": ["p03", "p05"],
        "abstract": (
            "We measure how retrieval grounding affects factual hallucination across model "
            "scales. Requiring generators to quote retrieved spans verbatim cuts unsupported "
            "claims by two thirds, and hallucination rates correlate more strongly with "
            "retrieval quality than with model size."
        ),
    },
    {
        "id": "p10",
        "title": "Community Detection in Billion-Edge Graphs with GPU Acceleration",
        "year": 2020,
        "authors": ["Omar Haddad", "Jonas Petersen"],
        "topics": ["Graph Algorithms", "Distributed Systems"],
        "cites": [],
        "abstract": (
            "We present a GPU-parallel formulation of Louvain community detection that "
            "partitions graphs with two billion edges in under ninety seconds. Careful memory "
            "layout and asynchronous modularity updates deliver a 40x speedup over "
            "state-of-the-art CPU implementations without degrading partition quality."
        ),
    },
    {
        "id": "p11",
        "title": "Multi-Hop Reasoning over Knowledge Graphs with Reinforcement Learning",
        "year": 2021,
        "authors": ["Hannah Osei", "Rafael Ortiz", "Viktor Sokolov"],
        "topics": ["Knowledge Graphs", "Reinforcement Learning"],
        "cites": ["p02"],
        "abstract": (
            "We train a policy network to walk knowledge graphs, choosing relation edges "
            "step by step to answer compositional queries. Reward shaping based on partial "
            "path plausibility stabilizes training, and learned paths double as human-readable "
            "explanations of the model's reasoning."
        ),
    },
    {
        "id": "p12",
        "title": "Vector Databases and Approximate Nearest Neighbor Search: A Systems Perspective",
        "year": 2022,
        "authors": ["Ingrid Bergström", "Mei-Ling Wu", "Tomas Lindgren"],
        "topics": ["Vector Search", "Distributed Systems"],
        "cites": [],
        "abstract": (
            "We benchmark graph-based, quantization-based, and hybrid indexes for approximate "
            "nearest neighbor search under realistic update and filter workloads. HNSW-style "
            "indexes dominate on recall-latency trade-offs for static corpora, but their "
            "performance degrades sharply under sustained inserts and deletes."
        ),
    },
    {
        "id": "p13",
        "title": "Hybrid Retrieval: Fusing Dense Vectors and Graph Traversal for Enterprise Search",
        "year": 2024,
        "authors": ["Marcus Chen", "Elena Vasquez", "Ingrid Bergström"],
        "topics": ["Vector Search", "Retrieval-Augmented Generation", "Knowledge Graphs"],
        "cites": ["p04", "p12"],
        "abstract": (
            "Enterprise questions often hinge on organizational relationships that vector "
            "similarity alone cannot capture. We fuse dense retrieval scores with graph "
            "proximity signals in a learned reranker, improving answer relevance by 22% on "
            "an internal corpus of two million documents linked to an organizational graph."
        ),
    },
    {
        "id": "p14",
        "title": "Instruction Tuning Improves Structured Output Generation in LLMs",
        "year": 2023,
        "authors": ["Fatima Al-Rashid", "Viktor Sokolov"],
        "topics": ["Large Language Models", "Semantic Parsing"],
        "cites": ["p05"],
        "abstract": (
            "We fine-tune language models on a curated mixture of JSON, SQL, and Cypher "
            "generation tasks with schema-conditioned instructions. Instruction-tuned models "
            "produce syntactically valid structured output 96% of the time versus 71% for "
            "base models, with the largest gains on schemas unseen during training."
        ),
    },
    {
        "id": "p15",
        "title": "Automated Knowledge Graph Construction from Scientific Literature",
        "year": 2023,
        "authors": ["Elena Vasquez", "Sofia Marchetti", "Rafael Ortiz"],
        "topics": ["Knowledge Graphs", "Information Extraction"],
        "cites": ["p02", "p07"],
        "abstract": (
            "We build an end-to-end pipeline that reads scientific abstracts, extracts "
            "entities and typed relations with a language model, resolves duplicates, and "
            "writes a queryable knowledge graph. Applied to 120,000 abstracts, the pipeline "
            "constructs a graph whose relation precision reaches 89% against expert annotation."
        ),
    },
    {
        "id": "p16",
        "title": "Evaluating Graph-Augmented LLM Agents on Multi-Hop Question Answering",
        "year": 2024,
        "authors": ["Hannah Osei", "Aisha Okafor", "Daniel Kovacs"],
        "topics": ["Question Answering", "Knowledge Graphs", "Large Language Models"],
        "cites": ["p04", "p09", "p11"],
        "abstract": (
            "We introduce a benchmark of 3,000 questions requiring two to four reasoning hops "
            "over a knowledge graph, and evaluate agents that interleave graph queries with "
            "generation. Graph-augmented agents outperform pure retrieval baselines by 26 "
            "points on three-hop questions, but still fail when hops require aggregations."
        ),
    },
]

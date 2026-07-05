"""Load the sample dataset into Neo4j and build the vector index."""

from . import config, db, ollama_client
from .seed_data import AUTHORS, PAPERS

CONSTRAINTS = [
    "CREATE CONSTRAINT paper_id IF NOT EXISTS FOR (p:Paper) REQUIRE p.id IS UNIQUE",
    "CREATE CONSTRAINT author_name IF NOT EXISTS FOR (a:Author) REQUIRE a.name IS UNIQUE",
    "CREATE CONSTRAINT topic_name IF NOT EXISTS FOR (t:Topic) REQUIRE t.name IS UNIQUE",
    "CREATE CONSTRAINT institution_name IF NOT EXISTS FOR (i:Institution) REQUIRE i.name IS UNIQUE",
]


def ensure_constraints():
    for stmt in CONSTRAINTS:
        db.run_query(stmt)


def ensure_vector_index(dimensions: int):
    # Index options don't accept query parameters; dimensions is an int we control.
    db.run_query(
        f"""
        CREATE VECTOR INDEX {config.VECTOR_INDEX_NAME} IF NOT EXISTS
        FOR (p:Paper) ON (p.embedding)
        OPTIONS {{indexConfig: {{
            `vector.dimensions`: {int(dimensions)},
            `vector.similarity_function`: 'cosine'
        }}}}
        """
    )


def embedding_text(title: str, abstract: str, topics: list[str]) -> str:
    return f"{title}\nTopics: {', '.join(topics)}\n{abstract}"


def seed() -> dict:
    ensure_constraints()

    # Embed everything first so a missing embedding model fails before any writes.
    embeddings = {}
    for paper in PAPERS:
        embeddings[paper["id"]] = ollama_client.embed(
            embedding_text(paper["title"], paper["abstract"], paper["topics"])
        )
    dimensions = len(next(iter(embeddings.values())))
    ensure_vector_index(dimensions)

    for name, institution in AUTHORS.items():
        db.run_query(
            """
            MERGE (a:Author {name: $name})
            MERGE (i:Institution {name: $institution})
            MERGE (a)-[:AFFILIATED_WITH]->(i)
            """,
            {"name": name, "institution": institution},
        )

    for paper in PAPERS:
        db.run_query(
            """
            MERGE (p:Paper {id: $id})
            SET p.title = $title, p.abstract = $abstract, p.year = $year,
                p.embedding = $embedding
            WITH p
            UNWIND $authors AS author_name
            MATCH (a:Author {name: author_name})
            MERGE (a)-[:AUTHORED]->(p)
            WITH DISTINCT p
            UNWIND $topics AS topic_name
            MERGE (t:Topic {name: topic_name})
            MERGE (p)-[:HAS_TOPIC]->(t)
            """,
            {
                "id": paper["id"],
                "title": paper["title"],
                "abstract": paper["abstract"],
                "year": paper["year"],
                "embedding": embeddings[paper["id"]],
                "authors": paper["authors"],
                "topics": paper["topics"],
            },
        )

    for paper in PAPERS:
        for cited_id in paper["cites"]:
            db.run_query(
                """
                MATCH (p:Paper {id: $id}), (c:Paper {id: $cited_id})
                MERGE (p)-[:CITES]->(c)
                """,
                {"id": paper["id"], "cited_id": cited_id},
            )

    return stats()


def stats() -> dict:
    counts = db.run_query(
        """
        MATCH (n)
        RETURN labels(n)[0] AS label, count(n) AS count
        ORDER BY label
        """
    )
    rels = db.run_query("MATCH ()-[r]->() RETURN count(r) AS count")
    return {
        "nodes": {row["label"]: row["count"] for row in counts},
        "relationships": rels[0]["count"] if rels else 0,
    }

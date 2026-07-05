"""Document ingestion: the LLM extracts entities and relationships from raw text,
and we merge them into the graph so ingested documents become queryable
alongside the seed data."""

import json
import re

from .. import db, ollama_client
from ..seeding import embedding_text, ensure_constraints, ensure_vector_index

EXTRACT_SYSTEM = (
    "You extract structured metadata from research paper text. "
    "Respond with JSON only, matching the requested schema exactly. "
    "Only include information actually present in the text — never invent authors or citations."
)

EXTRACT_PROMPT = """Extract metadata from this research document.

Return JSON with this exact shape:
{{
  "title": "paper title",
  "year": 2024,
  "summary": "2-3 sentence summary of the document",
  "authors": [{{"name": "Author Name", "institution": "Institution or null"}}],
  "topics": ["Topic One", "Topic Two"],
  "cited_titles": ["Title of any paper this document cites or mentions"]
}}

Use null for year if not stated. Topics should be 1-4 short research-area phrases.

Document text:
---
{text}
---
"""


def slugify(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return f"doc-{slug[:60]}"


def extract(text: str) -> dict:
    raw = ollama_client.generate(
        EXTRACT_PROMPT.format(text=text[:8000]),
        system=EXTRACT_SYSTEM,
        json_format=True,
        temperature=0.0,
    )
    data = json.loads(raw)
    if not data.get("title"):
        raise ValueError("Extraction failed: the model did not find a title in the text.")
    return data


def ingest(text: str) -> dict:
    ensure_constraints()
    data = extract(text)

    paper_id = slugify(data["title"])
    summary = data.get("summary") or text[:500]
    topics = [t for t in (data.get("topics") or []) if t]
    embedding = ollama_client.embed(embedding_text(data["title"], summary, topics))
    ensure_vector_index(len(embedding))  # no-op if it already exists

    db.run_query(
        """
        MERGE (p:Paper {id: $id})
        SET p.title = $title, p.abstract = $summary, p.year = $year,
            p.embedding = $embedding, p.ingested = true
        """,
        {
            "id": paper_id,
            "title": data["title"],
            "summary": summary,
            "year": data.get("year"),
            "embedding": embedding,
        },
    )

    for author in data.get("authors") or []:
        name = (author.get("name") or "").strip() if isinstance(author, dict) else str(author).strip()
        if not name:
            continue
        db.run_query(
            """
            MATCH (p:Paper {id: $id})
            MERGE (a:Author {name: $name})
            MERGE (a)-[:AUTHORED]->(p)
            """,
            {"id": paper_id, "name": name},
        )
        institution = author.get("institution") if isinstance(author, dict) else None
        if institution:
            db.run_query(
                """
                MATCH (a:Author {name: $name})
                MERGE (i:Institution {name: $institution})
                MERGE (a)-[:AFFILIATED_WITH]->(i)
                """,
                {"name": name, "institution": institution},
            )

    for topic in topics:
        db.run_query(
            """
            MATCH (p:Paper {id: $id})
            MERGE (t:Topic {name: $topic})
            MERGE (p)-[:HAS_TOPIC]->(t)
            """,
            {"id": paper_id, "topic": topic},
        )

    # Link citations only to papers that already exist in the graph.
    linked_citations = []
    for cited in data.get("cited_titles") or []:
        result = db.run_query(
            """
            MATCH (p:Paper {id: $id})
            MATCH (c:Paper)
            WHERE toLower(c.title) CONTAINS toLower($cited) AND c.id <> $id
            MERGE (p)-[:CITES]->(c)
            RETURN c.title AS title
            """,
            {"id": paper_id, "cited": cited},
        )
        linked_citations.extend(row["title"] for row in result)

    return {
        "paper_id": paper_id,
        "title": data["title"],
        "year": data.get("year"),
        "summary": summary,
        "authors": data.get("authors") or [],
        "topics": topics,
        "linked_citations": linked_citations,
        "unmatched_citations": [
            c for c in (data.get("cited_titles") or [])
            if not any(c.lower() in t.lower() or t.lower() in c.lower() for t in linked_citations)
        ],
    }

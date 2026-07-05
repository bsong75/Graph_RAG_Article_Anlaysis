"""Vector search + graph expansion: the core Graph RAG retrieval mode.

1. Embed the question and find the most similar papers via the vector index.
2. Expand each hit through the graph (authors, topics, citations in/out).
3. Hand the assembled context to the LLM to answer with citations.
"""

from .. import config, db, ollama_client

RETRIEVAL_QUERY = f"""
CALL db.index.vector.queryNodes('{config.VECTOR_INDEX_NAME}', $k, $embedding)
YIELD node, score
OPTIONAL MATCH (a:Author)-[:AUTHORED]->(node)
OPTIONAL MATCH (a)-[:AFFILIATED_WITH]->(i:Institution)
OPTIONAL MATCH (node)-[:HAS_TOPIC]->(t:Topic)
OPTIONAL MATCH (node)-[:CITES]->(cited:Paper)
OPTIONAL MATCH (citing:Paper)-[:CITES]->(node)
RETURN node.id AS id, node.title AS title, node.abstract AS abstract,
       node.year AS year, score,
       collect(DISTINCT a.name + ' (' + coalesce(i.name, 'unknown') + ')') AS authors,
       collect(DISTINCT t.name) AS topics,
       collect(DISTINCT cited.title) AS cites,
       collect(DISTINCT citing.title) AS cited_by
ORDER BY score DESC
"""

ANSWER_SYSTEM = (
    "You are a research assistant answering questions about a corpus of papers. "
    "Use ONLY the provided context. Cite papers by title when you rely on them. "
    "If the context does not contain the answer, say so plainly."
)


def format_paper(p: dict) -> str:
    lines = [
        f"Title: {p['title']} ({p['year']})",
        f"Authors: {', '.join(p['authors']) or 'unknown'}",
        f"Topics: {', '.join(p['topics']) or 'none'}",
        f"Abstract: {p['abstract']}",
    ]
    if p["cites"]:
        lines.append(f"Cites: {'; '.join(p['cites'])}")
    if p["cited_by"]:
        lines.append(f"Cited by: {'; '.join(p['cited_by'])}")
    return "\n".join(lines)


def ask(question: str, k: int = 4) -> dict:
    embedding = ollama_client.embed(question)
    papers = db.run_query(RETRIEVAL_QUERY, {"k": k, "embedding": embedding})

    if not papers:
        return {
            "answer": "The graph is empty — load the sample dataset first.",
            "mode": "vector_graph",
            "sources": [],
        }

    context = "\n\n---\n\n".join(format_paper(p) for p in papers)
    prompt = (
        f"Context — papers retrieved from the knowledge graph:\n\n{context}\n\n"
        f"Question: {question}\n\nAnswer:"
    )
    answer = ollama_client.generate(prompt, system=ANSWER_SYSTEM)

    return {
        "answer": answer.strip(),
        "mode": "vector_graph",
        "sources": [
            {
                "id": p["id"],
                "title": p["title"],
                "year": p["year"],
                "score": round(p["score"], 3),
                "authors": p["authors"],
                "topics": p["topics"],
                "cites": p["cites"],
                "cited_by": p["cited_by"],
            }
            for p in papers
        ],
    }

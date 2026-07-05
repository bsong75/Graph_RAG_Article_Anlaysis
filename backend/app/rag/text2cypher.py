"""Text-to-Cypher: the LLM translates the question into a read-only Cypher query,
we execute it, and a second LLM call phrases the results as an answer.
Failed queries get one repair attempt with the error fed back."""

import json
import re

from .. import db, ollama_client

SCHEMA = """
Node labels and properties:
  (:Paper {id: string, title: string, abstract: string, year: integer})
  (:Author {name: string})
  (:Topic {name: string})
  (:Institution {name: string})

Relationships:
  (:Author)-[:AUTHORED]->(:Paper)
  (:Author)-[:AFFILIATED_WITH]->(:Institution)
  (:Paper)-[:HAS_TOPIC]->(:Topic)
  (:Paper)-[:CITES]->(:Paper)
"""

CYPHER_SYSTEM = (
    "You translate natural language questions into Cypher queries for Neo4j. "
    "Output ONLY the Cypher query — no explanation, no markdown fences. "
    "Use case-insensitive matching for names and titles, e.g. "
    "WHERE toLower(a.name) CONTAINS toLower('chen'). "
    "Never use CREATE, MERGE, DELETE, SET, or REMOVE. Always include a LIMIT of at most 25."
)

EXAMPLES = """
Question: How many papers did Marcus Chen write?
Cypher: MATCH (a:Author)-[:AUTHORED]->(p:Paper) WHERE toLower(a.name) CONTAINS toLower('Marcus Chen') RETURN count(p) AS papers LIMIT 25

Question: Which papers cite the GraphRAG paper?
Cypher: MATCH (p:Paper)-[:CITES]->(c:Paper) WHERE toLower(c.title) CONTAINS toLower('GraphRAG') RETURN p.title AS title, p.year AS year LIMIT 25

Question: Which authors have collaborated with someone from Cascadia AI Lab?
Cypher: MATCH (a:Author)-[:AUTHORED]->(:Paper)<-[:AUTHORED]-(b:Author)-[:AFFILIATED_WITH]->(i:Institution) WHERE toLower(i.name) CONTAINS toLower('Cascadia') AND a <> b RETURN DISTINCT a.name AS author LIMIT 25
"""

WRITE_PATTERN = re.compile(
    r"\b(CREATE|MERGE|DELETE|DETACH|SET|REMOVE|DROP|CALL\s+db\.\w*create)\b", re.IGNORECASE
)

ANSWER_SYSTEM = (
    "You answer questions using the results of a database query. Be direct and concise. "
    "If the results are empty, say the database contains no matching data."
)


def clean_cypher(raw: str) -> str:
    text = raw.strip()
    # Strip markdown fences if the model added them anyway.
    text = re.sub(r"^```(?:cypher)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip().rstrip(";")


def generate_cypher(question: str, previous: str | None = None, error: str | None = None) -> str:
    prompt = f"Graph schema:\n{SCHEMA}\nExamples:\n{EXAMPLES}\nQuestion: {question}\nCypher:"
    if previous and error:
        prompt = (
            f"Graph schema:\n{SCHEMA}\nQuestion: {question}\n"
            f"This query failed:\n{previous}\nError: {error}\n"
            "Write a corrected Cypher query. Output only the query.\nCypher:"
        )
    return clean_cypher(ollama_client.generate(prompt, system=CYPHER_SYSTEM, temperature=0.0))


def ask(question: str) -> dict:
    cypher = generate_cypher(question)
    rows, error = None, None

    for attempt in range(2):
        if WRITE_PATTERN.search(cypher):
            error = "Query rejected: write operations are not allowed."
        else:
            try:
                rows = db.run_query(cypher)
                break
            except Exception as exc:  # noqa: BLE001 — surface any driver/syntax error to the repair loop
                error = str(exc)
        if attempt == 0:
            cypher = generate_cypher(question, previous=cypher, error=error)

    if rows is None:
        return {
            "answer": f"I couldn't produce a working Cypher query for that question. Last error: {error}",
            "mode": "text2cypher",
            "cypher": cypher,
            "rows": [],
        }

    rows = rows[:25]
    prompt = (
        f"Question: {question}\n"
        f"Cypher query used: {cypher}\n"
        f"Query results (JSON): {json.dumps(rows, default=str)}\n\n"
        "Answer the question based on these results:"
    )
    answer = ollama_client.generate(prompt, system=ANSWER_SYSTEM)

    return {
        "answer": answer.strip(),
        "mode": "text2cypher",
        "cypher": cypher,
        "rows": rows,
    }

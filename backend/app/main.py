from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import db, ollama_client, seeding
from .ollama_client import OllamaError
from .rag import ingest as ingest_mod
from .rag import text2cypher, vector_graph

app = FastAPI(title="Graph RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskRequest(BaseModel):
    question: str
    mode: str = "vector_graph"  # vector_graph | text2cypher


class IngestRequest(BaseModel):
    text: str


@app.get("/api/health")
def health():
    try:
        db.run_query("RETURN 1")
        neo4j_ok = True
    except Exception:
        neo4j_ok = False
    return {"neo4j": neo4j_ok, "ollama": ollama_client.check()}


@app.get("/api/stats")
def stats():
    return seeding.stats()


@app.post("/api/seed")
def seed():
    try:
        return {"status": "seeded", **seeding.seed()}
    except OllamaError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.post("/api/ask")
def ask(req: AskRequest):
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is empty.")
    try:
        if req.mode == "text2cypher":
            return text2cypher.ask(question)
        return vector_graph.ask(question)
    except OllamaError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.post("/api/ingest")
def ingest(req: IngestRequest):
    text = req.text.strip()
    if len(text) < 50:
        raise HTTPException(status_code=400, detail="Please provide at least a paragraph of text.")
    try:
        return ingest_mod.ingest(text)
    except OllamaError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@app.get("/api/node/{node_id}")
def node_details(node_id: str):
    rows = db.run_query(
        """
        MATCH (n) WHERE elementId(n) = $id
        RETURN labels(n)[0] AS label, properties(n) AS props,
               [(n)-[r]-(m) | {
                 rel: type(r),
                 direction: CASE WHEN startNode(r) = n THEN 'out' ELSE 'in' END,
                 id: elementId(m),
                 label: labels(m)[0],
                 name: coalesce(m.title, m.name)
               }] AS connections
        """,
        {"id": node_id},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Node not found.")
    row = rows[0]
    props = {k: v for k, v in row["props"].items() if k != "embedding"}
    return {"id": node_id, "label": row["label"], "properties": props, "connections": row["connections"]}


@app.get("/api/graph")
def graph(limit: int = 400):
    rows = db.run_query(
        """
        MATCH (n)-[r]->(m)
        RETURN elementId(n) AS source_id, labels(n)[0] AS source_label,
               coalesce(n.title, n.name) AS source_name, n.id AS source_pid,
               type(r) AS rel,
               elementId(m) AS target_id, labels(m)[0] AS target_label,
               coalesce(m.title, m.name) AS target_name, m.id AS target_pid
        LIMIT $limit
        """,
        {"limit": limit},
    )
    nodes, links = {}, []
    for row in rows:
        nodes[row["source_id"]] = {
            "id": row["source_id"],
            "label": row["source_label"],
            "name": row["source_name"],
            "pid": row["source_pid"],
        }
        nodes[row["target_id"]] = {
            "id": row["target_id"],
            "label": row["target_label"],
            "name": row["target_name"],
            "pid": row["target_pid"],
        }
        links.append({"source": row["source_id"], "target": row["target_id"], "rel": row["rel"]})
    return {"nodes": list(nodes.values()), "links": links}


@app.on_event("shutdown")
def shutdown():
    db.close()

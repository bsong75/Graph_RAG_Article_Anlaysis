from neo4j import GraphDatabase

from . import config

_driver = GraphDatabase.driver(
    config.NEO4J_URI, auth=(config.NEO4J_USER, config.NEO4J_PASSWORD)
)


def get_driver():
    return _driver


def run_query(cypher: str, params: dict | None = None) -> list[dict]:
    """Run a Cypher query and return records as plain dicts."""
    with _driver.session() as session:
        result = session.run(cypher, params or {})
        return [record.data() for record in result]


def close():
    _driver.close()

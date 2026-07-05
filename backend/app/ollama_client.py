"""Thin client for the Ollama HTTP API (generation + embeddings)."""

import httpx

from . import config

TIMEOUT = httpx.Timeout(300.0, connect=10.0)


class OllamaError(RuntimeError):
    pass


def generate(
    prompt: str,
    system: str | None = None,
    json_format: bool = False,
    temperature: float = 0.2,
) -> str:
    payload = {
        "model": config.GENERATION_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": temperature},
    }
    if system:
        payload["system"] = system
    if json_format:
        payload["format"] = "json"
    try:
        resp = httpx.post(f"{config.OLLAMA_BASE_URL}/api/generate", json=payload, timeout=TIMEOUT)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise OllamaError(
            f"Ollama generation failed ({config.GENERATION_MODEL} at {config.OLLAMA_BASE_URL}): {exc}"
        ) from exc
    return resp.json()["response"]


def embed(text: str) -> list[float]:
    payload = {"model": config.EMBEDDING_MODEL, "prompt": text}
    try:
        resp = httpx.post(f"{config.OLLAMA_BASE_URL}/api/embeddings", json=payload, timeout=TIMEOUT)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise OllamaError(
            f"Ollama embedding failed ({config.EMBEDDING_MODEL} at {config.OLLAMA_BASE_URL}): {exc}"
        ) from exc
    embedding = resp.json().get("embedding")
    if not embedding:
        raise OllamaError(
            f"Ollama returned an empty embedding — is '{config.EMBEDDING_MODEL}' pulled?"
        )
    return embedding


def check() -> dict:
    """Return Ollama reachability and whether the configured models are present."""
    try:
        resp = httpx.get(f"{config.OLLAMA_BASE_URL}/api/tags", timeout=10.0)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        return {"reachable": False, "error": str(exc)}
    names = [m["name"] for m in resp.json().get("models", [])]

    def has(model: str) -> bool:
        return any(n == model or n.split(":")[0] == model for n in names)

    return {
        "reachable": True,
        "generation_model": config.GENERATION_MODEL,
        "generation_model_available": has(config.GENERATION_MODEL),
        "embedding_model": config.EMBEDDING_MODEL,
        "embedding_model_available": has(config.EMBEDDING_MODEL),
        "models_present": names,
    }

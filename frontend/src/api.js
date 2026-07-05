async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.detail || `Request failed (${res.status})`)
  }
  return body
}

export const api = {
  health: () => request('/api/health'),
  stats: () => request('/api/stats'),
  seed: () => request('/api/seed', { method: 'POST' }),
  ask: (question, mode) =>
    request('/api/ask', { method: 'POST', body: JSON.stringify({ question, mode }) }),
  ingest: (text) =>
    request('/api/ingest', { method: 'POST', body: JSON.stringify({ text }) }),
  graph: () => request('/api/graph'),
  node: (id) => request(`/api/node/${encodeURIComponent(id)}`),
}

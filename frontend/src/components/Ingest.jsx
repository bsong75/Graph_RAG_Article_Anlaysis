import { useState } from 'react'
import { api } from '../api'

const SAMPLE = `Federated Graph Learning for Privacy-Preserving Recommendation
Hannah Osei (Cascadia AI Lab), Tomas Lindgren (Delta Research Institute), 2024

We study how to train graph neural networks for recommendation when user
interaction graphs cannot leave their home organizations. Our federated
protocol exchanges only encrypted gradient sketches between participants,
yet matches centralized training within 3% on standard benchmarks. Building
on ideas from GraphRAG: Combining Knowledge Graphs with Retrieval-Augmented
Generation, we also show that federated embeddings remain useful for
retrieval-augmented generation over the combined graph.`

export default function Ingest({ onIngested }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const submit = async () => {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const res = await api.ingest(text)
      setResult(res)
      onIngested?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ingest">
      <p className="muted">
        Paste a paper abstract or any research text. The LLM extracts the title, authors,
        institutions, topics, and citations, then merges them into the graph — after that the
        document is searchable in the Ask tab.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        placeholder="Paste document text here…"
      />
      <div className="ingest-actions">
        <button onClick={() => setText(SAMPLE)} disabled={busy} className="secondary">
          Use example document
        </button>
        <button onClick={submit} disabled={busy || text.trim().length < 50}>
          {busy ? 'Extracting entities…' : 'Ingest into graph'}
        </button>
      </div>

      {error && <div className="banner warn">{error}</div>}

      {result && (
        <div className="ingest-result">
          <h3>Added to graph</h3>
          <div><strong>Title:</strong> {result.title} {result.year ? `(${result.year})` : ''}</div>
          <div>
            <strong>Authors:</strong>{' '}
            {result.authors
              .map((a) => (typeof a === 'string' ? a : `${a.name}${a.institution ? ` — ${a.institution}` : ''}`))
              .join('; ') || 'none found'}
          </div>
          <div><strong>Topics:</strong> {result.topics.join(', ') || 'none found'}</div>
          <div><strong>Summary:</strong> {result.summary}</div>
          {result.linked_citations.length > 0 && (
            <div><strong>Linked citations:</strong> {result.linked_citations.join('; ')}</div>
          )}
          {result.unmatched_citations.length > 0 && (
            <div className="muted">
              Cited but not in graph: {result.unmatched_citations.join('; ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

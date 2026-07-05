import { useState } from 'react'
import { api } from '../api'

const SUGGESTIONS = [
  'What research combines knowledge graphs with retrieval-augmented generation?',
  'How can hallucinations in language models be reduced?',
  'How many papers did Elena Vasquez write, and which ones?',
  'Which papers cite the GraphRAG paper?',
]

function Sources({ msg }) {
  const [open, setOpen] = useState(false)
  const hasDetail =
    (msg.sources && msg.sources.length > 0) || msg.cypher || (msg.rows && msg.rows.length > 0)
  if (!hasDetail) return null

  return (
    <div className="detail">
      <button className="link" onClick={() => setOpen(!open)}>
        {open ? '▾ hide' : '▸ show'} {msg.mode === 'text2cypher' ? 'query' : 'retrieved context'}
      </button>
      {open && msg.mode === 'text2cypher' && (
        <div className="detail-body">
          <pre className="cypher">{msg.cypher}</pre>
          <pre className="rows">{JSON.stringify(msg.rows, null, 2)}</pre>
        </div>
      )}
      {open && msg.mode === 'vector_graph' && (
        <div className="detail-body">
          {msg.sources.map((s) => (
            <div key={s.id} className="source-card">
              <div className="source-title">
                {s.title} <span className="muted">({s.year}) · score {s.score}</span>
              </div>
              <div className="muted">{s.authors.join(', ')}</div>
              <div className="muted">Topics: {s.topics.join(', ')}</div>
              {s.cites.length > 0 && <div className="muted">Cites: {s.cites.join('; ')}</div>}
              {s.cited_by.length > 0 && (
                <div className="muted">Cited by: {s.cited_by.join('; ')}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Chat({ onSources }) {
  const [mode, setMode] = useState('vector_graph')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [busy, setBusy] = useState(false)

  const send = async (question) => {
    const q = (question || input).trim()
    if (!q || busy) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: q }])
    setBusy(true)
    try {
      const res = await api.ask(q, mode)
      setMessages((m) => [...m, { role: 'assistant', text: res.answer, ...res }])
      onSources?.(res.mode === 'vector_graph' ? res.sources.map((s) => s.id) : [])
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', text: `Error: ${err.message}`, error: true }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="chat">
      <div className="mode-row">
        <label className={mode === 'vector_graph' ? 'mode active' : 'mode'}>
          <input
            type="radio"
            checked={mode === 'vector_graph'}
            onChange={() => setMode('vector_graph')}
          />
          Vector + graph expansion
        </label>
        <label className={mode === 'text2cypher' ? 'mode active' : 'mode'}>
          <input
            type="radio"
            checked={mode === 'text2cypher'}
            onChange={() => setMode('text2cypher')}
          />
          Text-to-Cypher
        </label>
        <span className="muted mode-hint">
          {mode === 'vector_graph'
            ? 'Best for open questions about topics and content.'
            : 'Best for precise questions: counts, lists, who-cites-what.'}
        </span>
      </div>

      <div className="messages">
        {messages.length === 0 && (
          <div className="empty">
            <p>Ask something about the paper corpus. Try:</p>
            {SUGGESTIONS.map((s) => (
              <button key={s} className="suggestion" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`msg ${msg.role} ${msg.error ? 'error' : ''}`}>
            <div className="msg-text">{msg.text}</div>
            {msg.role === 'assistant' && <Sources msg={msg} />}
          </div>
        ))}
        {busy && <div className="msg assistant pending">Thinking… (local LLM, may take a moment)</div>}
      </div>

      <form
        className="input-row"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about the papers…"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}

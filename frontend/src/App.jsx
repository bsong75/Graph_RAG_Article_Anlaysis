import { useEffect, useState } from 'react'
import { api } from './api'
import Chat from './components/Chat'
import Ingest from './components/Ingest'
import GraphView from './components/GraphView'

const TABS = [
  { id: 'explore', label: 'Explore' },
  { id: 'ingest', label: 'Ingest document' },
]

export default function App() {
  const [tab, setTab] = useState('explore')
  const [highlightIds, setHighlightIds] = useState([])
  const [chatOpen, setChatOpen] = useState(true)
  const [stats, setStats] = useState(null)
  const [health, setHealth] = useState(null)
  const [seeding, setSeeding] = useState(false)
  const [seedMsg, setSeedMsg] = useState('')

  const refresh = async () => {
    try {
      setStats(await api.stats())
    } catch {
      setStats(null)
    }
    try {
      setHealth(await api.health())
    } catch {
      setHealth(null)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const nodeCount = stats
    ? Object.values(stats.nodes || {}).reduce((a, b) => a + b, 0)
    : 0
  const isEmpty = stats && nodeCount === 0

  const handleSeed = async () => {
    setSeeding(true)
    setSeedMsg('')
    try {
      await api.seed()
      setSeedMsg('Sample dataset loaded.')
      await refresh()
    } catch (err) {
      setSeedMsg(`Seeding failed: ${err.message}`)
    } finally {
      setSeeding(false)
    }
  }

  const ollamaOk = health?.ollama?.reachable
  const neo4jOk = health?.neo4j

  return (
    <div className="app">
      <header>
        <div className="title-block">
          <h1 title="Research papers · Neo4j + Ollama">Graph RAG</h1>
          <nav className="tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? 'tab active' : 'tab'}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="header-right">
          <div className="status">
            <span className={`dot ${neo4jOk ? 'ok' : 'bad'}`} title="Neo4j" />
            Neo4j
            <span className={`dot ${ollamaOk ? 'ok' : 'bad'}`} title="Ollama" />
            Ollama
            {stats && (
              <span className="counts">
                {nodeCount} nodes · {stats.relationships} rels
              </span>
            )}
          </div>
          <button onClick={handleSeed} disabled={seeding}>
            {seeding ? 'Loading + embedding…' : isEmpty ? 'Load sample data' : 'Reload sample data'}
          </button>
        </div>
      </header>

      {seedMsg && <div className="banner">{seedMsg}</div>}
      {health && !ollamaOk && (
        <div className="banner warn">
          Ollama is unreachable at the configured URL — check OLLAMA_BASE_URL and that your
          Ollama container publishes port 11434.
        </div>
      )}
      {health?.ollama?.reachable &&
        (!health.ollama.generation_model_available || !health.ollama.embedding_model_available) && (
          <div className="banner warn">
            Missing model(s) in Ollama:{' '}
            {[
              !health.ollama.generation_model_available && health.ollama.generation_model,
              !health.ollama.embedding_model_available && health.ollama.embedding_model,
            ]
              .filter(Boolean)
              .join(', ')}{' '}
            — run <code>ollama pull &lt;model&gt;</code> inside your Ollama container.
          </div>
        )}

      <main>
        {tab === 'explore' && (
          <div className="explore">
            {chatOpen && (
              <div className="chat-panel">
                <Chat onSources={setHighlightIds} />
              </div>
            )}
            <div className="graph-panel">
              <button
                className="panel-toggle"
                onClick={() => setChatOpen(!chatOpen)}
                title={chatOpen ? 'Hide chat — full-screen graph' : 'Show chat'}
              >
                {chatOpen ? '‹' : '›'}
              </button>
              <GraphView highlightIds={highlightIds} />
            </div>
          </div>
        )}
        {tab === 'ingest' && <Ingest onIngested={refresh} />}
      </main>
    </div>
  )
}

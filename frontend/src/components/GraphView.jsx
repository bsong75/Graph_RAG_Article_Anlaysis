import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import GraphCanvas from './GraphCanvas'
import { NODE_COLORS, NODE_ICONS } from '../constants'

const REL_GROUPS = {
  'AUTHORED:in': 'Authors',
  'AUTHORED:out': 'Papers written',
  'CITES:out': 'Cites',
  'CITES:in': 'Cited by',
  'HAS_TOPIC:out': 'Topics',
  'HAS_TOPIC:in': 'Papers with this topic',
  'AFFILIATED_WITH:out': 'Affiliated with',
  'AFFILIATED_WITH:in': 'Affiliated researchers',
}

const endId = (e) => (typeof e === 'object' && e !== null ? e.id : e)
const truncate = (s, n = 34) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '')

function DetailsPanel({ details, node, onJump, onClose }) {
  if (!details) return null
  const props = details.properties || {}
  const groups = {}
  for (const c of details.connections || []) {
    const key = REL_GROUPS[`${c.rel}:${c.direction}`] || `${c.rel} (${c.direction})`
    ;(groups[key] = groups[key] || []).push(c)
  }
  return (
    <div className="details-panel">
      <button className="details-close" onClick={onClose} title="Close">
        ×
      </button>
      <div className="details-type">
        <span className="dot" style={{ background: NODE_COLORS[details.label] }} />
        {details.label}
        {props.year ? ` · ${props.year}` : ''}
        {node ? ` · ${node.degree} connection${node.degree === 1 ? '' : 's'}` : ''}
      </div>
      <div className="details-name">{props.title || props.name}</div>
      {props.abstract && <p className="details-abstract">{props.abstract}</p>}
      {Object.entries(groups).map(([group, items]) => (
        <div key={group} className="details-group">
          <div className="details-group-title">
            {group} <span className="muted">({items.length})</span>
          </div>
          {items.map((c) => (
            <button key={`${c.rel}-${c.id}-${c.direction}`} className="details-link" onClick={() => onJump(c.id)}>
              <span className="dot" style={{ background: NODE_COLORS[c.label] }} />
              {c.name}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function GraphView({ highlightIds }) {
  const [graphData, setGraphData] = useState(null)
  const [error, setError] = useState('')
  const [selectedNode, setSelectedNode] = useState(null)
  const [selectedLink, setSelectedLink] = useState(null)
  const [details, setDetails] = useState(null)
  const focusNodeRef = useRef(null)
  const controlsRef = useRef(null)

  // Fetch and map the API payload into the shape GraphCanvas expects:
  // node.color, node.val (size), node.properties, link.type.
  useEffect(() => {
    api
      .graph()
      .then((raw) => {
        const degree = new Map()
        raw.links.forEach((l) => {
          degree.set(l.source, (degree.get(l.source) || 0) + 1)
          degree.set(l.target, (degree.get(l.target) || 0) + 1)
        })
        setGraphData({
          nodes: raw.nodes.map((n) => ({
            id: n.id,
            label: n.label,
            name: n.name,
            pid: n.pid,
            color: NODE_COLORS[n.label] || '#888',
            degree: degree.get(n.id) || 0,
            val: 4 + Math.sqrt(degree.get(n.id) || 0) * 1.8,
            properties: { name: truncate(n.name) },
          })),
          links: raw.links.map((l) => ({ source: l.source, target: l.target, type: l.rel })),
        })
      })
      .catch((err) => setError(err.message))
  }, [])

  // Load details whenever a node is selected.
  useEffect(() => {
    if (!selectedNode) {
      setDetails(null)
      return
    }
    let stale = false
    api
      .node(selectedNode.id)
      .then((d) => {
        if (!stale) setDetails(d)
      })
      .catch(() => {
        if (!stale) setDetails(null)
      })
    return () => {
      stale = true
    }
  }, [selectedNode])

  const removeNodes = useCallback((ids) => {
    const rm = new Set(ids)
    setGraphData((g) => ({
      nodes: g.nodes.filter((n) => !rm.has(n.id)),
      links: g.links.filter((l) => !rm.has(endId(l.source)) && !rm.has(endId(l.target))),
    }))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedNode(null)
    setSelectedLink(null)
  }, [])

  const counts = useMemo(() => {
    const c = {}
    graphData?.nodes.forEach((n) => {
      c[n.label] = (c[n.label] || 0) + 1
    })
    return c
  }, [graphData])

  const highlights = useMemo(() => new Set(highlightIds || []), [highlightIds])

  if (error) return <div className="banner warn">{error}</div>
  if (graphData && graphData.nodes.length === 0)
    return <div className="empty">Graph is empty — load the sample data first.</div>

  return (
    <div className="graph-view">
      <div className="legend">
        {Object.entries(NODE_COLORS).map(([label, color]) => (
          <span key={label}>
            <span className="legend-glyph">{NODE_ICONS[label]}</span>
            <span className="dot" style={{ background: color }} />
            {label}
            {counts[label] != null && <span className="legend-count"> {counts[label]}</span>}
          </span>
        ))}
        <span className="legend-hint">
          {highlights.size > 0
            ? 'dashed ring = retrieved for the last answer'
            : 'click for details · drop to pin 📌 · right-click for menu'}
        </span>
      </div>

      <div className="graph-controls">
        <button onClick={() => controlsRef.current?.zoomIn()} title="Zoom in">+</button>
        <button onClick={() => controlsRef.current?.zoomOut()} title="Zoom out">−</button>
        <button onClick={() => controlsRef.current?.fit()} title="Fit graph to view">⛶</button>
      </div>

      <DetailsPanel
        details={details}
        node={selectedNode}
        onJump={(id) => focusNodeRef.current?.(id)}
        onClose={clearSelection}
      />

      {selectedLink && (
        <div className="edge-card">
          {truncate(selectedLink.source?.name, 26)}
          <span className="edge-rel"> —{selectedLink.type}→ </span>
          {truncate(selectedLink.target?.name, 26)}
        </div>
      )}

      <GraphCanvas
        graphData={graphData || { nodes: [], links: [] }}
        removeNodes={removeNodes}
        selectedNode={selectedNode}
        onNodeClick={setSelectedNode}
        selectedLink={selectedLink}
        onLinkClick={setSelectedLink}
        onBackgroundClick={clearSelection}
        loading={!graphData && !error}
        theme="dark"
        focusNodeRef={focusNodeRef}
        controlsRef={controlsRef}
        highlightIds={highlights}
      />
    </div>
  )
}

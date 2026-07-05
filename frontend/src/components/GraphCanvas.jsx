// Ported from galaxy_neo4tune/client/src/components/GraphCanvas.jsx.
// Adaptations for this app: constants schema (Paper/Author/Topic/Institution),
// link distances tuned for the citation graph, optional highlightIds (dashed
// ring on papers retrieved for the last answer), controlsRef (external zoom
// buttons), and onBackgroundClick to clear selection.
import { useRef, useCallback, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { NODE_LABELS, NODE_ICONS, NODE_SIZES, NODE_DISPLAY_PROPERTY } from '../constants';

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export default function GraphCanvas({
  graphData,
  removeNodes,
  selectedNode,
  onNodeClick,
  selectedLink,
  onLinkClick,
  onBackgroundClick,
  loading,
  theme,
  focusNodeRef,
  controlsRef,
  highlightIds,
}) {
  const fgRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 1600, height: 900 });
  const [ctxMenu, setCtxMenu] = useState(null);
  const [animationReady, setAnimationReady] = useState(false);

  // Animation tracking
  const nodeOpacity = useRef(new Map());
  const linkOpacity = useRef(new Map());
  const animationFrameRef = useRef();
  const lastUpdateTime = useRef(Date.now());
  const isInitialLoad = useRef(true);

  // Track container size so the canvas fits the available area
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Animate node/link opacity for smooth transitions
  useEffect(() => {
    if (graphData.nodes.length === 0) return;

    const currentNodeIds = new Set(graphData.nodes.map(n => n.id));
    const currentLinkIds = new Set(graphData.links.map(l => `${typeof l.source === 'object' ? l.source.id : l.source}-${typeof l.target === 'object' ? l.target.id : l.target}`));

    const initialOpacity = isInitialLoad.current ? 1 : 0;

    graphData.nodes.forEach(node => {
      if (!nodeOpacity.current.has(node.id)) {
        nodeOpacity.current.set(node.id, initialOpacity);
      }
    });

    graphData.links.forEach(link => {
      const linkId = `${typeof link.source === 'object' ? link.source.id : link.source}-${typeof link.target === 'object' ? link.target.id : link.target}`;
      if (!linkOpacity.current.has(linkId)) {
        linkOpacity.current.set(linkId, initialOpacity);
      }
    });

    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      setAnimationReady(true);
      return;
    }

    const animate = () => {
      const now = Date.now();
      const delta = Math.min((now - lastUpdateTime.current) / 300, 1); // 300ms transition
      lastUpdateTime.current = now;
      let needsUpdate = false;

      nodeOpacity.current.forEach((opacity, nodeId) => {
        const target = currentNodeIds.has(nodeId) ? 1 : 0;
        if (Math.abs(opacity - target) > 0.01) {
          const newOpacity = opacity + (target - opacity) * delta * 3;
          nodeOpacity.current.set(nodeId, newOpacity);
          needsUpdate = true;
        } else {
          nodeOpacity.current.set(nodeId, target);
          if (target === 0) {
            nodeOpacity.current.delete(nodeId);
          }
        }
      });

      linkOpacity.current.forEach((opacity, linkId) => {
        const target = currentLinkIds.has(linkId) ? 1 : 0;
        if (Math.abs(opacity - target) > 0.01) {
          const newOpacity = opacity + (target - opacity) * delta * 3;
          linkOpacity.current.set(linkId, newOpacity);
          needsUpdate = true;
        } else {
          linkOpacity.current.set(linkId, target);
          if (target === 0) {
            linkOpacity.current.delete(linkId);
          }
        }
      });

      if (needsUpdate) {
        if (fgRef.current) {
          fgRef.current.d3ReheatSimulation();
        }
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    lastUpdateTime.current = Date.now();
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [graphData]);

  // Dismiss context menu on click elsewhere or Escape
  useEffect(() => {
    if (!ctxMenu) return;

    const dismiss = () => setCtxMenu(null);
    const onKey = (e) => { if (e.key === 'Escape') dismiss(); };

    const timer = setTimeout(() => {
      window.addEventListener('click', dismiss);
      window.addEventListener('contextmenu', dismiss);
      window.addEventListener('keydown', onKey);
    }, 0);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', dismiss);
      window.removeEventListener('contextmenu', dismiss);
      window.removeEventListener('keydown', onKey);
    };
  }, [ctxMenu]);

  const handleNodeDragEnd = useCallback((node) => {
    node.fx = node.x;
    node.fy = node.y;
  }, []);

  const handleNodeRightClick = useCallback((node, event) => {
    event.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    setCtxMenu({
      node,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }, []);

  const handleUnpin = useCallback(() => {
    if (!ctxMenu) return;
    ctxMenu.node.fx = undefined;
    ctxMenu.node.fy = undefined;
    fgRef.current?.d3ReheatSimulation();
    setCtxMenu(null);
  }, [ctxMenu]);

  const handleRemoveWithChildren = useCallback(() => {
    if (!ctxMenu) return;
    const { node } = ctxMenu;
    const { nodes, links } = graphData;

    const getId = (endpoint) => typeof endpoint === 'object' ? endpoint.id : endpoint;

    // Build adjacency maps
    const outgoing = new Map();
    const incoming = new Map();
    links.forEach((link) => {
      const s = getId(link.source);
      const t = getId(link.target);
      if (!outgoing.has(s)) outgoing.set(s, []);
      outgoing.get(s).push(t);
      if (!incoming.has(t)) incoming.set(t, []);
      incoming.get(t).push(s);
    });

    // BFS to find all descendants
    const candidates = new Set();
    const stack = [node.id];
    while (stack.length) {
      const current = stack.pop();
      if (candidates.has(current)) continue;
      candidates.add(current);
      const children = outgoing.get(current) || [];
      children.forEach((childId) => {
        if (!candidates.has(childId)) stack.push(childId);
      });
    }

    // Start with all candidates marked for removal
    const toRemove = new Set(candidates);

    // Iteratively rescue nodes that have an incoming edge from outside the removal set
    let changed = true;
    while (changed) {
      changed = false;
      toRemove.forEach((id) => {
        if (id === node.id) return; // always remove the clicked node
        const parents = incoming.get(id) || [];
        const hasExternalParent = parents.some((p) => !toRemove.has(p));
        if (hasExternalParent) {
          toRemove.delete(id);
          changed = true;
        }
      });
    }

    // Clear selected node if it's being removed
    if (selectedNode && toRemove.has(selectedNode.id)) {
      onNodeClick(null);
    }

    removeNodes([...toRemove]);
    setCtxMenu(null);
  }, [ctxMenu, graphData, removeNodes, selectedNode, onNodeClick]);

  const handleNodeClick = useCallback((node) => {
    onNodeClick(node);
    onLinkClick(null);
  }, [onNodeClick, onLinkClick]);

  const handleLinkClick = useCallback((link) => {
    onLinkClick(link);
    onNodeClick(null);
  }, [onLinkClick, onNodeClick]);

  const paintNode = useCallback((node, ctx, globalScale) => {
    const icon = NODE_ICONS[node.label];
    const label = NODE_LABELS[node.label] || '?';
    const displayProp = NODE_DISPLAY_PROPERTY[node.label];
    const displayVal = node.properties?.[displayProp] || '';
    const nodeSize = NODE_SIZES[node.label] || node.val || 6;
    const fontSize = nodeSize * 0.9;
    const textColor = getCssVar('--text-primary') || '#fff';
    const subTextColor = getCssVar('--text-secondary') || '#ddd';

    // Get animated opacity
    const opacity = nodeOpacity.current.get(node.id) ?? 1;
    ctx.globalAlpha = opacity;

    // Draw circle background
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
    ctx.fillStyle = node.color || '#999';
    ctx.fill();

    // Highlight selected node
    if (selectedNode && selectedNode.id === node.id) {
      ctx.strokeStyle = textColor;
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    // Dashed ring marks papers retrieved for the latest RAG answer
    if (highlightIds && node.pid && highlightIds.has(node.pid)) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize + 3 / globalScale, 0, 2 * Math.PI);
      ctx.setLineDash([4 / globalScale, 3 / globalScale]);
      ctx.lineWidth = 1.8 / globalScale;
      ctx.strokeStyle = textColor;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw icon or label abbreviation inside
    if (icon) {
      const iconSize = nodeSize * 1.4;
      ctx.font = `${iconSize}px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, node.x, node.y);
    } else {
      ctx.font = `bold ${fontSize}px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = textColor;
      ctx.fillText(label, node.x, node.y);
    }

    // Pin badge for nodes fixed in place by the user
    if (node.fx !== undefined && node.fx !== null) {
      ctx.font = `${Math.max(nodeSize * 0.9, 5)}px Sans-Serif`;
      ctx.fillText('📌', node.x + nodeSize * 0.9, node.y - nodeSize * 0.9);
    }

    // Draw display value below
    if (displayVal) {
      ctx.font = `${fontSize * 0.8}px Sans-Serif`;
      ctx.fillStyle = subTextColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayVal, node.x, node.y + nodeSize + fontSize);
    }

    // Reset opacity
    ctx.globalAlpha = 1;
  }, [selectedNode, theme, animationReady, highlightIds]);

  const paintLink = useCallback((link, ctx, globalScale) => {
    const fontSize = 8 / globalScale;
    const start = link.source;
    const end = link.target;

    if (typeof start !== 'object' || typeof end !== 'object') return;

    const isSelected = selectedLink && selectedLink === link;
    const linkColor = isSelected
      ? (getCssVar('--text-primary') || '#fff')
      : (getCssVar('--link-color') || 'rgba(255,255,255,0.8)');
    const labelColor = isSelected
      ? (getCssVar('--text-primary') || '#fff')
      : (getCssVar('--link-label') || 'rgba(255,255,255,0.9)');

    const linkId = `${typeof link.source === 'object' ? link.source.id : link.source}-${typeof link.target === 'object' ? link.target.id : link.target}`;
    const opacity = linkOpacity.current.get(linkId) ?? 1;

    // Calculate curve control point
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (!distance) return;

    // Perpendicular offset for curve (20% of distance)
    const curvature = distance * 0.2;
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    // Control point perpendicular to the line
    const controlX = midX + (-dy / distance) * curvature;
    const controlY = midY + (dx / distance) * curvature;

    ctx.globalAlpha = opacity;

    // Draw curved line
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(controlX, controlY, end.x, end.y);
    ctx.strokeStyle = linkColor;
    ctx.lineWidth = isSelected ? 2 / globalScale : 1.5 / globalScale;
    ctx.stroke();

    // Draw relationship type at curve midpoint (only if link is mostly visible)
    if (opacity > 0.5) {
      const labelX = 0.25 * start.x + 0.5 * controlX + 0.25 * end.x;
      const labelY = 0.25 * start.y + 0.5 * controlY + 0.25 * end.y;

      ctx.font = `${isSelected ? 'bold ' : ''}${fontSize}px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = labelColor;
      ctx.fillText(link.type, labelX, labelY);
    }

    // Reset opacity
    ctx.globalAlpha = 1;
  }, [theme, selectedLink, animationReady]);

  // Configure link distance and repulsion for this app's citation graph
  useEffect(() => {
    if (!fgRef.current) return;
    fgRef.current.d3Force('charge')?.strength(-260);
    const linkForce = fgRef.current.d3Force('link');
    if (linkForce) {
      linkForce.distance((link) => (link.type === 'CITES' ? 110 : 60));
      fgRef.current.d3ReheatSimulation();
    }
  }, [graphData]);

  // Center the graph when data changes
  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      setTimeout(() => {
        fgRef.current.zoomToFit(400, 60);
        // Cap zoom so nodes don't appear oversized
        const MAX_ZOOM = 2;
        if (fgRef.current.zoom() > MAX_ZOOM) {
          fgRef.current.zoom(MAX_ZOOM, 400);
        }
      }, 500);
    }
  }, [graphData]);

  // Expose a focus function so other components can zoom to a node
  useEffect(() => {
    if (!focusNodeRef) return;
    focusNodeRef.current = (nodeId) => {
      const node = graphData.nodes.find((n) => n.id === nodeId);
      if (!node || !fgRef.current) return;
      fgRef.current.centerAt(node.x, node.y, 800);
      fgRef.current.zoom(4, 800);
      onNodeClick(node);
    };
  }, [focusNodeRef, graphData, onNodeClick]);

  // Expose zoom controls for external buttons
  useEffect(() => {
    if (!controlsRef) return;
    controlsRef.current = {
      zoomIn: () => fgRef.current?.zoom(fgRef.current.zoom() * 1.5, 300),
      zoomOut: () => fgRef.current?.zoom(fgRef.current.zoom() / 1.5, 300),
      fit: () => fgRef.current?.zoomToFit(500, 60),
    };
  }, [controlsRef]);

  const canvasBg = theme === 'light' ? '#E3F2FD' : (getCssVar('--bg-canvas') || '#0D1B2A');

  const menuBtnStyle = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'none',
    border: 'none',
    padding: '8px 12px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '13px',
  };

  return (
    <div ref={containerRef} style={{ flex: 1, background: 'var(--bg-canvas)', position: 'relative', overflow: 'hidden' }}>
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        nodeCanvasObject={paintNode}
        linkCanvasObject={paintLink}
        onNodeClick={handleNodeClick}
        onNodeDragEnd={handleNodeDragEnd}
        onNodeRightClick={handleNodeRightClick}
        onLinkClick={handleLinkClick}
        onBackgroundClick={() => onBackgroundClick?.()}
        linkHoverPrecision={8}
        nodeId="id"
        linkSource="source"
        linkTarget="target"
        backgroundColor={canvasBg}
        nodeRelSize={6}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />
      {ctxMenu && (
        <div
          style={{
            position: 'absolute',
            left: ctxMenu.x,
            top: ctxMenu.y,
            zIndex: 20,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-hover)',
            borderRadius: '6px',
            padding: '4px 0',
            minWidth: '180px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            padding: '4px 12px',
            fontSize: '11px',
            color: 'var(--text-dim)',
            borderBottom: '1px solid var(--border-color)',
          }}>
            {ctxMenu.node.label}: {ctxMenu.node.properties?.[NODE_DISPLAY_PROPERTY[ctxMenu.node.label]] || ctxMenu.node.id}
          </div>
          <button
            onClick={handleUnpin}
            style={menuBtnStyle}
            onMouseEnter={(e) => e.target.style.background = 'var(--border-color)'}
            onMouseLeave={(e) => e.target.style.background = 'none'}
          >
            Unpin node
          </button>
          <button
            onClick={handleRemoveWithChildren}
            style={{ ...menuBtnStyle, color: '#F44336' }}
            onMouseEnter={(e) => e.target.style.background = 'var(--border-color)'}
            onMouseLeave={(e) => e.target.style.background = 'none'}
          >
            Remove node &amp; children
          </button>
        </div>
      )}
      {loading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.4)',
          zIndex: 30,
        }}>
          <div style={{ textAlign: 'center', color: 'var(--text-primary)' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid var(--border-color)',
              borderTop: '4px solid #1976D2',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 12px',
            }} />
            <div style={{ fontSize: '14px' }}>Loading...</div>
          </div>
        </div>
      )}
    </div>
  );
}

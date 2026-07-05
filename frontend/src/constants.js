// Node styling contract consumed by GraphCanvas (ported from galaxy_neo4tune).

// Dark categorical steps validated against the canvas surface (#171c26).
export const NODE_COLORS = {
  Paper: '#3987e5',
  Author: '#199e70',
  Topic: '#c98500',
  Institution: '#9085e9',
}

// Fallback abbreviation drawn inside the circle when no icon exists.
export const NODE_LABELS = {
  Paper: 'P',
  Author: 'A',
  Topic: 'T',
  Institution: 'I',
}

export const NODE_ICONS = {
  Paper: '📄',
  Author: '👤',
  Topic: '💡',
  Institution: '🏛️',
}

// Empty on purpose: GraphCanvas falls back to node.val, which we set from
// the node's connection count so hubs render larger.
export const NODE_SIZES = {}

// Which property to print under each node.
export const NODE_DISPLAY_PROPERTY = {
  Paper: 'name',
  Author: 'name',
  Topic: 'name',
  Institution: 'name',
}

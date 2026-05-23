'use client';

// GraphView — Cytoscape.js interactive graph.
//
// Improvements in this version:
//   • Position persistence — layout runs once; on re-renders positions are
//     restored from a ref so nodes don't jump around.
//   • Node search — search bar highlights matching nodes, fades the rest.
//   • Export PNG — downloads the full graph as a PNG image.

import { useEffect, useRef, useState } from 'react';
import styles from './GraphView.module.css';

const NODE_COLORS = {
  file:     '#a78bfa',
  function: '#38bdf8',
  class:    '#fbbf24',
  import:   '#34d399',
};

const NODE_GLOW = {
  file:     '#7c3aed',
  function: '#0284c7',
  class:    '#d97706',
  import:   '#059669',
};

const EDGE_STYLES = {
  contains: { color: '#6366f140', width: 1,   dash: null  },
  calls:    { color: '#38bdf870', width: 1.5, dash: null  },
  imports:  { color: '#34d39960', width: 1,   dash: [6,3] },
  extends:  { color: '#fbbf2470', width: 2,   dash: null  },
};

export default function GraphView({ nodes, edges, onNodeSelect }) {
  const containerRef    = useRef(null);
  const cyRef           = useRef(null);
  // persist node positions across re-renders so layout doesn't randomise again
  const savedPositions  = useRef({});

  const [searchQuery, setSearchQuery] = useState('');

  // ── build / restore the graph ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !nodes?.length) return;

    import('cytoscape').then(({ default: cytoscape }) => {
      if (cyRef.current) { cyRef.current.destroy(); }

      // check whether we have saved positions for every node in this dataset
      const hasSavedPositions = nodes.every((n) => savedPositions.current[n.id]);

      const cy = cytoscape({
        container: containerRef.current,

        elements: [
          ...nodes.map((n) => ({
            data: { id: n.id, label: n.label, type: n.type, file: n.file, description: n.description },
            // restore position if available so nodes don't jump
            position: hasSavedPositions ? savedPositions.current[n.id] : undefined,
          })),
          ...edges
            .filter((e) => e.source && e.target)
            .map((e, i) => ({
              data: { id: `e-${i}`, source: e.source, target: e.target, type: e.type },
            })),
        ],

        style: [
          {
            selector: 'node',
            style: {
              'background-color': (el) => NODE_COLORS[el.data('type')] ?? '#a78bfa',
              'shadow-blur':      18,
              'shadow-color':     (el) => NODE_GLOW[el.data('type')] ?? '#7c3aed',
              'shadow-opacity':   0.55,
              'shadow-offset-x':  0,
              'shadow-offset-y':  0,
              'border-width':     1.5,
              'border-color':     'rgba(255,255,255,0.2)',
              'border-opacity':   1,
              'width':            (el) => el.data('type') === 'file' ? 30 : 16,
              'height':           (el) => el.data('type') === 'file' ? 30 : 16,
              'label':            '',
              'color':            '#e8e8ff',
              'font-size':        10,
              'font-family':      'Inter, system-ui, sans-serif',
              'font-weight':      '600',
              'text-valign':      'bottom',
              'text-halign':      'center',
              'text-margin-y':    6,
              'text-max-width':   80,
              'text-wrap':        'ellipsis',
              'text-background-color':   '#0a0a14',
              'text-background-opacity': 0.88,
              'text-background-padding': '3px',
            },
          },
          {
            // file nodes always show their label — they're the main landmarks
            selector: 'node[type = "file"]',
            style: { 'label': 'data(label)', 'font-size': 10 },
          },
          {
            selector: 'node:selected',
            style: {
              'label': 'data(label)', 'font-size': 11,
              'border-width': 2.5, 'border-color': '#ffffff', 'border-opacity': 1,
              'shadow-opacity': 0.9, 'shadow-blur': 28,
            },
          },
          {
            selector: 'node.hovered',
            style: {
              'label': 'data(label)', 'font-size': 10,
              'border-color': 'rgba(255,255,255,0.5)',
              'shadow-opacity': 0.8, 'shadow-blur': 24,
            },
          },
          {
            // dimmed — non-matching nodes during search or after tap
            selector: 'node.faded',
            style: { 'opacity': 0.12, 'shadow-opacity': 0 },
          },
          {
            // highlighted — search match or selected neighbourhood
            selector: 'node.highlighted',
            style: {
              'label':          'data(label)',
              'font-size':      11,
              'border-color':   '#facc15',
              'border-width':   2.5,
              'shadow-color':   '#eab308',
              'shadow-opacity': 0.85,
              'shadow-blur':    26,
            },
          },
          {
            selector: 'edge',
            style: {
              'line-color':         (el) => EDGE_STYLES[el.data('type')]?.color ?? '#6366f140',
              'width':              (el) => EDGE_STYLES[el.data('type')]?.width ?? 1,
              'line-dash-pattern':  (el) => EDGE_STYLES[el.data('type')]?.dash ?? [],
              'line-style':         (el) => EDGE_STYLES[el.data('type')]?.dash ? 'dashed' : 'solid',
              'curve-style':        'bezier',
              'target-arrow-shape': 'triangle',
              'target-arrow-color': (el) => EDGE_STYLES[el.data('type')]?.color ?? '#6366f140',
              'arrow-scale':        0.55,
              'shadow-blur':    4,
              'shadow-color':   (el) => EDGE_STYLES[el.data('type')]?.color ?? '#6366f1',
              'shadow-opacity': 0.2,
              'shadow-offset-x': 0,
              'shadow-offset-y': 0,
            },
          },
          { selector: 'edge.faded', style: { opacity: 0.04 } },
          {
            // edge label — visible only on hover so it doesn't clutter the graph
            selector: 'edge.edgeHovered',
            style: {
              'label':                    'data(type)',
              'font-size':                9,
              'font-family':              "'DM Mono', monospace",
              'color':                    'rgba(255,255,255,0.55)',
              'text-background-color':    '#0a0a14',
              'text-background-opacity':  0.9,
              'text-background-padding':  '3px',
              'text-rotation':            'autorotate',
            },
          },
        ],

        // use preset layout (no animation) if we have saved positions,
        // otherwise run cose to compute an initial layout
        layout: hasSavedPositions
          ? { name: 'preset', fit: true, padding: 50 }
          : {
              name:              'cose',
              animate:           true,
              animationDuration: 900,
              animationEasing:   'ease-out',
              randomize:         true,
              nodeRepulsion:     () => 4500,
              idealEdgeLength:   () => 60,
              edgeElasticity:    () => 100,
              gravity:           0.4,
              numIter:           1200,
              fit:               true,
              padding:           50,
              componentSpacing:  60,
            },

        minZoom: 0.15,
        maxZoom: 4,
        wheelSensitivity: 0.25,
      });

      // save positions after the layout finishes so re-renders are stable
      cy.on('layoutstop', () => {
        cy.nodes().forEach((n) => {
          savedPositions.current[n.id()] = { ...n.position() };
        });
      });

      // also save after the user drags a node so manual adjustments persist
      cy.on('dragfree', 'node', (evt) => {
        savedPositions.current[evt.target.id()] = { ...evt.target.position() };
      });

      // ── tap node ────────────────────────────────────────────────────
      cy.on('tap', 'node', (evt) => {
        const node = evt.target;
        cy.elements().removeClass('faded highlighted');
        cy.elements().not(node.closedNeighborhood()).addClass('faded');
        onNodeSelect?.(node.data());
      });

      // ── tap background → reset ────────────────────────────────────
      cy.on('tap', (evt) => {
        if (evt.target === cy) {
          cy.elements().removeClass('faded highlighted');
          onNodeSelect?.(null);
        }
      });

      cy.on('mouseover', 'node', (evt) => { evt.target.addClass('hovered'); });
      cy.on('mouseout',  'node', (evt) => { evt.target.removeClass('hovered'); });

      // edge hover — reveal the relationship type label (calls / imports / etc.)
      cy.on('mouseover', 'edge', (evt) => { evt.target.addClass('edgeHovered'); });
      cy.on('mouseout',  'edge', (evt) => { evt.target.removeClass('edgeHovered'); });

      cyRef.current = cy;
    });

    return () => { cyRef.current?.destroy(); };
  }, [nodes, edges, onNodeSelect]);

  // ── search — highlight matching nodes, fade the rest ──────────────────
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.elements().removeClass('faded highlighted');

    const q = searchQuery.trim().toLowerCase();
    if (!q) return;

    const matched   = cy.nodes().filter((n) => n.data('label').toLowerCase().includes(q));
    const unmatched = cy.nodes().not(matched);

    if (matched.length === 0) return;

    unmatched.addClass('faded');
    matched.addClass('highlighted');
  }, [searchQuery]);

  // ── export graph as PNG ───────────────────────────────────────────────
  function exportPNG() {
    const cy = cyRef.current;
    if (!cy) return;

    // render the full graph (not just the viewport) at 2× resolution
    const dataUrl = cy.png({ output: 'base64uri', bg: '#080810', full: true, scale: 2 });
    const a = document.createElement('a');
    a.href     = dataUrl;
    a.download = 'codegraph.png';
    a.click();
  }

  function handleSearchKey(e) {
    if (e.key === 'Escape') setSearchQuery('');
  }

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.canvas} id="cy-canvas" />

      {/* ── search bar — top center of graph area ── */}
      <div className={styles.searchBar}>
        <span className={styles.searchIcon}>⌕</span>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search nodes…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKey}
          aria-label="Search graph nodes"
          id="graph-search"
          spellCheck={false}
        />
        {searchQuery && (
          <button className={styles.searchClear} onClick={() => setSearchQuery('')} aria-label="Clear search">
            ✕
          </button>
        )}
      </div>

      {/* ── legend — bottom left ── */}
      <div className={styles.legend} aria-label="Graph legend">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <span key={type} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
            {type}
          </span>
        ))}
      </div>

      {/* ── controls — bottom right: zoom + export ── */}
      <div className={styles.controls}>
        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 15 }}
          onClick={() => cyRef.current?.zoom({ level: cyRef.current.zoom() * 1.25, renderedPosition: { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 } })}
          aria-label="Zoom in">+</button>
        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 15 }}
          onClick={() => cyRef.current?.fit(undefined, 50)}
          aria-label="Fit graph to screen">⊡</button>
        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 15 }}
          onClick={() => cyRef.current?.zoom({ level: cyRef.current.zoom() * 0.8, renderedPosition: { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 } })}
          aria-label="Zoom out">−</button>
        <div className={styles.controlDivider} />
        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}
          onClick={exportPNG}
          aria-label="Export graph as PNG"
          title="Export as PNG">↓ PNG</button>
      </div>
    </div>
  );
}

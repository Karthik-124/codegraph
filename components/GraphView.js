'use client';

// Cytoscape.js must run client-side only — it touches the DOM directly.
// We import it lazily inside useEffect to avoid SSR issues with Next.js.

import { useEffect, useRef } from 'react';
import styles from './GraphView.module.css';

// node colours — intentionally vivid so they read well on the dark canvas
const NODE_COLORS = {
  file:     '#a78bfa', // soft purple
  function: '#38bdf8', // sky blue
  class:    '#fbbf24', // amber
  import:   '#34d399', // emerald
};

// glow colour per type — slightly more saturated than the fill
const NODE_GLOW = {
  file:     '#7c3aed',
  function: '#0284c7',
  class:    '#d97706',
  import:   '#059669',
};

// edge style per relationship — connecting lines that feel purposeful
const EDGE_STYLES = {
  contains: { color: '#6366f140', width: 1,   dash: null  },
  calls:    { color: '#38bdf870', width: 1.5, dash: null  },
  imports:  { color: '#34d39960', width: 1,   dash: [6,3] },
  extends:  { color: '#fbbf2470', width: 2,   dash: null  },
};

export default function GraphView({ nodes, edges, onNodeSelect }) {
  const containerRef = useRef(null);
  const cyRef        = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !nodes?.length) return;

    import('cytoscape').then(({ default: cytoscape }) => {
      if (cyRef.current) { cyRef.current.destroy(); }

      const cy = cytoscape({
        container: containerRef.current,

        // ── elements ──────────────────────────────────────────────────
        elements: [
          ...nodes.map((n) => ({
            data: {
              id:          n.id,
              label:       n.label,
              type:        n.type,
              file:        n.file,
              description: n.description,
            },
          })),
          ...edges
            .filter((e) => e.source && e.target)
            .map((e, i) => ({
              data: {
                id:     `e-${i}`,
                source: e.source,
                target: e.target,
                type:   e.type,
              },
            })),
        ],

        // ── style ─────────────────────────────────────────────────────
        style: [
          {
            // base — all nodes start with no label so non-file nodes stay clean
            selector: 'node',
            style: {
              // fill with a two-stop radial gradient: bright centre → darker edge
              'background-color':          (el) => NODE_COLORS[el.data('type')] ?? '#a78bfa',
              'background-gradient-stop-colors': (el) => {
                const c = NODE_COLORS[el.data('type')] ?? '#a78bfa';
                return `${c} ${c}88`; // same hue, fade to 53% alpha at the edge
              },
              'background-gradient-stop-positions': '0 100',
              'background-fill':           'radial-gradient',

              // glow via shadow
              'shadow-blur':    20,
              'shadow-color':   (el) => NODE_GLOW[el.data('type')] ?? '#7c3aed',
              'shadow-opacity': 0.6,
              'shadow-offset-x': 0,
              'shadow-offset-y': 0,

              // border — thin white ring to separate node from background
              'border-width':   1.5,
              'border-color':   'rgba(255,255,255,0.25)',
              'border-opacity': 1,

              // size — file nodes are the hubs, everything else is smaller
              'width':  (el) => el.data('type') === 'file' ? 32 : 18,
              'height': (el) => el.data('type') === 'file' ? 32 : 18,

              // label — hidden by default; only file nodes always show
              'label':        '',
              'color':        '#f0f0ff',
              'font-size':    10,
              'font-family':  'Inter, system-ui, sans-serif',
              'font-weight':  '600',
              'text-valign':  'bottom',
              'text-halign':  'center',
              'text-margin-y': 6,
              'text-max-width': 80,
              'text-wrap':    'ellipsis',
              // pill background behind label so it never overlaps edges
              'text-background-color':   '#0d0d1a',
              'text-background-opacity': 0.85,
              'text-background-padding': '3px',
              'text-border-radius':      4,
            },
          },
          {
            // file nodes always show their label — they're the landmarks
            selector: 'node[type = "file"]',
            style: {
              'label':    'data(label)',
              'font-size': 10,
            },
          },
          {
            // selected node — brighter ring + show label
            selector: 'node:selected',
            style: {
              'label':          'data(label)',
              'font-size':      11,
              'border-width':   2.5,
              'border-color':   '#ffffff',
              'border-opacity': 1,
              'shadow-opacity': 0.9,
              'shadow-blur':    30,
            },
          },
          {
            // hovered — reveal label and intensify glow
            selector: 'node.hovered',
            style: {
              'label':        'data(label)',
              'font-size':    10,
              'border-color': 'rgba(255,255,255,0.6)',
              'shadow-opacity': 0.85,
              'shadow-blur':  28,
            },
          },
          {
            // faded — dim non-neighbours when a node is selected
            selector: 'node.faded',
            style: {
              opacity:         0.15,
              'shadow-opacity': 0,
            },
          },
          {
            // edges — subtle but visible, colour-coded by type
            selector: 'edge',
            style: {
              'line-color':          (el) => EDGE_STYLES[el.data('type')]?.color ?? '#6366f140',
              'width':               (el) => EDGE_STYLES[el.data('type')]?.width ?? 1,
              'line-dash-pattern':   (el) => EDGE_STYLES[el.data('type')]?.dash ?? [],
              'line-style':          (el) => EDGE_STYLES[el.data('type')]?.dash ? 'dashed' : 'solid',
              'curve-style':         'bezier',
              'target-arrow-shape':  'triangle',
              'target-arrow-color':  (el) => EDGE_STYLES[el.data('type')]?.color ?? '#6366f140',
              'arrow-scale':         0.55,
              // subtle glow on edges too
              'shadow-blur':    4,
              'shadow-color':   (el) => EDGE_STYLES[el.data('type')]?.color ?? '#6366f1',
              'shadow-opacity': 0.25,
              'shadow-offset-x': 0,
              'shadow-offset-y': 0,
            },
          },
          {
            selector: 'edge.faded',
            style: { opacity: 0.04 },
          },
        ],

        // ── layout — tighter cose so nodes cluster naturally ──────────
        layout: {
          name:              'cose',
          animate:           true,
          animationDuration: 900,
          animationEasing:   'ease-out',
          randomize:         true,
          // smaller repulsion → nodes sit closer together, graph feels denser
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

      // ── tap node → highlight neighbourhood ────────────────────────
      cy.on('tap', 'node', (evt) => {
        const node = evt.target;
        cy.elements().removeClass('faded');
        cy.elements().not(node.closedNeighborhood()).addClass('faded');
        onNodeSelect?.(node.data());
      });

      // ── tap background → reset ────────────────────────────────────
      cy.on('tap', (evt) => {
        if (evt.target === cy) {
          cy.elements().removeClass('faded');
          onNodeSelect?.(null);
        }
      });

      // ── hover → reveal label + boost glow ─────────────────────────
      cy.on('mouseover', 'node', (evt) => {
        evt.target.addClass('hovered');
      });

      cy.on('mouseout', 'node', (evt) => {
        evt.target.removeClass('hovered');
      });

      cyRef.current = cy;
    });

    return () => { cyRef.current?.destroy(); };
  }, [nodes, edges, onNodeSelect]);

  return (
    <div className={styles.wrapper}>
      {/* canvas — the dot-grid background is painted purely in CSS */}
      <div ref={containerRef} className={styles.canvas} id="cy-canvas" />

      {/* legend — bottom left */}
      <div className={styles.legend} aria-label="Graph legend">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <span key={type} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
            {type}
          </span>
        ))}
      </div>

      {/* zoom controls — bottom right */}
      <div className={styles.controls}>
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 12px', fontSize: 15 }}
          onClick={() => cyRef.current?.zoom({ level: cyRef.current.zoom() * 1.25, renderedPosition: { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 } })}
          aria-label="Zoom in"
        >+</button>
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 12px', fontSize: 15 }}
          onClick={() => cyRef.current?.fit(undefined, 50)}
          aria-label="Fit graph to screen"
          title="Fit to screen"
        >⊡</button>
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 12px', fontSize: 15 }}
          onClick={() => cyRef.current?.zoom({ level: cyRef.current.zoom() * 0.8, renderedPosition: { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 } })}
          aria-label="Zoom out"
        >−</button>
      </div>
    </div>
  );
}

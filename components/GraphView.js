'use client';

// Cytoscape.js must run client-side only — it touches the DOM directly.
// We import it lazily inside useEffect to avoid SSR issues with Next.js.

import { useEffect, useRef } from 'react';
import styles from './GraphView.module.css';

// colour for each node type — matches the CSS design tokens
const NODE_COLORS = {
  file:     '#7c3aed',
  function: '#06b6d4',
  class:    '#f59e0b',
  import:   '#10b981',
};

// edge style for each relationship type
const EDGE_STYLES = {
  contains: { lineColor: '#ffffff15', width: 1,   lineStyle: 'solid' },
  calls:    { lineColor: '#06b6d455', width: 1.5, lineStyle: 'solid' },
  imports:  { lineColor: '#10b98155', width: 1,   lineStyle: 'dashed' },
  extends:  { lineColor: '#f59e0b55', width: 2,   lineStyle: 'solid' },
};

export default function GraphView({ nodes, edges, onNodeSelect }) {
  const containerRef = useRef(null);
  const cyRef        = useRef(null); // holds the Cytoscape instance

  useEffect(() => {
    if (!containerRef.current || !nodes?.length) return;

    // dynamic import keeps Cytoscape out of the SSR bundle entirely
    import('cytoscape').then(({ default: cytoscape }) => {
      // tear down any existing instance before re-initialising
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
            .filter((e) => e.source && e.target) // drop any edge with missing refs
            .map((e, i) => ({
              data: {
                id:     `e-${i}`,
                source: e.source,
                target: e.target,
                type:   e.type,
              },
            })),
        ],

        // ── visual style ──────────────────────────────────────────────
        style: [
          {
            selector: 'node',
            style: {
              'background-color':   (el) => NODE_COLORS[el.data('type')] ?? '#7c3aed',
              'label':              'data(label)',
              'color':              '#f0f0ff',
              'font-size':          10,
              'font-family':        'Inter, system-ui, sans-serif',
              'text-valign':        'bottom',
              'text-margin-y':      6,
              'width':              (el) => el.data('type') === 'file' ? 28 : 18,
              'height':             (el) => el.data('type') === 'file' ? 28 : 18,
              'border-width':       2,
              'border-color':       'rgba(255,255,255,0.15)',
              'border-opacity':     1,
              'text-max-width':     80,
              'text-wrap':          'ellipsis',
            },
          },
          {
            // highlight the selected node with a white ring
            selector: 'node:selected',
            style: {
              'border-width': 3,
              'border-color': '#ffffff',
              'border-opacity': 1,
            },
          },
          {
            // dim unconnected nodes when something is selected
            selector: 'node.faded',
            style: { opacity: 0.25 },
          },
          {
            selector: 'edge',
            style: {
              'line-color':       (el) => EDGE_STYLES[el.data('type')]?.lineColor ?? '#ffffff15',
              'width':            (el) => EDGE_STYLES[el.data('type')]?.width ?? 1,
              'line-style':       (el) => EDGE_STYLES[el.data('type')]?.lineStyle ?? 'solid',
              'curve-style':      'bezier',
              'target-arrow-shape': 'triangle',
              'target-arrow-color': (el) => EDGE_STYLES[el.data('type')]?.lineColor ?? '#ffffff15',
              'arrow-scale':      0.7,
            },
          },
          {
            selector: 'edge.faded',
            style: { opacity: 0.08 },
          },
        ],

        // ── layout ────────────────────────────────────────────────────
        // "cose" (Compound Spring Embedder) gives a nice force-directed layout
        layout: {
          name:             'cose',
          animate:          true,
          animationDuration: 800,
          randomize:        true,
          nodeRepulsion:    () => 8000,
          idealEdgeLength:  () => 80,
          gravity:          0.25,
          numIter:          1000,
          fit:              true,
          padding:          40,
        },

        // ── interaction settings ───────────────────────────────────────
        minZoom: 0.2,
        maxZoom: 4,
        wheelSensitivity: 0.3,
      });

      // ── node click — highlight neighbours, call parent callback ───────
      cy.on('tap', 'node', (evt) => {
        const node = evt.target;
        const nodeData = node.data();

        // reset all fading first
        cy.elements().removeClass('faded');

        // fade everything that isn't connected to the tapped node
        const neighbourhood = node.closedNeighborhood();
        cy.elements().not(neighbourhood).addClass('faded');

        onNodeSelect?.(nodeData);
      });

      // ── click on background — reset fading ────────────────────────────
      cy.on('tap', (evt) => {
        if (evt.target === cy) {
          cy.elements().removeClass('faded');
          onNodeSelect?.(null);
        }
      });

      // ── hover tooltip — show label clearly on mouseover ───────────────
      cy.on('mouseover', 'node', (evt) => {
        evt.target.style({ 'font-size': 12, 'border-color': '#ffffff55' });
      });

      cy.on('mouseout', 'node', (evt) => {
        if (!evt.target.selected()) {
          evt.target.style({ 'font-size': 10, 'border-color': 'rgba(255,255,255,0.15)' });
        }
      });

      cyRef.current = cy;
    });

    // cleanup when the component unmounts or data changes
    return () => { cyRef.current?.destroy(); };
  }, [nodes, edges, onNodeSelect]);

  return (
    <div className={styles.wrapper}>
      {/* the div Cytoscape renders into — must have explicit dimensions */}
      <div ref={containerRef} className={styles.canvas} id="cy-canvas" />

      {/* legend — bottom-left corner */}
      <div className={styles.legend} aria-label="Graph legend">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <span key={type} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: color }} />
            {type}
          </span>
        ))}
      </div>

      {/* zoom controls — bottom-right corner */}
      <div className={styles.controls}>
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 10px', fontSize: 16 }}
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)}
          aria-label="Zoom in"
        >+</button>
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 10px', fontSize: 16 }}
          onClick={() => cyRef.current?.fit()}
          aria-label="Fit graph"
        >⊡</button>
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 10px', fontSize: 16 }}
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}
          aria-label="Zoom out"
        >−</button>
      </div>
    </div>
  );
}

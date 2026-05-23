'use client';

// HeroCanvas — animated floating graph nodes on a canvas.
// Nodes drift slowly, connect to nearby neighbours with faint lines,
// and pulse gently — exactly the visual from the Akoin IDR site.
// Runs client-side only (window/canvas access).

import { useEffect, useRef } from 'react';

// node types and their colours — same palette as the Cytoscape graph
const NODE_TYPES = [
  { color: '#a78bfa', glow: '#7c3aed' }, // file   — purple
  { color: '#38bdf8', glow: '#0284c7' }, // fn     — blue
  { color: '#fbbf24', glow: '#d97706' }, // class  — amber
  { color: '#34d399', glow: '#059669' }, // import — green
];

export default function HeroCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // make canvas fill its container
    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // ── create nodes ──────────────────────────────────────────────────
    const COUNT = Math.min(Math.floor((canvas.width * canvas.height) / 14000), 55);

    const nodes = Array.from({ length: COUNT }, () => {
      const type = NODE_TYPES[Math.floor(Math.random() * NODE_TYPES.length)];
      return {
        x:   Math.random() * canvas.width,
        y:   Math.random() * canvas.height,
        vx:  (Math.random() - 0.5) * 0.35,
        vy:  (Math.random() - 0.5) * 0.35,
        r:   Math.random() * 4 + 3,      // radius 3–7
        color: type.color,
        glow:  type.glow,
        // pulse phase offset so they don't all throb together
        phase: Math.random() * Math.PI * 2,
      };
    });

    // ── animation loop ────────────────────────────────────────────────
    let raf;
    let t = 0;

    function draw() {
      t += 0.012;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // ── draw edges between nearby nodes ──────────────────────────
      const CONNECT_DIST = 130;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx   = nodes[i].x - nodes[j].x;
          const dy   = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECT_DIST) {
            // fade opacity with distance — 0 at edge, 0.18 at closest
            const alpha = (1 - dist / CONNECT_DIST) * 0.18;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(167, 139, 250, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // ── draw and move nodes ───────────────────────────────────────
      for (const node of nodes) {
        // gentle pulse — radius oscillates ±1px
        const pulse = Math.sin(t + node.phase) * 1;
        const r = node.r + pulse;

        // glow shadow
        ctx.save();
        ctx.shadowBlur   = 14 + pulse * 3;
        ctx.shadowColor  = node.glow;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.restore();

        // move
        node.x += node.vx;
        node.y += node.vy;

        // bounce off edges
        if (node.x < node.r || node.x > canvas.width  - node.r) node.vx *= -1;
        if (node.y < node.r || node.y > canvas.height - node.r) node.vy *= -1;
      }

      raf = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

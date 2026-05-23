'use client';

// HeroCanvas — restrained particle graph for the landing page hero.
//
// Design decisions:
//   • Single accent colour — #a78bfa (purple), matching the file nodes
//     in the Cytoscape graph. No rainbow, no CodePen energy.
//   • Nodes are small (2–5px), mostly transparent — background, not foreground.
//   • Edges only appear when two nodes are very close — subtle lattice feel.
//   • Cursor LERP — particles very slowly lean toward wherever the cursor is,
//     giving the canvas a living, reactive quality without being distracting.

import { useEffect, useRef } from 'react';

const PURPLE      = '#a78bfa';
const PURPLE_GLOW = '#7c3aed';
const EDGE_COLOR  = 'rgba(124, 58, 237,'; // partial — alpha appended below

// how strongly particles are pulled toward the cursor (0 = none, 1 = instant)
// 0.018 is barely perceptible — just enough to feel alive
const LERP_STRENGTH = 0.018;
const CONNECT_DIST  = 120;

export default function HeroCanvas() {
  const canvasRef = useRef(null);
  const mouseRef  = useRef({ x: -9999, y: -9999 }); // off-screen default

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();

    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    // track cursor relative to the canvas element
    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    // use parent element so we catch mouse anywhere in the hero section
    canvas.parentElement.addEventListener('mousemove', onMouseMove);
    canvas.parentElement.addEventListener('mouseleave', () => {
      // glide back to center when cursor leaves
      mouseRef.current = { x: canvas.width / 2, y: canvas.height / 2 };
    });

    // ── create particles ────────────────────────────────────────────
    const COUNT = Math.min(Math.floor((canvas.width * canvas.height) / 16000), 45);

    const nodes = Array.from({ length: COUNT }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      vx:    (Math.random() - 0.5) * 0.3,
      vy:    (Math.random() - 0.5) * 0.3,
      // radius: small — these are background elements, not the hero
      r:     Math.random() * 2.5 + 1.5,
      // opacity varies so the field has depth (far/near feel)
      alpha: Math.random() * 0.45 + 0.2,
      // pulse phase — staggered so they breathe independently
      phase: Math.random() * Math.PI * 2,
    }));

    // ── animation ───────────────────────────────────────────────────
    let raf;
    let t = 0;

    function draw() {
      t += 0.01;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mouse = mouseRef.current;

      // ── edges first (drawn under nodes) ──────────────────────────
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx   = nodes[i].x - nodes[j].x;
          const dy   = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= CONNECT_DIST) continue;

          const edgeAlpha = (1 - dist / CONNECT_DIST) * 0.15;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.strokeStyle = `${EDGE_COLOR} ${edgeAlpha})`;
          ctx.lineWidth   = 0.6;
          ctx.stroke();
        }
      }

      // ── nodes ─────────────────────────────────────────────────────
      for (const n of nodes) {
        // subtle pulse — radius ±0.6px
        const pulse = Math.sin(t + n.phase) * 0.6;
        const r     = n.r + pulse;

        // LERP toward cursor — pull velocity slightly in cursor direction
        const dxM = mouse.x - n.x;
        const dyM = mouse.y - n.y;
        n.vx += dxM * LERP_STRENGTH * 0.004;
        n.vy += dyM * LERP_STRENGTH * 0.004;

        // cap speed so cursor pull never makes them shoot across the screen
        const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        if (speed > 0.7) { n.vx = (n.vx / speed) * 0.7; n.vy = (n.vy / speed) * 0.7; }

        n.x += n.vx;
        n.y += n.vy;

        // wrap edges instead of bounce — feels more organic
        if (n.x < -10)              n.x = canvas.width  + 10;
        if (n.x > canvas.width + 10) n.x = -10;
        if (n.y < -10)              n.y = canvas.height + 10;
        if (n.y > canvas.height + 10) n.y = -10;

        // draw with glow
        ctx.save();
        ctx.globalAlpha = n.alpha;
        ctx.shadowBlur  = 10 + pulse * 2;
        ctx.shadowColor = PURPLE_GLOW;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = PURPLE;
        ctx.fill();
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position:      'absolute',
        inset:         0,
        width:         '100%',
        height:        '100%',
        display:       'block',
        pointerEvents: 'none',
        zIndex:        0,
      }}
    />
  );
}

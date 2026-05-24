'use client';

// HeroCanvas — faithful port of the Akoin IDR hero graph animation.
//
// Behaviour (copied exactly):
//   • 60 nodes (30 on mobile) drift very slowly — vx/vy ≈ ±0.15 px/frame
//   • Each node connects to its K nearest neighbours (KNN), recomputed every ~2s
//   • 7 "active" nodes glow orange + pulse with a sine wave
//   • The rest are dim white (rgba 255,255,255,0.08)
//   • Cursor finds the nearest node within 200px and highlights IT + its edges orange
//   • Nodes do NOT move toward the cursor — zero attraction
//   • Accent color: #f45c00 (same orange as Akoin)

import { useEffect, useRef } from 'react';

const ORANGE      = 'rgba(244, 92, 0,';  // partial — append alpha + )
const DIM_WHITE   = 'rgba(255, 255, 255, 0.08)';
const EDGE_NORMAL = 'rgba(255, 255, 255, 0.06)';
const EDGE_HOT    = 'rgba(244, 92, 0, 0.7)';

export default function HeroCanvas() {
  const containerRef = useRef(null);

  useEffect(() => {
    const section = containerRef.current;
    if (!section) return;

    // inject the canvas element just like Akoin does
    const canvas = document.createElement('canvas');
    canvas.id = 'heroCanvas';
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;';
    section.insertBefore(canvas, section.firstChild);

    const ctx = canvas.getContext('2d');
    let w = 0, h = 0;

    const isMobile    = window.innerWidth <= 768;
    const NODE_COUNT  = isMobile ? 30 : 60;
    const ACTIVE_COUNT = isMobile ? 4 : 7;   // these nodes glow orange and pulse
    const K_NEIGHBORS = isMobile ? 2 : 3;    // each node connects to K nearest

    function resizeCanvas() {
      const rect = section.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width  = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // ── build nodes ─────────────────────────────────────────────────────
    const nodes = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x:         Math.random() * (w || window.innerWidth),
        y:         Math.random() * (h || window.innerHeight),
        vx:        (Math.random() - 0.5) * 0.15,   // very slow drift
        vy:        (Math.random() - 0.5) * 0.15,
        r:         3 + Math.random() * 5,            // radius 3–8 px
        active:    i < ACTIVE_COUNT,                 // first N are "active"
        phase:     Math.random() * Math.PI * 2,      // sine offset for pulsing
        neighbors: [],
      });
    }

    // ── K-nearest-neighbour edges ────────────────────────────────────────
    function computeNeighbors() {
      for (let i = 0; i < nodes.length; i++) {
        const dists = [];
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          dists.push({ index: j, dist: Math.sqrt(dx * dx + dy * dy) });
        }
        dists.sort((a, b) => a.dist - b.dist);
        nodes[i].neighbors = dists.slice(0, K_NEIGHBORS).map(d => d.index);
      }
    }
    computeNeighbors();

    // ── mouse / touch tracking — NO cursor attraction ─────────────────────
    let mouseX = -9999, mouseY = -9999;
    let targetedNode = -1;

    const onMouseMove = (e) => {
      const rect = section.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };
    const onMouseLeave = () => { mouseX = -9999; mouseY = -9999; targetedNode = -1; };
    const onTouchMove  = (e) => {
      if (e.touches.length > 0) {
        const rect = section.getBoundingClientRect();
        mouseX = e.touches[0].clientX - rect.left;
        mouseY = e.touches[0].clientY - rect.top;
      }
    };
    const onTouchEnd = () => { mouseX = -9999; mouseY = -9999; targetedNode = -1; };

    section.addEventListener('mousemove',  onMouseMove,  { passive: true });
    section.addEventListener('mouseleave', onMouseLeave);
    section.addEventListener('touchmove',  onTouchMove,  { passive: true });
    section.addEventListener('touchend',   onTouchEnd);

    // pause animation when hero scrolls off screen
    let heroVisible = true;
    const observer = new IntersectionObserver(
      (entries) => { heroVisible = entries[0].isIntersecting; },
      { threshold: 0 }
    );
    observer.observe(section);

    // ── animation loop ───────────────────────────────────────────────────
    let raf;
    let time = 0;
    let neighborTimer = 0;

    function animate() {
      raf = requestAnimationFrame(animate);
      if (!heroVisible) return;

      ctx.clearRect(0, 0, w, h);
      time++;
      neighborTimer++;

      // recompute KNN every ~2 s (120 frames at 60 fps)
      if (neighborTimer >= 120) {
        computeNeighbors();
        neighborTimer = 0;
      }

      // find nearest node to cursor (within 200 px) — only that one lights up
      if (mouseX > -9000) {
        let minDist = Infinity;
        targetedNode = -1;
        for (let i = 0; i < nodes.length; i++) {
          const dx   = nodes[i].x - mouseX;
          const dy   = nodes[i].y - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist && dist < 200) { minDist = dist; targetedNode = i; }
        }
      }

      // ── move nodes (drift only — no cursor attraction) ──────────────
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;
        // soft wrap at edges
        if (n.x < -20)    n.x = w + 20;
        if (n.x > w + 20) n.x = -20;
        if (n.y < -20)    n.y = h + 20;
        if (n.y > h + 20) n.y = -20;
      }

      // ── draw edges (KNN, deduplicated via Set) ───────────────────────
      // KNN is asymmetric: A may list B as neighbor but B may not list A.
      // The old j<=i skip silently dropped edges when the targeted node had
      // a lower index than its neighbor. Fix: track drawn pairs in a Set.
      const drawnPairs = new Set();
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        for (let k = 0; k < n.neighbors.length; k++) {
          const j   = n.neighbors[k];
          // canonical key: smaller index first so each pair is unique
          const key = Math.min(i, j) * 10000 + Math.max(i, j);
          if (drawnPairs.has(key)) continue;
          drawnPairs.add(key);

          const m = nodes[j];
          if (n.x < 0 || n.x > w || n.y < 0 || n.y > h) continue;
          if (m.x < 0 || m.x > w || m.y < 0 || m.y > h) continue;

          const isHot = (i === targetedNode || j === targetedNode);
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(m.x, m.y);
          ctx.strokeStyle = isHot ? EDGE_HOT : EDGE_NORMAL;
          ctx.lineWidth   = isHot ? 1 : 0.5;
          ctx.stroke();
        }
      }

      // ── draw nodes ──────────────────────────────────────────────────
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.x < 0 || n.x > w || n.y < 0 || n.y > h) continue;

        let radius, fillColor;

        if (i === targetedNode) {
          // nearest to cursor — solid orange, slightly enlarged, glow ring
          fillColor = `${ORANGE} 1)`;
          radius    = n.r * 1.3;
        } else if (n.active) {
          // active nodes — dim orange, pulsing
          const pulse = 0.7 + 0.3 * Math.sin(time * 0.03 + n.phase);
          radius    = n.r * (0.9 + 0.2 * Math.sin(time * 0.02 + n.phase));
          fillColor = `${ORANGE} ${0.3 * pulse})`;
        } else {
          // inactive — nearly invisible white
          fillColor = DIM_WHITE;
          radius    = n.r;
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();

        // glow ring on the targeted node only
        if (i === targetedNode) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, radius + 8, 0, Math.PI * 2);
          ctx.strokeStyle = `${ORANGE} 0.4)`;
          ctx.lineWidth   = 1.5;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resizeCanvas);
      section.removeEventListener('mousemove',  onMouseMove);
      section.removeEventListener('mouseleave', onMouseLeave);
      section.removeEventListener('touchmove',  onTouchMove);
      section.removeEventListener('touchend',   onTouchEnd);
      observer.disconnect();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, []);

  // returns the section div — canvas is injected as first child inside useEffect
  return <div ref={containerRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} aria-hidden="true" />;
}

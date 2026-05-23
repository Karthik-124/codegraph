'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import styles from './page.module.css';

// load canvas animation client-side only (it accesses window/canvas)
const HeroCanvas = dynamic(() => import('@/components/HeroCanvas'), { ssr: false });

// small repos that comfortably fit within Groq's free-tier token limits
const EXAMPLE_REPOS = [
  { label: 'expressjs/express', url: 'https://github.com/expressjs/express' },
  { label: 'fastify/fastify',   url: 'https://github.com/fastify/fastify'   },
  { label: 'axios/axios',       url: 'https://github.com/axios/axios'       },
];

const HOW_IT_WORKS = [
  { n: '01', label: 'Paste URL',   detail: 'Any public GitHub repo' },
  { n: '02', label: 'Fetch Files', detail: 'GitHub Contents API'    },
  { n: '03', label: 'LLM Analysis', detail: 'Groq Llama 3.3 70B'   },
  { n: '04', label: 'Graph',       detail: 'Cytoscape.js render'    },
];

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl]     = useState('');
  const [error, setError] = useState('');
  const [tick, setTick]   = useState(false); // for cursor blink

  // blinking cursor in terminal section
  useEffect(() => {
    const t = setInterval(() => setTick((v) => !v), 530);
    return () => clearInterval(t);
  }, []);

  function isValidGithubUrl(val) {
    return /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+(\/.*)?$/.test(val.trim());
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const trimmed = url.trim();
    if (!trimmed)                  { setError('Paste a GitHub repo URL to continue.'); return; }
    if (!isValidGithubUrl(trimmed)) { setError("That doesn't look like a valid GitHub repo URL."); return; }
    router.push(`/graph?repo=${encodeURIComponent(trimmed)}`);
  }

  return (
    <main className={styles.main}>
      {/* ── dot-grid background (CSS only) ── */}
      <div className={styles.grid} aria-hidden="true" />

      {/* ── thin top nav ── */}
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <span className={styles.navLogo}>
            <svg width="22" height="22" viewBox="0 0 52 52" fill="none" aria-hidden="true">
              <circle cx="26" cy="14" r="5" fill="url(#nlg)" />
              <circle cx="14" cy="38" r="5" fill="url(#nlg)" />
              <circle cx="38" cy="38" r="5" fill="url(#nlg)" />
              <line x1="26" y1="14" x2="14" y2="38" stroke="#7c3aed" strokeWidth="1.5" />
              <line x1="26" y1="14" x2="38" y2="38" stroke="#06b6d4" strokeWidth="1.5" />
              <line x1="14" y1="38" x2="38" y2="38" stroke="#5b6ee1" strokeWidth="1.5" />
              <defs>
                <linearGradient id="nlg" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#7c3aed" /><stop offset="1" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
            <span>CodeGraph</span>
          </span>
          <span className={`${styles.navTag} mono`}>CGR_v1.0 / Open Beta</span>
        </div>
      </header>

      {/* ── hero ── */}
      <section className={styles.hero}>
        {/* floating node graph canvas — sits behind the content */}
        <HeroCanvas />

        <div className={styles.heroInner}>
          {/* eyebrow label — same monospace numbering as IDR */}
          <div className={styles.eyebrow}>
            <span className="mono">CGR_001</span>
            <span className={styles.sep} aria-hidden="true">/</span>
            <span>GitHub · Groq API · Cytoscape.js</span>
          </div>

          <h1 className={styles.heroTitle}>
            <span className={styles.word} style={{ '--d': '0ms' }}>See inside</span>
            <br />
            <span className={styles.word} style={{ '--d': '120ms' }}>any{' '}</span>
            <em className={`${styles.word} ${styles.wordAccent}`} style={{ '--d': '220ms' }}>codebase.</em>
          </h1>

          <p className={styles.heroCopy}>
            Paste a public GitHub repo URL. CodeGraph fetches the source, runs it through
            Llama&nbsp;3.3&nbsp;70B, and builds an interactive knowledge graph — every file,
            function, and class, with edges showing how they connect. Then chat with it.
          </p>

          {/* ── input form ── */}
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.inputRow}>
              <span className={`${styles.inputPrefix} mono`}>$</span>
              <input
                id="repo-url-input"
                type="url"
                className={styles.repoInput}
                placeholder="https://github.com/owner/repo"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(''); }}
                aria-label="GitHub repository URL"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" className={styles.submitBtn} id="explore-btn">
                Explore →
              </button>
            </div>
            {error && <p className={`${styles.error} mono`} role="alert">⚠ {error}</p>}
          </form>

          {/* example repos */}
          <div className={styles.examples}>
            <span className={`${styles.examplesLabel} mono`}>try:</span>
            {EXAMPLE_REPOS.map(({ label, url: u }) => (
              <button
                key={u}
                type="button"
                className={styles.exampleBtn}
                onClick={() => { setUrl(u); setError(''); }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── how it works — terminal pipeline style ── */}
      <section className={styles.pipeline}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHead}>
            <span className={`${styles.sectionTag} mono`}>CGR_002 / How it works</span>
          </div>

          <div className={styles.pipelineTerminal}>
            <div className={styles.termHeader}>
              <span className={styles.termDot} style={{ background: '#ff5f57' }} />
              <span className={styles.termDot} style={{ background: '#febc2e' }} />
              <span className={styles.termDot} style={{ background: '#28c840' }} />
              <span className={`${styles.termTitle} mono`}>codegraph — pipeline</span>
            </div>
            <div className={styles.termBody}>
              <div className={styles.termLine}>
                <span className={`${styles.termPrompt} mono`}>$</span>
                <span className={`${styles.termCmd} mono`}>codegraph</span>
                <span className={`${styles.termFlag} mono`}> --run-pipeline</span>
              </div>
              <div className={styles.termLine}>
                {HOW_IT_WORKS.map((step, i) => (
                  <span key={step.n} className={styles.termPipeItem}>
                    <span className={`${styles.termN} mono`}>{step.n}</span>
                    <span className={i === HOW_IT_WORKS.length - 1 ? styles.termStepActive : styles.termStep}>
                      {step.label}
                    </span>
                    {i < HOW_IT_WORKS.length - 1 && <span className={`${styles.termArrow} mono`}> → </span>}
                  </span>
                ))}
                <span className={styles.termCursor} aria-hidden="true">{tick ? '█' : ' '}</span>
              </div>
              <div className={styles.termLine}>
                <span className={`${styles.termPrompt} mono`}>$</span>
                <span className={`${styles.termOutput} mono`}>status: ready</span>
              </div>
            </div>
          </div>

          {/* step detail cards */}
          <div className={styles.stepCards}>
            {HOW_IT_WORKS.map((step) => (
              <div key={step.n} className={styles.stepCard}>
                <div className={styles.stepAccent} />
                <span className={`${styles.stepN} mono`}>{step.n}</span>
                <h3 className={styles.stepLabel}>{step.label}</h3>
                <p className={`${styles.stepDetail} mono`}>{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── features ── */}
      <section className={styles.features}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHead}>
            <span className={`${styles.sectionTag} mono`}>CGR_003 / Features</span>
          </div>

          <div className={styles.featureGrid}>
            {[
              {
                n: '01',
                title: 'Force-Directed Graph',
                body: 'Cytoscape.js renders every file, function, class, and import as a node. Click any node to highlight its neighbours and see its description.',
                tags: ['Cytoscape.js', 'cose layout'],
              },
              {
                n: '02',
                title: 'LLM-Powered Analysis',
                body: "Groq's Llama 3.3 70B reads your source files and extracts a structured graph — nodes, edges, and a plain-English codebase summary — in seconds.",
                tags: ['Groq API', 'Llama 3.3 70B'],
              },
              {
                n: '03',
                title: 'Streaming AI Chat',
                body: 'Ask anything about the codebase. Click a node to focus the conversation on that file or function. Responses stream token by token.',
                tags: ['Streaming', 'Context-aware'],
              },
              {
                n: '04',
                title: 'Code Viewer',
                body: 'Click a file node and the raw source slides in — line numbers, syntax highlighting, no context switching.',
                tags: ['Source view', 'Inline'],
              },
              {
                n: '05',
                title: 'Node Search',
                body: 'Type any function or class name in the graph search bar. Matching nodes highlight in amber, everything else fades.',
                tags: ['Search', 'Filter'],
              },
              {
                n: '06',
                title: 'Export Graph',
                body: 'Download the full knowledge graph as a 2× PNG image — clean dark background, ready to drop into a presentation.',
                tags: ['PNG export', '2× resolution'],
              },
            ].map((f) => (
              <article key={f.n} className={styles.featureCard}>
                <div className={styles.featureCardHead}>
                  <span className={`${styles.featureN} mono`}>{f.n}</span>
                  <h3 className={styles.featureTitle}>{f.title}</h3>
                </div>
                <p className={styles.featureBody}>{f.body}</p>
                <div className={styles.featureTags}>
                  {f.tags.map((t) => <span key={t} className={`${styles.featureTag} mono`}>{t}</span>)}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── tech stack ── */}
      <section className={styles.stack}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHead}>
            <span className={`${styles.sectionTag} mono`}>CGR_004 / Stack</span>
          </div>
          <div className={styles.stackPills}>
            {['Next.js 16', 'Cytoscape.js', 'Groq API', 'Llama 3.3 70B', 'GitHub API', 'IBM Plex Sans', 'Syne'].map((s) => (
              <span key={s} className={`${styles.stackPill} mono`}>{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            © 2025 Polishetty Karthik · CodeGraph · Open Source
          </span>
          <a
            href="https://github.com/Karthik-124/codegraph"
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.footerLink} mono`}
          >
            github.com/Karthik-124/codegraph ↗
          </a>
        </div>
      </footer>
    </main>
  );
}

'use client';

// The main graph explorer page.
// Flow: read ?repo= param → fetch files from GitHub → send to Groq → render graph.
// State lives here and is passed down to GraphView and ChatPanel.

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import GraphView from '@/components/GraphView';
import ChatPanel from '@/components/ChatPanel';
import NodeDetail from '@/components/NodeDetail';
import styles from './graph.module.css';

// loading steps shown in order while the pipeline runs
const LOADING_STEPS = [
  'Connecting to GitHub…',
  'Fetching repository files…',
  'Sending code to Groq Llama 3…',
  'Building knowledge graph…',
];

export default function GraphPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const repoUrl = searchParams.get('repo');

  // overall pipeline state
  const [phase, setPhase]       = useState('loading'); // loading | ready | error
  const [loadStep, setLoadStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // data from the pipeline
  const [repoMeta, setRepoMeta] = useState(null);   // { owner, repo, description, stars }
  const [graphData, setGraphData] = useState(null); // { nodes, edges, summary }
  const [fileMap, setFileMap]   = useState({});      // path → content, for chat context

  // UI state
  const [selectedNode, setSelectedNode] = useState(null);
  const [chatOpen, setChatOpen] = useState(true);

  // run the full pipeline when the page mounts
  const runPipeline = useCallback(async () => {
    if (!repoUrl) { router.push('/'); return; }

    setPhase('loading');
    setLoadStep(0);

    try {
      // ── step 1: fetch repo files from GitHub ──────────────────────────
      setLoadStep(1);
      const fetchRes = await fetch('/api/fetch-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl }),
      });

      if (!fetchRes.ok) {
        const { error } = await fetchRes.json();
        throw new Error(error || 'Failed to fetch repository');
      }

      const { files, owner, repo, description, stars, language } = await fetchRes.json();

      if (files.length === 0) {
        throw new Error('No analysable source files found in this repository.');
      }

      setRepoMeta({ owner, repo, description, stars, language });

      // build a path → content map so the chat route can pull relevant snippets
      const map = {};
      files.forEach(({ path, content }) => { map[path] = content; });
      setFileMap(map);

      // ── step 2: send files to Groq for graph generation ───────────────
      setLoadStep(2);
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, owner, repo }),
      });

      if (!analyzeRes.ok) {
        const { error } = await analyzeRes.json();
        throw new Error(error || 'Analysis failed');
      }

      setLoadStep(3);
      const graph = await analyzeRes.json();

      setGraphData(graph);
      setPhase('ready');
    } catch (err) {
      console.error('Pipeline error:', err);
      setErrorMsg(err.message);
      setPhase('error');
    }
  }, [repoUrl, router]);

  useEffect(() => { runPipeline(); }, [runPipeline]);

  // ── loading screen ────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className={styles.centered}>
        <div className={styles.loadCard}>
          <div className={`${styles.loadLogo}`} aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="14" r="5" fill="url(#lg2)" />
              <circle cx="14" cy="34" r="5" fill="url(#lg2)" />
              <circle cx="38" cy="34" r="5" fill="url(#lg2)" />
              <line x1="26" y1="14" x2="14" y2="34" stroke="#7c3aed" strokeWidth="1.5" />
              <line x1="26" y1="14" x2="38" y2="34" stroke="#06b6d4" strokeWidth="1.5" />
              <line x1="14" y1="34" x2="38" y2="34" stroke="#5b6ee1" strokeWidth="1.5" />
              <defs>
                <linearGradient id="lg2" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#7c3aed" /><stop offset="1" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <h2 className={styles.loadTitle}>Analysing repository…</h2>
          <p className={styles.loadRepo}>{decodeURIComponent(repoUrl || '')}</p>

          {/* step list */}
          <ol className={styles.steps}>
            {LOADING_STEPS.map((step, i) => (
              <li
                key={step}
                className={`${styles.step} ${
                  i < loadStep  ? styles.stepDone :
                  i === loadStep ? styles.stepActive :
                  styles.stepPending
                }`}
              >
                <span className={styles.stepDot} />
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  // ── error screen ──────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className={styles.centered}>
        <div className={styles.loadCard}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <h2 className={styles.loadTitle}>Something went wrong</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8, textAlign: 'center' }}>
            {errorMsg}
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button className="btn btn-primary" onClick={runPipeline}>Retry</button>
            <button className="btn btn-ghost" onClick={() => router.push('/')}>← Back</button>
          </div>
        </div>
      </div>
    );
  }

  // ── main explorer UI ──────────────────────────────────────────────────
  return (
    <div className={styles.shell}>
      {/* ── top bar ── */}
      <header className={styles.topbar}>
        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => router.push('/')}>
          ← Home
        </button>

        <div className={styles.repoInfo}>
          <span className="gradient-text" style={{ fontWeight: 600 }}>
            {repoMeta?.owner}/{repoMeta?.repo}
          </span>
          {repoMeta?.language && (
            <span className="badge">{repoMeta.language}</span>
          )}
          {repoMeta?.stars != null && (
            <span className="badge">⭐ {repoMeta.stars.toLocaleString()}</span>
          )}
        </div>

        <button
          className="btn btn-ghost"
          style={{ padding: '6px 12px', fontSize: 13 }}
          onClick={() => setChatOpen((v) => !v)}
          aria-label="Toggle chat panel"
        >
          {chatOpen ? 'Hide chat' : 'Show chat'}
        </button>
      </header>

      {/* ── body: graph + optional chat panel ── */}
      <div className={styles.body}>
        {/* graph fills the remaining space */}
        <div className={styles.graphArea}>
          <GraphView
            nodes={graphData.nodes}
            edges={graphData.edges}
            onNodeSelect={setSelectedNode}
          />

          {/* node detail overlay — slides up from the bottom of the graph */}
          {selectedNode && (
            <NodeDetail
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
            />
          )}
        </div>

        {/* chat panel — conditionally rendered */}
        {chatOpen && (
          <ChatPanel
            graphSummary={graphData.summary}
            selectedNode={selectedNode}
            fileMap={fileMap}
          />
        )}
      </div>
    </div>
  );
}

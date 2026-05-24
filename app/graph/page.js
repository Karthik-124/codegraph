'use client';

export const dynamic = 'force-dynamic';

// Graph explorer page — orchestrates the full pipeline:
//   GitHub fetch → Groq analysis → graph render
//
// useSearchParams() must live inside a component wrapped in <Suspense>.
// We do that by splitting into GraphPageInner (the real logic) +
// GraphPage (the exported page, which just wraps Inner in Suspense).

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import GraphView from '@/components/GraphView';
import ChatPanel from '@/components/ChatPanel';
import NodeDetail from '@/components/NodeDetail';
import CodeViewer from '@/components/CodeViewer';
import styles from './graph.module.css';

const LOADING_STEPS = [
  'Connecting to GitHub…',
  'Fetching repository files…',
  'Sending code to Groq Llama 3…',
  'Building knowledge graph…',
];

// ── inner component — contains all useSearchParams() logic ───────────────────
function GraphPageInner() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const repoUrl      = searchParams.get('repo');

  const [phase, setPhase]       = useState('loading');
  const [loadStep, setLoadStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const [repoMeta, setRepoMeta]   = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [fileMap, setFileMap]     = useState({});

  // UI state
  const [selectedNode, setSelectedNode] = useState(null);
  const [chatOpen, setChatOpen]         = useState(true);
  const [codeViewerOpen, setCodeViewerOpen] = useState(false);

  // size warning shown when fetch-repo returns > 20 files
  const [sizeWarning, setSizeWarning] = useState('');

  // compute graph stats from nodes for topbar display
  const stats = graphData
    ? graphData.nodes.reduce((acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
      }, {})
    : null;

  const runPipeline = useCallback(async () => {
    if (!repoUrl) { router.push('/'); return; }

    setPhase('loading');
    setLoadStep(0);
    setErrorMsg('');
    setSizeWarning('');
    setSelectedNode(null);
    setCodeViewerOpen(false);

    try {
      // ── step 1: fetch files from GitHub ────────────────────────────────
      setLoadStep(1);
      const fetchRes = await fetch('/api/fetch-repo', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ repoUrl }),
      });

      if (!fetchRes.ok) {
        const { error } = await fetchRes.json();
        throw new Error(error || 'Failed to fetch repository');
      }

      const { files, owner, repo, description, stars, language } = await fetchRes.json();

      if (files.length === 0) {
        throw new Error('No analysable source files found in this repository.');
      }

      // show warning for larger repos — they may hit the token limit
      if (files.length > 20) {
        setSizeWarning(`${files.length} files found — only the first 25 will be analysed. Large repos may hit the free Groq token limit.`);
      }

      setRepoMeta({ owner, repo, description, stars, language });
      const map = {};
      files.forEach(({ path, content }) => { map[path] = content; });
      setFileMap(map);

      // ── step 2: Groq analysis ──────────────────────────────────────────
      setLoadStep(2);
      const analyzeRes = await fetch('/api/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ files, owner, repo }),
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

  // open code viewer only when a file node is selected
  function handleNodeSelect(nodeData) {
    setSelectedNode(nodeData);
    if (nodeData?.type === 'file' && fileMap[nodeData.file]) {
      setCodeViewerOpen(true);
    } else {
      setCodeViewerOpen(false);
    }
  }

  // ── loading ────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className={styles.centered}>
        <div className={styles.loadCard}>
          <div className={styles.loadLogo} aria-hidden="true">
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
          <ol className={styles.steps}>
            {LOADING_STEPS.map((step, i) => (
              <li key={step} className={`${styles.step} ${
                i < loadStep  ? styles.stepDone :
                i === loadStep ? styles.stepActive :
                styles.stepPending
              }`}>
                <span className={styles.stepDot} />{step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  // ── error ──────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className={styles.centered}>
        <div className={styles.loadCard}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <h2 className={styles.loadTitle}>Something went wrong</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8, textAlign: 'center' }}>{errorMsg}</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button className="btn btn-primary" onClick={runPipeline}>Retry</button>
            <button className="btn btn-ghost" onClick={() => router.push('/')}>← Back</button>
          </div>
        </div>
      </div>
    );
  }

  // ── main explorer ──────────────────────────────────────────────────────
  return (
    <div className={styles.shell}>
      {/* ── topbar ── */}
      <header className={styles.topbar}>
        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => router.push('/')}>
          ← Home
        </button>

        <div className={styles.repoInfo}>
          <span className="gradient-text" style={{ fontWeight: 600 }}>
            {repoMeta?.owner}/{repoMeta?.repo}
          </span>
          {repoMeta?.language && <span className="badge">{repoMeta.language}</span>}
          {repoMeta?.stars != null && <span className="badge">⭐ {repoMeta.stars.toLocaleString()}</span>}

          {stats && (
            <div className={styles.stats}>
              {Object.entries(stats).map(([type, count]) => (
                <span key={type} className={`badge ${styles.statBadge}`} data-type={type}>
                  {count} {type}{count !== 1 ? 's' : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '6px 12px', fontSize: 13 }}
            onClick={runPipeline}
            title="Re-fetch and re-analyse the repository"
            aria-label="Re-analyze repository"
          >
            ↺ Re-analyze
          </button>

          <button
            className="btn btn-ghost"
            style={{ padding: '6px 12px', fontSize: 13 }}
            onClick={() => setChatOpen((v) => !v)}
          >
            {chatOpen ? 'Hide chat' : 'Show chat'}
          </button>
        </div>
      </header>

      {/* ── size warning banner ── */}
      {sizeWarning && (
        <div className={styles.warningBanner} role="alert">
          ⚠️ {sizeWarning}
          <button className={styles.warnClose} onClick={() => setSizeWarning('')}>✕</button>
        </div>
      )}

      {/* ── body ── */}
      <div className={styles.body}>
        <div className={styles.graphArea}>
          <GraphView
            nodes={graphData.nodes}
            edges={graphData.edges}
            onNodeSelect={handleNodeSelect}
          />

          {codeViewerOpen && selectedNode?.type === 'file' && (
            <CodeViewer
              filePath={selectedNode.file}
              content={fileMap[selectedNode.file]}
              onClose={() => setCodeViewerOpen(false)}
            />
          )}

          {selectedNode && !codeViewerOpen && (
            <NodeDetail
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
            />
          )}
        </div>

        {/* always mounted so chat history survives hide/show — visibility via CSS */}
        <ChatPanel
          graphSummary={graphData.summary}
          selectedNode={selectedNode}
          fileMap={fileMap}
          visible={chatOpen}
        />
      </div>
    </div>
  );
}

// ── exported page — wraps inner in Suspense (required by Next.js App Router) ─
export default function GraphPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0f', color: '#9090b0', fontFamily: 'IBM Plex Sans, sans-serif' }}>
        Loading…
      </div>
    }>
      <GraphPageInner />
    </Suspense>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

// example repos shown under the input so users know what to expect
const EXAMPLE_REPOS = [
  'https://github.com/vercel/next.js',
  'https://github.com/facebook/react',
  'https://github.com/expressjs/express',
];

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  // basic validation — just checks it looks like a github repo URL
  function isValidGithubUrl(val) {
    return /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+(\/.*)?$/.test(val.trim());
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const trimmed = url.trim();
    if (!trimmed) { setError('Paste a GitHub repo URL to get started.'); return; }
    if (!isValidGithubUrl(trimmed)) { setError('That doesn\'t look like a GitHub repo URL.'); return; }

    // encode the URL as a query param so the graph page can pick it up
    const encoded = encodeURIComponent(trimmed);
    router.push(`/graph?repo=${encoded}`);
  }

  function handleExample(exampleUrl) {
    setUrl(exampleUrl);
    setError('');
  }

  return (
    <main className={styles.main}>
      {/* ── animated background blobs ── */}
      <div className={styles.blobPurple} aria-hidden="true" />
      <div className={styles.blobCyan}   aria-hidden="true" />

      <div className={styles.hero}>
        {/* logo mark */}
        <div className={styles.logoWrap} aria-hidden="true">
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <circle cx="26" cy="26" r="25" stroke="url(#lg)" strokeWidth="1.5" />
            <circle cx="26" cy="14" r="5" fill="url(#lg)" />
            <circle cx="14" cy="34" r="5" fill="url(#lg)" />
            <circle cx="38" cy="34" r="5" fill="url(#lg)" />
            <line x1="26" y1="14" x2="14" y2="34" stroke="#7c3aed" strokeWidth="1.5" />
            <line x1="26" y1="14" x2="38" y2="34" stroke="#06b6d4" strokeWidth="1.5" />
            <line x1="14" y1="34" x2="38" y2="34" stroke="#5b6ee1" strokeWidth="1.5" />
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7c3aed" />
                <stop offset="1" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <h1 className={styles.title}>
          <span className="gradient-text">CodeGraph</span>
        </h1>

        <p className={styles.tagline}>
          Drop any GitHub repo. Get an interactive knowledge graph of every
          file, function, and class — then chat with the code using AI.
        </p>

        {/* ── input form ── */}
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.inputRow}>
            <input
              id="repo-url-input"
              type="url"
              className={`input ${styles.repoInput}`}
              placeholder="https://github.com/owner/repo"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(''); }}
              aria-label="GitHub repository URL"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="btn btn-primary" id="explore-btn">
              Explore →
            </button>
          </div>

          {error && (
            <p className={styles.error} role="alert">{error}</p>
          )}
        </form>

        {/* ── example repos ── */}
        <div className={styles.examples}>
          <span className={styles.examplesLabel}>Try:</span>
          {EXAMPLE_REPOS.map((r) => {
            // just show "owner/repo" part to keep it tidy
            const short = r.replace('https://github.com/', '');
            return (
              <button
                key={r}
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: '5px 12px' }}
                onClick={() => handleExample(r)}
              >
                {short}
              </button>
            );
          })}
        </div>

        {/* ── feature pills ── */}
        <div className={styles.features}>
          {[
            { icon: '⬡', label: 'Interactive graph' },
            { icon: '⚡', label: 'Groq Llama 3 70B' },
            { icon: '🔗', label: 'GitHub API' },
            { icon: '💬', label: 'Chat with code' },
          ].map(({ icon, label }) => (
            <span key={label} className={`badge ${styles.featureBadge}`}>
              {icon} {label}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}

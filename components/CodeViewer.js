'use client';

// CodeViewer — shows raw source code when a file node is clicked.
// Appears as a slide-in panel from the left side of the graph area.
// No external syntax highlighting library — uses CSS classes to colour
// common keywords, strings and comments at render time.

import { useMemo } from 'react';
import styles from './CodeViewer.module.css';

// very light tokeniser — colours keywords, strings, and comments
// purely with CSS so we don't need to ship an extra library
function tokeniseLine(line) {
  // single-line comments
  if (/^\s*(\/\/|#)/.test(line)) {
    return <span className={styles.comment}>{line}</span>;
  }

  // split on string literals first to avoid false keyword matches inside them
  const STRING_RE = /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g;
  const KEYWORD_RE = /\b(import|export|from|const|let|var|function|return|class|extends|default|if|else|for|while|async|await|new|this|typeof|null|undefined|true|false|void|throw|try|catch|finally|of|in|=>\s*)\b/g;

  const parts = [];
  let last = 0;
  let m;

  // collect string spans
  const strings = [];
  while ((m = STRING_RE.exec(line)) !== null) {
    strings.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }

  // walk through the line building spans
  let i = 0;
  for (const s of strings) {
    const before = line.slice(i, s.start);
    if (before) {
      // keyword-colour the non-string segment
      parts.push(...keywordSpans(before, last));
    }
    parts.push(<span key={s.start} className={styles.string}>{s.text}</span>);
    i = s.end;
  }
  // tail after last string
  if (i < line.length) {
    parts.push(...keywordSpans(line.slice(i), i));
  }

  return parts.length ? parts : line;
}

// wrap keyword matches in a coloured span, leave the rest plain
function keywordSpans(text, offset = 0) {
  const KEYWORD_RE = /\b(import|export|from|const|let|var|function|return|class|extends|default|if|else|for|while|async|await|new|this|typeof|null|undefined|true|false|void|throw|try|catch|finally|of|in)\b/g;
  const parts = [];
  let last = 0;
  let m;
  while ((m = KEYWORD_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={offset + last}>{text.slice(last, m.index)}</span>);
    parts.push(<span key={offset + m.index} className={styles.keyword}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<span key={offset + last}>{text.slice(last)}</span>);
  return parts;
}

export default function CodeViewer({ filePath, content, onClose }) {
  if (!filePath || !content) return null;

  const lines = content.split('\n');

  return (
    <div className={styles.panel} role="dialog" aria-label={`Source: ${filePath}`}>
      {/* ── header ── */}
      <div className={styles.header}>
        <span className={styles.fileIcon}>📄</span>
        <code className={styles.filePath}>{filePath}</code>
        <span className={styles.lineCount}>{lines.length} lines</span>
        <button
          className="btn btn-ghost"
          style={{ padding: '4px 10px', fontSize: 12, marginLeft: 'auto' }}
          onClick={onClose}
          aria-label="Close code viewer"
        >✕</button>
      </div>

      {/* ── code body with line numbers ── */}
      <div className={styles.body}>
        <pre className={styles.pre}>
          {lines.map((line, i) => (
            <div key={i} className={styles.line}>
              <span className={styles.lineNum}>{i + 1}</span>
              <span className={styles.lineContent}>{tokeniseLine(line) || ' '}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

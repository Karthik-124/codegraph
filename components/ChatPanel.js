'use client';

// ChatPanel — the right-side chat sidebar.
// Sends messages to /api/chat with the current graph context and streams
// the response back token by token so it feels fast.

import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './ChatPanel.module.css';

// ── Lightweight markdown renderer ───────────────────────────────────
// No external library — handles the patterns Groq actually outputs:
// **bold**, *italic*, `inline code`, ```code blocks```, - bullets, 1. numbered
function renderInline(text) {
  // process inline patterns: **bold**, *italic*, `code`
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // fenced inline code — match first
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`/);
    const boldMatch  = remaining.match(/^(.*?)\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/^(.*?)\*(.+?)\*/);

    // pick whichever match starts earliest
    const candidates = [
      codeMatch   && { idx: codeMatch[1].length,   match: codeMatch,   type: 'code' },
      boldMatch   && { idx: boldMatch[1].length,   match: boldMatch,   type: 'bold' },
      italicMatch && { idx: italicMatch[1].length, match: italicMatch, type: 'italic' },
    ].filter(Boolean);

    if (candidates.length === 0) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    const earliest = candidates.reduce((a, b) => a.idx <= b.idx ? a : b);
    const { match, type } = earliest;

    // push any text before the match
    if (match[1]) parts.push(<span key={key++}>{match[1]}</span>);

    if (type === 'code') {
      parts.push(<code key={key++} className={styles.inlineCode}>{match[2]}</code>);
    } else if (type === 'bold') {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else {
      parts.push(<em key={key++}>{match[2]}</em>);
    }

    remaining = remaining.slice(match[1].length + match[0].length - match[1].length);
  }

  return parts;
}

// parse a full markdown string into React nodes
function MarkdownMessage({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const output = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── fenced code block ───────────────────────
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      output.push(
        <pre key={i} className={styles.codeBlock}>
          {lang && <span className={styles.codeLang}>{lang}</span>}
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      i++; // skip closing ```
      continue;
    }

    // ── bullet list item (− or *) ──────────────
    if (/^(  )?[-*]\s/.test(line)) {
      const indent = line.startsWith('  ');
      const text = line.replace(/^\s*[-*]\s/, '');
      output.push(
        <div key={i} className={`${styles.listItem} ${indent ? styles.listItemIndent : ''}`}>
          <span className={styles.bullet}>•</span>
          <span>{renderInline(text)}</span>
        </div>
      );
      i++;
      continue;
    }

    // ── numbered list item ──────────────────
    const numMatch = line.match(/^(\d+)\. (.+)/);
    if (numMatch) {
      output.push(
        <div key={i} className={styles.listItem}>
          <span className={styles.bullet}>{numMatch[1]}.</span>
          <span>{renderInline(numMatch[2])}</span>
        </div>
      );
      i++;
      continue;
    }

    // ── blank line ────────────────────────
    if (line.trim() === '') {
      output.push(<div key={i} className={styles.spacer} />);
      i++;
      continue;
    }

    // ── normal paragraph line ────────────────
    output.push(
      <p key={i} className={styles.para}>{renderInline(line)}</p>
    );
    i++;
  }

  return <>{output}</>;
}

// starter prompts shown before the user types anything
const STARTERS = [
  'What does this repo do?',
  'How is the code structured?',
  'What are the main entry points?',
  'Explain the most complex part',
];

export default function ChatPanel({ graphSummary, selectedNode, fileMap }) {
  const [messages, setMessages]  = useState([]);   // { role, content }
  const [input, setInput]        = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // auto-scroll to the latest message whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // build a snippet of the selected node's file content to attach as context
  // (we cap at 60 lines to stay within the Groq context budget)
  function getFileSnippet() {
    if (!selectedNode?.file || !fileMap[selectedNode.file]) return null;
    const lines = fileMap[selectedNode.file].split('\n').slice(0, 60).join('\n');
    return `// ${selectedNode.file}\n${lines}`;
  }

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    // add the user message to the conversation immediately
    const userMsg = { role: 'user', content: trimmed };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setStreaming(true);

    // add a placeholder for the assistant response we'll stream into
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updated,
          graphSummary,
          selectedNode,
          fileContents: getFileSnippet(),
        }),
      });

      if (!res.ok) {
        throw new Error('Chat request failed');
      }

      // read the stream and append each token to the last message
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            copy[copy.length - 1] = { ...last, content: last.content + chunk };
            return copy;
          });
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: 'assistant',
          content: '⚠️ Something went wrong. Try again.',
        };
        return copy;
      });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, streaming, graphSummary, selectedNode, fileMap]);

  function handleKeyDown(e) {
    // Ctrl+Enter or just Enter (without shift) submits the message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <aside className={styles.panel}>
      {/* ── header ── */}
      <div className={styles.header}>
        <span className="gradient-text" style={{ fontWeight: 600, fontSize: 14 }}>
          Chat with Code
        </span>
        {selectedNode && (
          <span className="badge" style={{ fontSize: 11 }}>
            📌 {selectedNode.label}
          </span>
        )}
      </div>

      {/* ── message list ── */}
      <div className={styles.messages} role="log" aria-live="polite">

        {/* graph summary shown at the top if we have it */}
        {graphSummary && messages.length === 0 && (
          <div className={styles.summary}>
            <p className={styles.summaryLabel}>📋 Codebase summary</p>
            <p>{graphSummary}</p>
          </div>
        )}

        {/* starter prompt chips — only shown before first message */}
        {messages.length === 0 && (
          <div className={styles.starters}>
            {STARTERS.map((s) => (
              <button
                key={s}
                className={styles.starter}
                onClick={() => sendMessage(s)}
                disabled={streaming}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.msg} ${msg.role === 'user' ? styles.user : styles.assistant}`}
          >
            <span className={styles.roleTag}>
              {msg.role === 'user' ? 'You' : 'AI'}
            </span>
            {msg.role === 'user' ? (
              // user messages are plain text — no markdown needed
              <p className={styles.msgContent}>{msg.content}</p>
            ) : (
              // assistant messages go through the markdown renderer
              <div className={styles.msgContent}>
                {msg.content
                  ? <MarkdownMessage content={msg.content} />
                  : (streaming && i === messages.length - 1 ? <span className={styles.cursor}>▋</span> : null)
                }
              </div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* ── input bar ── */}
      <div className={styles.inputArea}>
        <textarea
          ref={inputRef}
          className={`input ${styles.textarea}`}
          placeholder={selectedNode
            ? `Ask about ${selectedNode.label}…`
            : 'Ask anything about the codebase…'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={streaming}
          aria-label="Chat input"
          id="chat-input"
        />
        <button
          className="btn btn-primary"
          style={{ alignSelf: 'flex-end', padding: '8px 16px' }}
          onClick={() => sendMessage(input)}
          disabled={streaming || !input.trim()}
          id="chat-send-btn"
          aria-label="Send message"
        >
          {streaming ? <span className="spinner" /> : '↑'}
        </button>
      </div>
    </aside>
  );
}

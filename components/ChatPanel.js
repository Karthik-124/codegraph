'use client';

// ChatPanel — the right-side chat sidebar.
// Sends messages to /api/chat with the current graph context and streams
// the response back token by token so it feels fast.

import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './ChatPanel.module.css';

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
            {/* render line breaks but keep it simple — no heavy markdown lib */}
            <p className={styles.msgContent}>
              {msg.content || (streaming && i === messages.length - 1 ? '▋' : '')}
            </p>
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

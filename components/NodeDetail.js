'use client';

// NodeDetail — slides up from the bottom of the graph area when a node is selected.
// Shows the node's type, which file it lives in, and its AI-generated description.

import styles from './NodeDetail.module.css';

// maps node type → human-readable icon
const TYPE_ICONS = {
  file:     '📄',
  function: '⚡',
  class:    '🔷',
  import:   '🔗',
};

export default function NodeDetail({ node, onClose }) {
  if (!node) return null;

  const icon = TYPE_ICONS[node.type] ?? '◉';

  return (
    <div className={styles.panel} role="dialog" aria-label={`Node: ${node.label}`}>
      <div className={styles.header}>
        <span className={styles.icon}>{icon}</span>
        <div className={styles.meta}>
          <h3 className={styles.label}>{node.label}</h3>
          <span className={`badge ${styles.typeBadge}`} data-type={node.type}>
            {node.type}
          </span>
        </div>
        <button
          className="btn btn-ghost"
          style={{ padding: '4px 10px', fontSize: 12, marginLeft: 'auto' }}
          onClick={onClose}
          aria-label="Close node detail"
        >
          ✕
        </button>
      </div>

      {node.file && (
        <p className={styles.filepath}>
          <span className={styles.filepathIcon}>📁</span>
          <code>{node.file}</code>
        </p>
      )}

      {node.description && (
        <p className={styles.description}>{node.description}</p>
      )}

      <p className={styles.hint}>
        💬 Ask the chat panel anything about this node
      </p>
    </div>
  );
}

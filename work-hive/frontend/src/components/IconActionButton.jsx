import React from 'react';

export default function IconActionButton({ title, onClick, tone = 'ghost', children, disabled = false }) {
  const className = tone === 'danger' ? 'danger-button small icon-action' : 'ghost-button small icon-action';
  return (
    <button type="button" className={className} title={title} aria-label={title} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}


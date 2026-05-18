import React from 'react';
import { AlertCircle, Inbox, SearchX } from 'lucide-react';

export function LoadingState({ title = 'Loading...', message = 'Please wait while we fetch data.' }) {
  return (
    <section className="state-card">
      <div className="state-icon"><Inbox size={18} /></div>
      <h3>{title}</h3>
      <p className="muted">{message}</p>
      <div className="skeleton-wrap" style={{ marginTop: 12 }}>
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
      </div>
    </section>
  );
}

export function EmptyState({ title, message, action }) {
  return (
    <section className="state-card">
      <div className="state-icon"><SearchX size={18} /></div>
      <h3>{title}</h3>
      <p className="muted">{message}</p>
      {action ? <div className="state-actions">{action}</div> : null}
    </section>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <section className="state-card">
      <div className="state-icon"><AlertCircle size={18} /></div>
      <h3>Something went wrong</h3>
      <p className="muted">{message}</p>
      {onRetry ? <div className="state-actions"><button type="button" className="ghost-button" onClick={onRetry}>Retry</button></div> : null}
    </section>
  );
}

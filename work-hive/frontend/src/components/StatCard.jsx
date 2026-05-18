import React from 'react';

export default function StatCard({ label, value, hint }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
      {hint && <small>{hint}</small>}
    </article>
  );
}

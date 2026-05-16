import React from 'react';

export default function StatusBadge({ value }) {
  const className = value?.toLowerCase().replaceAll(' ', '-') || 'todo';
  return <span className={`status-badge ${className}`}>{value}</span>;
}

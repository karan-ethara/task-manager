import React from 'react';

export default function LoadingSpinner({ label = 'Loading...' }) {
  return (
    <span className="spinner-wrap" aria-live="polite" aria-busy="true">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

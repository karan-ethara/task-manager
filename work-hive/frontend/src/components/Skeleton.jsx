import React from 'react';

export default function Skeleton({ lines = 3 }) {
  return (
    <div className="skeleton-wrap">
      {Array.from({ length: lines }).map((_, idx) => (
        <div key={idx} className="skeleton-line" />
      ))}
    </div>
  );
}


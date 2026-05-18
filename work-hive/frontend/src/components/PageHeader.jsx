import React from 'react';

export default function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
      </div>
      {action}
    </div>
  );
}

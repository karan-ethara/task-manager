import React from 'react';

export default function Modal({ title, children, onClose, variant = 'modal' }) {
  const isDrawer = variant === 'drawer';
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className={isDrawer ? 'modal drawer' : 'modal'} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="ghost-button" onClick={onClose}>Close</button>
        </div>
        {children}
      </section>
    </div>
  );
}

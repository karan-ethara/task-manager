import React, { createContext, useContext, useMemo, useState } from 'react';
import Modal from '../components/Modal';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = (options) => new Promise((resolve) => {
    setState({
      title: options?.title || 'Confirm action',
      message: options?.message || 'Are you sure you want to continue?',
      confirmText: options?.confirmText || 'Confirm',
      cancelText: options?.cancelText || 'Cancel',
      tone: options?.tone || 'default',
      resolve
    });
  });

  const api = useMemo(() => ({ confirm }), []);

  const close = (result) => {
    if (state?.resolve) state.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {state && (
        <Modal title={state.title} onClose={() => close(false)}>
          <p className="muted" style={{ marginTop: 0 }}>{state.message}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-button" onClick={() => close(false)}>{state.cancelText}</button>
            <button
              type="button"
              className={state.tone === 'danger' ? 'danger-button' : 'primary-button'}
              onClick={() => close(true)}
            >
              {state.confirmText}
            </button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}


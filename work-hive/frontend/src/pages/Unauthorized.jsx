import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import PageHeader from '../components/PageHeader';

export default function Unauthorized() {
  const location = useLocation();

  return (
    <div className="auth-screen">
      <section className="auth-card">
        <div className="auth-copy">
          <div className="brand auth-brand"><div className="brand-icon">T</div><strong>TaskFlow</strong></div>
          <h1>Unauthorized</h1>
          <p>You do not have access to this page.</p>
        </div>

        <div className="form-card">
          <PageHeader
            eyebrow="Access control"
            title="Restricted area"
            description={location.state?.from ? `Blocked from ${location.state.from}` : 'This section is available to Admin users only.'}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="primary-button" to="/">Go to dashboard</Link>
            <Link className="ghost-button" to="/projects">Go to projects</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
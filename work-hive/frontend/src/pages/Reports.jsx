import React, { useEffect, useState } from 'react';
import { dashboardApi } from '../api/dashboard';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    dashboardApi.get().then(setData).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  if (error) return <div className="alert error">{error}</div>;
  if (loading) return <section className="loading-state"><LoadingSpinner label="Loading reports..." /></section>;

  return (
    <div>
      <PageHeader eyebrow="Insights" title="Reports & Progress" description="Track performance, progress, and workload trends." />
      <section className="panel">
        <div className="section-title"><h2>Progress summary</h2><span>Current period</span></div>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 0 }}>
          <article className="stat-card"><span>Role</span><strong>{data.role}</strong><small>Perspective</small></article>
          <article className="stat-card"><span>Overdue</span><strong>{data.stats?.overdueTasks ?? data.stats?.myOverdueTasks ?? 0}</strong><small>Needs attention</small></article>
          <article className="stat-card"><span>Completed</span><strong>{data.stats?.completedTasks ?? data.stats?.myCompletedTasks ?? 0}</strong><small>Done work</small></article>
        </div>
      </section>
    </div>
  );
}


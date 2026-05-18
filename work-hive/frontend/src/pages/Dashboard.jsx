import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, CircleDashed, ListChecks } from 'lucide-react';
import { dashboardApi } from '../api/dashboard';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';
import { formatDate } from '../utils/date';
import Skeleton from '../components/Skeleton';

function MetricCard({ icon: Icon, label, value, hint }) {
  return (
    <article className="stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{label}</span>
        <Icon size={16} color="#64748b" />
      </div>
      <strong>{value ?? 0}</strong>
      <small>{hint}</small>
    </article>
  );
}

function buildSmoothPath(points) {
  if (points.length < 2) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const current = points[i];
    const cp1x = (prev.x + current.x) / 2;
    const cp1y = prev.y;
    const cp2x = (prev.x + current.x) / 2;
    const cp2y = current.y;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${current.x} ${current.y}`;
  }
  return path;
}

function TrendChart({ points = [] }) {
  const safePoints = points.length ? points : [
    { label: 'Day 1', count: 2 },
    { label: 'Day 2', count: 4 },
    { label: 'Day 3', count: 3 },
    { label: 'Day 4', count: 5 },
    { label: 'Day 5', count: 4 },
    { label: 'Day 6', count: 6 }
  ];
  const width = 520;
  const height = 200;
  const max = Math.max(1, ...safePoints.map((item) => Number(item.count || 0)));
  const step = safePoints.length > 1 ? width / (safePoints.length - 1) : width;
  const coordinates = safePoints.map((row, index) => {
    const x = index * step;
    const y = height - (((Number(row.count || 0)) / max) * (height - 36) + 18);
    return { x, y, count: Number(row.count || 0), label: row.label };
  });
  const smoothLinePath = buildSmoothPath(coordinates);
  const areaPath = `${smoothLinePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="trend-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Tasks completed per day">
        <defs>
          <linearGradient id="trendFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(79,70,229,0.22)" />
            <stop offset="100%" stopColor="rgba(79,70,229,0.02)" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#trendFill)" />
        <path d={smoothLinePath} fill="none" stroke="var(--primary)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {coordinates.map((point) => (
          <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="3.5" fill="var(--primary)" opacity="0.9">
            <title>{`${point.label}: ${point.count}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

function TeamProgressChart({ items = [] }) {
  const safeItems = items.slice(0, 6);
  const maxValue = Math.max(...safeItems.map((item) => Number(item.value || 0)), 1);
  const palette = ['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#64748b', '#94a3b8'];
  return (
    <div className="distribution-stack">
      {safeItems.map((item, index) => {
        const width = Math.max(8, Math.round((Number(item.value || 0) / maxValue) * 100));
        return (
          <div key={item.label} className="distribution-row">
            <span>{item.label}</span>
            <div className="distribution-bar"><i style={{ width: `${width}%`, '--bar-color': palette[index % palette.length] }} /></div>
            <strong>{item.value}</strong>
          </div>
        );
      })}
    </div>
  );
}

function PieChart({ items = [] }) {
  const safeItems = items.filter((item) => Number(item.value || 0) > 0).slice(0, 6);
  const total = safeItems.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const palette = ['#4f46e5', '#64748b', '#16a34a', '#f59e0b', '#ef4444', '#0ea5e9'];

  let offset = 0;
  return (
    <div className="donut-layout">
      <div className="donut-wrap">
        <svg viewBox="0 0 160 160" className="donut-svg" role="img" aria-label="Member task allocation">
          <circle cx="80" cy="80" r={radius} className="donut-track" />
          {safeItems.map((item, index) => {
            const value = Number(item.value || 0);
            const arc = (value / total) * circumference;
            const strokeDasharray = `${arc} ${circumference - arc}`;
            const strokeDashoffset = -offset;
            offset += arc;
            return (
              <circle
                key={item.label}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={palette[index % palette.length]}
                strokeWidth="12"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
              />
            );
          })}
        </svg>
        <div className="donut-center">
          <strong>{total}</strong>
          <small>Total</small>
        </div>
      </div>
      <div className="donut-legend">
        {safeItems.map((item, index) => (
          <div key={item.label}>
            <span className="legend-dot" style={{ background: palette[index % palette.length] }} />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    dashboardApi.get().then(setData).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const stats = data?.stats || {};

  const dashboardMetrics = useMemo(() => [
    { icon: ListChecks, label: 'Total Tasks', value: stats.totalTasks, hint: 'Visible scope' },
    { icon: CheckCircle2, label: 'Completed', value: stats.completedTasks, hint: `${stats.completionRate || 0}% completion` },
    { icon: CircleDashed, label: 'Pending', value: stats.pendingTasks, hint: 'Todo + In Progress' },
    { icon: AlertCircle, label: 'Overdue', value: stats.overdueTasks, hint: 'Needs action' }
  ], [stats]);

  const trendPoints = useMemo(() => data?.completionTrend || [], [data?.completionTrend]);

  const teamProgressItems = useMemo(() => (data?.teamProgress || []).map((row) => ({
    label: row.teamName,
    value: row.progressPercent || 0
  })), [data?.teamProgress]);

  const memberAllocationItems = useMemo(() => (data?.memberTaskAllocation || []).map((row) => ({
    label: row.name,
    value: row.count || 0
  })), [data?.memberTaskAllocation]);

  if (error) return <div className="alert error">{error}</div>;
  if (loading) {
    return (
      <section className="panel">
        <LoadingSpinner label="Loading dashboard..." />
        <Skeleton lines={6} />
      </section>
    );
  }

  return (
    <div className="dashboard-dense">
      <PageHeader title="Dashboard" />

      <div className="stats-grid dashboard-stats-compact dashboard-stats-four">
        {dashboardMetrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-title"><h2>Tasks Completed Per Day</h2><span>Last 7 days</span></div>
          <TrendChart points={trendPoints} />
        </section>

        <section className="panel">
          <div className="section-title"><h2>Team Progress</h2><span>Completion %</span></div>
          {teamProgressItems.length ? <TeamProgressChart items={teamProgressItems} /> : <div className="muted">No team progress data.</div>}
        </section>

        <section className="panel">
          <div className="section-title"><h2>Member Task Allocation</h2><span>By assignee</span></div>
          {memberAllocationItems.length ? <PieChart items={memberAllocationItems} /> : <div className="muted">No allocation data.</div>}
        </section>

        <section className="panel panel-scroll">
          <div className="section-title"><h2>Due Soon</h2><span>Next 7 days</span></div>
          {data.tasksDueThisWeek?.length ? (
            <div className="stack-form">
              {data.tasksDueThisWeek.slice(0, 6).map((task) => (
                <div key={task._id} className="activity-row">
                  <div className="activity-dot" />
                  <div style={{ minWidth: 0 }}>
                    <strong>{task.title}</strong>
                    <div className="muted">{task.project?.title || 'No project'}</div>
                  </div>
                  <small className="muted">{formatDate(task.dueDate)}</small>
                </div>
              ))}
            </div>
          ) : <div className="muted">No upcoming tasks.</div>}
        </section>
      </div>
    </div>
  );
}

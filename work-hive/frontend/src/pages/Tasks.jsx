import React, { useEffect, useMemo, useState } from 'react';
import { projectApi } from '../api/projects';
import { taskApi } from '../api/tasks';
import { userApi } from '../api/users';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { formatDate, isOverdue } from '../utils/date';
import { openUserProfilePanel } from '../utils/profilePanel';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import IconActionButton from '../components/IconActionButton';
import { AlertCircle, ArrowDownAZ, CalendarClock, Clock3, Filter, KanbanSquare, LayoutGrid, List, Pencil, Trash2, UserSquare2 } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';

const emptyTask = { title: '', description: '', project: '', assignedTo: '', status: 'Todo', priority: 'Medium', dueDate: '' };
const emptyFilters = { q: '', status: '', priority: '', assignedTo: '', team: '', project: '', dueDate: '' };

export default function Tasks() {
  const { user } = useAuth();
  const toast = useToast();
  const { confirm } = useConfirm();
  const [tasks, setTasks] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyTask);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState('');
  const [deletingTaskId, setDeletingTaskId] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [draftFilters, setDraftFilters] = useState(emptyFilters);
  const [taskTab, setTaskTab] = useState(() => {
    const saved = localStorage.getItem('ttm_tasks_tab');
    return ['team', 'my'].includes(saved) ? saved : 'team';
  });
  const [view, setView] = useState(() => {
    const saved = localStorage.getItem('ttm_tasks_view');
    return ['grid', 'list', 'kanban'].includes(saved) ? saved : 'grid';
  });
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('ttm_tasks_sort') || 'updated_desc');
  const [taskTeam, setTaskTeam] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const isManager = ['Admin', 'Team Lead'].includes(user?.role);

  const load = async () => {
    const [taskData, projectData, userData] = await Promise.all([
      taskApi.list({ page, ...filters, assignedTo: taskTab === 'my' ? user?._id : filters.assignedTo }),
      projectApi.list(),
      isManager ? userApi.list() : Promise.resolve({ users: [] })
    ]);
    setTasks(taskData.tasks || []);
    setMeta(taskData.meta || null);
    setProjects(projectData.projects || []);
    setUsers(userData.users || []);
  };

  useEffect(() => {
    setLoading(true);
    load().catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [page, isManager, filters, taskTab, user?._id]);

  useEffect(() => {
    setPage(1);
  }, [filters, taskTab]);

  useEffect(() => {
    if (showFilters) setDraftFilters(filters);
  }, [showFilters, filters]);

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setFieldErrors({});
    const local = {};
    if (!form.title || form.title.trim().length < 2) local.title = 'Title is required (min 2 chars)';
    if (isManager) {
      if (!form.project) local.project = 'Project is required';
      if (!form.assignedTo) local.assignedTo = 'Assignee is required';
    }
    if (!form.dueDate) local.dueDate = 'Due date is required';
    if (Object.keys(local).length) return setFieldErrors(local);

    try {
      setSubmitting(true);
      if (editing) {
        const payload = isManager
          ? form
          : {
            title: form.title,
            description: form.description,
            status: form.status,
            priority: form.priority,
            dueDate: form.dueDate
          };
        await taskApi.update(editing._id, payload);
      } else {
        await taskApi.create(form);
      }
      setForm(emptyTask);
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
      toast?.error(err.message);
      const apiErrors = err.data?.errors;
      if (apiErrors) {
        const map = {};
        apiErrors.forEach((it) => { map[it.field] = it.message; });
        setFieldErrors(map);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      setStatusUpdatingId(id);
      await taskApi.updateStatus(id, status);
      await load();
    } catch (err) {
      setError(err.message);
      toast?.error(err.message);
    } finally {
      setStatusUpdatingId('');
    }
  };

  const canUpdateTaskStatus = (task) => isManager || String(task.assignedTo?._id) === String(user?._id);
  const canEditTask = (task) => isManager || String(task.assignedTo?._id) === String(user?._id);

  const selectedProject = useMemo(
    () => projects.find((project) => String(project._id) === String(form.project)),
    [projects, form.project]
  );

  const selectedTeamIdForAssignee = useMemo(() => {
    if (user?.role === 'Admin') {
      if (selectedProject) return String(selectedProject.team?._id || selectedProject.team || '');
      return String(taskTeam || '');
    }
    if (selectedProject) return String(selectedProject.team?._id || selectedProject.team || '');
    return String(user?.team?._id || user?.team || '');
  }, [user?.role, user?.team, selectedProject, taskTeam]);

  const selectedProjectMembers = useMemo(() => {
    if (!isManager) return [];
    if (!selectedTeamIdForAssignee) return [];
    return users.filter((candidate) => (
      candidate.isActive !== false
      && candidate.role === 'Member'
      && String(candidate.team?._id || candidate.team || '') === selectedTeamIdForAssignee
    ));
  }, [isManager, users, selectedTeamIdForAssignee]);

  const teamScopedProjects = useMemo(() => {
    if (user?.role !== 'Admin' || !taskTeam) return projects;
    return projects.filter((project) => String(project.team?._id || project.team) === String(taskTeam));
  }, [projects, taskTeam, user?.role]);

  const teamOptions = useMemo(() => {
    const map = new Map();
    projects.forEach((project) => {
      if (project.team?._id && !map.has(project.team._id)) map.set(project.team._id, project.team);
    });
    return [...map.values()];
  }, [projects]);

  const startCreate = () => {
    setEditing(null);
    setForm(emptyTask);
    setTaskTeam('');
    setModalOpen(true);
  };

  const startEdit = (task) => {
    setEditing(task);
    setForm({
      title: task.title || '',
      description: task.description || '',
      project: task.project?._id || '',
      assignedTo: task.assignedTo?._id || '',
      status: task.status || 'Todo',
      priority: task.priority || 'Medium',
      dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : ''
    });
    setTaskTeam(task.team?._id || task.project?.team?._id || '');
    setModalOpen(true);
  };

  const taskButtonLabel = useMemo(() => (editing ? 'Save changes' : 'Create task'), [editing]);
  const kanbanColumns = useMemo(() => ([
    { key: 'Todo', label: 'Todo' },
    { key: 'In Progress', label: 'In Progress' },
    { key: 'Completed', label: 'Completed' }
  ]), []);

  const remove = async (id) => {
    const ok = await confirm({ title: 'Delete task', message: 'Delete this task permanently?', confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    try {
      setDeletingTaskId(id);
      await taskApi.remove(id);
      await load();
      toast?.success('Task deleted');
    } catch (err) {
      setError(err.message);
      toast?.error(err.message);
    } finally {
      setDeletingTaskId('');
    }
  };

  useEffect(() => {
    localStorage.setItem('ttm_tasks_view', view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem('ttm_tasks_tab', taskTab);
  }, [taskTab]);

  useEffect(() => {
    localStorage.setItem('ttm_tasks_sort', sortBy);
  }, [sortBy]);

  const sortedTasks = useMemo(() => {
    const list = [...tasks];
    if (sortBy === 'az') return list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    if (sortBy === 'created_desc') return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return list.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }, [tasks, sortBy]);

  return (
    <div>
      <PageHeader title="Tasks" action={isManager && <button className="primary-button" onClick={startCreate}>Create Task</button>} />
      {error && <ErrorState message={error} onRetry={load} />}

      {loading && <LoadingState title="Loading tasks" message="Gathering tasks, assignees, and deadlines." />}

      {!loading && tasks.length === 0 && !error && <EmptyState title={taskTab === 'my' ? 'No tasks assigned to you' : 'No team tasks found'} message={taskTab === 'my' ? 'Tasks assigned to you will appear here.' : 'Create and assign tasks to start execution tracking.'} action={isManager ? <button className="primary-button" onClick={startCreate}>Create Task</button> : null} />}

      {!loading && <section className="panel" style={{ marginBottom: 16 }}>
        <div className="view-toggle" style={{ marginBottom: 10 }}>
          <button className={taskTab === 'team' ? 'toggle-active' : ''} onClick={() => setTaskTab('team')}>All Team Tasks</button>
          <button className={taskTab === 'my' ? 'toggle-active' : ''} onClick={() => setTaskTab('my')}>My Tasks</button>
        </div>
        <div className="section-controls section-controls-wrap">
          <div className="view-toggle">
            <button className={view === 'grid' ? 'toggle-active' : ''} onClick={() => setView('grid')} title="Grid view"><LayoutGrid size={14} /></button>
            <button className={view === 'list' ? 'toggle-active' : ''} onClick={() => setView('list')} title="List view"><List size={14} /></button>
            <button className={view === 'kanban' ? 'toggle-active' : ''} onClick={() => setView('kanban')} title="Kanban view"><KanbanSquare size={14} /></button>
          </div>
          <div className="sort-toggle">
            <button className={sortBy === 'az' ? 'toggle-active' : ''} onClick={() => setSortBy('az')} title="Sort A-Z"><ArrowDownAZ size={14} /><span>A-Z</span></button>
            <button className={sortBy === 'updated_desc' ? 'toggle-active' : ''} onClick={() => setSortBy('updated_desc')} title="Sort by updated"><Clock3 size={14} /><span>Updated</span></button>
            <button className={sortBy === 'created_desc' ? 'toggle-active' : ''} onClick={() => setSortBy('created_desc')} title="Sort by created"><CalendarClock size={14} /><span>Created</span></button>
            <button type="button" className={showFilters ? 'toggle-active' : ''} onClick={() => setShowFilters((v) => !v)} title="Filters"><Filter size={14} /></button>
          </div>
          {showFilters && (
            <div className="filter-popover">
              <div className="filter-grid">
                <label className="filter-field"><span>Search</span><input value={draftFilters.q} onChange={(e) => setDraftFilters((prev) => ({ ...prev, q: e.target.value }))} placeholder="Search title..." /></label>
                <label className="filter-field"><span>Status</span><select value={draftFilters.status} onChange={(e) => setDraftFilters((prev) => ({ ...prev, status: e.target.value }))}><option value="">All</option><option>Todo</option><option>In Progress</option><option>Completed</option></select></label>
                <label className="filter-field"><span>Priority</span><select value={draftFilters.priority} onChange={(e) => setDraftFilters((prev) => ({ ...prev, priority: e.target.value }))}><option value="">All</option><option>Low</option><option>Medium</option><option>High</option></select></label>
                {taskTab !== 'my' && isManager && <label className="filter-field"><span>Assignee</span><select value={draftFilters.assignedTo} onChange={(e) => setDraftFilters((prev) => ({ ...prev, assignedTo: e.target.value }))}><option value="">All</option>{users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select></label>}
                {user?.role === 'Admin' && <label className="filter-field"><span>Team</span><select value={draftFilters.team} onChange={(e) => setDraftFilters((prev) => ({ ...prev, team: e.target.value }))}><option value="">All</option>{[...new Map(projects.map((p) => [p.team?._id, p.team])).values()].filter(Boolean).map((team) => <option key={team._id} value={team._id}>{team.name}</option>)}</select></label>}
                <label className="filter-field"><span>Project</span><select value={draftFilters.project} onChange={(e) => setDraftFilters((prev) => ({ ...prev, project: e.target.value }))}><option value="">All</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.title}</option>)}</select></label>
                <label className="filter-field"><span>Due date</span><input type="date" value={draftFilters.dueDate} onChange={(e) => setDraftFilters((prev) => ({ ...prev, dueDate: e.target.value }))} /></label>
              </div>
              <div className="filter-actions">
                <button type="button" className="ghost-button" onClick={() => { setDraftFilters(emptyFilters); setFilters(emptyFilters); setShowFilters(false); }}>Reset</button>
                <button type="button" className="primary-button" onClick={() => { setFilters(draftFilters); setShowFilters(false); }}>Apply</button>
              </div>
            </div>
          )}
        </div>
      </section>}

      {!loading && view === 'list' && <section className="panel"><div className="table-wrap"><table><thead><tr><th>Title</th><th>Project</th><th>Team</th><th>Assignee</th><th>Status</th><th>Priority</th><th>Due date</th><th>Created by</th><th>Actions</th></tr></thead><tbody>
        {sortedTasks.map((task) => (
          <tr key={task._id} className={isOverdue(task.dueDate, task.status) ? 'danger-row' : ''}>
            <td><strong>{task.title}</strong><small>{task.description}</small>{isOverdue(task.dueDate, task.status) && <div className="muted">Overdue</div>}</td>
            <td>{task.project?.title}</td>
            <td>{task.team?.name || 'N/A'}</td>
            <td>{task.assignedTo?._id ? <button type="button" className="ghost-button small" onClick={() => openUserProfilePanel(task.assignedTo._id)}>{task.assignedTo.name}</button> : 'Unassigned'}</td>
            <td><StatusBadge value={task.status} /></td>
            <td><span className="pill">{task.priority}</span></td>
            <td>{formatDate(task.dueDate)}{isOverdue(task.dueDate, task.status) && <div><span className="status-badge do-not-disturb">Overdue</span></div>}</td>
            <td>{task.createdBy?._id ? <button type="button" className="ghost-button small" onClick={() => openUserProfilePanel(task.createdBy._id)}>{task.createdBy.name}</button> : (task.createdBy?.name || 'Unknown')}</td>
            <td className="action-cell">
              {canUpdateTaskStatus(task) ? <select value={task.status} onChange={(e) => updateStatus(task._id, e.target.value)} disabled={statusUpdatingId === task._id}><option>Todo</option><option>In Progress</option><option>Completed</option></select> : <span>{task.status}</span>}
              {canEditTask(task) && <IconActionButton title="Edit task" onClick={() => startEdit(task)}><Pencil size={14} /></IconActionButton>}
              {isManager && <IconActionButton title="Delete task" tone="danger" onClick={() => remove(task._id)} disabled={deletingTaskId === task._id}><Trash2 size={14} /></IconActionButton>}
            </td>
          </tr>
        ))}
      </tbody></table></div>
      </section>}

      {!loading && view === 'grid' && <section className="cards-grid">
        {sortedTasks.map((task) => (
          <article className="project-card" key={`m-${task._id}`}>
            <h3 style={{ margin: 0 }}>{task.title}</h3>
            <div className="mini-facts" style={{ marginTop: 8 }}>
              <div><UserSquare2 size={13} /><span>{task.assignedTo?.name || 'Unassigned'}</span></div>
              <div><AlertCircle size={13} /><span>{task.priority}</span></div>
              <div><CalendarClock size={13} /><span>{formatDate(task.dueDate)}</span></div>
            </div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusBadge value={task.status} />
              <span className="muted">{task.project?.title}</span>
              {isOverdue(task.dueDate, task.status) && <span className="status-badge do-not-disturb">Overdue</span>}
            </div>
            <div className="action-cell" style={{ marginTop: 12 }}>
              {canEditTask(task) && <IconActionButton title="Edit task" onClick={() => startEdit(task)}><Pencil size={14} /></IconActionButton>}
              {isManager && <IconActionButton title="Delete task" tone="danger" onClick={() => remove(task._id)} disabled={deletingTaskId === task._id}><Trash2 size={14} /></IconActionButton>}
            </div>
          </article>
        ))}
      </section>}

      {!loading && view === 'kanban' && <section className="kanban-grid">
        {kanbanColumns.map((column) => (
          <article key={column.key} className="kanban-column">
            <div className="section-title"><h3 style={{ margin: 0 }}>{column.label}</h3><span>{sortedTasks.filter((task) => task.status === column.key).length}</span></div>
            <div className="kanban-stack">
              {sortedTasks.filter((task) => task.status === column.key).map((task) => (
                <div key={task._id} className="kanban-card">
                  <strong>{task.title}</strong>
                  <p className="muted" style={{ margin: '6px 0 10px' }}>{task.project?.title} - {task.team?.name || 'N/A'}</p>
                  <div style={{ marginBottom: 10 }}>
                    {task.assignedTo?._id ? <button type="button" className="ghost-button small" onClick={() => openUserProfilePanel(task.assignedTo._id)}>{task.assignedTo.name}</button> : <span className="muted">Unassigned</span>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <StatusBadge value={task.status} />
                    <span className="pill">{task.priority}</span>
                    <small className="muted">{formatDate(task.dueDate)}</small>
                  </div>
                  {isOverdue(task.dueDate, task.status) && <div style={{ marginTop: 8 }}><span className="status-badge do-not-disturb">Overdue</span></div>}
                </div>
              ))}
              {!sortedTasks.some((task) => task.status === column.key) && <p className="muted">No tasks</p>}
            </div>
          </article>
        ))}
      </section>}

      {meta && meta.totalPages > 1 && <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}><button className="ghost-button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Prev</button><div className="muted">Page {page} of {meta.totalPages}</div><button className="ghost-button" onClick={() => setPage(Math.min(meta.totalPages, page + 1))} disabled={page === meta.totalPages}>Next</button></div>}

      {modalOpen && (
        <Modal title={editing ? 'Edit task' : 'Create task'} onClose={() => { setModalOpen(false); setEditing(null); setForm(emptyTask); setTaskTeam(''); }}>
          <form className="stack-form" onSubmit={submit}>
            <label>Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            {fieldErrors.title && <div className="alert error">{fieldErrors.title}</div>}
            <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            {isManager && (
              <>
                {user?.role === 'Admin' && <label>Team<select value={taskTeam} onChange={(e) => { setTaskTeam(e.target.value); setForm((prev) => ({ ...prev, project: '', assignedTo: '' })); }}><option value="">Select team</option>{teamOptions.map((team) => <option key={team._id} value={team._id}>{team.name}</option>)}</select></label>}
                <label>Project<select required value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value, assignedTo: '' })}><option value="">Select project</option>{teamScopedProjects.map((project) => <option key={project._id} value={project._id}>{project.title}</option>)}</select></label>
                {fieldErrors.project && <div className="alert error">{fieldErrors.project}</div>}
                <label>Assign to<select required value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} disabled={selectedProjectMembers.length === 0}><option value="">{selectedProjectMembers.length === 0 ? 'Select team/project first' : 'Select member'}</option>{selectedProjectMembers.map((member) => <option key={member._id} value={member._id}>{member.name} ({member.role})</option>)}</select></label>
                {fieldErrors.assignedTo && <div className="alert error">{fieldErrors.assignedTo}</div>}
              </>
            )}
            <div className="form-grid">
              <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>Todo</option><option>In Progress</option><option>Completed</option></select></label>
              <label>Priority<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>Low</option><option>Medium</option><option>High</option></select></label>
              <label>Due date<input type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
            </div>
            {fieldErrors.dueDate && <div className="alert error">{fieldErrors.dueDate}</div>}
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => { setModalOpen(false); setEditing(null); setForm(emptyTask); setTaskTeam(''); }} disabled={submitting}>Cancel</button>
              <button className="primary-button" disabled={submitting}>{submitting ? <LoadingSpinner label={editing ? 'Saving task...' : 'Creating task...'} /> : taskButtonLabel}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

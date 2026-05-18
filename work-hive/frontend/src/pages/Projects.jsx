import React, { useEffect, useMemo, useState } from 'react';
import { projectApi } from '../api/projects';
import { userApi } from '../api/users';
import { teamApi } from '../api/teams';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import { formatDate } from '../utils/date';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import IconActionButton from '../components/IconActionButton';
import { ArrowDownAZ, CalendarClock, CheckCircle2, Clock3, Eye, Filter, LayoutGrid, Rows3, Pencil, Timer, Trash2, Users } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';

export default function Projects() {
  const { user } = useAuth();
  const toast = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [memberToAdd, setMemberToAdd] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', description: '', members: [], team: '', deadline: '' });
  const [editing, setEditing] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [memberUpdating, setMemberUpdating] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState('');
  const defaultFilters = { q: '', status: '', team: '', dueDate: '' };
  const [filters, setFilters] = useState(defaultFilters);
  const [draftFilters, setDraftFilters] = useState(defaultFilters);
  const [view, setView] = useState(() => localStorage.getItem('ttm_projects_view') || 'grid');
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('ttm_projects_sort') || 'updated_desc');
  const [showFilters, setShowFilters] = useState(false);
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const isManager = ['Admin', 'Team Lead'].includes(user?.role);

  const load = async () => {
    const [projectData, userData, teamData] = await Promise.all([
      projectApi.list({ page }),
      isManager ? userApi.list() : Promise.resolve({ users: [] }),
      user?.role === 'Admin' ? teamApi.list() : Promise.resolve({ teams: [] })
    ]);

    setProjects(projectData.projects || []);
    setMeta(projectData.meta || null);
    setUsers(userData.users || []);
    setTeams(teamData.teams || []);
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    load()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, user?.role]);

  const memberOptions = useMemo(() => {
    if (!Array.isArray(users)) return [];
    if (user?.role !== 'Admin' || !form.team) return users;
    return users.filter((candidate) => String(candidate.team?._id || candidate.team) === String(form.team));
  }, [form.team, user?.role, users]);

  const availableMembers = useMemo(() => {
    if (!isManager || !selectedProject) return [];

    const memberIds = new Set((selectedProject.members || []).map((member) => String(member._id)));
    return users.filter((candidate) => candidate.isActive !== false && !memberIds.has(String(candidate._id)));
  }, [isManager, selectedProject, users]);

  const refreshSelectedProject = async (projectId) => {
    const data = await projectApi.get(projectId);
    setSelectedProject(data.project);
    return data.project;
  };

  const openDetails = async (projectId) => {
    navigate(`/projects/${projectId}`);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setSelectedProject(null);
    setMemberToAdd('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setFieldErrors({});

    // Frontend validation
    const local = {};
    if (!form.title || form.title.trim().length < 2) local.title = 'Title is required (min 2 chars)';
    if (user?.role === 'Admin' && !form.team) local.team = 'Team is required for admin project creation';
    if (form.deadline && form.deadline < todayISO) local.deadline = 'Deadline cannot be in the past';
    if (Object.keys(local).length) {
      setFieldErrors(local);
      return;
    }
    try {
      setSubmitting(true);
      if (editing) {
        await projectApi.update(editing._id, form);
      } else {
        await projectApi.create(form);
      }
      setForm({ title: '', description: '', members: [], team: '', deadline: '' });
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
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

  const startEdit = (project) => {
    setEditing(project);
    setForm({
      title: project.title || '',
      description: project.description || '',
      members: project.members?.map((member) => member._id) || [],
      team: project.team?._id || '',
      deadline: project.deadline ? String(project.deadline).slice(0, 10) : ''
    });
    setModalOpen(true);
  };

  const addMember = async () => {
    if (!selectedProject || !memberToAdd) return;
    try {
      setMemberUpdating(true);
      await projectApi.addMember(selectedProject._id, memberToAdd);
      await load();
      await refreshSelectedProject(selectedProject._id);
      setMemberToAdd('');
    } catch (err) {
      setError(err.message);
      toast?.error(err.message);
    } finally {
      setMemberUpdating(false);
    }
  };

  const removeMember = async (memberId) => {
    if (!selectedProject) return;
    const ok = await confirm({ title: 'Remove member', message: 'Remove this member from the project?', confirmText: 'Remove', tone: 'danger' });
    if (!ok) return;
    try {
      setMemberUpdating(true);
      await projectApi.removeMember(selectedProject._id, memberId);
      await load();
      await refreshSelectedProject(selectedProject._id);
    } catch (err) {
      setError(err.message);
      toast?.error(err.message);
    } finally {
      setMemberUpdating(false);
    }
  };

  const remove = async (id) => {
    const ok = await confirm({ title: 'Delete project', message: 'Delete this project and all related tasks?', confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    try {
      setDeletingProjectId(id);
      await projectApi.remove(id);
      if (selectedProject?._id === id) closeDetails();
      await load();
      toast?.success('Project deleted');
    } catch (err) {
      setError(err.message);
      toast?.error(err.message);
    } finally {
      setDeletingProjectId('');
    }
  };

  const projectCount = projects.length;
  useEffect(() => {
    if (showFilters) setDraftFilters(filters);
  }, [showFilters, filters]);

  const filteredProjects = useMemo(() => (
    projects.filter((project) => {
      const matchQuery = !filters.q || project.title?.toLowerCase().includes(filters.q.toLowerCase()) || project.description?.toLowerCase().includes(filters.q.toLowerCase());
      const matchStatus = !filters.status || project.status === filters.status;
      const matchTeam = !filters.team || String(project.team?._id || project.team) === String(filters.team);
      const matchDueDate = !filters.dueDate || (project.deadline && String(project.deadline).slice(0, 10) === filters.dueDate);
      return matchQuery && matchStatus && matchTeam && matchDueDate;
    })
  ), [projects, filters]);

  useEffect(() => {
    localStorage.setItem('ttm_projects_view', view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem('ttm_projects_sort', sortBy);
  }, [sortBy]);

  const sortedProjects = useMemo(() => {
    const list = [...filteredProjects];
    if (sortBy === 'az') return list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    if (sortBy === 'created_desc') return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return list.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }, [filteredProjects, sortBy]);

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Create projects, attach team members, and organize tasks."
        action={isManager && <button className="primary-button" onClick={() => { setEditing(null); setForm({ title: '', description: '', members: [], team: user?.role === 'Admin' ? '' : (user?.team || ''), deadline: '' }); setModalOpen(true); }}>Create Project</button>}
      />

      {error && <ErrorState message={error} onRetry={load} />}

      {loading && (
        <LoadingState title="Loading projects" message="Preparing project cards and team progress data." />
      )}

      {!loading && projectCount === 0 && !error && (
        <EmptyState title="No projects found" message="Create a project to start organizing team delivery." action={isManager ? <button className="primary-button" onClick={() => { setEditing(null); setForm({ title: '', description: '', members: [], team: user?.role === 'Admin' ? '' : (user?.team || ''), deadline: '' }); setModalOpen(true); }}>Create Project</button> : null} />
      )}

      {!loading && <section className="panel" style={{ marginBottom: 16 }}>
        <div className="section-controls section-controls-wrap">
          <div className="view-toggle">
            <button className={view === 'grid' ? 'toggle-active' : ''} onClick={() => setView('grid')} title="Grid view"><LayoutGrid size={14} /></button>
            <button className={view === 'list' ? 'toggle-active' : ''} onClick={() => setView('list')} title="List view"><Rows3 size={14} /></button>
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
                <label className="filter-field"><span>Search</span><input value={draftFilters.q} onChange={(e) => setDraftFilters((prev) => ({ ...prev, q: e.target.value }))} placeholder="Project name or description" /></label>
                <label className="filter-field"><span>Status</span><select value={draftFilters.status} onChange={(e) => setDraftFilters((prev) => ({ ...prev, status: e.target.value }))}><option value="">All</option><option value="Planned">Planned</option><option value="In Progress">In Progress</option><option value="Completed">Completed</option><option value="On Hold">On Hold</option></select></label>
                <label className="filter-field"><span>Team</span><select value={draftFilters.team} onChange={(e) => setDraftFilters((prev) => ({ ...prev, team: e.target.value }))}><option value="">All</option>{[...new Map(projects.map((p) => [p.team?._id, p.team])).values()].filter(Boolean).map((team) => (<option key={team._id} value={team._id}>{team.name}</option>))}</select></label>
                <label className="filter-field"><span>Due date</span><input type="date" value={draftFilters.dueDate} onChange={(e) => setDraftFilters((prev) => ({ ...prev, dueDate: e.target.value }))} /></label>
              </div>
              <div className="filter-actions">
                <button type="button" className="ghost-button" onClick={() => { setDraftFilters(defaultFilters); setFilters(defaultFilters); setShowFilters(false); }}>Reset</button>
                <button type="button" className="primary-button" onClick={() => { setFilters(draftFilters); setShowFilters(false); }}>Apply</button>
              </div>
            </div>
          )}
        </div>
      </section>}

      {!loading && view === 'grid' && <section className="cards-grid">
        {sortedProjects.map((project) => (
          <article className="project-card project-directory-card" key={project._id}>
            <div className="card-topline">
              <span>{project.team?.name || 'No team'}</span>
              <span className="status-badge">{project.status || 'Planned'}</span>
            </div>
            <h2>{project.title}</h2>
            <div className="mini-facts">
              <div><Timer size={13} /><span>{project.deadline ? formatDate(project.deadline) : 'No deadline'}</span></div>
              <div><CheckCircle2 size={13} /><span>{project.progressPercent ?? 0}%</span></div>
              <div><Users size={13} /><span>{project.taskCount ?? 0} tasks</span></div>
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="muted" style={{ marginBottom: 6 }}>Progress</div>
              <div className="mini-progress"><span style={{ width: `${project.progressPercent ?? 0}%` }} /></div>
            </div>
            <div className="action-cell" style={{ marginTop: 12 }}>
              <IconActionButton title="View project" onClick={() => openDetails(project._id)}><Eye size={14} /></IconActionButton>
              {isManager && <IconActionButton title="Edit project" onClick={() => startEdit(project)}><Pencil size={14} /></IconActionButton>}
              {isManager && <IconActionButton title="Delete project" tone="danger" onClick={() => remove(project._id)} disabled={deletingProjectId === project._id}><Trash2 size={14} /></IconActionButton>}
            </div>
          </article>
        ))}
        {sortedProjects.length === 0 && <EmptyState title="No matching results" message="Try different filters or create a new project." />}
      </section>}

      {!loading && view === 'list' && (
        <section className="panel">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Project</th><th>Team</th><th>Status</th><th>Deadline</th><th>Progress</th><th>Tasks</th><th>Created by</th><th>Actions</th></tr></thead>
              <tbody>
                {sortedProjects.map((project) => (
                  <tr key={`list-${project._id}`}>
                    <td><strong>{project.title}</strong><small>{project.description || 'No description added.'}</small></td>
                    <td>{project.team?.name || 'No team'}</td>
                    <td><span className="status-badge">{project.status || 'Planned'}</span></td>
                    <td>{project.deadline ? formatDate(project.deadline) : 'No deadline'}</td>
                    <td>{project.progressPercent ?? 0}%</td>
                    <td>{project.taskCount ?? 0}</td>
                    <td>{project.createdBy?.name || 'Unknown'}</td>
                    <td className="action-cell">
                      <IconActionButton title="View project" onClick={() => openDetails(project._id)}><Eye size={14} /></IconActionButton>
                      {isManager && <IconActionButton title="Edit project" onClick={() => startEdit(project)}><Pencil size={14} /></IconActionButton>}
                      {isManager && <IconActionButton title="Delete project" tone="danger" onClick={() => remove(project._id)} disabled={deletingProjectId === project._id}><Trash2 size={14} /></IconActionButton>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedProjects.length === 0 && <EmptyState title="No matching results" message="Try different filters or create a new project." />}
        </section>
      )}

      {meta && meta.totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
          <button className="ghost-button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Prev</button>
          <div className="muted">Page {page} of {meta.totalPages}</div>
          <button className="ghost-button" onClick={() => setPage(Math.min(meta.totalPages, page + 1))} disabled={page === meta.totalPages}>Next</button>
        </div>
      )}

      {modalOpen && (
        <Modal title={editing ? 'Edit project' : 'Create project'} onClose={() => { setModalOpen(false); setEditing(null); setForm({ title: '', description: '', members: [], team: '', deadline: '' }); }}>
          <form className="stack-form" onSubmit={submit}>
            <label>Name<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            {fieldErrors.title && <div className="alert error">{fieldErrors.title}</div>}
            {user?.role === 'Admin' && (
              <label>
                Team
                <select value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value, members: [] })} required>
                  <option value="">Select team</option>
                  {teams.map((team) => <option key={team._id} value={team._id}>{team.name}</option>)}
                </select>
              </label>
            )}
            {fieldErrors.team && <div className="alert error">{fieldErrors.team}</div>}
            <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <label>Deadline
              <input type="date" min={todayISO} value={form.deadline || ''} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </label>
            {fieldErrors.deadline && <div className="alert error">{fieldErrors.deadline}</div>}
            <label>Members
              <select multiple value={form.members} onChange={(e) => setForm({ ...form, members: Array.from(e.target.selectedOptions, (option) => option.value) })}>
                {memberOptions.map((member) => <option key={member._id} value={member._id}>{member.name} ({member.role})</option>)}
              </select>
            </label>
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => { setModalOpen(false); setEditing(null); setForm({ title: '', description: '', members: [], team: '', deadline: '' }); }} disabled={submitting}>Cancel</button>
              <button className="primary-button" disabled={submitting}>
                {submitting ? <LoadingSpinner label={editing ? 'Saving project...' : 'Creating project...'} /> : editing ? 'Save changes' : 'Create project'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {detailsOpen && selectedProject && (
        <Modal title="Project details" onClose={closeDetails}>
          {detailsLoading ? (
            <div className="panel centered">Loading project details...</div>
          ) : (
            <div className="stack-form">
              <div className="panel" style={{ margin: 0 }}>
                <h3 style={{ marginTop: 0 }}>{selectedProject.title}</h3>
                <p className="muted">{selectedProject.description || 'No description added.'}</p>
                <div className="form-grid" style={{ marginTop: 16 }}>
                  <div>
                    <p className="eyebrow">Members</p>
                    <strong>{selectedProject.memberCount ?? selectedProject.members?.length ?? 0}</strong>
                  </div>
                  <div>
                    <p className="eyebrow">Tasks</p>
                    <strong>{selectedProject.taskCount ?? selectedProject.tasks?.length ?? 0}</strong>
                  </div>
                  <div>
                    <p className="eyebrow">Created by</p>
                    <strong>{selectedProject.createdBy?.name || 'Unknown'}</strong>
                  </div>
                  <div>
                    <p className="eyebrow">Created date</p>
                    <strong>{formatDate(selectedProject.createdAt)}</strong>
                  </div>
                </div>
              </div>

              <div className="panel" style={{ margin: 0 }}>
                <h3 style={{ marginTop: 0 }}>Members</h3>
                <div className="stack-form">
                  {selectedProject.members?.length ? (
                    selectedProject.members.map((member) => (
                      <div key={member._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                        <div>
                          <strong>{member.name}</strong>
                          <div className="muted">{member.email} · {member.role}</div>
                        </div>
                        {isManager && (
                          <button className="danger-button small" type="button" onClick={() => removeMember(member._id)} disabled={memberUpdating}>Remove</button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="muted">No members added yet.</p>
                  )}

                  {isManager && availableMembers.length > 0 && (
                    <div className="form-grid">
                      <label>
                        Add member
                        <select value={memberToAdd} onChange={(e) => setMemberToAdd(e.target.value)}>
                          <option value="">Select a user</option>
                          {availableMembers.map((candidate) => (
                            <option key={candidate._id} value={candidate._id}>
                              {candidate.name} ({candidate.email})
                            </option>
                          ))}
                        </select>
                      </label>
                      <div style={{ display: 'flex', alignItems: 'end' }}>
                        <button type="button" className="primary-button" onClick={addMember} disabled={!memberToAdd || memberUpdating}>
                          {memberUpdating ? <LoadingSpinner label="Updating..." /> : 'Add member'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="panel" style={{ margin: 0 }}>
                <h3 style={{ marginTop: 0 }}>Tasks inside project</h3>
                {selectedProject.tasks?.length ? (
                  <div className="stack-form">
                    {selectedProject.tasks.slice(0, 10).map((task) => (
                      <div key={task._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                        <div>
                          <strong>{task.title}</strong>
                          <div className="muted">{task.assignedTo?.name || 'Unassigned'}</div>
                        </div>
                        <span className="status-badge">{task.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No tasks in this project yet.</p>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

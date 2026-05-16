import React, { useEffect, useState } from 'react';
import { userApi } from '../api/users';
import { teamApi } from '../api/teams';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { openUserProfilePanel } from '../utils/profilePanel';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import IconActionButton from '../components/IconActionButton';
import { ArrowDownAZ, Briefcase, CalendarClock, Clock3, Filter, LayoutGrid, Rows3, Pencil, Power, Trash2, Users as UsersIcon } from 'lucide-react';
import AvailabilityStatus from '../components/AvailabilityStatus';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';

const getAvatarStatusClass = (status) => {
  if (status === 'Active') return 'avatar-status-dot active';
  if (status === 'Idle') return 'avatar-status-dot idle';
  if (status === 'Do Not Disturb') return 'avatar-status-dot dnd';
  return 'avatar-status-dot away';
};

const formatJoinedDate = (value) => (value ? new Date(value).toLocaleDateString() : '-');

export default function Users() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'Admin';
  const currentUserId = String(currentUser?.id || currentUser?._id || '');
  const toast = useToast();
  const { confirm } = useConfirm();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'Member', password: '', team: '', profileStatus: 'Active' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState('');
  const defaultFilters = { q: '', role: '', status: '', team: '', joinedDate: '' };
  const [filters, setFilters] = useState(defaultFilters);
  const [draftFilters, setDraftFilters] = useState(defaultFilters);
  const [view, setView] = useState(() => localStorage.getItem('ttm_users_view') || 'list');
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('ttm_users_sort') || 'updated_desc');
  const [showFilters, setShowFilters] = useState(false);

  const load = async () => {
    const params = { ...filters };
    if (!params.q) delete params.q;
    if (!params.role) delete params.role;
    if (!params.status) delete params.status;
    if (!isAdmin || !params.team) delete params.team;
    delete params.joinedDate;

    const [userData, teamData] = await Promise.all([
      userApi.list(params),
      isAdmin ? teamApi.list().catch(() => ({ teams: [] })) : Promise.resolve({ teams: [] })
    ]);
    setUsers(userData.users || []);
    setTeams(teamData.teams || []);
  };

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters.q, filters.role, filters.status, filters.team, isAdmin]);

  useEffect(() => {
    if (showFilters) setDraftFilters(filters);
  }, [showFilters, filters]);

  useEffect(() => {
    localStorage.setItem('ttm_users_view', view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem('ttm_users_sort', sortBy);
  }, [sortBy]);

  const filteredUsers = React.useMemo(() => users.filter((u) => {
    if (!filters.joinedDate) return true;
    const joined = u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '';
    return joined === filters.joinedDate;
  }), [users, filters.joinedDate]);

  const sortedUsers = React.useMemo(() => {
    const list = [...filteredUsers];
    if (sortBy === 'az') return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (sortBy === 'created_desc') return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return list.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }, [filteredUsers, sortBy]);

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    try {
      setSubmitting(true);
      if (editing) {
        const updatePayload = {
          name: form.name,
          email: form.email,
          role: form.role,
          team: form.team || null,
          profileStatus: form.profileStatus
        };
        if (form.password?.trim()) updatePayload.password = form.password;
        await userApi.update(editing._id, updatePayload);
      } else {
        await userApi.create(form);
      }
      setForm({ name: '', email: '', role: 'Member', password: '', team: '', profileStatus: 'Active' });
      setEditing(null);
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
      toast?.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (id, isActive) => {
    if (String(id) === currentUserId && isActive) {
      const message = 'You cannot deactivate your own account.';
      setError(message);
      toast?.error(message);
      return;
    }
    try {
      setUpdatingUserId(id);
      await userApi.update(id, { isActive: !isActive });
      await load();
    } catch (err) {
      setError(err.message);
      toast?.error(err.message);
    } finally {
      setUpdatingUserId('');
    }
  };

  const startEdit = (user) => {
    setEditing(user);
    setForm({ name: user.name || '', email: user.email || '', role: user.role || 'Member', password: '', team: user.team?._id || user.team || '', profileStatus: user.profileStatus || 'Active' });
    setModalOpen(true);
  };

  const remove = async (id) => {
    if (String(id) === currentUserId) {
      const message = 'You cannot deactivate your own account.';
      setError(message);
      toast?.error(message);
      return;
    }
    const ok = await confirm({ title: 'Deactivate user', message: 'Deactivate this user account?', confirmText: 'Deactivate', tone: 'danger' });
    if (!ok) return;
    try {
      setUpdatingUserId(id);
      await userApi.remove(id);
      await load();
      toast?.success('User deactivated');
    } catch (err) {
      setError(err.message);
      toast?.error(err.message);
    } finally {
      setUpdatingUserId('');
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Management" title="Members" description="View teammates, profile status, and workload across your scope." action={isAdmin ? <button className="primary-button" onClick={() => { setEditing(null); setForm({ name: '', email: '', role: 'Member', password: '', team: '', profileStatus: 'Active' }); setModalOpen(true); }}>Invite Member</button> : null} />

      {error && <ErrorState message={error} onRetry={load} />}
      {loading && <LoadingState title="Loading members" message="Preparing people directory and team profiles." />}

      {!loading && <div className="panel">
        <div className="section-controls section-controls-wrap">
          <div className="view-toggle">
            <button className={view === 'grid' ? 'toggle-active' : ''} onClick={() => setView('grid')} title="Grid view" aria-label="Grid view"><LayoutGrid size={14} /></button>
            <button className={view === 'list' ? 'toggle-active' : ''} onClick={() => setView('list')} title="List view" aria-label="List view"><Rows3 size={14} /></button>
          </div>
          <div className="sort-toggle">
            <button className={sortBy === 'az' ? 'toggle-active' : ''} onClick={() => setSortBy('az')} title="Sort A-Z"><ArrowDownAZ size={14} /><span>A-Z</span></button>
            <button className={sortBy === 'updated_desc' ? 'toggle-active' : ''} onClick={() => setSortBy('updated_desc')} title="Sort by updated"><Clock3 size={14} /><span>Updated</span></button>
            <button className={sortBy === 'created_desc' ? 'toggle-active' : ''} onClick={() => setSortBy('created_desc')} title="Sort by created"><CalendarClock size={14} /><span>Created</span></button>
            <button type="button" className={showFilters ? 'toggle-active' : ''} onClick={() => setShowFilters((v) => !v)} title="Filters" aria-label="Filters"><Filter size={14} /></button>
          </div>
          {showFilters && (
            <div className="filter-popover">
              <div className="filter-grid">
                <label className="filter-field"><span>Search</span><input value={draftFilters.q} onChange={(e) => setDraftFilters((prev) => ({ ...prev, q: e.target.value }))} placeholder="Name or email" /></label>
                <label className="filter-field"><span>Role</span><select value={draftFilters.role} onChange={(e) => setDraftFilters((prev) => ({ ...prev, role: e.target.value }))}><option value="">All roles</option><option value="Admin">Admin</option><option value="Team Lead">Team Lead</option><option value="Member">Member</option></select></label>
                <label className="filter-field"><span>Status</span><select value={draftFilters.status} onChange={(e) => setDraftFilters((prev) => ({ ...prev, status: e.target.value }))}><option value="">All statuses</option><option value="Active">Active</option><option value="Away">Away</option><option value="Idle">Idle</option><option value="Do Not Disturb">Do Not Disturb</option></select></label>
                {isAdmin && <label className="filter-field"><span>Team</span><select value={draftFilters.team} onChange={(e) => setDraftFilters((prev) => ({ ...prev, team: e.target.value }))}><option value="">All teams</option>{teams.map((team) => <option key={team._id} value={team._id}>{team.name}</option>)}</select></label>}
                <label className="filter-field"><span>Joined date</span><input type="date" value={draftFilters.joinedDate} onChange={(e) => setDraftFilters((prev) => ({ ...prev, joinedDate: e.target.value }))} /></label>
              </div>
              <div className="filter-actions">
                <button type="button" className="ghost-button" onClick={() => { setDraftFilters(defaultFilters); setFilters(defaultFilters); setShowFilters(false); }}>Reset</button>
                <button type="button" className="primary-button" onClick={() => { setFilters(draftFilters); setShowFilters(false); }}>Apply</button>
              </div>
            </div>
          )}
        </div>
        {view === 'grid' ? (
          <section className="cards-grid">
            {sortedUsers.map((u) => {
              const isSelf = String(u._id || u.id) === currentUserId;
              return (
                <article className="project-card member-directory-card" key={u._id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button type="button" className="avatar-with-status" onClick={() => openUserProfilePanel(u._id)} aria-label={`View ${u.name} profile`}>
                    <span className="avatar">{u.name?.[0] || 'U'}</span>
                    <span className={getAvatarStatusClass(u.profileStatus)} aria-hidden="true" />
                  </button>
                  <div>
                    <button type="button" className="ghost-button small" onClick={() => openUserProfilePanel(u._id)}>
                      <strong>{u.name}</strong>
                    </button>
                    <div className="muted member-subline">{u.role}</div>
                    <div className="muted">{u.email}</div>
                  </div>
                </div>
                <div className="mini-facts" style={{ marginTop: 10 }}>
                  <div><UsersIcon size={13} /><span>{u.team?.name || 'No team'}</span></div>
                  <div><Briefcase size={13} /><span>{u.workload?.openTasks ?? 0}/{u.workload?.totalTasks ?? 0}</span></div>
                  <div><CalendarClock size={13} /><span>{formatJoinedDate(u.createdAt)}</span></div>
                </div>
                {isAdmin && <div className="action-cell" style={{ marginTop: 10 }}>
                  <IconActionButton title="Edit user" onClick={() => startEdit(u)}><Pencil size={14} /></IconActionButton>
                  <IconActionButton title={isSelf ? 'You cannot deactivate your own account' : (u.isActive ? 'Deactivate user' : 'Activate user')} onClick={() => toggleActive(u._id, u.isActive)} disabled={updatingUserId === u._id || (isSelf && u.isActive)}><Power size={14} /></IconActionButton>
                  <IconActionButton title={isSelf ? 'You cannot deactivate your own account' : 'Deactivate user'} tone="danger" onClick={() => remove(u._id)} disabled={updatingUserId === u._id || isSelf}><Trash2 size={14} /></IconActionButton>
                </div>}
              </article>
              );
            })}
          </section>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Member</th><th>Team</th><th>Status</th><th>Workload</th><th>Joined</th>{isAdmin && <th>Actions</th>}</tr></thead>
              <tbody>
                {sortedUsers.map((u) => {
                  const isSelf = String(u._id || u.id) === currentUserId;
                  return (
                  <tr key={u._id}>
                    <td>
                      <button type="button" className="ghost-button member-row-trigger" onClick={() => openUserProfilePanel(u._id)}>
                        <span className="avatar-with-status" aria-hidden="true">
                          <span className="avatar">{u.name?.[0] || 'U'}</span>
                          <span className={getAvatarStatusClass(u.profileStatus)} />
                        </span>
                        <span className="member-identity">
                          <strong>{u.name}</strong>
                          <small>{u.role}</small>
                          <small>{u.email}</small>
                        </span>
                      </button>
                    </td>
                    <td>{u.team?.name || 'No team'}</td>
                    <td><AvailabilityStatus value={u.profileStatus || 'Active'} /></td>
                    <td>{u.workload?.openTasks ?? 0} open / {u.workload?.totalTasks ?? 0} total</td>
                    <td>{formatJoinedDate(u.createdAt)}</td>
                    {isAdmin && <td>
                      <IconActionButton title="Edit user" onClick={() => startEdit(u)}><Pencil size={14} /></IconActionButton>
                      <IconActionButton title={isSelf ? 'You cannot deactivate your own account' : (u.isActive ? 'Deactivate user' : 'Activate user')} onClick={() => toggleActive(u._id, u.isActive)} disabled={updatingUserId === u._id || (isSelf && u.isActive)}><Power size={14} /></IconActionButton>
                      <IconActionButton title={isSelf ? 'You cannot deactivate your own account' : 'Deactivate user'} tone="danger" onClick={() => remove(u._id)} disabled={updatingUserId === u._id || isSelf}><Trash2 size={14} /></IconActionButton>
                    </td>}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {users.length === 0 && <EmptyState title="No matching results" message="Try changing filters or invite members to this workspace." action={isAdmin ? <button className="primary-button" onClick={() => { setEditing(null); setForm({ name: '', email: '', role: 'Member', password: '', team: '', profileStatus: 'Active' }); setModalOpen(true); }}>Invite Member</button> : null} />}
      </div>}

      {isAdmin && modalOpen && (
        <Modal title={editing ? 'Edit user' : 'Create user'} onClose={() => { setModalOpen(false); setEditing(null); }}>
          <form className="stack-form" onSubmit={submit}>
            <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>Role
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option>Member</option>
                {currentUser?.role === 'Admin' && <option>Team Lead</option>}
                {currentUser?.role === 'Admin' && <option>Admin</option>}
              </select>
            </label>
            <label>Team
              <select value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })}>
                <option value="">No team</option>
                {teams.map((team) => <option key={team._id} value={team._id}>{team.name}</option>)}
              </select>
            </label>
            <label>Status
              <select value={form.profileStatus} onChange={(e) => setForm({ ...form, profileStatus: e.target.value })}>
                <option>Active</option>
                <option>Away</option>
                <option>Idle</option>
                <option>Do Not Disturb</option>
              </select>
            </label>
            <label>
              {editing ? 'Password (optional reset)' : 'Password'}
              <input type="password" required={!editing} minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </label>
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => { setModalOpen(false); setEditing(null); setForm({ name: '', email: '', role: 'Member', password: '', team: '', profileStatus: 'Active' }); }} disabled={submitting}>Cancel</button>
              <button className="primary-button" disabled={submitting}>
                {submitting ? <LoadingSpinner label={editing ? 'Saving user...' : 'Creating user...'} /> : editing ? 'Save changes' : 'Create user'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

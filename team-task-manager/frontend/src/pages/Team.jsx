import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, Eye, Trash2, UserMinus } from 'lucide-react';
import { userApi } from '../api/users';
import { teamApi } from '../api/teams';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/date';
import { openUserProfilePanel } from '../utils/profilePanel';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import IconActionButton from '../components/IconActionButton';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';

export default function Team() {
  const { user } = useAuth();
  const toast = useToast();
  const { confirm } = useConfirm();
  const isAdmin = user?.role === 'Admin';
  const isTeamLead = user?.role === 'Team Lead';
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [detail, setDetail] = useState(null);
  const [leadId, setLeadId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [form, setForm] = useState({ name: '', leadId: '' });
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [memberUpdating, setMemberUpdating] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const load = async () => {
    const [teamData, userData] = await Promise.all([
      teamApi.list(),
      isAdmin ? userApi.list() : Promise.resolve({ users: [] })
    ]);
    setTeams(teamData.teams || []);
    setUsers(userData.users || []);
  };

  const openDetail = async (teamId) => {
    const data = await teamApi.get(teamId);
    setSelectedTeam(teamId);
    setDetail(data);
    setLeadId(data.team?.lead?._id || '');
  };

  useEffect(() => {
    setLoading(true);
    load().catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [isAdmin]);

  const memberCandidates = useMemo(() => {
    if (!detail?.team || !isAdmin) return [];
    const currentIds = new Set((detail.team.members || []).map((m) => String(m._id)));
    currentIds.add(String(detail.team.lead?._id || ''));
    return users
      .filter((u) => u.isActive && u.role === 'Member' && !currentIds.has(String(u._id)))
      .map((u) => {
        const assignedTeamId = String(u.team?._id || u.team || '');
        const currentTeamId = String(detail.team._id || '');
        const assignedElsewhere = Boolean(assignedTeamId) && assignedTeamId !== currentTeamId;
        return {
          ...u,
          disabled: assignedElsewhere,
          assignedTeamName: assignedElsewhere ? (u.team?.name || 'Another team') : ''
        };
      });
  }, [detail, isAdmin, users]);

  const canManageTeamMembers = useMemo(
    () => isAdmin || (isTeamLead && detail?.team?._id && String(detail.team._id) === String(user?.team)),
    [isAdmin, isTeamLead, detail?.team?._id, user?.team]
  );

  const selectedMemberOption = useMemo(
    () => memberCandidates.find((candidate) => String(candidate._id) === String(memberId)),
    [memberCandidates, memberId]
  );

  const leadCandidates = useMemo(() => users.filter((u) => u.isActive && u.role !== 'Admin'), [users]);

  const filteredTeams = useMemo(() => (
    teams.filter((team) => {
      const matchesQuery = !query || team.name?.toLowerCase().includes(query.toLowerCase()) || team.lead?.name?.toLowerCase().includes(query.toLowerCase());
      const progress = team.progress ?? 0;
      const status = progress >= 90 ? 'On Track' : progress >= 50 ? 'In Progress' : 'Needs Attention';
      const matchesStatus = !statusFilter || status === statusFilter;
      return matchesQuery && matchesStatus;
    })
  ), [teams, query, statusFilter]);

  const submitTeam = async (e) => {
    e.preventDefault();
    if (submitting) return;
    try {
      setSubmitting(true);
      if (editing) await teamApi.update(editing._id, form);
      else await teamApi.create(form);
      setModalOpen(false);
      setEditing(null);
      setForm({ name: '', leadId: '' });
      await load();
      toast?.success(editing ? 'Team updated' : 'Team created');
    } catch (err) {
      setError(err.message);
      toast?.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (team) => {
    setEditing(team);
    setForm({ name: team.name || '', leadId: team.lead?._id || '' });
    setModalOpen(true);
  };

  const deleteTeam = async (teamId) => {
    const ok = await confirm({ title: 'Delete team', message: 'Delete this team with all team projects and tasks?', confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    try {
      setSubmitting(true);
      await teamApi.remove(teamId);
      if (selectedTeam === teamId) {
        setSelectedTeam(null);
        setDetail(null);
      }
      await load();
      toast?.success('Team deleted');
    } catch (err) {
      setError(err.message);
      toast?.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const assignLead = async () => {
    if (!detail?.team?._id || !leadId) return;
    try {
      setMemberUpdating(true);
      await teamApi.update(detail.team._id, { leadId });
      const updated = await teamApi.get(detail.team._id);
      setDetail(updated);
      await load();
      toast?.success('Team lead updated');
    } catch (err) {
      setError(err.message);
      toast?.error(err.message);
    } finally {
      setMemberUpdating(false);
    }
  };

  const addMember = async () => {
    if (!detail?.team?._id || !memberId) return;
    if (selectedMemberOption?.disabled) {
      toast?.error('Selected member is already assigned to another team');
      return;
    }
    try {
      setMemberUpdating(true);
      await teamApi.addMember(detail.team._id, memberId);
      const updated = await teamApi.get(detail.team._id);
      setDetail(updated);
      setMemberId('');
      await load();
      toast?.success('Member added');
    } catch (err) {
      setError(err.message);
      toast?.error(err.message);
    } finally {
      setMemberUpdating(false);
    }
  };

  const removeMember = async (id) => {
    if (!detail?.team?._id) return;
    const ok = await confirm({ title: 'Remove member', message: 'Remove this member from the team?', confirmText: 'Remove', tone: 'danger' });
    if (!ok) return;
    try {
      setMemberUpdating(true);
      await teamApi.removeMember(detail.team._id, id);
      const updated = await teamApi.get(detail.team._id);
      setDetail(updated);
      await load();
      toast?.success('Member removed');
    } catch (err) {
      setError(err.message);
      toast?.error(err.message);
    } finally {
      setMemberUpdating(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Teams"
        description="Team command center with ownership, activity, open workload, and progress tracking."
        action={isAdmin && <button className="primary-button" onClick={() => { setEditing(null); setForm({ name: '', leadId: '' }); setModalOpen(true); }}>Create Team</button>}
      />

      {error && <ErrorState message={error} onRetry={load} />}

      {loading ? (
        <LoadingState title="Loading teams" message="Fetching command center data for teams and members." />
      ) : teams.length === 0 ? (
        <EmptyState title="No teams created yet" message="Create your first team to start planning work." action={isAdmin ? <button className="primary-button" onClick={() => { setEditing(null); setForm({ name: '', leadId: '' }); setModalOpen(true); }}>Create Team</button> : null} />
      ) : (
        <>
          <section className="panel" style={{ marginBottom: 16 }}>
            <button type="button" className="filter-toggle" onClick={() => setShowFilters((v) => !v)}>{showFilters ? 'Hide Filters' : 'Show Filters'}</button>
            {showFilters && <div className="filter-bar"><div className="filter-grid">
              <label className="filter-field"><span>Search</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search team or lead name" /></label>
              <label className="filter-field"><span>Status</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All</option><option value="On Track">On Track</option><option value="In Progress">In Progress</option><option value="Needs Attention">Needs Attention</option></select></label>
              <div style={{ display: 'flex', alignItems: 'end' }}><button type="button" className="ghost-button" onClick={() => { setQuery(''); setStatusFilter(''); }}>Reset</button></div>
            </div></div>}
          </section>
          <section className="cards-grid">
            {filteredTeams.map((team) => {
              const progress = team.progress ?? 0;
              const status = progress >= 90 ? 'On Track' : progress >= 50 ? 'In Progress' : 'Needs Attention';
              return (
                <article key={team._id} className="team-card team-command-card">
                  <div className="card-topline">
                    <span>{status}</span>
                    <span>{team.recentActivityAt ? `Active ${formatDate(team.recentActivityAt)}` : 'No activity'}</span>
                  </div>
                  <h2>{team.name}</h2>
                  <p style={{ margin: '0 0 10px' }}>
                    Lead: {team.lead?._id ? (
                      <button type="button" className="ghost-button small" onClick={() => openUserProfilePanel(team.lead._id)}>{team.lead.name}</button>
                    ) : 'Unassigned'}
                  </p>
                  <div className="member-stack">
                    {(team.members || []).slice(0, 5).map((m) => <span key={m._id}>{m.name?.[0] || 'U'}</span>)}
                    {(team.memberCount ?? 0) > 5 && <span>+{(team.memberCount ?? 0) - 5}</span>}
                  </div>
                  <div className="form-grid">
                    <div><p className="eyebrow">Members</p><strong>{team.memberCount ?? 0}</strong></div>
                    <div><p className="eyebrow">Open Tasks</p><strong>{team.openTaskCount ?? 0}</strong></div>
                    <div><p className="eyebrow">Projects</p><strong>{team.projectCount ?? 0}</strong></div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div className="muted" style={{ marginBottom: 6 }}>Progress {progress}%</div>
                    <div className="mini-progress"><span style={{ width: `${progress}%` }} /></div>
                  </div>
                  <div className="action-cell" style={{ marginTop: 12 }}>
                    <IconActionButton title="View team" onClick={() => openDetail(team._id)}><Eye size={15} /></IconActionButton>
                    {isAdmin && <IconActionButton title="Edit team" onClick={() => startEdit(team)}><Edit3 size={15} /></IconActionButton>}
                    {isAdmin && <IconActionButton title="Delete team" tone="danger" onClick={() => deleteTeam(team._id)}><Trash2 size={15} /></IconActionButton>}
                  </div>
                </article>
              );
            })}
            {filteredTeams.length === 0 && (
              <section className="empty-state">
                <h3>No teams match these filters</h3>
                <p>Try a different search or status selection.</p>
              </section>
            )}
          </section>
        </>
      )}

      {selectedTeam && detail?.team && (
        <Modal title={`Team detail - ${detail.team.name}`} variant="drawer" onClose={() => { setSelectedTeam(null); setDetail(null); }}>
          <div className="stack-form">
            <div className="panel" style={{ margin: 0 }}>
              <h3 style={{ marginTop: 0 }}>Team info</h3>
              <p className="muted">Lead: {detail.team.lead?.name || 'Unassigned'} ({detail.team.lead?.email || 'No email'})</p>
              <div className="form-grid">
                <div><p className="eyebrow">Members</p><strong>{detail.team.memberCount ?? 0}</strong></div>
                <div><p className="eyebrow">Projects</p><strong>{detail.team.projectCount ?? 0}</strong></div>
                <div><p className="eyebrow">Open tasks</p><strong>{detail.team.openTaskCount ?? 0}</strong></div>
                <div><p className="eyebrow">Completion</p><strong>{detail.team.progress ?? 0}%</strong></div>
                <div><p className="eyebrow">Recent activity</p><strong>{detail.team.recentActivityAt ? formatDate(detail.team.recentActivityAt) : 'No activity'}</strong></div>
              </div>
            </div>

            {isAdmin && (
              <div className="panel" style={{ margin: 0 }}>
                <h3 style={{ marginTop: 0 }}>Team management</h3>
                <div className="form-grid">
                  <label>Assign Team Lead
                    <select value={leadId} onChange={(e) => setLeadId(e.target.value)}>
                      <option value="">Select user</option>
                      {leadCandidates.map((candidate) => <option key={candidate._id} value={candidate._id}>{candidate.name} ({candidate.role})</option>)}
                    </select>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'end' }}>
                    <button type="button" className="primary-button" onClick={assignLead} disabled={!leadId || memberUpdating}>{memberUpdating ? 'Saving...' : 'Assign lead'}</button>
                  </div>
                </div>
                <div className="form-grid" style={{ marginTop: 10 }}>
                  <label>Add Member
                    <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                      <option value="">Select member</option>
                      {memberCandidates.map((candidate) => (
                        <option key={candidate._id} value={candidate._id} disabled={candidate.disabled}>
                          {candidate.name} ({candidate.role}){candidate.disabled ? ` - In ${candidate.assignedTeamName}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'end' }}>
                    <button type="button" className="primary-button" onClick={addMember} disabled={!memberId || memberUpdating || selectedMemberOption?.disabled}>Invite Member</button>
                  </div>
                </div>
              </div>
            )}

            <div className="panel" style={{ margin: 0 }}>
              <h3 style={{ marginTop: 0 }}>Members</h3>
              {(detail.team.members || []).length === 0 ? <p className="muted">No members in this team.</p> : (
                detail.team.members.map((m) => (
                  <div key={m._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div><strong><button type="button" className="ghost-button small" onClick={() => openUserProfilePanel(m._id)}>{m.name}</button></strong> <span className="muted">({m.role})</span><div className="muted">{m.email} - {m.profileStatus || 'Active'}</div></div>
                    {canManageTeamMembers && m.role !== 'Team Lead' && <button className="danger-button small" onClick={() => removeMember(m._id)} disabled={memberUpdating}><UserMinus size={15} /></button>}
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}

      {modalOpen && (
        <Modal title={editing ? 'Edit team' : 'Create team'} onClose={() => { setModalOpen(false); setEditing(null); }}>
          <form className="stack-form" onSubmit={submitTeam}>
            <label>Team name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Team lead
              <select required value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value })}>
                <option value="">Select user</option>
                {leadCandidates.map((candidate) => <option key={candidate._id} value={candidate._id}>{candidate.name} ({candidate.role})</option>)}
              </select>
            </label>
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => { setModalOpen(false); setEditing(null); setForm({ name: '', leadId: '' }); }} disabled={submitting}>Cancel</button>
              <button className="primary-button" disabled={submitting}>
                {submitting ? <LoadingSpinner label={editing ? 'Saving team...' : 'Creating team...'} /> : editing ? 'Save changes' : 'Create team'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

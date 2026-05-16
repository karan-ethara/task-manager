import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { projectApi } from '../api/projects';
import { taskApi } from '../api/tasks';
import { userApi } from '../api/users';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { formatDate } from '../utils/date';

const emptyTask = {
  title: '',
  description: '',
  assignedTo: '',
  status: 'Todo',
  priority: 'Medium',
  dueDate: ''
};

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManager = ['Admin', 'Team Lead'].includes(user?.role);

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [memberToAdd, setMemberToAdd] = useState('');
  const [projectForm, setProjectForm] = useState({ title: '', description: '', status: 'Planned', deadline: '' });
  const [taskForm, setTaskForm] = useState({ ...emptyTask, project: id });
  const [fieldErrors, setFieldErrors] = useState({});
  const [savingProject, setSavingProject] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [memberUpdating, setMemberUpdating] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState('');

  const load = async () => {
    const [projectData, userData] = await Promise.all([
      projectApi.get(id),
      isManager ? userApi.list() : Promise.resolve({ users: [] })
    ]);

    setProject(projectData.project || null);
    setTasks(projectData.tasks || []);
    setUsers(userData.users || []);
    setProjectForm({
      title: projectData.project?.title || '',
      description: projectData.project?.description || '',
      status: projectData.project?.status || 'Planned',
      deadline: projectData.project?.deadline ? String(projectData.project.deadline).slice(0, 10) : ''
    });
    setTaskForm((current) => ({
      ...current,
      project: projectData.project?._id || id,
      assignedTo: projectData.project?.members?.[0]?._id || '',
      title: '',
      description: '',
      status: 'Todo',
      priority: 'Medium',
      dueDate: ''
    }));
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    load()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isManager]);

  const memberIds = useMemo(() => new Set((project?.members || []).map((member) => String(member._id))), [project]);

  const availableUsers = useMemo(() => {
    if (!isManager) return [];
    return users.filter((candidate) => candidate.isActive !== false && !memberIds.has(String(candidate._id)));
  }, [isManager, memberIds, users]);

  const addMember = async () => {
    if (!memberToAdd) return;
    try {
      setMemberUpdating(true);
      await projectApi.addMember(id, memberToAdd);
      setMemberToAdd('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setMemberUpdating(false);
    }
  };

  const removeMember = async (memberId) => {
    if (!confirm('Remove this member from the project?')) return;
    try {
      setMemberUpdating(true);
      await projectApi.removeMember(id, memberId);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setMemberUpdating(false);
    }
  };

  const saveProject = async (e) => {
    e.preventDefault();
    if (savingProject) return;
    setFieldErrors({});
    try {
      setSavingProject(true);
      await projectApi.update(id, projectForm);
      setEditOpen(false);
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
      setSavingProject(false);
    }
  };

  const deleteProject = async () => {
    if (!confirm('Delete this project and all related tasks?')) return;
    try {
      setDeletingProject(true);
      await projectApi.remove(id);
      navigate('/projects');
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingProject(false);
    }
  };

  const createTask = async (e) => {
    e.preventDefault();
    if (creatingTask) return;
    setFieldErrors({});

    const local = {};
    if (!taskForm.title || taskForm.title.trim().length < 2) local.title = 'Title is required (min 2 chars)';
    if (!taskForm.assignedTo) local.assignedTo = 'Assignee is required';
    if (!taskForm.dueDate) local.dueDate = 'Due date is required';
    if (Object.keys(local).length) {
      setFieldErrors(local);
      return;
    }

    try {
      setCreatingTask(true);
      if (editingTask) {
        await taskApi.update(editingTask._id, taskForm);
      } else {
        await taskApi.create(taskForm);
      }
      setTaskOpen(false);
      setEditingTask(null);
      setTaskForm({ ...emptyTask, project: id, assignedTo: project?.members?.[0]?._id || '' });
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
      setCreatingTask(false);
    }
  };

  const openCreateTask = () => {
    setFieldErrors({});
    setEditingTask(null);
    setTaskForm({ ...emptyTask, project: id, assignedTo: project?.members?.[0]?._id || '' });
    setTaskOpen(true);
  };

  const openEditTask = (task) => {
    setFieldErrors({});
    setEditingTask(task);
    setTaskForm({
      title: task.title || '',
      description: task.description || '',
      project: task.project?._id || id,
      assignedTo: task.assignedTo?._id || '',
      status: task.status || 'Todo',
      priority: task.priority || 'Medium',
      dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : ''
    });
    setTaskOpen(true);
  };

  const deleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    try {
      setDeletingTaskId(taskId);
      await taskApi.remove(taskId);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingTaskId('');
    }
  };

  const taskAssignees = project?.members || [];

  if (loading) {
    return <section className="loading-state"><LoadingSpinner label="Loading project details..." /><p>Fetching project, member, and task data.</p></section>;
  }

  if (error) {
    return (
      <div>
        <PageHeader
          eyebrow="Workspace"
          title="Project details"
          description="View project information, members, and tasks."
          action={<Link className="ghost-button" to="/projects">Back to projects</Link>}
        />
        <div className="alert error">{error}</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div>
        <PageHeader
          eyebrow="Workspace"
          title="Project details"
          description="View project information, members, and tasks."
          action={<Link className="ghost-button" to="/projects">Back to projects</Link>}
        />
        <section className="panel centered">
          <h3>Project not found</h3>
          <p className="muted">The project may have been deleted or you may not have access.</p>
        </section>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title={project.title}
        description="Project information, team members, and related tasks."
        action={<Link className="ghost-button" to="/projects">Back to projects</Link>}
      />

      {error && <div className="alert error">{error}</div>}

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="form-grid">
          <div>
            <p className="eyebrow">Project name</p>
            <strong>{project.title}</strong>
          </div>
          <div>
            <p className="eyebrow">Assigned team</p>
            <strong>{project.team?.name || 'No team'}</strong>
          </div>
          <div>
            <p className="eyebrow">Team lead</p>
            <strong>{project.team?.lead?.name || 'Unassigned'}</strong>
          </div>
          <div>
            <p className="eyebrow">Created by</p>
            <strong>{project.createdBy?.name || 'Unknown'}</strong>
          </div>
          <div>
            <p className="eyebrow">Members</p>
            <strong>{project.memberCount ?? project.members?.length ?? 0}</strong>
          </div>
          <div>
            <p className="eyebrow">Tasks</p>
            <strong>{project.taskCount ?? tasks.length}</strong>
          </div>
          <div>
            <p className="eyebrow">Status</p>
            <strong>{project.status || 'Planned'}</strong>
          </div>
          <div>
            <p className="eyebrow">Progress</p>
            <strong>{project.progressPercent ?? 0}%</strong>
          </div>
          <div>
            <p className="eyebrow">Deadline</p>
            <strong>{project.deadline ? formatDate(project.deadline) : 'No deadline'}</strong>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <p className="eyebrow">Project description</p>
          <p className="muted" style={{ marginBottom: 0 }}>{project.description || 'No description added.'}</p>
        </div>
        <div style={{ marginTop: 16 }}>
          <p className="eyebrow">Created date</p>
          <strong>{formatDate(project.createdAt)}</strong>
        </div>
      </div>

      {isManager && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <button className="primary-button" onClick={() => setEditOpen(true)}>Edit project</button>
          <button className="danger-button" onClick={deleteProject} disabled={deletingProject}>{deletingProject ? 'Deleting...' : 'Delete project'}</button>
          <button className="ghost-button" onClick={openCreateTask}>Create task</button>
        </div>
      )}

      <section className="panel" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>Project team members</h2>
        {project.members?.length ? (
          <div className="stack-form">
            {project.members.map((member) => (
              <div key={member._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <strong>{member.name}</strong>
                  <div className="muted">{member.email} · {member.role}</div>
                </div>
                {isManager && <button type="button" className="danger-button small" onClick={() => removeMember(member._id)} disabled={memberUpdating}>Remove member</button>}
              </div>
            ))}
          </div>
        ) : (
          <section className="empty-state"><h3>No members yet</h3><p>Add team members to assign work and collaborate.</p></section>
        )}

        {isManager && (
          <div className="form-grid" style={{ marginTop: 16 }}>
            <label>
              Add member
              <select value={memberToAdd} onChange={(e) => setMemberToAdd(e.target.value)}>
                <option value="">Select a user</option>
                {availableUsers.map((candidate) => (
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
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Tasks related to this project</h2>
        {tasks.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Assigned to</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Due date</th>
                  {isManager && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task._id}>
                    <td>
                      <strong>{task.title}</strong>
                      <div className="muted">{task.description || 'No description added.'}</div>
                    </td>
                    <td>{task.assignedTo?.name || 'Unassigned'}</td>
                    <td><StatusBadge value={task.status} /></td>
                    <td>{task.priority}</td>
                    <td>{formatDate(task.dueDate)}</td>
                    {isManager && (
                      <td className="action-cell">
                        <button className="ghost-button small" onClick={() => openEditTask(task)}>Edit</button>
                        <button className="danger-button small" onClick={() => deleteTask(task._id)} disabled={deletingTaskId === task._id}>
                          {deletingTaskId === task._id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <section className="empty-state"><h3>No tasks yet</h3><p>Create the first task to begin this project.</p></section>
        )}
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Recent updates</h2>
        {(project.recentUpdates || []).length ? (
          <div className="stack-form">
            {project.recentUpdates.map((item) => (
              <div key={item._id || `${item.title}-${item.updatedAt}`} className="setting-row">
                <div>
                  <strong>{item.title}</strong>
                  <div className="muted">{item.assignedTo?.name || 'Unassigned'} · {item.status}</div>
                </div>
                <small className="muted">{formatDate(item.updatedAt)}</small>
              </div>
            ))}
          </div>
        ) : (
          <section className="empty-state"><h3>No updates yet</h3><p>Task activity will appear here as work progresses.</p></section>
        )}
      </section>

      {editOpen && (
        <Modal title="Edit project" onClose={() => setEditOpen(false)}>
          <form className="stack-form" onSubmit={saveProject}>
            <label>
              Name
              <input required value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} />
            </label>
              {fieldErrors.title && <div className="alert error">{fieldErrors.title}</div>}
            <label>
              Description
              <textarea value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} />
            </label>
            <div className="form-grid">
              <label>
                Status
                <select value={projectForm.status} onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}>
                  <option>Planned</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                  <option>On Hold</option>
                </select>
              </label>
              <label>
                Deadline
                <input type="date" value={projectForm.deadline || ''} onChange={(e) => setProjectForm({ ...projectForm, deadline: e.target.value })} />
              </label>
            </div>
            <button className="primary-button" type="submit" disabled={savingProject}>
              {savingProject ? <LoadingSpinner label="Saving project..." /> : 'Save changes'}
            </button>
          </form>
        </Modal>
      )}

      {taskOpen && (
        <Modal title={editingTask ? 'Edit task' : 'Create task'} onClose={() => { setTaskOpen(false); setEditingTask(null); setFieldErrors({}); }}>
          <form className="stack-form" onSubmit={createTask}>
            <label>
              Title
              <input required value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
            </label>
            {fieldErrors.title && <div className="alert error">{fieldErrors.title}</div>}
            <label>
              Description
              <textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
            </label>
            <label>
              Assign task
              <select required value={taskForm.assignedTo} onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })} disabled={taskAssignees.length === 0}>
                <option value="">Select member</option>
                {taskAssignees.map((member) => (
                  <option key={member._id} value={member._id}>
                    {member.name} ({member.role})
                  </option>
                ))}
              </select>
            </label>
            {fieldErrors.assignedTo && <div className="alert error">{fieldErrors.assignedTo}</div>}
            <div className="form-grid">
              <label>
                Status
                <select value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}>
                  <option>Todo</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                </select>
              </label>
              <label>
                Priority
                <select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </label>
              <label>
                Due date
                <input type="date" required value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
              </label>
            </div>
            {fieldErrors.dueDate && <div className="alert error">{fieldErrors.dueDate}</div>}
            {taskAssignees.length === 0 && <p className="muted">Add members before creating a task.</p>}
            <button className="primary-button" type="submit" disabled={taskAssignees.length === 0 || creatingTask}>
              {creatingTask ? <LoadingSpinner label={editingTask ? 'Saving task...' : 'Creating task...'} /> : editingTask ? 'Save changes' : 'Create task'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

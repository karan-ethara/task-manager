import request from 'supertest';
import { app } from '../app.js';
import { User } from '../models/user.model.js';

const signup = async ({ name, email, password }) => {
  const res = await request(app).post('/api/auth/signup').send({ name, email, password });
  return res.body;
};

describe('Security', () => {
  it('does not expose password in auth responses', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Safe User',
      email: 'safe@example.com',
      password: 'SafePass123'
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('does not allow a member to hit admin-only user APIs', async () => {
    const member = await signup({
      name: 'Member User',
      email: 'member@example.com',
      password: 'MemberPass123'
    });

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${member.data.token}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/permission/i);
  });

  it('does not allow users to access projects they are not part of', async () => {
    const admin = await signup({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'AdminPass123'
    });
    await User.findOneAndUpdate({ email: 'admin@example.com' }, { role: 'Admin' });

    const member = await signup({
      name: 'Project Outsider',
      email: 'outsider@example.com',
      password: 'Outsider123'
    });

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${admin.data.token}`)
      .send({
        title: 'Private Project',
        description: 'Only admin is a member',
        members: []
      });

    const res = await request(app)
      .get(`/api/projects/${projectRes.body.data.project._id}`)
      .set('Authorization', `Bearer ${member.data.token}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe('Project not found');
  });

  it('does not allow task assignment to users outside the project', async () => {
    const admin = await signup({
      name: 'Admin User',
      email: 'admin2@example.com',
      password: 'AdminPass123'
    });
    await User.findOneAndUpdate({ email: 'admin2@example.com' }, { role: 'Admin' });

    const memberInProject = await signup({
      name: 'Project Member',
      email: 'member-in-project@example.com',
      password: 'MemberPass123'
    });
    const memberOutsideProject = await signup({
      name: 'Outside Member',
      email: 'member-outside-project@example.com',
      password: 'MemberPass123'
    });

    const memberDoc = await User.findOne({ email: 'member-in-project@example.com' });
    const outsiderDoc = await User.findOne({ email: 'member-outside-project@example.com' });

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${admin.data.token}`)
      .send({
        title: 'Assigned Project',
        description: 'Task assignment should stay inside members',
        members: [String(memberDoc._id)]
      });

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${admin.data.token}`)
      .send({
        title: 'Locked Task',
        description: 'Should fail',
        project: projectRes.body.data.project._id,
        assignedTo: String(outsiderDoc._id),
        status: 'Todo',
        priority: 'Medium',
        dueDate: '2030-01-01T00:00:00.000Z'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Assigned user must be a member of the selected project');
  });

  it('blocks a member from admin project and task actions', async () => {
    const admin = await signup({
      name: 'Admin Owner',
      email: 'admin-owner@example.com',
      password: 'AdminPass123'
    });
    await User.findOneAndUpdate({ email: 'admin-owner@example.com' }, { role: 'Admin' });

    const member = await signup({
      name: 'Regular Member',
      email: 'regular-member@example.com',
      password: 'MemberPass123'
    });

    const memberDoc = await User.findOne({ email: 'regular-member@example.com' });

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${admin.data.token}`)
      .send({
        title: 'Member Access Project',
        description: 'For permission checks',
        members: [String(memberDoc._id)]
      });

    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${admin.data.token}`)
      .send({
        title: 'Admin Task',
        description: 'Member should not manage this',
        project: projectRes.body.data.project._id,
        assignedTo: String(memberDoc._id),
        status: 'Todo',
        priority: 'Medium',
        dueDate: '2030-01-01T00:00:00.000Z'
      });

    const checks = await Promise.all([
      request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${member.data.token}`)
        .send({ title: 'Blocked', description: 'Blocked', members: [] }),
      request(app)
        .put(`/api/projects/${projectRes.body.data.project._id}`)
        .set('Authorization', `Bearer ${member.data.token}`)
        .send({ title: 'Blocked Update' }),
      request(app)
        .delete(`/api/projects/${projectRes.body.data.project._id}`)
        .set('Authorization', `Bearer ${member.data.token}`),
      request(app)
        .post(`/api/projects/${projectRes.body.data.project._id}/members`)
        .set('Authorization', `Bearer ${member.data.token}`)
        .send({ memberId: String(memberDoc._id) }),
      request(app)
        .delete(`/api/projects/${projectRes.body.data.project._id}/members/${memberDoc._id}`)
        .set('Authorization', `Bearer ${member.data.token}`),
      request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${member.data.token}`)
        .send({
          title: 'Blocked Task',
          description: 'Blocked',
          project: projectRes.body.data.project._id,
          assignedTo: String(memberDoc._id),
          status: 'Todo',
          priority: 'Medium',
          dueDate: '2030-01-01T00:00:00.000Z'
        }),
      request(app)
        .put(`/api/tasks/${taskRes.body.data.task._id}`)
        .set('Authorization', `Bearer ${member.data.token}`)
        .send({ title: 'Blocked Edit' }),
      request(app)
        .delete(`/api/tasks/${taskRes.body.data.task._id}`)
        .set('Authorization', `Bearer ${member.data.token}`)
    ]);

    checks.forEach((res) => {
      expect(res.statusCode).toBe(403);
    });
  });

  it('allows a member to update only their own task status and see only assigned tasks', async () => {
    const admin = await signup({
      name: 'Admin Manager',
      email: 'admin-manager@example.com',
      password: 'AdminPass123'
    });
    await User.findOneAndUpdate({ email: 'admin-manager@example.com' }, { role: 'Admin' });

    const memberA = await signup({
      name: 'Member A',
      email: 'member-a@example.com',
      password: 'MemberPass123'
    });
    const memberB = await signup({
      name: 'Member B',
      email: 'member-b@example.com',
      password: 'MemberPass123'
    });

    const memberADoc = await User.findOne({ email: 'member-a@example.com' });
    const memberBDoc = await User.findOne({ email: 'member-b@example.com' });

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${admin.data.token}`)
      .send({
        title: 'Shared Project',
        description: 'Members can open project but only see assigned tasks',
        members: [String(memberADoc._id), String(memberBDoc._id)]
      });

    const memberATaskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${admin.data.token}`)
      .send({
        title: 'Task for A',
        description: 'Assigned to A',
        project: projectRes.body.data.project._id,
        assignedTo: String(memberADoc._id),
        status: 'Todo',
        priority: 'Medium',
        dueDate: '2030-01-01T00:00:00.000Z'
      });

    const memberBTaskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${admin.data.token}`)
      .send({
        title: 'Task for B',
        description: 'Assigned to B',
        project: projectRes.body.data.project._id,
        assignedTo: String(memberBDoc._id),
        status: 'Todo',
        priority: 'Medium',
        dueDate: '2030-01-01T00:00:00.000Z'
      });

    const listRes = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${memberA.data.token}`);

    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.data.tasks).toHaveLength(1);
    expect(listRes.body.data.tasks[0].title).toBe('Task for A');

    const projectDetailsRes = await request(app)
      .get(`/api/projects/${projectRes.body.data.project._id}`)
      .set('Authorization', `Bearer ${memberA.data.token}`);

    expect(projectDetailsRes.statusCode).toBe(200);
    expect(projectDetailsRes.body.data.tasks).toHaveLength(1);
    expect(projectDetailsRes.body.data.tasks[0].title).toBe('Task for A');

    const ownStatusRes = await request(app)
      .patch(`/api/tasks/${memberATaskRes.body.data.task._id}/status`)
      .set('Authorization', `Bearer ${memberA.data.token}`)
      .send({ status: 'Completed' });

    expect(ownStatusRes.statusCode).toBe(200);
    expect(ownStatusRes.body.data.task.status).toBe('Completed');

    const otherStatusRes = await request(app)
      .patch(`/api/tasks/${memberBTaskRes.body.data.task._id}/status`)
      .set('Authorization', `Bearer ${memberA.data.token}`)
      .send({ status: 'Completed' });

    expect(otherStatusRes.statusCode).toBe(403);
    expect(otherStatusRes.body.message).toMatch(/own assigned task status/i);
  });

  it('ignores non-status fields sent to status API', async () => {
    const admin = await signup({
      name: 'Admin Status',
      email: 'admin-status@example.com',
      password: 'AdminPass123'
    });
    await User.findOneAndUpdate({ email: 'admin-status@example.com' }, { role: 'Admin' });

    const member = await signup({
      name: 'Status Member',
      email: 'status-member@example.com',
      password: 'MemberPass123'
    });
    const memberDoc = await User.findOne({ email: 'status-member@example.com' });

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${admin.data.token}`)
      .send({
        title: 'Status API Project',
        description: 'Only status should be mutable',
        members: [String(memberDoc._id)]
      });

    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${admin.data.token}`)
      .send({
        title: 'Status-only Task',
        description: 'Task for status test',
        project: projectRes.body.data.project._id,
        assignedTo: String(memberDoc._id),
        status: 'Todo',
        priority: 'Medium',
        dueDate: '2030-01-01T00:00:00.000Z'
      });

    const patchRes = await request(app)
      .patch(`/api/tasks/${taskRes.body.data.task._id}/status`)
      .set('Authorization', `Bearer ${member.data.token}`)
      .send({ status: 'In Progress', assignedTo: String(admin.data.user.id) });

    expect(patchRes.statusCode).toBe(200);
    expect(String(patchRes.body.data.task.assignedTo._id || patchRes.body.data.task.assignedTo)).toBe(String(memberDoc._id));
    expect(patchRes.body.data.task.status).toBe('In Progress');
  });

  it('deletes related tasks when a project is deleted', async () => {
    const admin = await signup({
      name: 'Admin Cleanup',
      email: 'admin-cleanup@example.com',
      password: 'AdminPass123'
    });
    await User.findOneAndUpdate({ email: 'admin-cleanup@example.com' }, { role: 'Admin' });

    const member = await signup({
      name: 'Cleanup Member',
      email: 'cleanup-member@example.com',
      password: 'MemberPass123'
    });
    const memberDoc = await User.findOne({ email: 'cleanup-member@example.com' });

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${admin.data.token}`)
      .send({
        title: 'Cascade Delete Project',
        description: 'Task cleanup check',
        members: [String(memberDoc._id)]
      });

    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${admin.data.token}`)
      .send({
        title: 'Task to be deleted',
        description: 'Should disappear after project deletion',
        project: projectRes.body.data.project._id,
        assignedTo: String(memberDoc._id),
        status: 'Todo',
        priority: 'Medium',
        dueDate: '2030-01-01T00:00:00.000Z'
      });

    const deleteRes = await request(app)
      .delete(`/api/projects/${projectRes.body.data.project._id}`)
      .set('Authorization', `Bearer ${admin.data.token}`);

    expect(deleteRes.statusCode).toBe(200);

    const taskGetRes = await request(app)
      .get(`/api/tasks/${taskRes.body.data.task._id}`)
      .set('Authorization', `Bearer ${admin.data.token}`);

    expect(taskGetRes.statusCode).toBe(404);
    expect(taskGetRes.body.message).toBe('Task not found');
  });

  it('blocks removing a member who has active project tasks', async () => {
    const admin = await signup({
      name: 'Admin Member Guard',
      email: 'admin-member-guard@example.com',
      password: 'AdminPass123'
    });
    await User.findOneAndUpdate({ email: 'admin-member-guard@example.com' }, { role: 'Admin' });

    const member = await signup({
      name: 'Active Task Member',
      email: 'active-task-member@example.com',
      password: 'MemberPass123'
    });
    const memberDoc = await User.findOne({ email: 'active-task-member@example.com' });

    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${admin.data.token}`)
      .send({
        title: 'Member Removal Guard Project',
        description: 'Cannot remove member with Todo/In Progress tasks',
        members: [String(memberDoc._id)]
      });

    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${admin.data.token}`)
      .send({
        title: 'Open Task',
        description: 'Member still has active work',
        project: projectRes.body.data.project._id,
        assignedTo: String(memberDoc._id),
        status: 'Todo',
        priority: 'Medium',
        dueDate: '2030-01-01T00:00:00.000Z'
      });

    const removeRes = await request(app)
      .delete(`/api/projects/${projectRes.body.data.project._id}/members/${memberDoc._id}`)
      .set('Authorization', `Bearer ${admin.data.token}`);

    expect(removeRes.statusCode).toBe(400);
    expect(removeRes.body.message).toBe('Cannot remove member with active tasks. Reassign or complete their tasks first.');
  });
});


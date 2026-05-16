import request from 'supertest';
import { app } from '../app.js';
import { User } from '../models/user.model.js';

describe('Auth', () => {
  it('signs up a user and returns token', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Member User',
      email: 'member@example.com',
      password: 'Member@12345'
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('Member');
  });

  it('returns a JSON error for duplicate email signup', async () => {
    const payload = {
      name: 'Member User',
      email: 'member@example.com',
      password: 'Member@12345'
    };

    await request(app).post('/api/auth/signup').send(payload);
    const res = await request(app).post('/api/auth/signup').send(payload);

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/email/i);
  });

  it('returns missing token error for protected routes', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Missing authentication token');
  });

  it('returns invalid token error for protected routes', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid token');
  });

  it('returns invalid object id error for admin user update', async () => {
    const signupRes = await request(app).post('/api/auth/signup').send({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'Admin@12345'
    });

    const token = signupRes.body.data.token;
    await User.findOneAndUpdate({ email: 'admin@example.com' }, { role: 'Admin' });

    const res = await request(app)
      .put('/api/users/not-a-valid-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'Member' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid id');
  });

  it('returns unauthorized access error for inactive users', async () => {
    const signupRes = await request(app).post('/api/auth/signup').send({
      name: 'Inactive User',
      email: 'inactive@example.com',
      password: 'Inactive@12345'
    });

    await User.findOneAndUpdate({ email: 'inactive@example.com' }, { isActive: false });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${signupRes.body.data.token}`);

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Unauthorized access');
  });

  it('blocks admin from deactivating their own account', async () => {
    const signupRes = await request(app).post('/api/auth/signup').send({
      name: 'Self Admin',
      email: 'self-admin@example.com',
      password: 'SelfAdmin@12345'
    });

    const adminUser = await User.findOneAndUpdate(
      { email: 'self-admin@example.com' },
      { role: 'Admin' },
      { new: true }
    );

    const res = await request(app)
      .delete(`/api/users/${adminUser._id}`)
      .set('Authorization', `Bearer ${signupRes.body.data.token}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('You cannot deactivate your own account');
  });

  it('blocks non-admin users from deactivating accounts', async () => {
    const leadSignup = await request(app).post('/api/auth/signup').send({
      name: 'Team Lead User',
      email: 'lead-user@example.com',
      password: 'LeadUser@12345'
    });

    const memberSignup = await request(app).post('/api/auth/signup').send({
      name: 'Member User',
      email: 'member-user@example.com',
      password: 'MemberUser@12345'
    });

    const memberUser = await User.findOne({ email: 'member-user@example.com' });
    await User.findOneAndUpdate({ email: 'lead-user@example.com' }, { role: 'Team Lead' });

    const res = await request(app)
      .delete(`/api/users/${memberUser._id}`)
      .set('Authorization', `Bearer ${leadSignup.body.data.token}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('You do not have permission to perform this action');
  });

  it('allows admin to update member email/password and login with new credentials', async () => {
    const adminSignup = await request(app).post('/api/auth/signup').send({
      name: 'Credential Admin',
      email: 'credential-admin@example.com',
      password: 'CredentialAdmin@123'
    });
    await User.findOneAndUpdate({ email: 'credential-admin@example.com' }, { role: 'Admin' });

    const memberSignup = await request(app).post('/api/auth/signup').send({
      name: 'Credential Member',
      email: 'credential-member@example.com',
      password: 'OldMember@123'
    });

    const targetUserId = memberSignup.body.data.user.id;
    const updateRes = await request(app)
      .put(`/api/users/${targetUserId}`)
      .set('Authorization', `Bearer ${adminSignup.body.data.token}`)
      .send({ email: 'member-updated@example.com', password: 'NewMember@12345' });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.user.email).toBe('member-updated@example.com');

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'member-updated@example.com',
      password: 'NewMember@12345'
    });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.user.email).toBe('member-updated@example.com');
  });
});


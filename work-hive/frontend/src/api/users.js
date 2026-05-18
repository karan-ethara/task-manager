import { api, extractData } from './client';

export const userApi = {
  list: (params = {}) => api.get('/users', { params }).then((res) => extractData(res, { users: [] })),
  create: (payload) => api.post('/users', payload).then((res) => extractData(res, { user: null })),
  update: (id, payload) => api.put(`/users/${id}`, payload).then((res) => extractData(res, { user: null })),
  remove: (id) => api.delete(`/users/${id}`).then((res) => extractData(res, { message: 'User updated' })),
  updateMyStatus: (profileStatus) => api.patch('/users/me/status', { profileStatus }).then((res) => extractData(res, { user: null })),
  getProfile: (id) => api.get(`/users/${id}/profile`).then((res) => extractData(res, { profile: null }))
};

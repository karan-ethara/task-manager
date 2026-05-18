import { api, extractData } from './client';

export const projectApi = {
  list: (params = {}) => api.get('/projects', { params }).then((res) => extractData(res, { projects: [], meta: null })),
  get: (id) => api.get(`/projects/${id}`).then((res) => extractData(res, { project: null, tasks: [] })),
  create: (payload) => api.post('/projects', payload).then((res) => extractData(res, { project: null })),
  update: (id, payload) => api.put(`/projects/${id}`, payload).then((res) => extractData(res, { project: null })),
  remove: (id) => api.delete(`/projects/${id}`).then((res) => extractData(res, { message: 'Project deleted' })),
  addMember: (id, memberId) => api.post(`/projects/${id}/members`, { memberId }).then((res) => extractData(res, { project: null })),
  removeMember: (id, memberId) => api.delete(`/projects/${id}/members/${memberId}`).then((res) => extractData(res, { project: null }))
};

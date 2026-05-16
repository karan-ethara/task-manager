import { api, extractData } from './client';

export const teamApi = {
  list: () => api.get('/teams').then((res) => extractData(res, { teams: [] })),
  my: () => api.get('/teams/my').then((res) => extractData(res, { team: null })),
  get: (id) => api.get(`/teams/${id}`).then((res) => extractData(res, { team: null, projects: [], tasks: [] })),
  create: (payload) => api.post('/teams', payload).then((res) => extractData(res, { team: null })),
  update: (id, payload) => api.put(`/teams/${id}`, payload).then((res) => extractData(res, { team: null })),
  remove: (id) => api.delete(`/teams/${id}`).then((res) => extractData(res, {})),
  addMember: (id, userId) => api.post(`/teams/${id}/members`, { userId }).then((res) => extractData(res, { team: null })),
  removeMember: (id, userId) => api.delete(`/teams/${id}/members/${userId}`).then((res) => extractData(res, { team: null }))
};

import { api, extractData } from './client';

export const taskApi = {
  list: (params = {}) => api.get('/tasks', { params }).then((res) => extractData(res, { tasks: [], meta: null })),
  get: (id) => api.get(`/tasks/${id}`).then((res) => extractData(res, { task: null })),
  create: (payload) => api.post('/tasks', payload).then((res) => extractData(res, { task: null })),
  update: (id, payload) => api.put(`/tasks/${id}`, payload).then((res) => extractData(res, { task: null })),
  remove: (id) => api.delete(`/tasks/${id}`).then((res) => extractData(res, { message: 'Task deleted' })),
  updateStatus: (id, status) => api.patch(`/tasks/${id}/status`, { status }).then((res) => extractData(res, { task: null }))
};

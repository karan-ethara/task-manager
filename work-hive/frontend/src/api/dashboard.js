import { api, extractData } from './client';

export const dashboardApi = {
  get: () => api.get('/dashboard').then((res) => extractData(res, {})),
  overdue: () => api.get('/dashboard/overdue').then((res) => extractData(res, { tasks: [] }))
};

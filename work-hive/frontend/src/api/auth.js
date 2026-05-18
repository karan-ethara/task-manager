import { api, extractData } from './client';

export const authApi = {
  signup: (payload) => api.post('/auth/signup', payload).then((res) => extractData(res)),
  login: (payload) => api.post('/auth/login', payload).then((res) => extractData(res)),
  me: () => api.get('/auth/me').then((res) => extractData(res, { user: null }))
};

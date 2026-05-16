import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth';
import { setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');

  useEffect(() => {
    setUnauthorizedHandler(({ message }) => {
      localStorage.removeItem('ttm_token');
      setUser(null);
      setSessionError(message || 'Your session has expired. Please log in again.');
    });

    const token = localStorage.getItem('ttm_token');
    if (!token) {
      setLoading(false);
      return;
    }

    authApi.me()
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem('ttm_token');
        setUser(null);
      })
      .finally(() => setLoading(false));

    return () => setUnauthorizedHandler(null);
  }, []);

  const login = async (payload) => {
    const data = await authApi.login(payload);
    localStorage.setItem('ttm_token', data.token);
    setUser(data.user);
    setSessionError('');
  };

  const signup = async (payload) => {
    const data = await authApi.signup(payload);
    localStorage.setItem('ttm_token', data.token);
    setUser(data.user);
    setSessionError('');
  };

  const logout = () => {
    localStorage.removeItem('ttm_token');
    setUser(null);
    setSessionError('');
  };

  const refreshMe = async () => {
    const data = await authApi.me();
    setUser(data.user);
  };

  const clearSessionError = useCallback(() => setSessionError(''), []);

  const value = useMemo(
    () => ({ user, loading, sessionError, login, signup, logout, clearSessionError, refreshMe }),
    [user, loading, sessionError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

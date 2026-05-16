import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AuthPage({ mode }) {
  const isSignup = mode === 'signup';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const { login, signup, sessionError, clearSessionError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    return () => clearSessionError();
  }, [clearSessionError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    setFieldErrors({});

    // Frontend validation
    const localErrors = {};
    if (isSignup && (!form.name || form.name.trim().length < 2)) localErrors.name = 'Name is required (min 2 chars)';
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) localErrors.email = 'A valid email is required';
    if (!form.password || form.password.length < 8) localErrors.password = 'Password must be at least 8 characters';
    if (Object.keys(localErrors).length) {
      setFieldErrors(localErrors);
      setSubmitting(false);
      return;
    }

    try {
      if (isSignup) await signup(form);
      else await login({ email: form.email, password: form.password });
      navigate(location.state?.from?.pathname || '/');
    } catch (err) {
      setError(err.message);
      const apiErrors = err.data?.errors;
      if (apiErrors) {
        const map = {};
        apiErrors.forEach((e) => { map[e.field] = e.message; });
        setFieldErrors(map);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <section className="auth-card">
        <div className="auth-copy">
          <div className="brand auth-brand"><div className="brand-icon">T</div><strong>TaskFlow</strong></div>
          <h1>{isSignup ? 'Create your workspace account' : 'Welcome back'}</h1>
          <p>Manage projects, assign tasks, and track team progress from a clean role-based dashboard.</p>
        </div>

        <form className="form-card" onSubmit={handleSubmit}>
          <h2>{isSignup ? 'Signup' : 'Login'}</h2>
          {(sessionError || error) && <div className="alert error">{sessionError || error}</div>}

          {isSignup && (
            <label>Name
              <input required minLength="2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
          )}
          {fieldErrors.name && <div className="alert error">{fieldErrors.name}</div>}

          <label>Email
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          {fieldErrors.email && <div className="alert error">{fieldErrors.email}</div>}

          <label>Password
            <input type="password" required minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
          {fieldErrors.password && <div className="alert error">{fieldErrors.password}</div>}

          <button className="primary-button" disabled={submitting}>
            {submitting ? <LoadingSpinner label={isSignup ? 'Creating account...' : 'Signing in...'} /> : isSignup ? 'Create account' : 'Login'}
          </button>
          <p className="muted centered">
            {isSignup ? 'Already have an account?' : 'New here?'}{' '}
            <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Login' : 'Signup'}</Link>
          </p>
        </form>
      </section>
    </div>
  );
}

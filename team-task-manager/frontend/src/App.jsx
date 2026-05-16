import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import ProjectDetails from './pages/ProjectDetails';
import Projects from './pages/Projects';
import Account from './pages/Account';
import Unauthorized from './pages/Unauthorized';
import Tasks from './pages/Tasks';
import Team from './pages/Team';
import Users from './pages/Users';
import Settings from './pages/Settings';

function AdminOnly({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user?.role !== 'Admin') return <Navigate to="/unauthorized" replace state={{ from: location.pathname }} />;
  return children;
}

function ManagerOnly({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!['Admin', 'Team Lead'].includes(user?.role)) return <Navigate to="/unauthorized" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetails />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="account" element={<Account />} />
        <Route path="team" element={<Team />} />
        <Route path="users" element={<Users />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

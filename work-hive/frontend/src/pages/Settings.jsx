import React, { useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const toast = useToast();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('ttm_theme_mode') || 'light');
  const [themeAccent, setThemeAccent] = useState(() => localStorage.getItem('ttm_theme_accent') || 'indigo');

  const save = () => {
    localStorage.setItem('ttm_theme_mode', themeMode);
    localStorage.setItem('ttm_theme_accent', themeAccent);
    window.dispatchEvent(new Event('ttm:theme-changed'));
    toast?.success('Settings saved successfully');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div>
      <PageHeader eyebrow="Workspace" title="Settings" description="Customize your workspace behavior and personal preferences." />
      <section className="panel">
        <div className="stack-form">
          <label>Theme mode
            <select value={themeMode} onChange={(e) => setThemeMode(e.target.value)}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>
          <label>Accent color
            <select value={themeAccent} onChange={(e) => setThemeAccent(e.target.value)}>
              <option value="blue">Blue</option>
              <option value="indigo">Indigo</option>
              <option value="emerald">Emerald</option>
              <option value="violet">Violet</option>
              <option value="slate">Slate</option>
            </select>
          </label>
          <div>
            <button type="button" className="primary-button" onClick={save}>Save settings</button>
            <button type="button" className="danger-button" onClick={handleLogout} style={{ marginLeft: 8 }}>Logout</button>
          </div>
        </div>
      </section>
    </div>
  );
}

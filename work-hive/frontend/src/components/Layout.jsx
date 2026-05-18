import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CheckSquare, ChevronDown, FolderKanban, Gauge, Menu, Settings, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../api/users';
import AvailabilityStatus from './AvailabilityStatus';
import BrandLogo from './BrandLogo';
import UserProfilePanel from './UserProfilePanel';

export default function Layout() {
  const { user, refreshMe, logout } = useAuth();
  const navigate = useNavigate();
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('ttm_theme_mode') || 'light');
  const [themeAccent, setThemeAccent] = useState(() => localStorage.getItem('ttm_theme_accent') || 'indigo');
  const [menuOpen, setMenuOpen] = useState(false);
  const [profilePanelUserId, setProfilePanelUserId] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isManager = ['Admin', 'Team Lead'].includes(user?.role);

  useEffect(() => {
    const root = document.documentElement;
    const applyMode = () => {
      const resolved = themeMode === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : themeMode;
      root.setAttribute('data-theme', resolved);
      root.setAttribute('data-theme-mode', themeMode);
      root.setAttribute('data-accent', themeAccent);
    };
    applyMode();
    localStorage.setItem('ttm_theme_mode', themeMode);
    localStorage.setItem('ttm_theme_accent', themeAccent);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', applyMode);
    return () => media.removeEventListener('change', applyMode);
  }, [themeMode, themeAccent]);

  useEffect(() => {
    const onProfileOpen = (event) => {
      const id = event.detail?.userId;
      if (!id) return;
      setProfilePanelUserId(id);
    };
    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setSidebarOpen(false);
      }
    };
    const onDocumentClick = (event) => {
      const trigger = event.target.closest('.profile-card-wrap');
      if (!trigger) setMenuOpen(false);
    };
    const onThemeChanged = () => {
      setThemeMode(localStorage.getItem('ttm_theme_mode') || 'light');
      setThemeAccent(localStorage.getItem('ttm_theme_accent') || 'indigo');
    };
    window.addEventListener('ttm:open-user-profile', onProfileOpen);
    window.addEventListener('ttm:theme-changed', onThemeChanged);
    window.addEventListener('keydown', onEscape);
    document.addEventListener('click', onDocumentClick);
    return () => {
      window.removeEventListener('ttm:open-user-profile', onProfileOpen);
      window.removeEventListener('ttm:theme-changed', onThemeChanged);
      window.removeEventListener('keydown', onEscape);
      document.removeEventListener('click', onDocumentClick);
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 980) setSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const updateStatus = async (status) => {
    try {
      setMenuOpen(false);
      await userApi.updateMyStatus(status);
      await refreshMe();
    } catch {
      // API interceptor and page-level alerts handle errors
    }
  };

  return (
    <div className="app-shell">
      <button type="button" className="mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation menu">
        <Menu size={18} /> Menu
      </button>
      {sidebarOpen && <button type="button" className="sidebar-overlay" aria-label="Close navigation menu" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <button type="button" className="mobile-close-button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation menu">
          <X size={16} /> Close
        </button>
        <BrandLogo subtitle="Projects, people, momentum" />

        <nav className="nav-list">
          <NavLink to="/" end><Gauge size={18} /> Dashboard</NavLink>
          <NavLink to="/team"><Users size={18} /> Teams</NavLink>
          <NavLink to="/users"><Users size={18} /> Members</NavLink>
          <NavLink to="/projects"><FolderKanban size={18} /> Projects</NavLink>
          <NavLink to="/tasks"><CheckSquare size={18} /> {isManager ? 'Team Tasks' : 'My Tasks'}</NavLink>
          <NavLink to="/settings"><Settings size={18} /> Settings</NavLink>
        </nav>

        <div className="profile-card-wrap">
          <button type="button" className="profile-card profile-trigger" onClick={() => setMenuOpen((v) => !v)}>
            <div className="avatar">{user?.name?.[0]}</div>
            <div>
              <strong>{user?.name}</strong>
              <span>{user?.role}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AvailabilityStatus value={user?.profileStatus || 'Active'} />
              <ChevronDown size={14} />
            </div>
          </button>
          {menuOpen && (
            <div className="profile-menu">
              <button type="button" onClick={() => { setProfilePanelUserId(user?.id || user?._id); setMenuOpen(false); }}>View Profile</button>
              <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--menu-text)', opacity: 0.85 }}>Change Status</div>
              <div className="profile-status-actions">
                <button type="button" title="Active" onClick={() => updateStatus('Active')}><span className="status-indicator active" /></button>
                <button type="button" title="Away" onClick={() => updateStatus('Away')}><span className="status-indicator away" /></button>
                <button type="button" title="Idle" onClick={() => updateStatus('Idle')}><span className="status-indicator idle" /></button>
                <button type="button" title="Do Not Disturb" onClick={() => updateStatus('Do Not Disturb')}><span className="status-indicator dnd" /></button>
              </div>
              <button type="button" onClick={() => { setThemeMode(themeMode === 'dark' ? 'light' : 'dark'); setMenuOpen(false); }}>Theme</button>
              <button type="button" onClick={() => { navigate('/settings'); setMenuOpen(false); }}>Settings</button>
              <button type="button" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
            </div>
          )}
        </div>
      </aside>

      <main className="main-panel">
        <Outlet />
      </main>

      <UserProfilePanel
        open={Boolean(profilePanelUserId)}
        userId={profilePanelUserId}
        onClose={() => setProfilePanelUserId('')}
      />
    </div>
  );
}

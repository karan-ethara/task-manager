import React from 'react';
import { X } from 'lucide-react';
import { userApi } from '../api/users';
import AvailabilityStatus from './AvailabilityStatus';
import LoadingSpinner from './LoadingSpinner';
import { formatDate } from '../utils/date';

export default function UserProfilePanel({ userId, open, onClose }) {
  const [profile, setProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    setError('');
    setProfile(null);
    userApi.getProfile(userId)
      .then((data) => setProfile(data.profile || null))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, userId]);

  if (!open) return null;

  return (
    <div className="profile-panel-backdrop" onClick={onClose}>
      <aside className="profile-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="profile-panel-head">
          <h3>Profile</h3>
          <button type="button" className="ghost-button" onClick={onClose}><X size={16} /></button>
        </div>
        {loading && <LoadingSpinner label="Loading profile..." />}
        {error && <div className="alert error">{error}</div>}
        {!loading && !error && profile && (
          <div className="profile-card-body">
            <div className="profile-hero-center">
              <div className="avatar large">{profile.name?.[0] || 'U'}</div>
              <div className="profile-identity">
                <h2>{profile.name}</h2>
                <p>{profile.role}</p>
              </div>
            </div>
            <div className="profile-info-grid">
              <div className="profile-info-row">
                <span className="profile-label">Email</span>
                <span className="profile-value">{profile.email}</span>
              </div>
              <div className="profile-info-row">
                <span className="profile-label">Team</span>
                <span className="profile-value">{profile.team?.name || 'No team'}</span>
              </div>
              <div className="profile-info-row">
                <span className="profile-label">Status</span>
                <span className="profile-value"><AvailabilityStatus value={profile.profileStatus || 'Active'} /></span>
              </div>
              <div className="profile-info-row">
                <span className="profile-label">Joined date</span>
                <span className="profile-value key-accent">{formatDate(profile.createdAt)}</span>
              </div>
              <div className="profile-info-row">
                <span className="profile-label">Assigned tasks</span>
                <span className="profile-value">{profile.workload?.totalTasks ?? 0}</span>
              </div>
              <div className="profile-info-row">
                <span className="profile-label">Completed tasks</span>
                <span className="profile-value">{profile.workload?.completedTasks ?? 0}</span>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

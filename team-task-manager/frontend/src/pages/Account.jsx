import React from 'react';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/date';
import { userApi } from '../api/users';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Account() {
  const { user, logout, refreshMe } = useAuth();
  const [status, setStatus] = React.useState(user?.profileStatus || 'Active');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setStatus(user?.profileStatus || 'Active');
  }, [user?.profileStatus]);

  const updateStatus = async () => {
    try {
      setSaving(true);
      setError('');
      await userApi.updateMyStatus(status);
      await refreshMe();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Profile"
        title="Account"
        description="View your workspace identity and sign out when finished."
      />

      <section className="panel">
        {error && <div className="alert error">{error}</div>}
        <div className="form-grid">
          <div>
            <p className="eyebrow">Name</p>
            <strong>{user?.name || 'Unknown'}</strong>
          </div>
          <div>
            <p className="eyebrow">Email</p>
            <strong>{user?.email || 'Unknown'}</strong>
          </div>
          <div>
            <p className="eyebrow">Role</p>
            <strong>{user?.role || 'Unknown'}</strong>
          </div>
          <div>
            <p className="eyebrow">Joined</p>
            <strong>{formatDate(user?.createdAt)}</strong>
          </div>
          <div>
            <p className="eyebrow">Availability</p>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>Active</option>
              <option>Away</option>
              <option>Idle</option>
              <option>Do Not Disturb</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="primary-button" onClick={updateStatus} disabled={saving}>
            {saving ? <LoadingSpinner label="Saving..." /> : 'Update status'}
          </button>
          <button className="primary-button" onClick={logout}>Logout</button>
        </div>
      </section>
    </div>
  );
}

import React from 'react';

const statusClassMap = {
  Active: 'status-indicator active',
  Away: 'status-indicator away',
  Offline: 'status-indicator away',
  Idle: 'status-indicator idle',
  'Do Not Disturb': 'status-indicator dnd'
};

export default function AvailabilityStatus({ value = 'Active' }) {
  return (
    <span className="availability-pill">
      <span className={statusClassMap[value] || statusClassMap.Active} />
      {value}
    </span>
  );
}

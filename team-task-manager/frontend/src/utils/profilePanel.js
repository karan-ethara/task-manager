export const openUserProfilePanel = (userId) => {
  if (!userId || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('ttm:open-user-profile', { detail: { userId } }));
};


'use client';

import { useState, useEffect } from 'react';

/**
 * useNetworkStatus
 * Tracks online/offline connectivity and provides a reconnect callback.
 * Fires a queued-refresh on reconnect for suggestions that were blocked.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    // Sync with actual state on mount (navigator.onLine may lag)
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true); // signal "just reconnected"
      // Clear reconnect flag after 4s
      setTimeout(() => setWasOffline(false), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}

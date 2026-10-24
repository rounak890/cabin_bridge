import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export default function OfflineBanner() {
  const { settings, wsStatus } = useApp();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const backendOffline = Boolean(settings.role && settings.seat && wsStatus === 'disconnected');
  if (!isOffline && !backendOffline) return null;

  return (
    <div className="offline-banner" role="alert" aria-live="polite">
      <span>📡</span>
      <div>
        <strong>{isOffline ? 'Offline mode' : 'Local backend unavailable'}</strong> — Phrase cards, urgent button, and TTS are available.
        Voice transcription and translation require the local backend (localhost:8000).
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import type { UrgentType } from '../types';

const URGENT_TYPES: { type: UrgentType; icon: string; label: string }[] = [
  { type: 'medical', icon: '🏥', label: 'Medical Emergency' },
  { type: 'unwell', icon: '🤒', label: 'Feeling Unwell' },
  { type: 'security', icon: '🚨', label: 'Security Concern' },
  { type: 'other', icon: '📞', label: 'Other Urgent Help' },
];

export default function UrgentButton() {
  const { sendUrgent, crewOnline, deliveryMap, wsStatus } = useApp();
  const [open, setOpen] = useState(false);
  const [sentId, setSentId] = useState<string | null>(null);
  const [sentStatus, setSentStatus] = useState<string | null>(null);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const firstTypeRef = useRef<HTMLButtonElement | null>(null);

  // Watch delivery status for the last sent urgent
  useEffect(() => {
    if (sentId && deliveryMap[sentId]) {
      setSentStatus(deliveryMap[sentId]);
    }
  }, [sentId, deliveryMap]);

  // While the chooser is open: close on Escape, lock background scroll, and
  // move focus into the dialog. The dialog is portaled to <body> so the sticky
  // header cannot paint over it, and it can never inherit the urgent dock's
  // pointer-events: none (which used to make the choices unclickable).
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => firstTypeRef.current?.focus(), 30);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [open]);

  function handleType(type: UrgentType) {
    // PRODUCT RULE 2: Urgent assistance never touches ASR/translation.
    // Sends a predefined event instantly.
    const id = Math.random().toString(36).slice(2, 10);
    setSentId(id);
    setSentStatus('sent');
    sendUrgent(type, id);
    setOpen(false);

    // Fallback instructions if not delivered within 5 seconds
    const t = setTimeout(() => {
      setSentStatus(prev => prev === 'sent' ? 'not_delivered' : prev);
    }, 5000);
    setTimer(t);
  }

  function handleClose() {
    setOpen(false);
    setSentId(null);
    setSentStatus(null);
    if (timer) clearTimeout(timer);
  }

  const chooser = open ? (
    <div
      className="urgent-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="urgent-modal-title"
      onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}
    >
      <div className="urgent-modal card animate-fade-in">
        <h2 id="urgent-modal-title" className="urgent-modal-title">🚨 What do you need?</h2>
        <div className="urgent-type-grid">
          {URGENT_TYPES.map((u, index) => (
            <button
              key={u.type}
              ref={index === 0 ? firstTypeRef : undefined}
              id={`urgent-${u.type}`}
              type="button"
              className="urgent-type-btn"
              onClick={() => handleType(u.type)}
              aria-label={u.label}
            >
              <span className="urgent-type-icon" aria-hidden="true">{u.icon}</span>
              <span className="urgent-type-label">{u.label}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost w-full urgent-cancel" onClick={() => setOpen(false)}>Cancel</button>
        {!crewOnline && wsStatus !== 'connected' && (
          <p className="urgent-modal-note" role="note">
            ⚠️ No crew device is available to receive this request. Press the call button above your seat or raise your hand if urgent.
          </p>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Persistent urgent button — always visible */}
      <button
        id="urgent-btn"
        type="button"
        className="btn btn-urgent urgent-persistent animate-urgent"
        onClick={() => setOpen(true)}
        aria-label="I need urgent assistance"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        🚨 I Need Urgent Help
      </button>

      {/* Status display */}
      {sentStatus && (
        <div className={`urgent-status card ${sentStatus === 'not_delivered' ? 'urgent-fail' : ''}`} role="status" aria-live="assertive">
          {sentStatus === 'sent' && <><span className="animate-pulse">⏳</span> <strong>Sent</strong> — waiting for crew delivery confirmation.</>}
          {sentStatus === 'delivered' && <><span>✅</span> <strong>Delivered to crew</strong> — Stand by.</>}
          {sentStatus === 'acknowledged' && <><span>👩‍✈️</span> <strong>Acknowledged by crew</strong> — please wait at your seat.</>}
          {sentStatus === 'resolved' && <><span>✅</span> <strong>Request resolved by crew.</strong></>}
          {sentStatus === 'not_delivered' && (
            <div>
              <div><span>⚠️</span> <strong>Not delivered</strong> — The request did not reach a crew device.</div>
              <div className="urgent-status-help">
                Please press the <strong>overhead call button</strong> above your seat, or raise your hand to flag a crew member.
              </div>
            </div>
          )}
          <button type="button" className="btn btn-ghost urgent-status-dismiss" onClick={handleClose}>Dismiss</button>
        </div>
      )}

      {chooser && createPortal(chooser, document.body)}
    </>
  );
}

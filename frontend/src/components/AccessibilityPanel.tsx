import { useApp } from '../context/AppContext';

export default function AccessibilityPanel({ onClose }: { onClose?: () => void }) {
  const { settings, updateSettings } = useApp();

  return (
    <div className="a11y-panel card" role="region" aria-label="Accessibility settings">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'var(--space-4)'}}>
        <h3 style={{fontSize:'var(--text-lg)',fontWeight:700}}>♿ Accessibility</h3>
        {onClose && <button className="btn btn-ghost" style={{minHeight:'36px',padding:'4px 12px'}} onClick={onClose}>✕</button>}
      </div>

      <div className="a11y-row">
        <label>Text Size</label>
        <div className="a11y-text-sizes">
          {([1,2,3,4] as const).map(s => (
            <button
              key={s}
              id={`text-size-${s}`}
              className={`a11y-size-btn ${settings.textSize === s ? 'active' : ''}`}
              onClick={() => updateSettings({ textSize: s })}
              aria-pressed={settings.textSize === s}
              aria-label={`Text size ${s}`}
            >
              {['A','A','A','A'][s-1]}
            </button>
          ))}
        </div>
      </div>

      <div className="a11y-row">
        <label htmlFor="high-contrast">High Contrast</label>
        <input
          id="high-contrast"
          type="checkbox"
          style={{width:'auto'}}
          checked={settings.highContrast}
          onChange={e => updateSettings({ highContrast: e.target.checked })}
        />
      </div>

      <div className="a11y-row">
        <label htmlFor="reduced-motion">Reduced Motion</label>
        <input
          id="reduced-motion"
          type="checkbox"
          style={{width:'auto'}}
          checked={settings.reducedMotion}
          onChange={e => updateSettings({ reducedMotion: e.target.checked })}
        />
      </div>

      <div className="a11y-row">
        <label htmlFor="tts-speed">TTS Speed: {settings.ttsSpeed}x</label>
        <input
          id="tts-speed"
          type="range"
          min="0.5" max="2" step="0.1"
          style={{width:'auto',flex:1}}
          value={settings.ttsSpeed}
          onChange={e => updateSettings({ ttsSpeed: Number(e.target.value) })}
        />
      </div>

      <div className="a11y-row">
        <label htmlFor="confirm-tts">Confirm before speaking TTS</label>
        <input
          id="confirm-tts"
          type="checkbox"
          style={{width:'auto'}}
          checked={settings.confirmBeforeTTS}
          onChange={e => updateSettings({ confirmBeforeTTS: e.target.checked })}
        />
      </div>

      <style>{`
        .a11y-panel { display: flex; flex-direction: column; gap: var(--space-4); }
        .a11y-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); font-size: var(--text-sm); }
        .a11y-text-sizes { display: flex; gap: var(--space-2); }
        .a11y-size-btn {
          width: 36px; height: 36px; border-radius: var(--radius-sm);
          background: var(--color-surface2); border: 2px solid var(--color-border);
          color: var(--color-text); cursor: pointer; font-weight: 700;
          transition: all var(--transition-fast);
        }
        .a11y-size-btn:nth-child(1) { font-size: 0.7rem; }
        .a11y-size-btn:nth-child(2) { font-size: 0.9rem; }
        .a11y-size-btn:nth-child(3) { font-size: 1.1rem; }
        .a11y-size-btn:nth-child(4) { font-size: 1.3rem; }
        .a11y-size-btn.active { border-color: var(--color-accent); background: rgba(88,166,255,0.1); }
      `}</style>
    </div>
  );
}

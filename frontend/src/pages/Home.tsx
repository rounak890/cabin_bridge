import { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Lang, Role } from '../types';
import { LANGUAGES, FLAGS } from '../languages';

export default function Home() {
  const { settings, updateSettings } = useApp();
  const [role, setRole] = useState<Role>(settings.role ?? 'passenger');
  const [seat, setSeat] = useState(settings.seat || '');
  const [lang, setLang] = useState<Lang | null>(settings.languageChosen ? settings.lang : null);
  const [languageConfirmed, setLanguageConfirmed] = useState(Boolean(settings.languageChosen));

  function start() {
    if (!lang || !seat.trim()) return;
    const normalizedSeat = seat.trim().replace(/\s+/g, '').toUpperCase();
    updateSettings({ role, seat: normalizedSeat, lang, languageChosen: true });
    window.location.hash = `#/${role}`;
  }

  return <div className="home-page">
    <header className="home-hero">
      <div className="home-logo" aria-hidden="true">✈️</div>
      <h1 className="home-title">CabinBridge</h1>
      <p className="home-subtitle">Japan Airlines · Flight communication assistant</p>
      <p className="home-tagline">Simple communication between passengers and cabin crew</p>
    </header>
    <section className="home-card panel">
      {!languageConfirmed ? <div className="form-section">
        <div><h2 className="home-step-title">Choose your language</h2>
          <p className="form-hint">最初に使いやすい言語を選んでください · अपनी भाषा चुनें</p></div>
        <div className="lang-grid" role="group" aria-label="Choose your language">
          {LANGUAGES.map(language => <button key={language.code}
            className={`lang-btn ${lang === language.code ? 'active' : ''}`}
            onClick={() => setLang(language.code as Lang)} aria-pressed={lang === language.code}>
            <span className="lang-flag" aria-hidden="true">{FLAGS[language.code as Lang]}</span>
            <span className="lang-native">{language.nativeName}</span>
          </button>)}
        </div>
        <button className="btn btn-primary w-full" disabled={!lang} onClick={() => {
          if (!lang) return;
          updateSettings({ lang, languageChosen: true });
          setLanguageConfirmed(true);
        }}>Continue · 続ける</button>
      </div> : <>
        <div className="home-language-row">
          <span>Language · {LANGUAGES.find(language => language.code === lang)?.nativeName}</span>
          <button className="btn btn-ghost" onClick={() => setLanguageConfirmed(false)}>Change</button>
        </div>
        <div className="form-section">
          <h2 className="home-step-title">How will you use CabinBridge?</h2>
          <div className="role-selector">
            <button className={`role-btn ${role === 'passenger' ? 'active' : ''}`} onClick={() => setRole('passenger')} aria-pressed={role === 'passenger'}>
              <span className="role-icon">🧳</span><span>Passenger</span>
            </button>
            <button className={`role-btn ${role === 'crew' ? 'active' : ''}`} onClick={() => setRole('crew')} aria-pressed={role === 'crew'}>
              <span className="role-icon">👩‍✈️</span><span>Crew member</span>
            </button>
          </div>
        </div>
        <div className="form-section">
          <label className="form-label" htmlFor="seat-input">{role === 'passenger' ? 'Seat number' : 'Crew station ID'}</label>
          <input id="seat-input" value={seat} onChange={event => setSeat(event.target.value)}
            placeholder={role === 'passenger' ? 'For example, 12A' : 'For example, CREW-1'} maxLength={10} />
        </div>
        {role === 'passenger' && !LANGUAGES.find(language => language.code === lang)?.asr &&
          <p className="form-hint">Voice input is unavailable in this language. Phrase cards and text are ready to use.</p>}
        <button className="btn btn-primary w-full home-enter" onClick={start} disabled={!seat.trim()}>Open CabinBridge →</button>
        <nav className="home-links" aria-label="More information">
          <a href="#/about">About &amp; privacy</a><a href="#/demo">Demo guide</a><a href="#/metrics">Metrics</a>
        </nav>
      </>}
    </section>
  </div>;
}

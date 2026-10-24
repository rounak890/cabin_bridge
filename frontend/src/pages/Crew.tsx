import { useEffect, useState } from 'react';
import { apiHealth } from '../api';
import { useApp } from '../context/AppContext';
import type { Lang, Message } from '../types';
import ReplyComposer from '../components/ReplyComposer';
import RequestQueue from '../components/RequestQueue';
import SafetyLibrary from '../components/SafetyLibrary';

type CrewTab = 'queue' | 'completed' | 'reply' | 'safety' | 'operate';

function SentReplies({ messages, deliveryMap }: { messages: Message[]; deliveryMap: Record<string, string> }) {
  const replies = messages.filter(message => message.is_outgoing || message.is_crew_reply).slice().reverse();
  return (
    <section className="panel">
      <h2>Replies sent · {replies.length}</h2>
      {!replies.length && <p>No replies sent during this session.</p>}
      {replies.map(message => {
        const status = deliveryMap[message.id] || message.status;
        return <article className="queue-item" key={message.id}>
        <header>
          <strong>To seat {message.seat}</strong>
          <span className={`badge ${status === 'delivered' ? 'badge-success' : status === 'not_delivered' ? 'badge-urgent' : 'badge-info'}`}>
            {status === 'delivered' ? 'Delivered to passenger'
              : status === 'not_delivered' ? 'Saved · passenger offline' : 'Reply sent'}
          </span>
        </header>
        <div className="translation-pair"><p>{message.source_text}</p><p>{message.translated_text}</p></div>
        <small>{message.ts ? new Date(message.ts * 1000).toLocaleTimeString() : ''}</small>
        </article>;
      })}
    </section>
  );
}

export default function Crew() {
  const app = useApp();
  const [tab, setTab] = useState<CrewTab>('queue');
  const [seat, setSeat] = useState('12A');
  const [passengerLang, setPassengerLang] = useState<Lang>('en');
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    let active = true;
    const check = () => apiHealth().then(() => active && setBackendOnline(true)).catch(() => active && setBackendOnline(false));
    check();
    const timer = setInterval(check, 10000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const targetSeat = app.replyTarget?.seat || seat;
  const targetLang = app.replyTarget?.lang || passengerLang;
  const activeSeats = [...new Set([
    ...app.messages.filter(message => !message.is_crew_reply && !message.is_outgoing).map(message => message.seat || message.from || ''),
    ...app.urgentEvents.map(event => event.seat),
    ...app.messages.filter(message => message.is_outgoing || message.is_crew_reply).map(message => message.seat || ''),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const seatLangs = new Map(app.messages.filter(message => !message.is_crew_reply && !message.is_outgoing)
    .map(message => [message.seat || message.from || '', message.source_lang] as const));
  const replyCount = app.messages.filter(message => message.is_outgoing || message.is_crew_reply).length;
  const requestStatuses = new Map<string, string | undefined>([
    ...app.messages.filter(message => !message.is_crew_reply && !message.is_outgoing).map(message => [message.id, message.status] as const),
    ...app.urgentEvents.map(event => [event.id, event.status] as const),
  ]);
  const requestIds = [...requestStatuses.keys()];
  const openRequestCount = requestIds.filter(id => (app.deliveryMap[id] || requestStatuses.get(id)) !== 'resolved').length;
  const completedRequestCount = requestIds.filter(id => (app.deliveryMap[id] || requestStatuses.get(id)) === 'resolved').length;
  const tabs: { id: CrewTab; label: string }[] = [
    { id: 'queue', label: `Requests · ${openRequestCount}` }, { id: 'completed', label: `Resolved queries · ${completedRequestCount}` }, { id: 'reply', label: 'Reply' },
    { id: 'safety', label: 'Safety library' }, { id: 'operate', label: 'Crew-operated mode' },
  ];

  return (
    <div className="page container">
      <header className="page-header">
        <h1 className="page-title">Crew communication</h1>
        <p><span className={`status-dot ${app.wsStatus === 'connected' ? 'online' : 'offline'}`} />
          Crew console {app.wsStatus === 'connected' ? 'connected' : app.wsStatus}</p>
        <div className="crew-summary" aria-label="Crew queue summary">
          <span><strong>{openRequestCount}</strong> open requests</span>
          <span><strong>{activeSeats.length}</strong> passenger seats</span>
          <span><strong>{replyCount}</strong> replies sent</span>
        </div>
      </header>

      <nav className="tabs" aria-label="Crew tools">
        {tabs.map(item => <button key={item.id} className={`tab ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}>{item.label}</button>)}
      </nav>

      {tab === 'queue' && <>
        <details className="panel crew-demo">
          <summary>Demo controls</summary>
          <p>Local backend: {backendOnline ? 'online' : 'offline'}. Voice recognition and translation run on this device.</p>
          <label><input type="checkbox" checked={app.simulateFailure} onChange={event => app.toggleSimFailure(event.target.checked)} /> Simulate crew link failure</label>
          <p>Demo only: passenger requests will not be marked delivered while enabled.</p>
        </details>
        {app.replyTarget && <ReplyComposer seat={targetSeat} targetLang={targetLang} requestId={app.replyTarget.requestId} onClose={() => app.replyToSeat('', 'en')} />}
        {!!app.repeatRequests.length && <section className="panel repeat-alerts" aria-live="polite">
          <h2>Passengers asking for repetition · {app.repeatRequests.length}</h2>
          {app.repeatRequests.slice().reverse().map(request => <p key={request.id}><strong>Seat {request.seat}</strong> asked the crew to repeat the last message.</p>)}
        </section>}
        <RequestQueue messages={app.messages} urgentEvents={app.urgentEvents} app={app} />
      </>}

      {tab === 'completed' && <>
        <p className="notice" role="note">Resolved passenger messages are moved here from the Requests tab.</p>
        <RequestQueue messages={app.messages} urgentEvents={app.urgentEvents} app={app} completed />
      </>}

      {tab === 'reply' && <>
        <section className="panel">
          <h2>Choose passenger</h2>
          <label>Choose a passenger seat<select value={activeSeats.includes(targetSeat) ? targetSeat : ''} onChange={event => {
            const next = event.target.value;
            if (next) {
              app.replyToSeat('', 'en');
              setSeat(next);
              setPassengerLang(seatLangs.get(next) || 'en');
            }
          }}>
            <option value="">Choose a seat or enter one below</option>
            {activeSeats.map(activeSeat => <option value={activeSeat} key={activeSeat}>Seat {activeSeat}</option>)}
          </select></label>
          <label>Seat number<input value={targetSeat} onChange={event => {
            app.replyToSeat('', 'en');
            setSeat(event.target.value);
          }} placeholder="e.g. 12A" /></label>
          <p>{activeSeats.length ? `${activeSeats.length} passenger seat${activeSeats.length === 1 ? '' : 's'} in this session` : 'No passenger seats are active yet. You can still enter a seat number.'}</p>
          <label>Passenger language<select value={passengerLang} onChange={event => setPassengerLang(event.target.value as Lang)}>
            <option value="en">English</option><option value="ja">日本語</option><option value="hi">हिन्दी</option>
            <option value="th">ภาษาไทย</option><option value="vi">Tiếng Việt</option><option value="id">Bahasa Indonesia</option><option value="tl">Filipino</option>
          </select></label>
        </section>
        <ReplyComposer seat={targetSeat} targetLang={targetLang} requestId={app.replyTarget?.requestId} />
        <SentReplies messages={app.messages} deliveryMap={app.deliveryMap} />
      </>}

      {tab === 'safety' && <SafetyLibrary lang="en" targetLang={targetLang}
        onSend={(source, translated) => app.sendCrewReply(targetSeat, source, translated, 'en', targetLang, 'safety')} />}

      {tab === 'operate' && <section className="panel">
        <h2>Crew-operated mode</h2>
        <p>Choose the passenger’s seat and language, then prepare a message with them.</p>
        <label>Seat number<input value={seat} onChange={event => setSeat(event.target.value)} /></label>
        <label>Passenger language<select value={passengerLang} onChange={event => setPassengerLang(event.target.value as Lang)}>
          <option value="en">English</option><option value="ja">日本語</option><option value="hi">हिन्दी</option>
          <option value="th">ภาษาไทย</option><option value="vi">Tiếng Việt</option><option value="id">Bahasa Indonesia</option><option value="tl">Filipino</option>
        </select></label>
        <button className="btn btn-primary" onClick={() => setTab('reply')}>Compose for this passenger</button>
      </section>}
    </div>
  );
}

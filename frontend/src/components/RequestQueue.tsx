import type { Message, UrgentEvent } from '../types';
import type { AppContextValue } from '../context/AppContext';
import HighlightText from './HighlightText';
import { useState } from 'react';

type QueueItem = Message & { isUrgent: boolean };

function buildQueue(messages: Message[], urgentEvents: UrgentEvent[]): QueueItem[] {
  const requests = messages.filter(message => !message.is_crew_reply && !message.is_outgoing)
    .map(message => ({ ...message, isUrgent: message.priority === 'urgent' }));
  const urgent = urgentEvents.map(event => ({
    id: event.id, seat: event.seat, from: event.seat,
    source_lang: 'en' as const, source_text: `Urgent assistance: ${event.urgent_type}`,
    translated_text: `Urgent assistance: ${event.urgent_type}`, target_lang: 'en' as const,
    kind: 'urgent' as const, priority: 'urgent' as const, status: event.status, ts: event.ts,
    isUrgent: true,
  }));
  const byId = new Map(requests.map(request => [request.id, request]));
  urgent.forEach(event => { if (!byId.has(event.id)) byId.set(event.id, event); });
  return [...byId.values()].sort((a, b) => Number(b.isUrgent) - Number(a.isUrgent) || (b.ts || 0) - (a.ts || 0));
}

function statusLabel(status?: string) {
  if (status === 'sent') return 'Queued for crew';
  if (status === 'acknowledged') return 'Acknowledged';
  if (status === 'resolved') return 'Resolved';
  if (status === 'not_delivered') return 'Not delivered';
  return status || 'Delivered';
}

export default function RequestQueue({ messages, urgentEvents, app, completed = false }: {
  messages: Message[]; urgentEvents: UrgentEvent[]; app: AppContextValue; completed?: boolean;
}) {
  const [seatFilter, setSeatFilter] = useState('all');
  const allItems = buildQueue(messages, urgentEvents);
  const matchingItems = allItems.filter(item => ((app.deliveryMap[item.id] || item.status) === 'resolved') === completed);
  const seats = [...new Set(matchingItems.map(item => item.seat || item.from || '').filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const items = seatFilter === 'all' ? matchingItems : matchingItems.filter(item => (item.seat || item.from) === seatFilter);
  if (!allItems.length) return <div className="empty-state">No requests yet. Passenger requests will appear here.</div>;
  if (!matchingItems.length) return <div className="empty-state">{completed ? 'No completed requests yet.' : 'All requests are complete. New requests will appear here.'}</div>;

  return <>
    <details className="panel queue-controls">
      <summary>Filter by seat · {seatFilter === 'all' ? `All seats · ${matchingItems.length}` : `Seat ${seatFilter}`}</summary>
      <label>Show requests for <select value={seatFilter} onChange={event => setSeatFilter(event.target.value)}>
        <option value="all">All seats · {matchingItems.length} requests</option>
        {seats.map(seat => <option key={seat} value={seat}>Seat {seat} · {matchingItems.filter(item => (item.seat || item.from) === seat).length}</option>)}
      </select></label>
      <p>{seats.length} passenger seat{seats.length === 1 ? '' : 's'} · Attend to each seat from this shared queue.</p>
    </details>
    {!items.length ? <div className="empty-state">No requests for seat {seatFilter}.</div> : <div className="queue-list">
    {items.map(message => {
      const status = app.deliveryMap[message.id] || message.status;
      const seat = message.seat || message.from || '';
      return <article key={message.id} className={`queue-item ${message.isUrgent ? 'urgent-item' : ''} ${completed ? 'resolved-item' : ''}`}>
        <header>
          <strong>Seat {seat || '—'}</strong>
          <div className="queue-item-header-actions">
            <span className={message.isUrgent ? 'badge badge-urgent' : 'badge badge-info'}>
              {message.isUrgent ? '🚨 Urgent' : message.kind}
            </span>
            {!completed && <button
              type="button"
              className="btn btn-resolve"
              disabled={app.wsStatus !== 'connected' || status === 'resolved'}
              onClick={() => app.sendResolve(message.id)}
              aria-label={`Resolve the request from seat ${seat || 'unknown'} and move it to Resolved queries`}
              title="Remove from the open queue and move to Resolved queries"
            >✓ Resolve</button>}
          </div>
        </header>
        <div className="button-row">
          <small>{message.ts ? `${Math.max(0, Math.floor(Date.now() / 1000 - message.ts))} seconds ago` : 'Just received'}</small>
          <span className={`badge ${status === 'resolved' ? 'badge-success' : 'badge-info'}`}>{statusLabel(status)}</span>
        </div>
        <div className="translation-pair">
          <p><b>Original ({message.source_lang}):</b> <HighlightText text={message.source_text} /></p>
          <p><b>Translation:</b> <HighlightText text={message.translated_text} /></p>
        </div>
        {message.kind === 'safety' && <span className="badge badge-safety">Airline-approved</span>}
        {!completed && <div className="button-row">
          <button className="btn btn-primary" disabled={!seat} onClick={() => app.replyToSeat(seat, message.source_lang, message.id)}>Reply to seat</button>
          <button className="btn btn-secondary" disabled={app.wsStatus !== 'connected' || status === 'acknowledged' || status === 'resolved'} onClick={() => app.sendAck(message.id)}>Acknowledge</button>
        </div>}
      </article>;
    })}
    </div>}
  </>;
}

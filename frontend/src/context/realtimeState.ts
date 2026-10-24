import type { Dispatch, SetStateAction } from 'react';
import type { DeliveryStatus, Message, RepeatRequest, UrgentEvent } from '../types';

export interface RealtimeEvent { type: string; [key: string]: unknown }
type Actions = {
  messages: Dispatch<SetStateAction<Message[]>>;
  urgentEvents: Dispatch<SetStateAction<UrgentEvent[]>>;
  repeatRequests: Dispatch<SetStateAction<RepeatRequest[]>>;
  deliveryMap: Dispatch<SetStateAction<Record<string, DeliveryStatus>>>;
  crewOnline: Dispatch<SetStateAction<boolean>>;
  simulateFailure: Dispatch<SetStateAction<boolean>>;
};

function merge(current: Message[], additions: Message[]) {
  const byId = new Map(current.map(message => [message.id, message]));
  additions.forEach(message => byId.set(message.id, { ...byId.get(message.id), ...message }));
  return [...byId.values()].slice(-100);
}

export function applyRealtimeEvent(evt: RealtimeEvent, actions: Actions) {
  if (evt.type === 'message' || evt.type === 'crew_reply' || evt.type === 'crew_reply_sent') {
    const message = evt as unknown as Message;
    actions.messages(prev => merge(prev, [{ ...message, is_crew_reply: evt.type === 'crew_reply', is_outgoing: evt.type === 'crew_reply_sent' }]));
    if (evt.type === 'crew_reply_sent') actions.deliveryMap(prev => ({ ...prev, [message.id]: message.status || 'sent' }));
  } else if (evt.type === 'snapshot') {
    const messages = [...((evt.requests as Message[]) || []), ...((evt.replies as Message[]) || [])];
    actions.messages(prev => merge(prev, messages));
    actions.deliveryMap(prev => ({ ...prev, ...Object.fromEntries(messages.map(m => [m.id, m.status || 'sent'])) }));
    const repeats = (evt.repeat_requests as RepeatRequest[]) || [];
    actions.repeatRequests(prev => [...repeats]);
  } else if (evt.type === 'urgent') {
    actions.urgentEvents(prev => prev.some(item => item.id === evt.id) ? prev : [...prev, evt as unknown as UrgentEvent]);
  } else if (evt.type === 'repeat_request') {
    actions.repeatRequests(prev => prev.some(item => item.id === evt.id) ? prev : [...prev, evt as unknown as RepeatRequest]);
  } else if (evt.type === 'delivery' || evt.type === 'ack') {
    const status = (evt.type === 'ack' ? 'acknowledged' : evt.status) as DeliveryStatus;
    actions.deliveryMap(prev => ({ ...prev, [evt.id as string]: status }));
    actions.messages(prev => prev.map(m => m.id === evt.id ? { ...m, status } : m));
    actions.urgentEvents(prev => prev.map(event => event.id === evt.id ? { ...event, status } : event));
  } else if (evt.type === 'error' && evt.id) {
    actions.deliveryMap(prev => ({ ...prev, [evt.id as string]: 'not_delivered' }));
    actions.messages(prev => prev.map(m => m.id === evt.id ? { ...m, status: 'not_delivered' } : m));
  } else if (evt.type === 'presence') actions.crewOnline(Boolean(evt.crew_online));
  else if (evt.type === 'simulate_failure') actions.simulateFailure(Boolean(evt.on));
}

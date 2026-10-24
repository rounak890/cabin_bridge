import { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Lang, Phrase } from '../types';
import catalog from '../../../shared/approved_phrases.json';
export default function SafetyLibrary({ lang, targetLang, onSend }: { lang: Lang; targetLang: Lang; onSend: (a:string,b:string)=>string|null }) {
  const app=useApp(); const [selected,setSelected]=useState<Phrase|null>(null); const [sentId,setSentId]=useState('');
  const items=(catalog as {phrases:Phrase[]}).phrases.filter(p=>p.category==='safety'&&p.approved);
  return <section className="panel"><h2>Airline-approved safety library</h2><p>Only reviewed phrases from the approved catalog can be sent as safety instructions.</p>
    <div className="phrase-grid">{items.map(p=><button key={p.id} className={`phrase-card ${selected?.id===p.id?'selected':''}`} onClick={()=>setSelected(p)}><span className="phrase-card-icon">{p.icon}</span><span>{p.text[lang]||p.text.en}</span><span className="badge badge-safety">Airline-approved</span></button>)}</div>
    {selected&&<div className="translation-pair"><article><h3>English source</h3><p>{selected.text.en}</p></article><article><h3>Passenger view</h3><p>{selected.text[targetLang]}</p></article><button className="btn btn-primary" disabled={app.wsStatus!=='connected'} onClick={()=>{const id=onSend(selected.text.en,selected.text[targetLang]||selected.text.en);if(id)setSentId(id);}}>Send approved safety phrase</button>{sentId&&<p role="status">{app.deliveryMap[sentId]==='delivered'?'Delivered to passenger device.':app.deliveryMap[sentId]==='not_delivered'?'Passenger device not connected. The reply was saved for reconnect.':'Sending safety phrase…'}</p>}</div>}
  </section>;
}

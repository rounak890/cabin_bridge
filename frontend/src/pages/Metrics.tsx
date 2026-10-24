import { useEffect, useState } from 'react';
import { apiMetrics } from '../api';
import type { MetricsResponse } from '../types';
export default function Metrics() {
  const [data,setData]=useState<MetricsResponse|null>(null); const [error,setError]=useState('');
  useEffect(()=>{let active=true; const load=()=>apiMetrics().then(x=>{if(active){setData(x);setError('');}}).catch(()=>{if(active)setError('Metrics are unavailable while the backend is offline.');}); load(); const t=setInterval(load,5000); return()=>{active=false;clearInterval(t);};},[]);
  return <div className="page container"><header className="page-header"><h1 className="page-title">Demo metrics</h1><p>Recent request latency and fallback use · refreshes every 5 seconds</p></header>{error&&<p className="notice">{error}</p>}
    {data&&<><div className="stats-grid">{(['asr','translate','total'] as const).map(k=><article className="panel" key={k}><h2>{k.toUpperCase()} latency</h2><p>Median: {data.stats[k].median} ms</p><p>p95: {data.stats[k].p95} ms</p><small>{data.stats[k].count} measured</small></article>)}<article className="panel"><h2>Fallback count</h2><p>{data.fallback_count}</p></article></div>
    <div className="table-scroll"><table><thead><tr><th>Seat</th><th>Type</th><th>State</th><th>ASR ms</th><th>Translate ms</th><th>Total ms</th><th>Confidence</th></tr></thead><tbody>{data.requests.map(r=><tr key={r.id}><td>{r.seat}</td><td>{r.kind}</td><td>{r.status}</td><td>{r.asr_ms}</td><td>{r.translate_ms}</td><td>{r.total_ms}</td><td>{r.confidence_level}</td></tr>)}</tbody></table></div></>}
  </div>;
}

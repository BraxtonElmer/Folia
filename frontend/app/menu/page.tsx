'use client';

import DashboardLayout from '../components/DashboardLayout';
import { useState, useEffect } from 'react';
import { ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';
import { fetchMenuSuggestions, fetchCanteens } from '../lib/api';

export default function MenuPage() {
  const [mounted, setMounted] = useState(false);
  const [canteens, setCanteens] = useState<any[]>([]);
  const [canteenId, setCanteenId] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setMounted(true); fetchCanteens().then(c => { setCanteens(c); if (c.length > 0) setCanteenId(c[0].id); }).catch(() => {}); }, []);

  useEffect(() => {
    if (!canteenId) return;
    setLoading(true);
    fetchMenuSuggestions(canteenId).then(setSuggestions).catch(() => {}).finally(() => setLoading(false));
  }, [canteenId]);

  if (!mounted) return <DashboardLayout><div className="page-body" /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div><h2>Menu Optimization</h2><p>Data-driven suggestions to reduce waste through smarter menu choices</p></div>
          <select className="form-select" style={{ width: 180 }} value={canteenId} onChange={e => setCanteenId(e.target.value)}>
            {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}><span className="text-muted">Loading...</span></div>
        ) : (
          <>
            <div className="table-wrapper mb-6">
              <table className="table">
                <thead><tr><th>Item</th><th>Waste Rate</th><th>Best Day</th><th>Worst Day</th><th>Suggestion</th></tr></thead>
                <tbody>
                  {suggestions.map(s => (
                    <tr key={s.item_id}>
                      <td className="font-medium" style={{ color: 'var(--text)' }}>{s.item_name}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="gauge" style={{ width: 50 }}><div className={`gauge-fill ${s.waste_rate > 40 ? 'red' : s.waste_rate > 25 ? 'yellow' : 'green'}`} style={{ width: `${Math.min(s.waste_rate, 100)}%` }} /></div>
                          <span className={`badge ${s.waste_rate > 40 ? 'badge-danger' : s.waste_rate > 25 ? 'badge-warning' : 'badge-success'}`}>{s.waste_rate}%</span>
                        </div>
                      </td>
                      <td><span className="badge badge-success">{s.best_day}</span></td>
                      <td><span className="badge badge-danger">{s.worst_day}</span></td>
                      <td>
                        {s.suggested_replacement ? (
                          <div className="flex items-center gap-2"><AlertCircle size={14} style={{ color: 'var(--warning)' }} /><span className="text-xs">Replace on {s.worst_day} with <strong>{s.suggested_replacement}</strong> <span className="text-muted">({s.replacement_waste_rate}% waste)</span></span></div>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-muted"><CheckCircle size={14} style={{ color: 'var(--success)' }} /> No action needed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="section-title">Recommended Swaps</div>
            <div className="flex flex-col gap-3">
              {suggestions.filter(s => s.suggested_replacement).map(s => (
                <div key={s.item_id} className="card card-sm animate-in">
                  <div className="flex items-center gap-4">
                    <div style={{ flex: 1 }}>
                      <div className="flex items-center gap-3">
                        <div style={{ textAlign: 'center' }}><div className="font-medium text-sm">{s.item_name}</div><div className="badge badge-danger mt-1">{s.waste_rate}% waste</div></div>
                        <ArrowRight size={20} className="text-muted" />
                        <div style={{ textAlign: 'center' }}><div className="font-medium text-sm text-accent">{s.suggested_replacement}</div><div className="badge badge-success mt-1">{s.replacement_waste_rate}% waste</div></div>
                      </div>
                    </div>
                    <div className="text-xs text-muted">on {s.worst_day}s</div>
                  </div>
                </div>
              ))}
              {suggestions.filter(s => s.suggested_replacement).length === 0 && (
                <div className="card card-sm text-center text-muted text-sm" style={{ padding: 'var(--space-8)' }}>All items are performing well — no swaps needed right now.</div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

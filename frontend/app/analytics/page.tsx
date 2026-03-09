'use client';

import DashboardLayout from '../components/DashboardLayout';
import { useState, useEffect } from 'react';
import { fetchAnalyticsByItem, fetchAnalyticsByDay, fetchAnalyticsTrend, fetchHeatmap, fetchCanteens } from '../lib/api';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  const [canteens, setCanteens] = useState<any[]>([]);
  const [canteenId, setCanteenId] = useState('');
  const [byItem, setByItem] = useState<any[]>([]);
  const [byDay, setByDay] = useState<any[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [heatmap, setHeatmap] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    fetchCanteens().then(setCanteens).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const cid = canteenId || undefined;
    Promise.all([
      fetchAnalyticsByItem(cid),
      fetchAnalyticsByDay(cid),
      fetchAnalyticsTrend(cid, 90),
      fetchHeatmap(cid),
    ]).then(([items, days, trd, hm]) => {
      setByItem(items.slice(0, 10));
      setByDay(days);
      setTrend(trd);
      setHeatmap(hm);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, [canteenId]);

  if (!mounted) return <DashboardLayout><div className="page-body" /></DashboardLayout>;

  const meals = ['breakfast', 'lunch', 'dinner'];
  const dows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hmColor = (v: number) => v > 40 ? 'var(--danger)' : v > 25 ? 'var(--warning)' : 'var(--accent)';

  return (
    <DashboardLayout>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>Waste Analytics</h2>
            <p>Deep dive into your food waste patterns</p>
          </div>
          <select className="form-select" style={{ width: 180 }} value={canteenId} onChange={e => setCanteenId(e.target.value)}>
            <option value="">All Canteens</option>
            {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}><span className="text-muted">Loading analytics...</span></div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }} className="mb-6">
              <div className="card animate-in">
                <div className="section-title">Waste % by Item (Worst Offenders)</div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byItem} layout="vertical" margin={{ left: 80, right: 16, top: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={75} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', fontSize: '13px' }} formatter={(v: number) => [`${v}%`, 'Waste Rate']} />
                      <Bar dataKey="waste_rate" fill="var(--danger)" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card animate-in">
                <div className="section-title">Waste % by Day of Week</div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byDay} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', fontSize: '13px' }} formatter={(v: number) => [`${v}%`, 'Waste Rate']} />
                      <Bar dataKey="waste_rate" fill="var(--warning)" radius={[4, 4, 0, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="card animate-in mb-6">
              <div className="section-title">Waste Trend Over Time</div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                    <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', fontSize: '13px' }} formatter={(v: number) => [`${v}%`, 'Waste Rate']} />
                    <Line type="monotone" dataKey="waste_rate" stroke="var(--accent)" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card animate-in">
              <div className="section-title">Waste Heatmap (Day × Meal)</div>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      {meals.map(m => <th key={m} style={{ textTransform: 'capitalize' }}>{m}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {dows.map(d => (
                      <tr key={d}>
                        <td className="font-medium">{d}</td>
                        {meals.map(m => {
                          const cell = heatmap.find(h => h.day === d && h.meal === m);
                          const val = cell?.waste_rate ?? 0;
                          return (
                            <td key={m}>
                              <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 'var(--radius-sm)', background: hmColor(val), color: '#fff', fontSize: '12px', fontWeight: 600, minWidth: 48, textAlign: 'center' }}>
                                {val}%
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

'use client';

import DashboardLayout from '../components/DashboardLayout';
import { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { fetchBenchmarks } from '../lib/api';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

const COLORS = ['#5B8C5A', '#3B6FA0', '#C4851A'];

export default function BenchmarkPage() {
  const [mounted, setMounted] = useState(false);
  const [benchmarks, setBenchmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    fetchBenchmarks().then(setBenchmarks).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (!mounted) return <DashboardLayout><div className="page-body" /></DashboardLayout>;

  const avgRate = benchmarks.length > 0 ? benchmarks.reduce((s, b) => s + b.avg_waste_rate, 0) / benchmarks.length : 0;
  const chartData = benchmarks.map(b => ({ name: b.canteen_name, wasteRate: b.avg_waste_rate, campusAvg: Math.round(avgRate * 10) / 10 }));

  const trendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingDown size={16} style={{ color: 'var(--success)' }} />;
    if (trend === 'worsening') return <TrendingUp size={16} style={{ color: 'var(--danger)' }} />;
    return <Minus size={16} style={{ color: 'var(--text-muted)' }} />;
  };

  return (
    <DashboardLayout>
      <div className="page-header"><h2>Multi-Canteen Benchmarking</h2><p>Anonymized comparison across campus canteens</p></div>
      <div className="page-body">
        {loading ? (
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}><span className="text-muted">Loading...</span></div>
        ) : (
          <>
            <div className="stats-grid mb-6">
              <div className="card animate-in" style={{ borderLeft: '3px solid var(--accent)' }}><div className="card-title">Campus Average</div><div className="card-value">{avgRate.toFixed(1)}%</div><div className="card-subtitle mt-1">Waste rate across all canteens</div></div>
              {benchmarks.map((b, i) => (
                <div key={b.canteen_id} className="card animate-in" style={{ borderLeft: `3px solid ${COLORS[i % COLORS.length]}` }}>
                  <div className="card-title">{b.canteen_name}</div><div className="card-value">{b.avg_waste_rate}%</div>
                  <div className="card-subtitle mt-1 flex items-center gap-2">
                    {trendIcon(b.trend)}<span className="text-xs">{b.trend}</span>
                    {b.avg_waste_rate > avgRate && <span className="badge badge-danger" style={{ marginLeft: 4 }}>+{(b.avg_waste_rate - avgRate).toFixed(1)}% above avg</span>}
                    {b.avg_waste_rate < avgRate && <span className="badge badge-success" style={{ marginLeft: 4 }}>{(avgRate - b.avg_waste_rate).toFixed(1)}% below avg</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="card animate-in mb-6">
              <div className="section-title">Waste Rate Comparison</div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                    <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', fontSize: '13px' }} formatter={(v: number, name: string) => [`${v}%`, name === 'wasteRate' ? 'Waste Rate' : 'Campus Average']} />
                    <Bar dataKey="wasteRate" radius={[4, 4, 0, 0]} barSize={40}>{chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar>
                    <Bar dataKey="campusAvg" fill="var(--text-muted)" radius={[4, 4, 0, 0]} barSize={40} opacity={0.25} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Rank</th><th>Canteen</th><th>Waste Rate</th><th>Total Waste</th><th>Trend</th><th>vs. Average</th></tr></thead>
                <tbody>
                  {[...benchmarks].sort((a, b) => a.avg_waste_rate - b.avg_waste_rate).map((b, i) => (
                    <tr key={b.canteen_id}>
                      <td className="font-bold" style={{ color: i === 0 ? 'var(--success)' : 'var(--text-secondary)' }}>#{i + 1}</td>
                      <td className="font-medium" style={{ color: 'var(--text)' }}>{b.canteen_name}</td>
                      <td><span className={`badge ${b.avg_waste_rate > 35 ? 'badge-danger' : b.avg_waste_rate > 25 ? 'badge-warning' : 'badge-success'}`}>{b.avg_waste_rate}%</span></td>
                      <td>{b.total_waste.toLocaleString()}</td>
                      <td className="flex items-center gap-1">{trendIcon(b.trend)} {b.trend}</td>
                      <td>
                        {b.avg_waste_rate > avgRate ? <span className="text-xs" style={{ color: 'var(--danger)' }}>+{(b.avg_waste_rate - avgRate).toFixed(1)}%</span> : <span className="text-xs" style={{ color: 'var(--success)' }}>-{(avgRate - b.avg_waste_rate).toFixed(1)}%</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

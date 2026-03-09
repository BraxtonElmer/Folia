'use client';

import DashboardLayout from './components/DashboardLayout';
import { useState, useEffect } from 'react';
import { TrendingDown, TrendingUp, BarChart3, BrainCircuit, AlertTriangle, FileText } from 'lucide-react';
import Link from 'next/link';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { fetchAnalyticsByItem, fetchAnalyticsTrend, fetchROI } from './lib/api';

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [topWasters, setTopWasters] = useState<any[]>([]);
  const [roi, setROI] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    Promise.all([
      fetchAnalyticsTrend(undefined, 14).catch(() => []),
      fetchAnalyticsByItem().catch(() => []),
      fetchROI().catch(() => null),
    ]).then(([trend, items, roiData]) => {
      setTrendData(trend.map((d: any) => ({
        date: d.date?.slice(5),
        wasteRate: d.waste_rate,
      })));
      setTopWasters(items.slice(0, 5));
      setROI(roiData);
      setLoading(false);
    });
  }, []);

  if (!mounted) return <DashboardLayout><div className="page-body" /></DashboardLayout>;

  const todayTrend = trendData.length > 0 ? trendData[trendData.length - 1] : null;
  const wasteRate = todayTrend?.wasteRate ?? null;

  return (
    <DashboardLayout>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Real-time overview of food waste across campus</p>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <div className="text-muted">Loading from Supabase...</div>
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="stats-grid mb-6">
              <div className="card animate-in">
                <div className="card-title">Today&apos;s Waste Rate</div>
                <div className="card-value">{wasteRate !== null ? `${wasteRate}%` : '—%'}</div>
                <div className="card-subtitle mt-2">
                  {wasteRate !== null && wasteRate < 30 ? (
                    <span className="text-accent flex items-center gap-1"><TrendingDown size={14} /> Below target</span>
                  ) : (
                    <span className="text-danger flex items-center gap-1"><TrendingUp size={14} /> Above target</span>
                  )}
                </div>
              </div>

              <div className="card animate-in">
                <div className="card-title">Cost Wasted</div>
                <div className="card-value">₹{roi?.total_cost_wasted?.toLocaleString() ?? '—'}</div>
                <div className="card-subtitle mt-2 text-accent">
                  ₹{roi?.total_cost_saved?.toLocaleString() ?? '—'} saveable
                </div>
              </div>

              <div className="card animate-in">
                <div className="card-title">CO₂ Preventable</div>
                <div className="card-value">{roi?.co2_prevented?.toLocaleString() ?? '—'} <span className="text-sm font-regular text-muted">kg</span></div>
                <div className="card-subtitle mt-2">{roi?.water_saved?.toLocaleString() ?? '—'} L water saved</div>
              </div>

              <div className="card animate-in">
                <div className="card-title">Meals Equivalent</div>
                <div className="card-value">{roi?.meals_equivalent?.toLocaleString() ?? '—'}</div>
                <div className="card-subtitle mt-2">Total wasted portions</div>
              </div>
            </div>

            {/* Trend Chart + Leaderboard */}
            <div className="flex gap-6 mb-6" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr' }}>
              <div className="card animate-in">
                <div className="section-title">Waste Rate Trend (14 days)</div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                      <defs>
                        <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                      <Tooltip
                        contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', fontSize: '13px' }}
                        formatter={(v: number) => [`${v}%`, 'Waste Rate']}
                      />
                      <Area type="monotone" dataKey="wasteRate" stroke="var(--accent)" fill="url(#wg)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card animate-in">
                <div className="section-title">Top Wasted Items</div>
                <div className="flex flex-col gap-3 mt-2">
                  {topWasters.map((item: any, i: number) => (
                    <div key={item.name} className="flex items-center justify-between" style={{ padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-light)' }}>
                      <div className="flex items-center gap-3">
                        <span className="text-muted text-xs font-bold">#{i + 1}</span>
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <span className={`badge ${item.waste_rate > 35 ? 'badge-danger' : 'badge-warning'}`}>
                        {item.waste_rate}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="section-title">Quick Actions</div>
            <div className="stats-grid">
              {[
                { label: 'Log Waste', href: '/log', icon: BarChart3, desc: 'Record today\'s data' },
                { label: 'ML Forecast', href: '/forecast', icon: BrainCircuit, desc: 'View tomorrow\'s predictions' },
                { label: 'Expiry Check', href: '/expiry', icon: AlertTriangle, desc: 'Check ingredient status' },
                { label: 'Weekly Report', href: '/report', icon: FileText, desc: 'Generate PDF report' },
              ].map(a => (
                <Link key={a.href} href={a.href} className="card card-sm animate-in" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                  <div className="flex items-center gap-3">
                    <a.icon size={20} style={{ color: 'var(--accent)' }} />
                    <div>
                      <div className="font-medium text-sm">{a.label}</div>
                      <div className="text-xs text-muted">{a.desc}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

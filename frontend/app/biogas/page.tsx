'use client';

import DashboardLayout from '../components/DashboardLayout';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Flame, Zap, Thermometer, Wind, RefreshCw, Info, Database, Pencil, Calendar, Loader2 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { fetchCanteens, fetchBiogasData } from '../lib/api';

// Biogas conversion constants (real-world anaerobic digestion data)
// Yield = biogas m³ per metric ton of wet waste at ~60% CH₄ methane content
// Sources: IEA Bioenergy Task 37, EBA Statistical Report, DLG guidelines
const FOOD_CATEGORIES = [
  {
    id: 'grains',
    label: 'Cooked Rice & Grains',
    icon: '\ud83c\udf3e',
    yieldM3PerTon: 430,
    color: '#C4851A',
  },
  {
    id: 'vegetables',
    label: 'Vegetables & Greens',
    icon: '\ud83e\udd66',
    yieldM3PerTon: 350,
    color: '#5B8C5A',
  },
  {
    id: 'fruits',
    label: 'Fruits & Pulp',
    icon: '\ud83c\udf4e',
    yieldM3PerTon: 380,
    color: '#3B6FA0',
  },
  {
    id: 'dairy',
    label: 'Dairy & Cheese',
    icon: '\ud83e\uddc0',
    yieldM3PerTon: 520,
    color: '#C4501A',
  },
  {
    id: 'meat',
    label: 'Meat & Fish',
    icon: '\ud83e\udd69',
    yieldM3PerTon: 600,
    color: '#8B3A3A',
  },
  {
    id: 'bread',
    label: 'Bread & Bakery',
    icon: '\ud83c\udf5e',
    yieldM3PerTon: 470,
    color: '#8B6914',
  },
  {
    id: 'mixed',
    label: 'Mixed / Other',
    icon: '\ud83c\udf71',
    yieldM3PerTon: 400,
    color: '#6B6B9B',
  },
] as const;

type CategoryId = (typeof FOOD_CATEGORIES)[number]['id'];

// Derived energy constants per 1 m³ biogas (60% CH₄)
const KWH_PER_M3 = 1.7;   // micro-CHP at ~35% electrical efficiency
const MJ_PER_M3 = 3.5;    // heat recovery at ~50% thermal efficiency
const CO2_PER_M3 = 1.9;   // kg CO₂ avoided vs landfill baseline

const MAX_KG = 2000;

// Date helpers
function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}
function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: '7 days', days: 6 },
  { label: '30 days', days: 29 },
  { label: '90 days', days: 89 },
] as const;
type PresetLabel = (typeof PRESETS)[number]['label'] | 'custom';

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function BiogasCalculatorPage() {
  // Manual inputs
  const [inputs, setInputs] = useState<Record<CategoryId, number>>(
    Object.fromEntries(FOOD_CATEGORIES.map((c) => [c.id, 0])) as Record<CategoryId, number>
  );

  // Mode
  const [mode, setMode] = useState<'manual' | 'live'>('manual');

  // Live data state
  const [canteens, setCanteens] = useState<{ id: string; name: string }[]>([]);
  const [canteenId, setCanteenId] = useState('all');
  const [preset, setPreset] = useState<PresetLabel>('30 days');
  const [startDate, setStartDate] = useState(daysAgo(29));
  const [endDate, setEndDate] = useState(toDateStr(new Date()));
  const [loading, setLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<{ date: string; total_kg: number; biogas_m3: number; kwh: number; co2_kg: number }[]>([]);
  const [liveLoaded, setLiveLoaded] = useState(false);

  // Load canteens on first switch to live mode
  useEffect(() => {
    if (mode === 'live' && canteens.length === 0) {
      fetchCanteens().then(setCanteens).catch(() => {});
    }
  }, [mode, canteens.length]);

  // Effective date range derived from preset
  const computedRange = useMemo(() => {
    if (preset === 'custom') return { start: startDate, end: endDate };
    const p = PRESETS.find((p) => p.label === preset)!;
    return { start: daysAgo(p.days), end: toDateStr(new Date()) };
  }, [preset, startDate, endDate]);

  const loadLiveData = useCallback(async () => {
    setLoading(true);
    setLiveError(null);
    try {
      const data = await fetchBiogasData({
        canteen_id: canteenId !== 'all' ? canteenId : undefined,
        start_date: computedRange.start,
        end_date: computedRange.end,
      });
      // Populate category inputs from live waste data
      setInputs(
        Object.fromEntries(
          FOOD_CATEGORIES.map((c) => [
            c.id,
            Math.round(data.summary.by_category[c.id as keyof typeof data.summary.by_category] ?? 0),
          ])
        ) as Record<CategoryId, number>
      );
      setTimeline(data.timeline);
      setLiveLoaded(true);
    } catch (e: any) {
      setLiveError(e?.message ?? 'Failed to load live data');
    } finally {
      setLoading(false);
    }
  }, [canteenId, computedRange]);

  // Manual input helpers
  const set = (id: CategoryId, value: number) =>
    setInputs((prev) => ({ ...prev, [id]: Math.min(MAX_KG, Math.max(0, value)) }));

  const reset = () => {
    setInputs(Object.fromEntries(FOOD_CATEGORIES.map((c) => [c.id, 0])) as Record<CategoryId, number>);
    setTimeline([]);
    setLiveLoaded(false);
  };

  // Computed values
  const breakdown = useMemo(() =>
    FOOD_CATEGORIES.map((cat) => {
      const kg = inputs[cat.id];
      const biogas = (kg / 1000) * cat.yieldM3PerTon;
      return {
        ...cat,
        kg,
        biogas,
        kwh: biogas * KWH_PER_M3,
        mj: biogas * MJ_PER_M3,
        co2: biogas * CO2_PER_M3,
      };
    }),
  [inputs]);

  const totalKg     = breakdown.reduce((s, r) => s + r.kg, 0);
  const totalBiogas = breakdown.reduce((s, r) => s + r.biogas, 0);
  const totalKwh    = breakdown.reduce((s, r) => s + r.kwh, 0);
  const totalMj     = breakdown.reduce((s, r) => s + r.mj, 0);
  const totalCo2    = breakdown.reduce((s, r) => s + r.co2, 0);

  const chartData = breakdown.filter((r) => r.biogas > 0).map((r) => ({
    name: r.label.split(' ')[0],
    biogas: parseFloat(r.biogas.toFixed(3)),
    color: r.color,
  }));

  const timelineChartData = timeline.map((t) => ({
    ...t,
    dateLabel: fmtDate(t.date),
  }));

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="page-header">
        <h2>Biogas Calculator</h2>
        <p>
          Estimate biogas production, energy recovery, and CO₂ offset from food waste — manually
          or pulled live from waste logs filtered by canteen and date range.
        </p>
      </div>

      <div className="page-body">
        {/* Mode + Controls toolbar */}
        <div className="card animate-in mb-6" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              className={`btn btn-sm ${mode === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode('manual')}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Pencil size={13} /> Manual Entry
            </button>
            <button
              className={`btn btn-sm ${mode === 'live' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode('live')}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Database size={13} /> Live Data
            </button>
          </div>

          {/* Live data controls */}
          {mode === 'live' && (
            <>
              {/* Canteen selector */}
              <select
                className="form-input"
                value={canteenId}
                onChange={(e) => setCanteenId(e.target.value)}
                style={{ width: 'auto', minWidth: 150 }}
              >
                <option value="all">All Canteens</option>
                {canteens.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {/* Date preset pills */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    className={`btn btn-sm ${preset === p.label ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setPreset(p.label)}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  className={`btn btn-sm ${preset === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPreset('custom')}
                  style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <Calendar size={12} /> Custom
                </button>
              </div>

              {/* Custom date range */}
              {preset === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <input
                    type="date"
                    className="form-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ width: 145 }}
                  />
                  <span className="text-xs text-muted">to</span>
                  <input
                    type="date"
                    className="form-input"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ width: 145 }}
                  />
                </div>
              )}

              {/* Load button */}
              <button
                className="btn btn-primary btn-sm"
                onClick={loadLiveData}
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}
              >
                {loading
                  ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Database size={13} />}
                {loading ? 'Loading…' : 'Load Data'}
              </button>
            </>
          )}

          {/* Reset button (manual mode) */}
          {mode === 'manual' && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={reset}
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}
            >
              <RefreshCw size={13} /> Reset
            </button>
          )}
        </div>

        {/* Error alert */}
        {liveError && (
          <div className="alert alert-error animate-in mb-6">{liveError}</div>
        )}

        {/* Summary Output Cards */}
        <div className="stats-grid mb-6">
          <div className="card animate-in" style={{ borderLeft: '3px solid var(--text-muted)' }}>
            <div className="card-title">Total Waste Input</div>
            <div className="card-value">{fmt(totalKg, 1)} <span className="text-sm font-regular text-muted">kg</span></div>
            <div className="card-subtitle">
              {mode === 'live' && liveLoaded
                ? `${computedRange.start} → ${computedRange.end}`
                : `${FOOD_CATEGORIES.filter(c => inputs[c.id] > 0).length} categories entered`}
            </div>
          </div>

          <div className="card animate-in" style={{ borderLeft: '3px solid var(--accent)' }}>
            <div className="card-title">
              <Flame size={12} style={{ display: 'inline', marginRight: 4 }} />
              Biogas Volume
            </div>
            <div className="card-value" style={{ color: 'var(--accent)' }}>
              {fmt(totalBiogas)} <span className="text-sm font-regular text-muted">m³</span>
            </div>
            <div className="card-subtitle">~60% CH₄ methane content</div>
          </div>

          <div className="card animate-in" style={{ borderLeft: '3px solid var(--info)' }}>
            <div className="card-title">
              <Zap size={12} style={{ display: 'inline', marginRight: 4 }} />
              Electricity Potential
            </div>
            <div className="card-value" style={{ color: 'var(--info)' }}>
              {fmt(totalKwh)} <span className="text-sm font-regular text-muted">kWh</span>
            </div>
            <div className="card-subtitle">micro-CHP at 35% efficiency</div>
          </div>

          <div className="card animate-in" style={{ borderLeft: '3px solid var(--warning)' }}>
            <div className="card-title">
              <Thermometer size={12} style={{ display: 'inline', marginRight: 4 }} />
              Thermal Energy
            </div>
            <div className="card-value" style={{ color: 'var(--warning)' }}>
              {fmt(totalMj)} <span className="text-sm font-regular text-muted">MJ</span>
            </div>
            <div className="card-subtitle">heat recovery at 50% efficiency</div>
          </div>

          <div className="card animate-in" style={{ borderLeft: '3px solid var(--success)' }}>
            <div className="card-title">
              <Wind size={12} style={{ display: 'inline', marginRight: 4 }} />
              CO₂ Offset
            </div>
            <div className="card-value" style={{ color: 'var(--success)' }}>
              {fmt(totalCo2)} <span className="text-sm font-regular text-muted">kg</span>
            </div>
            <div className="card-subtitle">vs. landfill methane emission baseline</div>
          </div>
        </div>

        {/* Daily Timeline Chart (live mode only, after loading) */}
        {mode === 'live' && liveLoaded && timelineChartData.length > 0 && (
          <div className="card animate-in mb-6">
            <div className="section-title">
              Daily Biogas Potential — {computedRange.start} to {computedRange.end}
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineChartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="biogas"
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}m³`}
                    width={58}
                  />
                  <YAxis
                    yAxisId="kwh"
                    orientation="right"
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}kWh`}
                    width={62}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius)',
                      fontSize: 13,
                    }}
                    formatter={(v: any, name: string) => [
                      name === 'biogas_m3' ? `${Number(v).toFixed(4)} m³` : `${Number(v).toFixed(3)} kWh`,
                      name === 'biogas_m3' ? 'Biogas' : 'Electricity',
                    ]}
                    labelFormatter={(l) => `${l}`}
                  />
                  <Legend
                    formatter={(v) => v === 'biogas_m3' ? `Biogas (m³)` : 'Electricity (kWh)'}
                    wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }}
                  />
                  <Line
                    yAxisId="biogas"
                    type="monotone"
                    dataKey="biogas_m3"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={timelineChartData.length <= 35}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    yAxisId="kwh"
                    type="monotone"
                    dataKey="kwh"
                    stroke="var(--info)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Input Sliders + Category Bar Chart */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>

          {/* Input sliders */}
          <div className="card animate-in">
            <div className="section-title">
              {mode === 'live' ? 'Waste by Category (from live data — editable)' : 'Food Waste Input'}
            </div>

            {mode === 'live' && !liveLoaded && (
              <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                <Database size={36} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 'var(--space-3)' }} />
                <p>Select a canteen and date range, then click "Load Data".</p>
              </div>
            )}

            {(mode === 'manual' || liveLoaded) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                {FOOD_CATEGORIES.map((cat) => (
                  <div key={cat.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
                        <span style={{ fontSize: 16 }}>{cat.icon}</span> {cat.label}
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <input
                          type="number"
                          min={0}
                          max={MAX_KG}
                          value={inputs[cat.id] === 0 ? '' : inputs[cat.id]}
                          placeholder="0"
                          step={10}
                          onChange={(e) => set(cat.id, parseFloat(e.target.value) || 0)}
                          className="form-input"
                          style={{ width: 90, textAlign: 'right' }}
                        />
                        <span className="text-xs text-muted" style={{ width: 20 }}>kg</span>
                      </div>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="range"
                        min={0}
                        max={MAX_KG}
                        step={10}
                        value={inputs[cat.id]}
                        onChange={(e) => set(cat.id, parseInt(e.target.value))}
                        style={{
                          width: '100%',
                          accentColor: cat.color,
                          height: 4,
                          cursor: 'pointer',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                      <span className="text-xs text-muted">0 kg</span>
                      <span className="text-xs" style={{ color: cat.color, fontWeight: 500 }}>
                        {inputs[cat.id] > 0
                          ? `≈ ${fmt((inputs[cat.id] / 1000) * cat.yieldM3PerTon, 2)} m³ biogas`
                          : `yield: ${cat.yieldM3PerTon} m³/ton`}
                      </span>
                      <span className="text-xs text-muted">{MAX_KG} kg</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bar chart */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div className="card animate-in">
              <div className="section-title">Biogas by Category (m³)</div>
              {chartData.length > 0 ? (
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}m³`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                        axisLine={false}
                        tickLine={false}
                        width={70}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border-light)',
                          borderRadius: 'var(--radius)',
                          fontSize: 13,
                        }}
                        formatter={(v: any) => [`${Number(v).toFixed(3)} m³`, 'Biogas']}
                      />
                      <Bar dataKey="biogas" radius={[0, 4, 4, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                  <Flame size={36} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: 'var(--space-3)' }} />
                  <p>Enter waste quantities above to see the breakdown chart.</p>
                </div>
              )}
            </div>

            {/* Per-category breakdown table */}
            {totalBiogas > 0 && (
              <div className="card animate-in">
                <div className="section-title">Detailed Breakdown</div>
                <div className="table-wrapper" style={{ border: 'none' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th style={{ textAlign: 'right' }}>Input (kg)</th>
                        <th style={{ textAlign: 'right' }}>Biogas (m³)</th>
                        <th style={{ textAlign: 'right' }}>kWh</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdown.filter((r) => r.kg > 0).map((r) => (
                        <tr key={r.id}>
                          <td>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  width: 8, height: 8, borderRadius: '50%',
                                  background: r.color, flexShrink: 0,
                                }}
                              />
                              {r.label}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.kg}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--accent)', fontWeight: 500 }}>{r.biogas.toFixed(3)}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.kwh.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Methodology Info */}
        <div className="alert alert-info animate-in" style={{ gap: 'var(--space-4)' }}>
          <Info size={18} style={{ color: 'var(--info)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="font-medium text-sm" style={{ marginBottom: 'var(--space-1)' }}>Conversion Methodology</div>
            <div className="text-xs text-secondary" style={{ lineHeight: 1.7 }}>
              Biogas yields (m³/ton wet weight) are derived from peer-reviewed anaerobic digestion data:
              IEA Bioenergy Task 37 (grains, bakery), EBA/WRAP guidelines (vegetables, fruits), and DLG (dairy, meat).
              In live mode, item names are classified by Gemini AI into biogas categories and converted
              to kg using per-portion weight estimates.
              Energy conversion assumes a micro-CHP unit at <strong>35% electrical</strong> and <strong>50% thermal</strong> efficiency.
              CO₂ offset is calculated at <strong>1.9 kg CO₂ per m³ biogas</strong> relative to equivalent landfill methane emissions (GWP₂₀ basis).
              All figures are approximate estimates; actual yields vary by moisture content, temperature, and digester design.
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

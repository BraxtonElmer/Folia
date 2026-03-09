'use client';

import DashboardLayout from '../components/DashboardLayout';
import { useState, useEffect } from 'react';
import { BrainCircuit, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { fetchForecast, fetchCanteens } from '../lib/api';

const weatherOptions = [
  { value: 'sunny', label: '☀️ sunny' },
  { value: 'rainy', label: '🌧️ rainy' },
  { value: 'cold', label: '❄️ cold' },
];
const eventOptions = [
  { value: 'normal', label: '📅 normal' },
  { value: 'exam', label: '📝 exam' },
  { value: 'fest', label: '🎉 fest' },
  { value: 'holiday', label: '🏖️ holiday' },
];

export default function ForecastPage() {
  const [mounted, setMounted] = useState(false);
  const [canteens, setCanteens] = useState<any[]>([]);
  const [canteenId, setCanteenId] = useState('');
  const [weather, setWeather] = useState('sunny');
  const [event, setEvent] = useState('normal');
  const [forecast, setForecast] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    fetchCanteens().then(c => {
      setCanteens(c);
      if (c.length > 0) setCanteenId(c[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!canteenId) return;
    setLoading(true);
    fetchForecast({ canteen_id: canteenId, weather, event })
      .then(setForecast)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [canteenId, weather, event]);

  if (!mounted) return <DashboardLayout><div className="page-body" /></DashboardLayout>;

  const targetDate = forecast?.target_date
    ? new Date(forecast.target_date).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })
    : 'Tomorrow';

  return (
    <DashboardLayout>
      <div className="page-header">
        <h2>Demand Forecast</h2>
        <p>Prophet ML-predicted optimal preparation quantities for tomorrow</p>
      </div>

      <div className="page-body">
        {/* Context Controls */}
        <div className="card mb-6 animate-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-semibold">Forecasting for: {targetDate}</div>
              <div className="text-xs text-muted mt-1">
                {forecast?.model_trained ? 'Prophet model trained on historical data' : 'Model training...'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BrainCircuit size={18} style={{ color: 'var(--accent)' }} />
              <span className="badge badge-success">Facebook Prophet + Context</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
            <div>
              <div className="text-xs font-medium mb-2 text-muted">Canteen</div>
              <select className="form-select" value={canteenId} onChange={e => setCanteenId(e.target.value)}>
                {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs font-medium mb-2 text-muted">Weather</div>
              <div className="tag-list">
                {weatherOptions.map(w => (
                  <button key={w.value} className={`tag ${weather === w.value ? 'selected' : ''}`} onClick={() => setWeather(w.value)}>
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium mb-2 text-muted">Event</div>
              <div className="tag-list">
                {eventOptions.map(e => (
                  <button key={e.value} className={`tag ${event === e.value ? 'selected' : ''}`} onClick={() => setEvent(e.value)}>
                    {e.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Predictions */}
        <div className="flex items-center justify-between mb-4">
          <div className="section-title" style={{ margin: 0 }}>Recommended Prep Quantities</div>
          <span className="text-xs text-muted">Toggle weather/event tags to see predictions adjust in real-time</span>
        </div>

        {loading ? (
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <div className="text-muted">Running Prophet predictions...</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {forecast?.forecasts?.map((pred: any) => (
              <div key={pred.item_id} className="card card-sm animate-in" style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === pred.item_id ? null : pred.item_id)}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{pred.item_name}</div>
                    <div className="text-xs text-muted mt-1">Historical avg: {pred.historical_avg} portions</div>
                  </div>
                  <div className="flex items-center gap-4">
                    {pred.historical_avg > 0 && pred.predicted_qty < pred.historical_avg && (
                      <span className="flex items-center gap-1 text-xs text-accent">
                        <Zap size={12} /> Save {pred.historical_avg - pred.predicted_qty} portions
                      </span>
                    )}
                    <div style={{ textAlign: 'right' }}>
                      <div className="font-bold text-lg">{pred.predicted_qty}</div>
                      <div className="text-xs text-muted">{pred.lower_bound}–{pred.upper_bound} range</div>
                    </div>
                    <span className={`badge ${pred.confidence === 'high' ? 'badge-success' : pred.confidence === 'medium' ? 'badge-warning' : 'badge-danger'}`}>
                      {pred.confidence}
                    </span>
                    {expanded === pred.item_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {expanded === pred.item_id && (
                  <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-light)' }}>
                    <div className="text-xs text-secondary">{pred.explanation}</div>
                    <div className="flex gap-4 mt-2">
                      <span className="text-xs text-muted">Model: <strong>{pred.model_type}</strong></span>
                      <span className="text-xs text-muted">Context multiplier: <strong>{pred.context_multiplier}×</strong></span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

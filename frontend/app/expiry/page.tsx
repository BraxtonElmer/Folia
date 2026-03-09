'use client';

import DashboardLayout from '../components/DashboardLayout';
import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, ChefHat, Plus } from 'lucide-react';
import { fetchExpiryAlerts, fetchCanteens, addIngredient } from '../lib/api';

export default function ExpiryPage() {
  const [mounted, setMounted] = useState(false);
  const [canteens, setCanteens] = useState<any[]>([]);
  const [canteenId, setCanteenId] = useState('');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [shelfLife, setShelfLife] = useState('');

  useEffect(() => {
    setMounted(true);
    fetchCanteens().then(c => { setCanteens(c); if (c.length > 0) setCanteenId(c[0].id); }).catch(() => {});
  }, []);

  const loadAlerts = () => {
    if (!canteenId) return;
    setLoading(true);
    fetchExpiryAlerts(canteenId).then(setAlerts).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { if (canteenId) loadAlerts(); }, [canteenId]);

  if (!mounted) return <DashboardLayout><div className="page-body" /></DashboardLayout>;

  const critical = alerts.filter(a => a.risk_level === 'critical');
  const warning = alerts.filter(a => a.risk_level === 'warning');
  const safe = alerts.filter(a => a.risk_level === 'safe');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addIngredient({ canteen_id: canteenId, name, qty_kg: parseFloat(qty), purchase_date: purchaseDate, shelf_life_days: parseInt(shelfLife) });
    setShowForm(false); setName(''); setQty(''); setShelfLife('');
    loadAlerts();
  };

  const riskIcon = (level: string) => {
    if (level === 'critical') return <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />;
    if (level === 'warning') return <Clock size={18} style={{ color: 'var(--warning)' }} />;
    return <span style={{ color: 'var(--success)', fontSize: 18 }}>✓</span>;
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div><h2>Expiry Risk Alerts</h2><p>Track ingredient freshness and get proactive dish suggestions</p></div>
          <div className="flex items-center gap-3">
            <select className="form-select" style={{ width: 180 }} value={canteenId} onChange={e => setCanteenId(e.target.value)}>
              {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}><Plus size={16} /> Add Ingredient</button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {showForm && (
          <div className="card mb-6 animate-in">
            <div className="section-title">Add Ingredient to Inventory</div>
            <form onSubmit={handleSubmit}>
              <div className="form-row mb-4">
                <div className="form-group"><label className="form-label">Ingredient Name</label><input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} required /></div>
                <div className="form-group"><label className="form-label">Quantity (kg)</label><input type="number" className="form-input" value={qty} onChange={e => setQty(e.target.value)} required min="0" step="0.1" /></div>
                <div className="form-group"><label className="form-label">Purchase Date</label><input type="date" className="form-input" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} required /></div>
                <div className="form-group"><label className="form-label">Shelf Life (days)</label><input type="number" className="form-input" value={shelfLife} onChange={e => setShelfLife(e.target.value)} required min="1" /></div>
              </div>
              <div className="flex gap-3"><button type="submit" className="btn btn-primary">Save</button><button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button></div>
            </form>
          </div>
        )}

        <div className="stats-grid mb-6">
          <div className="card animate-in" style={{ borderLeft: '3px solid var(--danger)' }}><div className="card-title">Critical</div><div className="card-value" style={{ color: 'var(--danger)' }}>{critical.length}</div><div className="card-subtitle mt-1">Expiring within 1 day</div></div>
          <div className="card animate-in" style={{ borderLeft: '3px solid var(--warning)' }}><div className="card-title">Warning</div><div className="card-value" style={{ color: 'var(--warning)' }}>{warning.length}</div><div className="card-subtitle mt-1">Expiring within 3 days</div></div>
          <div className="card animate-in" style={{ borderLeft: '3px solid var(--success)' }}><div className="card-title">Safe</div><div className="card-value" style={{ color: 'var(--success)' }}>{safe.length}</div><div className="card-subtitle mt-1">More than 3 days left</div></div>
        </div>

        {loading ? (
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}><span className="text-muted">Loading...</span></div>
        ) : (
          <div className="flex flex-col gap-3">
            {alerts.map((alert: any) => (
              <div key={alert.ingredient.id} className={`alert ${alert.risk_level === 'critical' ? 'alert-danger' : alert.risk_level === 'warning' ? 'alert-warning' : 'alert-success'} animate-in`}>
                {riskIcon(alert.risk_level)}
                <div style={{ flex: 1 }}>
                  <div className="flex items-center justify-between">
                    <div><span className="font-medium">{alert.ingredient.name}</span><span className="text-xs text-muted" style={{ marginLeft: 8 }}>{alert.ingredient.qty_kg} kg</span></div>
                    <span className={`badge ${alert.risk_level === 'critical' ? 'badge-danger' : alert.risk_level === 'warning' ? 'badge-warning' : 'badge-success'}`}>
                      {alert.days_remaining <= 0 ? 'Expired' : `${alert.days_remaining} day${alert.days_remaining !== 1 ? 's' : ''} left`}
                    </span>
                  </div>
                  {alert.risk_level !== 'safe' && alert.suggested_dishes.length > 0 && (
                    <div className="flex items-center gap-2 mt-2"><ChefHat size={14} className="text-muted" /><span className="text-xs">Suggest: <strong>{alert.suggested_dishes.join(', ')}</strong></span></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

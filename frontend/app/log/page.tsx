'use client';

import DashboardLayout from '../components/DashboardLayout';
import { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { fetchLogs, fetchCanteens, fetchItems, createLog } from '../lib/api';

export default function LogPage() {
  const [mounted, setMounted] = useState(false);
  const [canteens, setCanteens] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCanteen, setFilterCanteen] = useState('');
  const [filterMeal, setFilterMeal] = useState('');

  // Form state
  const [formCanteen, setFormCanteen] = useState('');
  const [formItem, setFormItem] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formMeal, setFormMeal] = useState('lunch');
  const [formPrepared, setFormPrepared] = useState('');
  const [formSold, setFormSold] = useState('');
  const [formWeather, setFormWeather] = useState('sunny');
  const [formEvent, setFormEvent] = useState('normal');

  useEffect(() => {
    setMounted(true);
    Promise.all([
      fetchCanteens(),
      fetchItems(),
    ]).then(([c, i]) => {
      setCanteens(c);
      setItems(i);
      if (c.length > 0) setFormCanteen(c[0].id);
      if (i.length > 0) setFormItem(i[0].id);
    });
    loadLogs();
  }, []);

  const loadLogs = () => {
    setLoading(true);
    const params: any = { limit: 200 };
    if (filterCanteen) params.canteen_id = filterCanteen;
    if (filterMeal) params.meal_type = filterMeal;
    fetchLogs(params)
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (mounted) loadLogs();
  }, [filterCanteen, filterMeal]);

  if (!mounted) return <DashboardLayout><div className="page-body" /></DashboardLayout>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prepared = parseInt(formPrepared);
    const sold = parseInt(formSold);
    await createLog({
      canteen_id: formCanteen,
      item_id: formItem,
      log_date: formDate,
      meal_type: formMeal,
      prepared_qty: prepared,
      sold_qty: sold,
      leftover_qty: prepared - sold,
      weather: formWeather,
      event: formEvent,
    });
    setShowForm(false);
    setFormPrepared(''); setFormSold('');
    loadLogs();
  };

  const filteredLogs = search
    ? logs.filter(l => {
        const name = l.food_items?.name || '';
        return name.toLowerCase().includes(search.toLowerCase());
      })
    : logs;

  return (
    <DashboardLayout>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>Waste Logging</h2>
            <p>Record daily preparation vs. leftover data</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={16} /> New Entry
          </button>
        </div>
      </div>

      <div className="page-body">
        {showForm && (
          <div className="card mb-6 animate-in">
            <div className="section-title">Log New Entry</div>
            <form onSubmit={handleSubmit}>
              <div className="form-row mb-4">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={formDate} onChange={e => setFormDate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Canteen</label>
                  <select className="form-select" value={formCanteen} onChange={e => setFormCanteen(e.target.value)}>
                    {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Item</label>
                  <select className="form-select" value={formItem} onChange={e => setFormItem(e.target.value)}>
                    {items.filter(i => !formCanteen || i.canteen_id === formCanteen).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Meal</label>
                  <select className="form-select" value={formMeal} onChange={e => setFormMeal(e.target.value)}>
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                  </select>
                </div>
              </div>
              <div className="form-row mb-4">
                <div className="form-group">
                  <label className="form-label">Prepared (qty)</label>
                  <input type="number" className="form-input" value={formPrepared} onChange={e => setFormPrepared(e.target.value)} required min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Sold (qty)</label>
                  <input type="number" className="form-input" value={formSold} onChange={e => setFormSold(e.target.value)} required min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Weather</label>
                  <div className="tag-list">
                    {['sunny', 'rainy', 'cold', 'hot'].map(w => (
                      <button type="button" key={w} className={`tag ${formWeather === w ? 'selected' : ''}`} onClick={() => setFormWeather(w)}>{w}</button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Event</label>
                  <div className="tag-list">
                    {['normal', 'exam', 'fest', 'holiday'].map(e => (
                      <button type="button" key={e} className={`tag ${formEvent === e ? 'selected' : ''}`} onClick={() => setFormEvent(e)}>{e}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn btn-primary">Save Entry</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 mb-4">
          <div className="form-group" style={{ flex: 1, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
            <input className="form-input" placeholder="Search food items..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
          </div>
          <select className="form-select" style={{ width: 160 }} value={filterCanteen} onChange={e => setFilterCanteen(e.target.value)}>
            <option value="">All Canteens</option>
            {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="form-select" style={{ width: 140 }} value={filterMeal} onChange={e => setFilterMeal(e.target.value)}>
            <option value="">All Meals</option>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}><span className="text-muted">Loading...</span></div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Canteen</th>
                  <th>Item</th>
                  <th>Meal</th>
                  <th>Prepared</th>
                  <th>Sold</th>
                  <th>Leftover</th>
                  <th>Waste %</th>
                  <th>Context</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log: any) => {
                  const wasteRate = Math.round((log.leftover_qty / Math.max(log.prepared_qty, 1)) * 100);
                  return (
                    <tr key={log.id}>
                      <td>{new Date(log.log_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</td>
                      <td>{log.canteens?.name || '—'}</td>
                      <td className="font-medium" style={{ color: 'var(--text)' }}>{log.food_items?.name || '—'}</td>
                      <td><span className="badge">{log.meal_type}</span></td>
                      <td>{log.prepared_qty}</td>
                      <td>{log.sold_qty}</td>
                      <td>{log.leftover_qty}</td>
                      <td><span className={`badge ${wasteRate > 40 ? 'badge-danger' : wasteRate > 25 ? 'badge-warning' : 'badge-success'}`}>{wasteRate}%</span></td>
                      <td><span className="text-xs text-muted">{log.weather} · {log.event}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

'use client';

import DashboardLayout from '../components/DashboardLayout';
import { useState, useEffect } from 'react';
import { Droplets, CloudRain, Heart } from 'lucide-react';
import { fetchROI, fetchCanteens } from '../lib/api';

export default function ROIPage() {
  const [mounted, setMounted] = useState(false);
  const [canteens, setCanteens] = useState<any[]>([]);
  const [canteenId, setCanteenId] = useState('');
  const [period, setPeriod] = useState<'30' | '60' | '90'>('90');
  const [roi, setROI] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setMounted(true); fetchCanteens().then(setCanteens).catch(() => {}); }, []);

  useEffect(() => {
    if (!mounted) return;
    setLoading(true);
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - parseInt(period));
    fetchROI({
      canteen_id: canteenId || undefined,
      start_date: start.toISOString().split('T')[0],
      end_date: today.toISOString().split('T')[0],
    }).then(setROI).catch(() => {}).finally(() => setLoading(false));
  }, [canteenId, period, mounted]);

  if (!mounted) return <DashboardLayout><div className="page-body" /></DashboardLayout>;

  const yearlyProjection = roi ? {
    cost: Math.round(roi.total_cost_saved * (365 / parseInt(period))),
    co2: Math.round(roi.co2_prevented * (365 / parseInt(period))),
    water: Math.round(roi.water_saved * (365 / parseInt(period))),
    meals: Math.round(roi.meals_equivalent * (365 / parseInt(period))),
  } : { cost: 0, co2: 0, water: 0, meals: 0 };

  return (
    <DashboardLayout>
      <div className="page-header">
        <h2>ROI & Impact</h2>
        <p>Financial savings and sustainability metrics from waste reduction</p>
      </div>

      <div className="page-body">
        <div className="flex items-center gap-4 mb-6">
          <select className="form-select" style={{ width: 180 }} value={canteenId} onChange={e => setCanteenId(e.target.value)}>
            <option value="">All Canteens</option>
            {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="tag-list">
            {(['30', '60', '90'] as const).map(p => (
              <button key={p} className={`tag ${period === p ? 'selected' : ''}`} onClick={() => setPeriod(p)}>{p} days</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}><span className="text-muted">Loading ROI data...</span></div>
        ) : roi && (
          <>
            <div className="stats-grid mb-6">
              <div className="card animate-in" style={{ borderLeft: '3px solid var(--danger)' }}>
                <div className="card-title">Total Cost Wasted</div>
                <div className="card-value" style={{ color: 'var(--danger)' }}>₹{roi.total_cost_wasted.toLocaleString()}</div>
                <div className="card-subtitle mt-2">in the last {period} days</div>
              </div>
              <div className="card animate-in" style={{ borderLeft: '3px solid var(--accent)' }}>
                <div className="card-title">Potential Savings</div>
                <div className="card-value text-accent">₹{roi.total_cost_saved.toLocaleString()}</div>
                <div className="card-subtitle mt-2">with ML-optimized prep</div>
              </div>
              <div className="card animate-in" style={{ borderLeft: '3px solid var(--info)' }}>
                <div className="card-title">Yearly Projection</div>
                <div className="card-value" style={{ color: 'var(--info)' }}>₹{yearlyProjection.cost.toLocaleString()}</div>
                <div className="card-subtitle mt-2">annual savings at current rate</div>
              </div>
              <div className="card animate-in" style={{ borderLeft: '3px solid var(--warning)' }}>
                <div className="card-title">Waste Percentage</div>
                <div className="card-value" style={{ color: 'var(--warning)' }}>{roi.waste_percentage}%</div>
                <div className="card-subtitle mt-2">of prepared food goes waste</div>
              </div>
            </div>

            <div className="section-title">Sustainability Impact</div>
            <div className="stats-grid mb-6">
              <div className="card animate-in">
                <div className="flex items-center gap-3 mb-4">
                  <CloudRain size={20} style={{ color: '#5B8C5A' }} />
                  <span className="text-sm font-medium">CO₂ Prevented</span>
                </div>
                <div className="card-value" style={{ fontSize: 'var(--text-3xl)' }}>{roi.co2_prevented.toLocaleString()} <span className="text-sm text-muted font-regular">kg</span></div>
                <div className="text-xs text-muted mt-2">≈ {Math.round(roi.co2_prevented / 21)} trees planted for a year</div>
                <div className="gauge mt-4"><div className="gauge-fill green" style={{ width: `${Math.min(roi.co2_prevented / 50, 100)}%` }} /></div>
              </div>
              <div className="card animate-in">
                <div className="flex items-center gap-3 mb-4">
                  <Droplets size={20} style={{ color: '#3B6FA0' }} />
                  <span className="text-sm font-medium">Water Saved</span>
                </div>
                <div className="card-value" style={{ fontSize: 'var(--text-3xl)' }}>{roi.water_saved.toLocaleString()} <span className="text-sm text-muted font-regular">liters</span></div>
                <div className="text-xs text-muted mt-2">≈ {Math.round(roi.water_saved / 150)} days of drinking water</div>
                <div className="gauge mt-4"><div className="gauge-fill green" style={{ width: `${Math.min(roi.water_saved / 5000, 100)}%`, background: 'var(--info)' }} /></div>
              </div>
              <div className="card animate-in">
                <div className="flex items-center gap-3 mb-4">
                  <Heart size={20} style={{ color: '#C4851A' }} />
                  <span className="text-sm font-medium">Meals That Could Feed Someone</span>
                </div>
                <div className="card-value" style={{ fontSize: 'var(--text-3xl)' }}>{roi.meals_equivalent.toLocaleString()}</div>
                <div className="text-xs text-muted mt-2">Total wasted portions in {period} days</div>
                <div className="gauge mt-4"><div className="gauge-fill yellow" style={{ width: `${Math.min(roi.meals_equivalent / 100, 100)}%` }} /></div>
              </div>
            </div>

            <div className="card animate-in">
              <div className="section-title">Yearly Projection at Current Rate</div>
              <div className="stats-grid">
                {[
                  { label: 'Annual Savings', value: `₹${yearlyProjection.cost.toLocaleString()}`, icon: '💰' },
                  { label: 'CO₂ Prevented/Year', value: `${yearlyProjection.co2.toLocaleString()} kg`, icon: '🌍' },
                  { label: 'Water Saved/Year', value: `${yearlyProjection.water.toLocaleString()} L`, icon: '💧' },
                  { label: 'Meals Recoverable/Year', value: yearlyProjection.meals.toLocaleString(), icon: '🍽️' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3" style={{ padding: 'var(--space-3)' }}>
                    <span style={{ fontSize: '24px' }}>{item.icon}</span>
                    <div>
                      <div className="text-xs text-muted">{item.label}</div>
                      <div className="font-bold text-lg">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

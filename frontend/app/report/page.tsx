'use client';

import DashboardLayout from '../components/DashboardLayout';
import { useState, useEffect, useRef } from 'react';
import { Download } from 'lucide-react';
import { fetchWeeklyReport, fetchCanteens } from '../lib/api';

export default function ReportPage() {
  const [mounted, setMounted] = useState(false);
  const [canteens, setCanteens] = useState<any[]>([]);
  const [canteenId, setCanteenId] = useState('');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); fetchCanteens().then(c => { setCanteens(c); if (c.length > 0) setCanteenId(c[0].id); }).catch(() => {}); }, []);

  useEffect(() => {
    if (!canteenId) return;
    setLoading(true);
    fetchWeeklyReport(canteenId).then(setReport).catch(() => {}).finally(() => setLoading(false));
  }, [canteenId]);

  if (!mounted) return <DashboardLayout><div className="page-body" /></DashboardLayout>;

  const canteenName = canteens.find(c => c.id === canteenId)?.name ?? '';

  const handleDownload = async () => {
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#FFFFFF', useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 190;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
    pdf.save(`ZeroWaste_Weekly_Report_${report?.week_end || 'latest'}.pdf`);
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div><h2>Weekly Report</h2><p>Auto-generated summary for the latest week</p></div>
          <div className="flex items-center gap-3">
            <select className="form-select" style={{ width: 180 }} value={canteenId} onChange={e => setCanteenId(e.target.value)}>
              {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="btn btn-primary" onClick={handleDownload} disabled={!report}><Download size={16} /> Download PDF</button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}><span className="text-muted">Loading...</span></div>
        ) : report && (
          <div ref={reportRef} className="card" style={{ padding: 'var(--space-8)', maxWidth: 800, margin: '0 auto' }}>
            <div style={{ borderBottom: '2px solid var(--accent)', paddingBottom: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
              <div className="flex items-center justify-between">
                <div><h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-semibold)' }}>ZeroWaste Weekly Report</h3><div className="text-sm text-secondary mt-1">{canteenName}</div></div>
                <div style={{ textAlign: 'right' }}><div className="text-xs text-muted">Week of</div><div className="text-sm font-medium">{report.week_start} → {report.week_end}</div></div>
              </div>
            </div>

            <div className="stats-grid mb-6">
              <div style={{ padding: 'var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}><div className="text-xs text-muted">Total Prepared</div><div className="font-bold text-lg">{report.total_prepared.toLocaleString()}</div></div>
              <div style={{ padding: 'var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}><div className="text-xs text-muted">Total Wasted</div><div className="font-bold text-lg" style={{ color: 'var(--danger)' }}>{report.total_wasted.toLocaleString()}</div></div>
              <div style={{ padding: 'var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}><div className="text-xs text-muted">Waste Rate</div><div className="font-bold text-lg" style={{ color: report.waste_rate > 30 ? 'var(--danger)' : 'var(--accent)' }}>{report.waste_rate}%</div></div>
              <div style={{ padding: 'var(--space-4)', background: 'var(--accent-light)', borderRadius: 'var(--radius)' }}><div className="text-xs" style={{ color: 'var(--accent-dark)' }}>Potential Savings</div><div className="font-bold text-lg" style={{ color: 'var(--accent-dark)' }}>₹{report.cost_saved.toLocaleString()}</div></div>
            </div>

            <div className="mb-6">
              <h4 className="font-semibold text-sm mb-3">⚠️ Items Needing Attention</h4>
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>Item</th><th>Waste Rate</th><th>Status</th></tr></thead>
                  <tbody>
                    {report.worst_items?.map((item: any) => (
                      <tr key={item.name}>
                        <td className="font-medium" style={{ color: 'var(--text)' }}>{item.name}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="gauge" style={{ width: 50 }}><div className={`gauge-fill ${item.waste_rate > 40 ? 'red' : item.waste_rate > 25 ? 'yellow' : 'green'}`} style={{ width: `${Math.min(item.waste_rate, 100)}%` }} /></div>
                            <span className="text-sm">{item.waste_rate}%</span>
                          </div>
                        </td>
                        <td><span className={`badge ${item.waste_rate > 40 ? 'badge-danger' : item.waste_rate > 25 ? 'badge-warning' : 'badge-success'}`}>{item.waste_rate > 40 ? 'Critical' : item.waste_rate > 25 ? 'Review' : 'Good'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="font-semibold text-sm mb-3">✅ Best Performers</h4>
              <div className="flex gap-3">
                {report.best_items?.map((item: any) => (
                  <div key={item.name} style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--success-light)', borderRadius: 'var(--radius)', flex: 1 }}>
                    <div className="text-xs font-medium">{item.name}</div>
                    <div className="text-sm font-bold" style={{ color: 'var(--success)' }}>{item.waste_rate}% waste</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-8)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-light)', textAlign: 'center' }}>
              <span className="text-xs text-muted">Generated by ZeroWaste · Campus Food Intelligence Platform</span>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

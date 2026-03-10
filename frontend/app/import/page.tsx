'use client';

import DashboardLayout from '../components/DashboardLayout';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  UploadCloud, CheckCircle2, XCircle, AlertTriangle,
  Sparkles, FileSpreadsheet, RefreshCw, ArrowRight,
} from 'lucide-react';
import { fetchCanteens } from '../lib/api';
import { importCsvPreview, importCsvCommit, trainModel } from '../lib/api';

type Step = 'setup' | 'preview' | 'done';

const dropZoneBase: React.CSSProperties = {
  border: '2px dashed var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-12) var(--space-8)',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'all 200ms ease',
  background: 'var(--bg-secondary)',
};

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'setup', label: 'Upload' },
    { key: 'preview', label: 'Preview' },
    { key: 'done', label: 'Done' },
  ];
  const idx = steps.findIndex(s => s.key === current);
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
            background: i <= idx ? 'var(--accent)' : 'var(--border)',
            color: i <= idx ? '#fff' : 'var(--text-muted)',
            transition: 'all 200ms',
          }}>{i + 1}</div>
          <span style={{
            fontSize: 'var(--text-sm)',
            fontWeight: i === idx ? 'var(--weight-semibold)' : 'var(--weight-regular)',
            color: i === idx ? 'var(--text)' : 'var(--text-muted)',
          }}>{s.label}</span>
          {i < steps.length - 1 && (
            <div style={{ width: 40, height: 1, background: 'var(--border)', margin: '0 var(--space-1)' }} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function ImportPage() {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>('setup');
  const [canteens, setCanteens] = useState<any[]>([]);
  const [canteenId, setCanteenId] = useState('');

  // Setup state
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [setupError, setSetupError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview state
  const [previewData, setPreviewData] = useState<any>(null);
  const [committing, setCommitting] = useState(false);

  // Done state
  const [result, setResult] = useState<{ inserted: number; errors: string[] } | null>(null);
  const [retraining, setRetraining] = useState(false);
  const [retrainMsg, setRetrainMsg] = useState('');

  useEffect(() => {
    setMounted(true);
    fetchCanteens().then(c => {
      setCanteens(c);
      if (c.length > 0) setCanteenId(c[0].id);
    }).catch(() => {});
  }, []);

  if (!mounted) return <DashboardLayout><div className="page-body" /></DashboardLayout>;

  // ── File handling ─────────────────────────────────────────────────────────

  const handleFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setSetupError('Please upload a .csv file');
      return;
    }
    setFile(f);
    setSetupError('');
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  // ── Analyze ───────────────────────────────────────────────────────────────

  const analyze = async () => {
    if (!file || !canteenId) return;
    setAnalyzing(true);
    setSetupError('');
    try {
      const data = await importCsvPreview(file, canteenId);
      setPreviewData(data);
      setStep('preview');
    } catch (err: any) {
      setSetupError(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Commit ────────────────────────────────────────────────────────────────

  const commit = async () => {
    if (!previewData) return;
    setCommitting(true);
    try {
      const matchedRows = previewData.rows
        .filter((r: any) => r.matched)
        .map((r: any) => ({
          canteen_id: r.canteen_id,
          item_id: r.item_id,
          log_date: r.log_date,
          meal_type: r.meal_type,
          prepared_qty: r.prepared_qty,
          sold_qty: r.sold_qty,
          leftover_qty: r.leftover_qty,
          weather: r.weather,
          event: r.event,
        }));
      const res = await importCsvCommit(matchedRows);
      setResult(res);
      setStep('done');
    } catch (err: any) {
      setSetupError(err.message || 'Import failed');
    } finally {
      setCommitting(false);
    }
  };

  // ── Retrain model ─────────────────────────────────────────────────────────

  const retrain = async () => {
    setRetraining(true);
    setRetrainMsg('');
    try {
      const res = await trainModel();
      setRetrainMsg(`Model retrained — ${res.items_trained} items trained on ${res.total_records} records`);
    } catch (err: any) {
      setRetrainMsg(`Retrain failed: ${err.message}`);
    } finally {
      setRetraining(false);
    }
  };

  const reset = () => {
    setStep('setup');
    setFile(null);
    setPreviewData(null);
    setResult(null);
    setSetupError('');
    setRetrainMsg('');
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const matchedCount = previewData?.rows.filter((r: any) => r.matched).length ?? 0;
  const unmatchedCount = previewData?.unmatched_items?.length ?? 0;
  const errorCount = previewData?.errors?.length ?? 0;
  const canteenName = (id: string) => canteens.find(c => c.id === id)?.name || id;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <h2>AI CSV Import</h2>
          <p>Upload any billing software export — Gemini AI will map columns to Folia's format automatically</p>
        </div>
      </div>

      <div className="page-body">
        <StepIndicator current={step} />

        {/* ══ STEP 1: SETUP ═════════════════════════════════════════════════ */}
        {step === 'setup' && (
          <div style={{ maxWidth: 640 }}>
            {/* Canteen selector */}
            <div className="card mb-5">
              <div className="section-title mb-3">Select Canteen</div>
              <select
                className="form-select"
                value={canteenId}
                onChange={e => setCanteenId(e.target.value)}
              >
                {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p className="form-hint mt-2">Items will be matched against this canteen's food catalogue</p>
            </div>

            {/* Drop zone */}
            <div
              style={{
                ...dropZoneBase,
                borderColor: dragging ? 'var(--accent)' : file ? 'var(--accent)' : 'var(--border)',
                background: dragging ? 'var(--accent-light)' : file ? 'var(--accent-light)' : 'var(--bg-secondary)',
              }}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
              />

              {file ? (
                <div>
                  <FileSpreadsheet size={40} style={{ color: 'var(--accent)', margin: '0 auto var(--space-3)' }} />
                  <div className="font-medium" style={{ color: 'var(--text)' }}>{file.name}</div>
                  <div className="text-muted text-xs mt-1">{(file.size / 1024).toFixed(1)} KB — click to replace</div>
                </div>
              ) : (
                <div>
                  <UploadCloud size={40} style={{ color: 'var(--text-muted)', margin: '0 auto var(--space-3)' }} />
                  <div className="font-medium" style={{ color: 'var(--text)' }}>Drop your CSV here</div>
                  <div className="text-muted text-xs mt-2">or click to browse — exported from any billing / POS software</div>
                </div>
              )}
            </div>

            {/* Format hint */}
            <div className="card card-sm mt-4" style={{ background: 'var(--info-light)', border: '1px solid var(--info)', borderRadius: 'var(--radius)' }}>
              <div className="text-xs" style={{ color: 'var(--info)' }}>
                <strong>Supported columns (any name/order):</strong> Item name, Date, Meal type, Prepared qty, Sold qty, Leftover qty.<br />
                Gemini AI detects exact column names automatically — missing columns use smart defaults.
              </div>
            </div>

            {setupError && (
              <div className="mt-4 text-xs" style={{ color: 'var(--danger)', background: 'var(--danger-light)', padding: 'var(--space-3)', borderRadius: 'var(--radius)' }}>
                {setupError}
              </div>
            )}

            <button
              className="btn btn-primary mt-5"
              style={{ width: '100%', padding: 'var(--space-3)' }}
              disabled={!file || !canteenId || analyzing}
              onClick={analyze}
            >
              {analyzing ? (
                <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing with Gemini AI…</>
              ) : (
                <><Sparkles size={16} /> Analyze with AI</>
              )}
            </button>
          </div>
        )}

        {/* ══ STEP 2: PREVIEW ═══════════════════════════════════════════════ */}
        {step === 'preview' && previewData && (
          <>
            {/* Summary cards */}
            <div className="stats-grid mb-6">
              <div className="card animate-in" style={{ borderLeft: '3px solid var(--success)' }}>
                <div className="card-title">Matched Rows</div>
                <div className="card-value" style={{ color: 'var(--success)' }}>{matchedCount}</div>
                <div className="card-subtitle">Ready to import</div>
              </div>
              <div className="card animate-in" style={{ borderLeft: '3px solid var(--warning)' }}>
                <div className="card-title">Unmatched Items</div>
                <div className="card-value" style={{ color: unmatchedCount > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>{unmatchedCount}</div>
                <div className="card-subtitle">Rows will be skipped</div>
              </div>
              <div className="card animate-in" style={{ borderLeft: '3px solid var(--danger)' }}>
                <div className="card-title">Parse Errors</div>
                <div className="card-value" style={{ color: errorCount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{errorCount}</div>
                <div className="card-subtitle">Skipped rows</div>
              </div>
              <div className="card animate-in" style={{ borderLeft: '3px solid var(--info)' }}>
                <div className="card-title">Total Input</div>
                <div className="card-value" style={{ color: 'var(--info)' }}>{previewData.total_input}</div>
                <div className="card-subtitle">Rows in CSV</div>
              </div>
            </div>

            {/* Column mapping from Gemini */}
            <div className="card mb-5 animate-in">
              <div className="section-title mb-3">AI Column Mapping</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                {Object.entries(previewData.mapping as Record<string, string>).map(([field, col]) => (
                  <div key={field} style={{
                    background: col ? 'var(--accent-light)' : 'var(--bg-secondary)',
                    border: `1px solid ${col ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--text-xs)',
                  }}>
                    <span style={{ color: 'var(--text-muted)' }}>{field}</span>
                    <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>→</span>
                    <span style={{ fontWeight: 'var(--weight-semibold)', color: col ? 'var(--accent-dark)' : 'var(--text-muted)' }}>
                      {col || '(default)'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-3 text-xs text-muted">
                <span>Canteen: <strong>{canteenName(canteenId)}</strong></span>
                {previewData.defaults?.meal_type && <span>Default meal: <strong>{previewData.defaults.meal_type}</strong></span>}
                {previewData.defaults?.weather && <span>Default weather: <strong>{previewData.defaults.weather}</strong></span>}
              </div>
            </div>

            {/* Unmatched items warning */}
            {unmatchedCount > 0 && (
              <div className="card mb-5 animate-in" style={{ background: 'var(--warning-light)', border: '1px solid var(--warning)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
                  <span className="font-medium text-sm" style={{ color: 'var(--warning)' }}>
                    {unmatchedCount} item name{unmatchedCount !== 1 ? 's' : ''} not found in {canteenName(canteenId)}'s catalogue
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {previewData.unmatched_items.map((name: string) => (
                    <span key={name} className="badge badge-warning">{name}</span>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--warning)' }}>
                  Add these items in Settings → Food Items first, then re-import to capture these rows.
                </p>
              </div>
            )}

            {/* Parse errors */}
            {errorCount > 0 && (
              <div className="card mb-5 animate-in" style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <XCircle size={16} style={{ color: 'var(--danger)' }} />
                  <span className="font-medium text-sm" style={{ color: 'var(--danger)' }}>Parse errors (rows skipped)</span>
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {previewData.errors.slice(0, 10).map((err: string, i: number) => (
                    <li key={i} className="text-xs" style={{ color: 'var(--danger)' }}>{err}</li>
                  ))}
                  {previewData.errors.length > 10 && (
                    <li className="text-xs" style={{ color: 'var(--danger)' }}>…and {previewData.errors.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}

            {/* Preview table */}
            <div className="section-title mb-3">Row Preview (first 50)</div>
            <div className="table-wrapper mb-6 animate-in">
              <table className="table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Item</th>
                    <th>Date</th>
                    <th>Meal</th>
                    <th>Prepared</th>
                    <th>Sold</th>
                    <th>Leftover</th>
                    <th>Weather</th>
                    <th>Event</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.rows.slice(0, 50).map((row: any, i: number) => (
                    <tr key={i} style={{ opacity: row.matched ? 1 : 0.55 }}>
                      <td>
                        {row.matched
                          ? <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                          : <AlertTriangle size={14} style={{ color: 'var(--warning)' }} />}
                      </td>
                      <td className="font-medium" style={{ color: row.matched ? 'var(--text)' : 'var(--warning)' }}>
                        {row.item_name_raw}
                      </td>
                      <td>{row.log_date}</td>
                      <td><span className="badge badge-neutral">{row.meal_type}</span></td>
                      <td>{row.prepared_qty}</td>
                      <td>{row.sold_qty}</td>
                      <td>{row.leftover_qty}</td>
                      <td>{row.weather}</td>
                      <td>{row.event}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {setupError && (
              <div className="mb-4 text-xs" style={{ color: 'var(--danger)', background: 'var(--danger-light)', padding: 'var(--space-3)', borderRadius: 'var(--radius)' }}>
                {setupError}
              </div>
            )}

            <div className="flex gap-3">
              <button className="btn btn-secondary" onClick={reset}>← Start Over</button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={matchedCount === 0 || committing}
                onClick={commit}
              >
                {committing
                  ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Importing…</>
                  : <><ArrowRight size={16} /> Import {matchedCount} matched row{matchedCount !== 1 ? 's' : ''}</>}
              </button>
            </div>
          </>
        )}

        {/* ══ STEP 3: DONE ══════════════════════════════════════════════════ */}
        {step === 'done' && result && (
          <div style={{ maxWidth: 560 }}>
            <div className="card mb-5 animate-in" style={{ borderLeft: '4px solid var(--success)' }}>
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 size={28} style={{ color: 'var(--success)' }} />
                <div>
                  <div className="font-medium" style={{ fontSize: 'var(--text-lg)', color: 'var(--text)' }}>
                    Import complete
                  </div>
                  <div className="text-muted text-sm mt-1">
                    {result.inserted} waste log record{result.inserted !== 1 ? 's' : ''} added to {canteenName(canteenId)}
                  </div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div style={{ background: 'var(--warning-light)', borderRadius: 'var(--radius)', padding: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                  <div className="text-xs font-medium" style={{ color: 'var(--warning)' }}>
                    {result.errors.length} batch error{result.errors.length !== 1 ? 's' : ''} (partial import may have occurred):
                  </div>
                  {result.errors.map((e, i) => <div key={i} className="text-xs mt-1" style={{ color: 'var(--warning)' }}>{e}</div>)}
                </div>
              )}
            </div>

            <div className="card mb-5 animate-in" style={{ background: 'var(--accent-light)', border: '1px solid var(--accent)' }}>
              <div className="font-medium text-sm mb-2" style={{ color: 'var(--accent-dark)' }}>Retrain Prophet Model</div>
              <p className="text-xs text-muted mb-3">
                New data has been added. Retrain the forecasting model to incorporate the imported records.
              </p>
              {retrainMsg && (
                <div className="text-xs mb-3" style={{ color: 'var(--accent-dark)' }}>{retrainMsg}</div>
              )}
              <button className="btn btn-primary btn-sm" onClick={retrain} disabled={retraining}>
                {retraining
                  ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Retraining…</>
                  : <><Sparkles size={13} /> Retrain Forecast Model</>}
              </button>
            </div>

            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={reset}>
              Import Another File
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .section-title {
          font-size: var(--text-xs);
          font-weight: var(--weight-medium);
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
      `}</style>
    </DashboardLayout>
  );
}

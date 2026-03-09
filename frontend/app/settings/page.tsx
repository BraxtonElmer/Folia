'use client';

import DashboardLayout from '../components/DashboardLayout';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import {
  fetchCanteens,
  createCanteen, updateCanteen, deleteCanteen,
  fetchItems,
  createItem, updateItem, deleteItem,
  fetchExpiryAlerts, addIngredient,
  updateIngredient, deleteIngredient,
} from '../lib/api';

type Tab = 'canteens' | 'items' | 'ingredients';

const CATEGORIES = [
  'Breakfast', 'Main Course', 'Street Food',
  'South Indian', 'Continental', 'Dessert', 'Beverages', 'Snacks',
];

const TODAY = new Date().toISOString().split('T')[0];

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
};

const modalStyle: React.CSSProperties = {
  background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-6)', width: '100%', maxWidth: 480,
  boxShadow: 'var(--shadow-lg)', position: 'relative',
};

function ErrorBox({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div style={{
      background: 'var(--danger-light)', color: 'var(--danger)',
      borderRadius: 'var(--radius)', padding: 'var(--space-3)',
      fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)',
    }}>{msg}</div>
  );
}

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>('canteens');

  // Canteens
  const [canteens, setCanteens] = useState<any[]>([]);
  const [canteenLoading, setCanteenLoading] = useState(false);
  const [canteenModal, setCanteenModal] = useState<null | 'add' | { id: string; name: string; location: string }>(null);
  const [canteenForm, setCanteenForm] = useState({ name: '', location: '' });

  // Food Items
  const [items, setItems] = useState<any[]>([]);
  const [itemFilterCanteen, setItemFilterCanteen] = useState('all');
  const [itemLoading, setItemLoading] = useState(false);
  const [itemModal, setItemModal] = useState<null | 'add' | any>(null);
  const [itemForm, setItemForm] = useState({ canteen_id: '', name: '', category: 'Main Course', cost_per_portion: '' });

  // Ingredients
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [ingCanteen, setIngCanteen] = useState('');
  const [ingLoading, setIngLoading] = useState(false);
  const [ingModal, setIngModal] = useState<null | 'add' | any>(null);
  const [ingForm, setIngForm] = useState({ name: '', qty_kg: '', purchase_date: TODAY, shelf_life_days: '' });

  // Shared state
  const [deleteConfirm, setDeleteConfirm] = useState<null | { type: string; id: string; name: string }>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ─── Loaders ────────────────────────────────────────────────────────────────

  const loadCanteens = useCallback(async () => {
    setCanteenLoading(true);
    try {
      const c = await fetchCanteens();
      setCanteens(c);
      if (c.length > 0) {
        setIngCanteen(prev => prev || c[0].id);
        setItemForm(f => ({ ...f, canteen_id: f.canteen_id || c[0].id }));
      }
    } catch { /* silent */ } finally { setCanteenLoading(false); }
  }, []);

  const loadItems = useCallback(async () => {
    setItemLoading(true);
    try {
      setItems(await fetchItems(itemFilterCanteen === 'all' ? undefined : itemFilterCanteen));
    } catch { /* silent */ } finally { setItemLoading(false); }
  }, [itemFilterCanteen]);

  const loadIngredients = useCallback(async () => {
    if (!ingCanteen) return;
    setIngLoading(true);
    try {
      const alerts = await fetchExpiryAlerts(ingCanteen);
      setIngredients(alerts.map(a => a.ingredient));
    } catch { /* silent */ } finally { setIngLoading(false); }
  }, [ingCanteen]);

  useEffect(() => { setMounted(true); loadCanteens(); }, [loadCanteens]);
  useEffect(() => { if (tab === 'items') loadItems(); }, [tab, loadItems]);
  useEffect(() => { if (tab === 'ingredients' && ingCanteen) loadIngredients(); }, [tab, ingCanteen, loadIngredients]);

  if (!mounted) return <DashboardLayout><div className="page-body" /></DashboardLayout>;

  const canteenName = (id: string) => canteens.find(c => c.id === id)?.name || '—';

  // ─── Canteen handlers ────────────────────────────────────────────────────────

  const openCanteenAdd = () => { setCanteenForm({ name: '', location: '' }); setCanteenModal('add'); setError(''); };
  const openCanteenEdit = (c: any) => { setCanteenForm({ name: c.name, location: c.location }); setCanteenModal(c); setError(''); };

  const saveCanteen = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      if (canteenModal === 'add') await createCanteen(canteenForm);
      else await updateCanteen((canteenModal as any).id, canteenForm);
      setCanteenModal(null); await loadCanteens();
    } catch (err: any) { setError(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  // ─── Food Item handlers ──────────────────────────────────────────────────────

  const openItemAdd = () => {
    setItemForm({ canteen_id: canteens[0]?.id || '', name: '', category: 'Main Course', cost_per_portion: '' });
    setItemModal('add'); setError('');
  };
  const openItemEdit = (item: any) => {
    setItemForm({ canteen_id: item.canteen_id, name: item.name, category: item.category, cost_per_portion: String(item.cost_per_portion) });
    setItemModal(item); setError('');
  };

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const payload = { ...itemForm, cost_per_portion: parseFloat(itemForm.cost_per_portion) };
      if (itemModal === 'add') await createItem(payload);
      else await updateItem(itemModal.id, payload);
      setItemModal(null); await loadItems();
    } catch (err: any) { setError(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  // ─── Ingredient handlers ─────────────────────────────────────────────────────

  const openIngAdd = () => {
    setIngForm({ name: '', qty_kg: '', purchase_date: TODAY, shelf_life_days: '' });
    setIngModal('add'); setError('');
  };
  const openIngEdit = (ing: any) => {
    setIngForm({ name: ing.name, qty_kg: String(ing.qty_kg), purchase_date: ing.purchase_date, shelf_life_days: String(ing.shelf_life_days) });
    setIngModal(ing); setError('');
  };

  const saveIng = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const payload = { ...ingForm, qty_kg: parseFloat(ingForm.qty_kg), shelf_life_days: parseInt(ingForm.shelf_life_days) };
      if (ingModal === 'add') await addIngredient({ canteen_id: ingCanteen, ...payload });
      else await updateIngredient(ingModal.id, payload);
      setIngModal(null); await loadIngredients();
    } catch (err: any) { setError(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  // ─── Delete handler ──────────────────────────────────────────────────────────

  const confirmDelete = (type: string, id: string, name: string) => { setDeleteConfirm({ type, id, name }); setError(''); };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setSaving(true); setError('');
    try {
      if (deleteConfirm.type === 'canteen') { await deleteCanteen(deleteConfirm.id); setDeleteConfirm(null); await loadCanteens(); }
      else if (deleteConfirm.type === 'item') { await deleteItem(deleteConfirm.id); setDeleteConfirm(null); await loadItems(); }
      else if (deleteConfirm.type === 'ingredient') { await deleteIngredient(deleteConfirm.id); setDeleteConfirm(null); await loadIngredients(); }
    } catch (err: any) { setError(err.message || 'Failed to delete'); }
    finally { setSaving(false); }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <p>Manage canteens, food catalogue, and ingredient inventory</p>
        </div>
      </div>

      <div className="page-body">

        {/* Tabs */}
        <div className="tabs">
          {(['canteens', 'items', 'ingredients'] as Tab[]).map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'canteens' ? 'Canteens' : t === 'items' ? 'Food Items' : 'Ingredients'}
            </button>
          ))}
        </div>

        {/* ── CANTEENS ────────────────────────────────────────────────────────── */}
        {tab === 'canteens' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted">{canteens.length} canteen{canteens.length !== 1 ? 's' : ''} registered</span>
              <button className="btn btn-primary" onClick={openCanteenAdd}><Plus size={16} /> Add Canteen</button>
            </div>

            {canteenLoading ? (
              <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}><span className="text-muted">Loading…</span></div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr><th>Name</th><th>Location</th><th style={{ width: 96 }}>Actions</th></tr>
                  </thead>
                  <tbody>
                    {canteens.map(c => (
                      <tr key={c.id}>
                        <td className="font-medium" style={{ color: 'var(--text)' }}>{c.name}</td>
                        <td>{c.location}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <button className="btn btn-sm btn-secondary" onClick={() => openCanteenEdit(c)}><Pencil size={13} /></button>
                            <button className="btn btn-sm btn-danger" onClick={() => confirmDelete('canteen', c.id, c.name)}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {canteens.length === 0 && (
                      <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-10)' }}>No canteens yet — add one to get started.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── FOOD ITEMS ───────────────────────────────────────────────────────── */}
        {tab === 'items' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <select className="form-select" style={{ width: 200 }} value={itemFilterCanteen} onChange={e => setItemFilterCanteen(e.target.value)}>
                <option value="all">All Canteens</option>
                {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="btn btn-primary" onClick={openItemAdd}><Plus size={16} /> Add Food Item</button>
            </div>

            {itemLoading ? (
              <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}><span className="text-muted">Loading…</span></div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr><th>Name</th><th>Category</th><th>Canteen</th><th>Cost / Portion</th><th style={{ width: 96 }}>Actions</th></tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id}>
                        <td className="font-medium" style={{ color: 'var(--text)' }}>{item.name}</td>
                        <td><span className="badge badge-neutral">{item.category}</span></td>
                        <td>{canteenName(item.canteen_id)}</td>
                        <td>&#8377;{Number(item.cost_per_portion).toFixed(0)}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <button className="btn btn-sm btn-secondary" onClick={() => openItemEdit(item)}><Pencil size={13} /></button>
                            <button className="btn btn-sm btn-danger" onClick={() => confirmDelete('item', item.id, item.name)}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-10)' }}>No food items found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── INGREDIENTS ──────────────────────────────────────────────────────── */}
        {tab === 'ingredients' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <select className="form-select" style={{ width: 200 }} value={ingCanteen} onChange={e => setIngCanteen(e.target.value)}>
                {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="btn btn-primary" onClick={openIngAdd}><Plus size={16} /> Add Ingredient</button>
            </div>

            {ingLoading ? (
              <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}><span className="text-muted">Loading…</span></div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr><th>Name</th><th>Qty (kg)</th><th>Purchase Date</th><th>Shelf Life (days)</th><th style={{ width: 96 }}>Actions</th></tr>
                  </thead>
                  <tbody>
                    {ingredients.map(ing => (
                      <tr key={ing.id}>
                        <td className="font-medium" style={{ color: 'var(--text)' }}>{ing.name}</td>
                        <td>{ing.qty_kg} kg</td>
                        <td>{ing.purchase_date}</td>
                        <td>{ing.shelf_life_days} days</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <button className="btn btn-sm btn-secondary" onClick={() => openIngEdit(ing)}><Pencil size={13} /></button>
                            <button className="btn btn-sm btn-danger" onClick={() => confirmDelete('ingredient', ing.id, ing.name)}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {ingredients.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-10)' }}>No ingredients found for this canteen.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ CANTEEN MODAL ════════════════════════════════════════════════════ */}
      {canteenModal !== null && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setCanteenModal(null); }}>
          <div style={modalStyle}>
            <div className="flex items-center justify-between mb-6">
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)' }}>
                {canteenModal === 'add' ? 'Add Canteen' : 'Edit Canteen'}
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setCanteenModal(null)}><X size={14} /></button>
            </div>
            <ErrorBox msg={error} />
            <form onSubmit={saveCanteen}>
              <div className="flex flex-col gap-4">
                <div className="form-group">
                  <label className="form-label">Canteen Name</label>
                  <input className="form-input" type="text" placeholder="e.g. Main Cafeteria" value={canteenForm.name}
                    onChange={e => setCanteenForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input className="form-input" type="text" placeholder="e.g. Block A, Ground Floor" value={canteenForm.location}
                    onChange={e => setCanteenForm(f => ({ ...f, location: e.target.value }))} required />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Canteen'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => setCanteenModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ FOOD ITEM MODAL ══════════════════════════════════════════════════ */}
      {itemModal !== null && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setItemModal(null); }}>
          <div style={modalStyle}>
            <div className="flex items-center justify-between mb-6">
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)' }}>
                {itemModal === 'add' ? 'Add Food Item' : 'Edit Food Item'}
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setItemModal(null)}><X size={14} /></button>
            </div>
            <ErrorBox msg={error} />
            <form onSubmit={saveItem}>
              <div className="flex flex-col gap-4">
                <div className="form-group">
                  <label className="form-label">Canteen</label>
                  <select className="form-select" value={itemForm.canteen_id}
                    onChange={e => setItemForm(f => ({ ...f, canteen_id: e.target.value }))} required>
                    {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Item Name</label>
                  <input className="form-input" type="text" placeholder="e.g. Paneer Butter Masala" value={itemForm.name}
                    onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-select" value={itemForm.category}
                      onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))}>
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cost per Portion (&#8377;)</label>
                    <input className="form-input" type="number" placeholder="e.g. 45" min="0" step="0.5"
                      value={itemForm.cost_per_portion}
                      onChange={e => setItemForm(f => ({ ...f, cost_per_portion: e.target.value }))} required />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Item'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => setItemModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ INGREDIENT MODAL ════════════════════════════════════════════════ */}
      {ingModal !== null && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setIngModal(null); }}>
          <div style={modalStyle}>
            <div className="flex items-center justify-between mb-6">
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)' }}>
                {ingModal === 'add' ? 'Add Ingredient' : 'Edit Ingredient'}
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setIngModal(null)}><X size={14} /></button>
            </div>
            <ErrorBox msg={error} />
            <form onSubmit={saveIng}>
              <div className="flex flex-col gap-4">
                <div className="form-group">
                  <label className="form-label">Ingredient Name</label>
                  <input className="form-input" type="text" placeholder="e.g. Tomatoes" value={ingForm.name}
                    onChange={e => setIngForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Quantity (kg)</label>
                    <input className="form-input" type="number" placeholder="e.g. 10.5" min="0" step="0.1"
                      value={ingForm.qty_kg}
                      onChange={e => setIngForm(f => ({ ...f, qty_kg: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Shelf Life (days)</label>
                    <input className="form-input" type="number" placeholder="e.g. 7" min="1"
                      value={ingForm.shelf_life_days}
                      onChange={e => setIngForm(f => ({ ...f, shelf_life_days: e.target.value }))} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Purchase Date</label>
                  <input className="form-input" type="date" value={ingForm.purchase_date}
                    onChange={e => setIngForm(f => ({ ...f, purchase_date: e.target.value }))} required />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Ingredient'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => setIngModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ DELETE CONFIRM MODAL ════════════════════════════════════════════ */}
      {deleteConfirm && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}>
          <div style={{ ...modalStyle, maxWidth: 380 }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-3)' }}>
              Confirm Delete
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This cannot be undone.
            </p>
            <ErrorBox msg={error} />
            <div className="flex gap-3">
              <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>
                {saving ? 'Deleting…' : 'Delete'}
              </button>
              <button className="btn btn-secondary" onClick={() => { setDeleteConfirm(null); setError(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

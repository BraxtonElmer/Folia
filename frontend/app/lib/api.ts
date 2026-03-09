/**
 * ZeroWaste API client — connects frontend to FastAPI backend.
 * All data flows through here.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${error}`);
  }
  return res.json();
}

// ============ CANTEENS ============
export async function fetchCanteens() {
  return api<{ id: string; name: string; location: string }[]>('/api/canteens');
}

// ============ FOOD ITEMS ============
export async function fetchItems(canteenId?: string) {
  const params = canteenId ? `?canteen_id=${canteenId}` : '';
  return api<{ id: string; name: string; category: string; cost_per_portion: number; canteen_id: string }[]>(`/api/items${params}`);
}

// ============ WASTE LOGS ============
export async function fetchLogs(params?: {
  canteen_id?: string;
  item_id?: string;
  start_date?: string;
  end_date?: string;
  meal_type?: string;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) searchParams.set(k, String(v));
    });
  }
  const qs = searchParams.toString();
  return api<any[]>(`/api/logs${qs ? `?${qs}` : ''}`);
}

export async function createLog(log: {
  canteen_id: string;
  item_id: string;
  log_date: string;
  meal_type: string;
  prepared_qty: number;
  sold_qty: number;
  leftover_qty: number;
  weather: string;
  event: string;
}) {
  return api<any>('/api/logs', { method: 'POST', body: JSON.stringify(log) });
}

// ============ FORECAST ============
export async function fetchForecast(params: {
  canteen_id: string;
  target_date?: string;
  weather?: string;
  event?: string;
}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) searchParams.set(k, v);
  });
  return api<{
    target_date: string;
    canteen_id: string;
    weather: string;
    event: string;
    forecasts: {
      item_id: string;
      item_name: string;
      predicted_qty: number;
      lower_bound: number;
      upper_bound: number;
      confidence: string;
      explanation: string;
      historical_avg: number;
      context_multiplier: number;
      model_type: string;
    }[];
    model_trained: boolean;
  }>(`/api/forecast?${searchParams.toString()}`);
}

export async function trainModel() {
  return api<{ status: string; items_trained: number; total_records: number }>('/api/forecast/train', { method: 'POST' });
}

// ============ ANALYTICS ============
export async function fetchAnalyticsByItem(canteenId?: string) {
  const qs = canteenId ? `?canteen_id=${canteenId}` : '';
  return api<{ name: string; waste_rate: number; total_wasted: number }[]>(`/api/analytics/by-item${qs}`);
}

export async function fetchAnalyticsByDay(canteenId?: string) {
  const qs = canteenId ? `?canteen_id=${canteenId}` : '';
  return api<{ day: string; waste_rate: number }[]>(`/api/analytics/by-day${qs}`);
}

export async function fetchAnalyticsTrend(canteenId?: string, days = 90) {
  const params = new URLSearchParams();
  if (canteenId) params.set('canteen_id', canteenId);
  params.set('days', String(days));
  return api<{ date: string; waste_rate: number; prepared: number; wasted: number }[]>(`/api/analytics/trend?${params.toString()}`);
}

export async function fetchHeatmap(canteenId?: string) {
  const qs = canteenId ? `?canteen_id=${canteenId}` : '';
  return api<{ day: string; meal: string; waste_rate: number }[]>(`/api/analytics/heatmap${qs}`);
}

// ============ ROI ============
export async function fetchROI(params?: { canteen_id?: string; start_date?: string; end_date?: string }) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => { if (v) searchParams.set(k, v); });
  }
  const qs = searchParams.toString();
  return api<{
    total_wasted_portions: number;
    total_cost_wasted: number;
    total_cost_saved: number;
    co2_prevented: number;
    water_saved: number;
    meals_equivalent: number;
    waste_percentage: number;
  }>(`/api/roi${qs ? `?${qs}` : ''}`);
}

// ============ EXPIRY ============
export async function fetchExpiryAlerts(canteenId?: string) {
  const qs = canteenId ? `?canteen_id=${canteenId}` : '';
  return api<{
    ingredient: any;
    days_remaining: number;
    risk_level: string;
    suggested_dishes: string[];
  }[]>(`/api/expiry${qs}`);
}

export async function addIngredient(ing: {
  canteen_id: string;
  name: string;
  qty_kg: number;
  purchase_date: string;
  shelf_life_days: number;
}) {
  return api<any>('/api/ingredients', { method: 'POST', body: JSON.stringify(ing) });
}

// ============ MENU ============
export async function fetchMenuSuggestions(canteenId: string) {
  return api<{
    item_id: string;
    item_name: string;
    waste_rate: number;
    best_day: string;
    worst_day: string;
    suggested_replacement: string | null;
    replacement_waste_rate: number | null;
  }[]>(`/api/menu-suggest?canteen_id=${canteenId}`);
}

// ============ BENCHMARK ============
export async function fetchBenchmarks() {
  return api<{
    canteen_id: string;
    canteen_name: string;
    avg_waste_rate: number;
    total_waste: number;
    trend: string;
  }[]>('/api/benchmark');
}

// ============ VOTES ============
export async function fetchVotes(date?: string) {
  const qs = date ? `?date=${date}` : '';
  return api<any[]>(`/api/votes${qs}`);
}

export async function castVoteAPI(canteenId: string, itemId: string) {
  return api<{ status: string; count: number }>('/api/votes', {
    method: 'POST',
    body: JSON.stringify({ canteen_id: canteenId, item_id: itemId }),
  });
}

// ============ CANTEENS CRUD ============
export async function createCanteen(data: { name: string; location: string }) {
  return api<any>('/api/canteens', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCanteen(id: string, data: { name?: string; location?: string }) {
  return api<any>(`/api/canteens/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteCanteen(id: string) {
  return api<any>(`/api/canteens/${id}`, { method: 'DELETE' });
}

// ============ FOOD ITEMS CRUD ============
export async function createItem(data: { canteen_id: string; name: string; category: string; cost_per_portion: number }) {
  return api<any>('/api/items', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateItem(id: string, data: { canteen_id?: string; name?: string; category?: string; cost_per_portion?: number }) {
  return api<any>(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteItem(id: string) {
  return api<any>(`/api/items/${id}`, { method: 'DELETE' });
}

// ============ INGREDIENTS CRUD ============
export async function updateIngredient(id: string, data: { name?: string; qty_kg?: number; purchase_date?: string; shelf_life_days?: number }) {
  return api<any>(`/api/ingredients/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteIngredient(id: string) {
  return api<any>(`/api/ingredients/${id}`, { method: 'DELETE' });
}

// ============ REPORT ============
export async function fetchWeeklyReport(canteenId: string) {
  return api<{
    week_start: string;
    week_end: string;
    total_prepared: number;
    total_wasted: number;
    waste_rate: number;
    cost_saved: number;
    worst_items: { name: string; waste_rate: number }[];
    best_items: { name: string; waste_rate: number }[];
  }>(`/api/report?canteen_id=${canteenId}`);
}

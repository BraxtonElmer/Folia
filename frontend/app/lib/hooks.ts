/**
 * React hooks for data fetching from ZeroWaste API.
 * Provides loading and error state management.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import * as api from './api';

// Generic data fetching hook
function useAPI<T>(fetcher: () => Promise<T>, deps: any[] = []): {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    
    fetcher()
      .then(result => { if (!cancelled) setData(result); })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [...deps, key]);

  const refetch = useCallback(() => setKey(k => k + 1), []);
  return { data, loading, error, refetch };
}

// ============ CANTEENS ============
export function useCanteens() {
  return useAPI(() => api.fetchCanteens(), []);
}

// ============ FOOD ITEMS ============
export function useItems(canteenId?: string) {
  return useAPI(() => api.fetchItems(canteenId), [canteenId]);
}

// ============ WASTE LOGS ============
export function useLogs(params?: Parameters<typeof api.fetchLogs>[0]) {
  return useAPI(
    () => api.fetchLogs(params),
    [params?.canteen_id, params?.item_id, params?.meal_type, params?.start_date, params?.end_date]
  );
}

// ============ FORECAST ============
export function useForecast(canteenId: string, weather: string, event: string, targetDate?: string) {
  return useAPI(
    () => api.fetchForecast({ canteen_id: canteenId, weather, event, target_date: targetDate }),
    [canteenId, weather, event, targetDate]
  );
}

// ============ ANALYTICS ============
export function useAnalyticsByItem(canteenId?: string) {
  return useAPI(() => api.fetchAnalyticsByItem(canteenId), [canteenId]);
}

export function useAnalyticsByDay(canteenId?: string) {
  return useAPI(() => api.fetchAnalyticsByDay(canteenId), [canteenId]);
}

export function useAnalyticsTrend(canteenId?: string, days = 90) {
  return useAPI(() => api.fetchAnalyticsTrend(canteenId, days), [canteenId, days]);
}

export function useHeatmap(canteenId?: string) {
  return useAPI(() => api.fetchHeatmap(canteenId), [canteenId]);
}

// ============ ROI ============
export function useROI(params?: Parameters<typeof api.fetchROI>[0]) {
  return useAPI(
    () => api.fetchROI(params),
    [params?.canteen_id, params?.start_date, params?.end_date]
  );
}

// ============ EXPIRY ============
export function useExpiryAlerts(canteenId?: string) {
  return useAPI(() => api.fetchExpiryAlerts(canteenId), [canteenId]);
}

// ============ MENU ============
export function useMenuSuggestions(canteenId: string) {
  return useAPI(() => api.fetchMenuSuggestions(canteenId), [canteenId]);
}

// ============ BENCHMARK ============
export function useBenchmarks() {
  return useAPI(() => api.fetchBenchmarks(), []);
}

// ============ VOTES ============
export function useVotes(date?: string) {
  return useAPI(() => api.fetchVotes(date), [date]);
}

// ============ REPORT ============
export function useWeeklyReport(canteenId: string) {
  return useAPI(() => api.fetchWeeklyReport(canteenId), [canteenId]);
}

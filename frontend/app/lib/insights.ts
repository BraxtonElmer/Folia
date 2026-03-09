import { getLogs, foodItems, canteens, getIngredients, getItemName, getCanteenName } from './data';
import { ROIMetrics, MenuSuggestion, ExpiryAlert, CanteenBenchmark, WeeklyReport } from './types';

// ============ ROI CALCULATIONS ============

const CO2_PER_PORTION = 0.8; // kg CO2 per wasted portion (average)
const WATER_PER_PORTION = 150; // liters of water per portion
const MEALS_PER_PORTION = 1;

export function calculateROI(canteenId?: string, startDate?: string, endDate?: string): ROIMetrics {
  const logs = getLogs({ canteenId, startDate, endDate });
  
  const totalPrepared = logs.reduce((s, l) => s + l.preparedQty, 0);
  const totalWasted = logs.reduce((s, l) => s + l.leftoverQty, 0);
  const totalSold = logs.reduce((s, l) => s + l.soldQty, 0);
  
  // Calculate costs
  const totalCostWasted = logs.reduce((sum, log) => {
    const item = foodItems.find(f => f.id === log.itemId);
    return sum + (item?.costPerPortion ?? 30) * log.leftoverQty;
  }, 0);
  
  // Estimated savings if we had predicted correctly (assume 50% waste reduction)
  const totalCostSaved = totalCostWasted * 0.5;
  
  const wastePercentage = totalPrepared > 0 ? (totalWasted / totalPrepared) * 100 : 0;
  
  return {
    totalWastedPortions: totalWasted,
    totalCostWasted,
    totalCostSaved,
    co2Prevented: Math.round(totalWasted * CO2_PER_PORTION * 0.5),
    waterSaved: Math.round(totalWasted * WATER_PER_PORTION * 0.5),
    mealsEquivalent: Math.round(totalWasted * MEALS_PER_PORTION),
    wastePercentage: Math.round(wastePercentage * 10) / 10,
  };
}

// ============ MENU SUGGESTIONS ============

export function getMenuSuggestions(canteenId: string): MenuSuggestion[] {
  const logs = getLogs({ canteenId });
  const dowNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const itemStats: Record<string, { total: number; wasted: number; byDow: Record<number, { total: number; wasted: number }> }> = {};
  
  for (const log of logs) {
    if (!itemStats[log.itemId]) {
      itemStats[log.itemId] = { total: 0, wasted: 0, byDow: {} };
    }
    const dow = new Date(log.date).getDay();
    if (!itemStats[log.itemId].byDow[dow]) {
      itemStats[log.itemId].byDow[dow] = { total: 0, wasted: 0 };
    }
    
    itemStats[log.itemId].total += log.preparedQty;
    itemStats[log.itemId].wasted += log.leftoverQty;
    itemStats[log.itemId].byDow[dow].total += log.preparedQty;
    itemStats[log.itemId].byDow[dow].wasted += log.leftoverQty;
  }
  
  const suggestions: MenuSuggestion[] = [];
  const canteenItems = foodItems.filter(f => f.canteenId === canteenId);
  
  for (const item of canteenItems) {
    const stats = itemStats[item.id];
    if (!stats || stats.total === 0) continue;
    
    const wasteRate = (stats.wasted / stats.total) * 100;
    
    // Find best and worst days
    let bestDay = 'N/A', worstDay = 'N/A';
    let bestRate = 100, worstRate = 0;
    
    for (const [dowStr, dowStats] of Object.entries(stats.byDow)) {
      const dow = Number(dowStr);
      if (dowStats.total === 0) continue;
      const rate = (dowStats.wasted / dowStats.total) * 100;
      if (rate < bestRate) { bestRate = rate; bestDay = dowNames[dow]; }
      if (rate > worstRate) { worstRate = rate; worstDay = dowNames[dow]; }
    }
    
    // Find replacement: same category, lower waste
    let suggestedReplacement: string | null = null;
    let replacementWasteRate: number | null = null;
    
    if (wasteRate > 25) {
      const sameCategory = canteenItems.filter(f => f.category === item.category && f.id !== item.id);
      for (const alt of sameCategory) {
        const altStats = itemStats[alt.id];
        if (!altStats || altStats.total === 0) continue;
        const altRate = (altStats.wasted / altStats.total) * 100;
        if (altRate < wasteRate - 10) {
          suggestedReplacement = alt.name;
          replacementWasteRate = Math.round(altRate * 10) / 10;
          break;
        }
      }
    }
    
    suggestions.push({
      itemId: item.id,
      itemName: item.name,
      wasteRate: Math.round(wasteRate * 10) / 10,
      bestDay,
      worstDay,
      suggestedReplacement,
      replacementWasteRate,
    });
  }
  
  return suggestions.sort((a, b) => b.wasteRate - a.wasteRate);
}

// ============ EXPIRY ALERTS ============

const DISH_MAP: Record<string, string[]> = {
  'Paneer': ['Paneer Butter Masala', 'Shahi Paneer', 'Paneer Tikka'],
  'Tomatoes': ['Dal Tadka', 'Gravy Dishes', 'Pasta Sauce'],
  'Yogurt': ['Raita', 'Lassi', 'Dahi Chawal'],
  'Bread (Sliced)': ['Sandwiches', 'French Toast', 'Bread Pakora'],
  'Cheese': ['Pasta', 'Grilled Sandwich', 'Pizza'],
  'Cream': ['Paneer Butter Masala', 'Dal Makhani', 'Desserts'],
  'Capsicum': ['Fried Rice', 'Manchurian', 'Noodles'],
  'Onions': ['All Curries', 'Biryani', 'Fried Rice'],
};

export function getExpiryAlerts(canteenId?: string): ExpiryAlert[] {
  const ingredients = getIngredients(canteenId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return ingredients.map(ing => {
    const purchaseDate = new Date(ing.purchaseDate);
    const expiryDate = new Date(purchaseDate);
    expiryDate.setDate(expiryDate.getDate() + ing.shelfLifeDays);
    
    const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    const riskLevel = daysRemaining <= 1 ? 'critical' as const :
      daysRemaining <= 3 ? 'warning' as const : 'safe' as const;
    
    const suggestedDishes = DISH_MAP[ing.name] ?? ['General cooking'];
    
    return { ingredient: ing, daysRemaining, riskLevel, suggestedDishes };
  }).sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// ============ BENCHMARKING ============

export function getCanteenBenchmarks(): CanteenBenchmark[] {
  return canteens.map(canteen => {
    const logs = getLogs({ canteenId: canteen.id });
    const totalPrepared = logs.reduce((s, l) => s + l.preparedQty, 0);
    const totalWasted = logs.reduce((s, l) => s + l.leftoverQty, 0);
    const avgWasteRate = totalPrepared > 0 ? (totalWasted / totalPrepared) * 100 : 0;
    
    // Trend: compare last 7 days vs 7 days before
    const dates = [...new Set(logs.map(l => l.date))].sort().reverse();
    const recent = dates.slice(0, 7);
    const previous = dates.slice(7, 14);
    
    const recentRate = calcPeriodWaste(logs, recent);
    const previousRate = calcPeriodWaste(logs, previous);
    
    const trend = recentRate < previousRate - 2 ? 'improving' as const :
      recentRate > previousRate + 2 ? 'worsening' as const : 'stable' as const;
    
    return {
      canteenId: canteen.id,
      canteenName: canteen.name,
      avgWasteRate: Math.round(avgWasteRate * 10) / 10,
      totalWaste: totalWasted,
      trend,
    };
  });
}

function calcPeriodWaste(logs: ReturnType<typeof getLogs>, dates: string[]): number {
  const periodLogs = logs.filter(l => dates.includes(l.date));
  const prepared = periodLogs.reduce((s, l) => s + l.preparedQty, 0);
  const wasted = periodLogs.reduce((s, l) => s + l.leftoverQty, 0);
  return prepared > 0 ? (wasted / prepared) * 100 : 0;
}

// ============ WEEKLY REPORT ============

export function getWeeklyReport(canteenId: string): WeeklyReport {
  const logs = getLogs({ canteenId });
  const dates = [...new Set(logs.map(l => l.date))].sort().reverse();
  const weekDates = dates.slice(0, 7);
  
  const weekLogs = logs.filter(l => weekDates.includes(l.date));
  const totalPrepared = weekLogs.reduce((s, l) => s + l.preparedQty, 0);
  const totalWasted = weekLogs.reduce((s, l) => s + l.leftoverQty, 0);
  const wasteRate = totalPrepared > 0 ? (totalWasted / totalPrepared) * 100 : 0;
  
  // Cost saved calculation
  const costWasted = weekLogs.reduce((sum, log) => {
    const item = foodItems.find(f => f.id === log.itemId);
    return sum + (item?.costPerPortion ?? 30) * log.leftoverQty;
  }, 0);
  
  // Item waste rates
  const itemWaste: Record<string, { prepared: number; wasted: number }> = {};
  for (const log of weekLogs) {
    if (!itemWaste[log.itemId]) itemWaste[log.itemId] = { prepared: 0, wasted: 0 };
    itemWaste[log.itemId].prepared += log.preparedQty;
    itemWaste[log.itemId].wasted += log.leftoverQty;
  }
  
  const itemRates = Object.entries(itemWaste).map(([id, stats]) => ({
    name: getItemName(id),
    wasteRate: stats.prepared > 0 ? Math.round((stats.wasted / stats.prepared) * 100) : 0,
  })).sort((a, b) => b.wasteRate - a.wasteRate);
  
  return {
    weekStart: weekDates[weekDates.length - 1] ?? '',
    weekEnd: weekDates[0] ?? '',
    totalPrepared,
    totalWasted,
    wasteRate: Math.round(wasteRate * 10) / 10,
    costSaved: Math.round(costWasted * 0.5),
    worstItems: itemRates.slice(0, 5),
    bestItems: itemRates.slice(-3).reverse(),
    nextWeekForecast: itemRates.slice(0, 5).map(i => ({ name: i.name, qty: Math.round(50 + Math.random() * 40) })),
  };
}

// ============ ANALYTICS AGGREGATIONS ============

export function getWasteByItem(canteenId?: string): { name: string; wasteRate: number; totalWasted: number }[] {
  const logs = getLogs({ canteenId });
  const itemStats: Record<string, { prepared: number; wasted: number }> = {};
  
  for (const log of logs) {
    if (!itemStats[log.itemId]) itemStats[log.itemId] = { prepared: 0, wasted: 0 };
    itemStats[log.itemId].prepared += log.preparedQty;
    itemStats[log.itemId].wasted += log.leftoverQty;
  }
  
  return Object.entries(itemStats)
    .map(([id, stats]) => ({
      name: getItemName(id),
      wasteRate: stats.prepared > 0 ? Math.round((stats.wasted / stats.prepared) * 100 * 10) / 10 : 0,
      totalWasted: stats.wasted,
    }))
    .sort((a, b) => b.wasteRate - a.wasteRate);
}

export function getWasteByDayOfWeek(canteenId?: string): { day: string; wasteRate: number }[] {
  const logs = getLogs({ canteenId });
  const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dowStats: Record<number, { prepared: number; wasted: number }> = {};
  
  for (let i = 0; i < 7; i++) dowStats[i] = { prepared: 0, wasted: 0 };
  
  for (const log of logs) {
    const dow = new Date(log.date).getDay();
    dowStats[dow].prepared += log.preparedQty;
    dowStats[dow].wasted += log.leftoverQty;
  }
  
  return Object.entries(dowStats).map(([d, stats]) => ({
    day: dowNames[Number(d)],
    wasteRate: stats.prepared > 0 ? Math.round((stats.wasted / stats.prepared) * 100 * 10) / 10 : 0,
  }));
}

export function getWasteTrend(canteenId?: string): { date: string; wasteRate: number; prepared: number; wasted: number }[] {
  const logs = getLogs({ canteenId });
  const dailyStats: Record<string, { prepared: number; wasted: number }> = {};
  
  for (const log of logs) {
    if (!dailyStats[log.date]) dailyStats[log.date] = { prepared: 0, wasted: 0 };
    dailyStats[log.date].prepared += log.preparedQty;
    dailyStats[log.date].wasted += log.leftoverQty;
  }
  
  return Object.entries(dailyStats)
    .map(([date, stats]) => ({
      date,
      wasteRate: stats.prepared > 0 ? Math.round((stats.wasted / stats.prepared) * 100 * 10) / 10 : 0,
      prepared: stats.prepared,
      wasted: stats.wasted,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getHeatmapData(canteenId?: string): { day: string; meal: string; wasteRate: number }[] {
  const logs = getLogs({ canteenId });
  const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const meals = ['breakfast', 'lunch', 'dinner'];
  const stats: Record<string, { prepared: number; wasted: number }> = {};
  
  for (const dow of dowNames) {
    for (const meal of meals) {
      stats[`${dow}-${meal}`] = { prepared: 0, wasted: 0 };
    }
  }
  
  for (const log of logs) {
    const dow = dowNames[new Date(log.date).getDay()];
    const key = `${dow}-${log.mealType}`;
    if (stats[key]) {
      stats[key].prepared += log.preparedQty;
      stats[key].wasted += log.leftoverQty;
    }
  }
  
  return Object.entries(stats).map(([key, s]) => {
    const [day, meal] = key.split('-');
    return {
      day,
      meal,
      wasteRate: s.prepared > 0 ? Math.round((s.wasted / s.prepared) * 100) : 0,
    };
  });
}

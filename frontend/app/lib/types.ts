export interface Canteen {
  id: string;
  name: string;
  location: string;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner';
export type WeatherTag = 'sunny' | 'rainy' | 'cold' | 'hot';
export type EventTag = 'normal' | 'exam' | 'fest' | 'holiday';

export interface FoodItem {
  id: string;
  canteenId: string;
  name: string;
  category: string;
  costPerPortion: number;
}

export interface WasteLog {
  id: string;
  canteenId: string;
  itemId: string;
  date: string; // YYYY-MM-DD
  mealType: MealType;
  preparedQty: number;
  soldQty: number;
  leftoverQty: number;
  weather: WeatherTag;
  event: EventTag;
}

export interface Ingredient {
  id: string;
  canteenId: string;
  name: string;
  qtyKg: number;
  purchaseDate: string;
  shelfLifeDays: number;
}

export interface StudentVote {
  id: string;
  canteenId: string;
  itemId: string;
  voteDate: string;
  count: number;
}

export interface ForecastResult {
  itemId: string;
  itemName: string;
  predictedQty: number;
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
  lowerBound: number;
  upperBound: number;
  historicalAvg: number;
  contextMultiplier: number;
}

export interface ROIMetrics {
  totalWastedPortions: number;
  totalCostWasted: number;
  totalCostSaved: number; // compared to no optimization
  co2Prevented: number; // kg
  waterSaved: number; // liters
  mealsEquivalent: number;
  wastePercentage: number;
}

export interface MenuSuggestion {
  itemId: string;
  itemName: string;
  wasteRate: number;
  bestDay: string;
  worstDay: string;
  suggestedReplacement: string | null;
  replacementWasteRate: number | null;
}

export interface ExpiryAlert {
  ingredient: Ingredient;
  daysRemaining: number;
  riskLevel: 'critical' | 'warning' | 'safe';
  suggestedDishes: string[];
}

export interface CanteenBenchmark {
  canteenId: string;
  canteenName: string;
  avgWasteRate: number;
  totalWaste: number;
  trend: 'improving' | 'worsening' | 'stable';
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  totalPrepared: number;
  totalWasted: number;
  wasteRate: number;
  costSaved: number;
  worstItems: { name: string; wasteRate: number }[];
  bestItems: { name: string; wasteRate: number }[];
  nextWeekForecast: { name: string; qty: number }[];
}

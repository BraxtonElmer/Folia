import { Canteen, FoodItem, WasteLog, Ingredient, StudentVote, WeatherTag, EventTag, MealType } from './types';

// ============ CANTEENS ============
export const canteens: Canteen[] = [
  { id: 'c1', name: 'Main Canteen', location: 'Central Block' },
  { id: 'c2', name: 'North Café', location: 'Engineering Wing' },
  { id: 'c3', name: 'South Bistro', location: 'Arts & Science Block' },
];

// ============ FOOD ITEMS ============
export const foodItems: FoodItem[] = [
  { id: 'f1', canteenId: 'c1', name: 'Dal Tadka', category: 'Main Course', costPerPortion: 25 },
  { id: 'f2', canteenId: 'c1', name: 'Veg Biryani', category: 'Rice', costPerPortion: 45 },
  { id: 'f3', canteenId: 'c1', name: 'Paneer Butter Masala', category: 'Main Course', costPerPortion: 55 },
  { id: 'f4', canteenId: 'c1', name: 'Fried Rice', category: 'Rice', costPerPortion: 35 },
  { id: 'f5', canteenId: 'c1', name: 'Roti', category: 'Bread', costPerPortion: 8 },
  { id: 'f6', canteenId: 'c1', name: 'Rajma Chawal', category: 'Combo', costPerPortion: 40 },
  { id: 'f7', canteenId: 'c1', name: 'Chole Bhature', category: 'Combo', costPerPortion: 40 },
  { id: 'f8', canteenId: 'c1', name: 'Samosa', category: 'Snack', costPerPortion: 15 },
  { id: 'f9', canteenId: 'c2', name: 'Masala Dosa', category: 'South Indian', costPerPortion: 35 },
  { id: 'f10', canteenId: 'c2', name: 'Idli Sambhar', category: 'South Indian', costPerPortion: 25 },
  { id: 'f11', canteenId: 'c2', name: 'Pasta', category: 'Continental', costPerPortion: 50 },
  { id: 'f12', canteenId: 'c2', name: 'Sandwich', category: 'Snack', costPerPortion: 30 },
  { id: 'f13', canteenId: 'c3', name: 'Thali', category: 'Combo', costPerPortion: 60 },
  { id: 'f14', canteenId: 'c3', name: 'Noodles', category: 'Chinese', costPerPortion: 40 },
  { id: 'f15', canteenId: 'c3', name: 'Manchurian', category: 'Chinese', costPerPortion: 45 },
];

// ============ SEED DATA GENERATOR ============

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr).getDay();
}

function generateWasteLogs(): WasteLog[] {
  const logs: WasteLog[] = [];
  const rand = seededRandom(42);
  const today = new Date();
  
  // Generate 90 days of data
  for (let d = 89; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];
    const dow = date.getDay();
    
    // Skip Sundays occasionally
    if (dow === 0 && rand() > 0.3) continue;
    
    // Weather pattern — rainy on some days
    const weatherRoll = rand();
    const weather: WeatherTag = weatherRoll < 0.15 ? 'rainy' : weatherRoll < 0.25 ? 'cold' : weatherRoll < 0.4 ? 'hot' : 'sunny';
    
    // Event tags — exams in certain periods, fests, holidays
    let event: EventTag = 'normal';
    if (d >= 60 && d <= 67) event = 'exam';
    if (d >= 30 && d <= 32) event = 'fest';
    if (dow === 0 || (d === 45) || (d === 20)) event = 'holiday';
    
    // Base demand varies by day of week
    const dowMultiplier: Record<number, number> = {
      0: 0.4, 1: 1.0, 2: 0.95, 3: 1.05, 4: 0.9, 5: 1.1, 6: 0.6
    };
    
    const weatherMultiplier: Record<WeatherTag, number> = {
      sunny: 1.0, rainy: 0.7, cold: 0.85, hot: 0.9
    };
    
    const eventMultiplier: Record<EventTag, number> = {
      normal: 1.0, exam: 0.6, fest: 1.35, holiday: 0.3
    };
    
    const meals: MealType[] = ['lunch'];
    if (rand() > 0.3) meals.push('dinner');
    if (rand() > 0.7) meals.unshift('breakfast');
    
    for (const meal of meals) {
      const mealMultiplier = meal === 'lunch' ? 1.0 : meal === 'dinner' ? 0.7 : 0.4;
      
      // Each canteen's items for this meal
      for (const item of foodItems) {
        // Not every item every day
        if (rand() > 0.75) continue;
        
        const basePrepared = 60 + Math.floor(rand() * 60);
        const contextFactor = dowMultiplier[dow] * weatherMultiplier[weather] * eventMultiplier[event] * mealMultiplier;
        
        const actualDemand = Math.floor(basePrepared * contextFactor * (0.65 + rand() * 0.5));
        const prepared = basePrepared;
        const sold = Math.min(prepared, actualDemand);
        const leftover = prepared - sold;
        
        logs.push({
          id: `log-${dateStr}-${item.id}-${meal}`,
          canteenId: item.canteenId,
          itemId: item.id,
          date: dateStr,
          mealType: meal,
          preparedQty: prepared,
          soldQty: sold,
          leftoverQty: leftover,
          weather,
          event,
        });
      }
    }
  }
  
  return logs;
}

function generateIngredients(): Ingredient[] {
  const today = new Date();
  const ingredients: Ingredient[] = [
    { id: 'i1', canteenId: 'c1', name: 'Paneer', qtyKg: 5, purchaseDate: daysAgo(today, 4), shelfLifeDays: 5 },
    { id: 'i2', canteenId: 'c1', name: 'Tomatoes', qtyKg: 15, purchaseDate: daysAgo(today, 3), shelfLifeDays: 7 },
    { id: 'i3', canteenId: 'c1', name: 'Onions', qtyKg: 20, purchaseDate: daysAgo(today, 7), shelfLifeDays: 14 },
    { id: 'i4', canteenId: 'c1', name: 'Rice (Basmati)', qtyKg: 50, purchaseDate: daysAgo(today, 5), shelfLifeDays: 90 },
    { id: 'i5', canteenId: 'c1', name: 'Dal (Toor)', qtyKg: 10, purchaseDate: daysAgo(today, 6), shelfLifeDays: 60 },
    { id: 'i6', canteenId: 'c1', name: 'Yogurt', qtyKg: 8, purchaseDate: daysAgo(today, 5), shelfLifeDays: 7 },
    { id: 'i7', canteenId: 'c2', name: 'Bread (Sliced)', qtyKg: 3, purchaseDate: daysAgo(today, 2), shelfLifeDays: 3 },
    { id: 'i8', canteenId: 'c2', name: 'Cheese', qtyKg: 2, purchaseDate: daysAgo(today, 6), shelfLifeDays: 14 },
    { id: 'i9', canteenId: 'c2', name: 'Pasta Sheets', qtyKg: 4, purchaseDate: daysAgo(today, 1), shelfLifeDays: 30 },
    { id: 'i10', canteenId: 'c3', name: 'Noodles (Dried)', qtyKg: 8, purchaseDate: daysAgo(today, 10), shelfLifeDays: 60 },
    { id: 'i11', canteenId: 'c3', name: 'Capsicum', qtyKg: 6, purchaseDate: daysAgo(today, 3), shelfLifeDays: 5 },
    { id: 'i12', canteenId: 'c1', name: 'Cream', qtyKg: 3, purchaseDate: daysAgo(today, 4), shelfLifeDays: 5 },
  ];
  return ingredients;
}

function daysAgo(today: Date, n: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function generateVotes(): StudentVote[] {
  const rand = seededRandom(123);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const voteDate = tomorrow.toISOString().split('T')[0];
  
  return foodItems.slice(0, 8).map((item) => ({
    id: `vote-${item.id}`,
    canteenId: item.canteenId,
    itemId: item.id,
    voteDate,
    count: Math.floor(rand() * 80) + 5,
  }));
}

// ============ STORAGE KEYS ============
const KEYS = {
  LOGS: 'zerowaste_logs',
  INGREDIENTS: 'zerowaste_ingredients',
  VOTES: 'zerowaste_votes',
};

// ============ INIT ============
export function initializeData() {
  if (typeof window === 'undefined') return;
  if (!localStorage.getItem(KEYS.LOGS)) {
    localStorage.setItem(KEYS.LOGS, JSON.stringify(generateWasteLogs()));
  }
  if (!localStorage.getItem(KEYS.INGREDIENTS)) {
    localStorage.setItem(KEYS.INGREDIENTS, JSON.stringify(generateIngredients()));
  }
  if (!localStorage.getItem(KEYS.VOTES)) {
    localStorage.setItem(KEYS.VOTES, JSON.stringify(generateVotes()));
  }
}

// ============ CRUD ============

export function getLogs(filters?: { canteenId?: string; itemId?: string; startDate?: string; endDate?: string; mealType?: MealType }): WasteLog[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(KEYS.LOGS);
  if (!raw) return [];
  let logs: WasteLog[] = JSON.parse(raw);
  
  if (filters) {
    if (filters.canteenId) logs = logs.filter(l => l.canteenId === filters.canteenId);
    if (filters.itemId) logs = logs.filter(l => l.itemId === filters.itemId);
    if (filters.startDate) logs = logs.filter(l => l.date >= filters.startDate!);
    if (filters.endDate) logs = logs.filter(l => l.date <= filters.endDate!);
    if (filters.mealType) logs = logs.filter(l => l.mealType === filters.mealType);
  }
  
  return logs.sort((a, b) => b.date.localeCompare(a.date));
}

export function addLog(log: WasteLog) {
  if (typeof window === 'undefined') return;
  const logs = getLogs();
  logs.push(log);
  localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
}

export function getIngredients(canteenId?: string): Ingredient[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(KEYS.INGREDIENTS);
  if (!raw) return [];
  let items: Ingredient[] = JSON.parse(raw);
  if (canteenId) items = items.filter(i => i.canteenId === canteenId);
  return items;
}

export function addIngredient(ingredient: Ingredient) {
  if (typeof window === 'undefined') return;
  const items = getIngredients();
  items.push(ingredient);
  localStorage.setItem(KEYS.INGREDIENTS, JSON.stringify(items));
}

export function getVotes(date?: string): StudentVote[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(KEYS.VOTES);
  if (!raw) return [];
  let votes: StudentVote[] = JSON.parse(raw);
  if (date) votes = votes.filter(v => v.voteDate === date);
  return votes;
}

export function castVote(itemId: string, canteenId: string) {
  if (typeof window === 'undefined') return;
  const votes = getVotes();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const voteDate = tomorrow.toISOString().split('T')[0];
  
  const existing = votes.find(v => v.itemId === itemId && v.voteDate === voteDate);
  if (existing) {
    existing.count += 1;
  } else {
    votes.push({ id: `vote-${Date.now()}`, canteenId, itemId, voteDate, count: 1 });
  }
  localStorage.setItem(KEYS.VOTES, JSON.stringify(votes));
}

export function getItemName(itemId: string): string {
  return foodItems.find(f => f.id === itemId)?.name ?? 'Unknown';
}

export function getCanteenName(canteenId: string): string {
  return canteens.find(c => c.id === canteenId)?.name ?? 'Unknown';
}

export function getItemsByCanteen(canteenId: string): FoodItem[] {
  return foodItems.filter(f => f.canteenId === canteenId);
}

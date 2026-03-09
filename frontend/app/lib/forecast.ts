import { WasteLog, ForecastResult, WeatherTag, EventTag } from './types';
import { foodItems, getLogs, getVotes, getItemName } from './data';

const WEATHER_MULTIPLIERS: Record<WeatherTag, number> = {
  sunny: 1.0,
  rainy: 0.70,
  cold: 0.85,
  hot: 0.90,
};

const EVENT_MULTIPLIERS: Record<EventTag, number> = {
  normal: 1.0,
  exam: 0.60,
  fest: 1.35,
  holiday: 0.30,
};

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Weighted Moving Average with context-based demand forecasting.
 * Blends historical demand with student vote signals.
 */
export function predictDemand(
  itemId: string,
  targetDate: string,
  weather: WeatherTag = 'sunny',
  event: EventTag = 'normal',
  canteenId?: string
): ForecastResult {
  const logs = getLogs({ itemId, canteenId });
  const targetDow = new Date(targetDate).getDay();
  
  // Get last 30 days of logs for this item
  const recentLogs = logs.slice(0, 60);
  
  if (recentLogs.length === 0) {
    return {
      itemId,
      itemName: getItemName(itemId),
      predictedQty: 50,
      confidence: 'low',
      explanation: 'No historical data available. Using default estimate.',
      lowerBound: 30,
      upperBound: 70,
      historicalAvg: 0,
      contextMultiplier: 1.0,
    };
  }
  
  // 1. Calculate weighted moving average (recent days weighted higher)
  const weights = recentLogs.map((_, i) => Math.exp(-i * 0.1)); // exponential decay
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedAvgDemand = recentLogs.reduce((sum, log, i) => sum + log.soldQty * weights[i], 0) / totalWeight;
  
  // 2. Day-of-week seasonality
  const sameDowLogs = recentLogs.filter(l => new Date(l.date).getDay() === targetDow);
  const dowAvg = sameDowLogs.length > 0
    ? sameDowLogs.reduce((s, l) => s + l.soldQty, 0) / sameDowLogs.length
    : weightedAvgDemand;
  
  // Blend WMA with day-of-week pattern (60/40)
  const basePrediction = weightedAvgDemand * 0.6 + dowAvg * 0.4;
  
  // 3. Context multipliers
  const weatherMult = WEATHER_MULTIPLIERS[weather];
  const eventMult = EVENT_MULTIPLIERS[event];
  const contextMultiplier = weatherMult * eventMult;
  
  let predicted = Math.round(basePrediction * contextMultiplier);
  
  // 4. Student vote signal fusion
  const votes = getVotes(targetDate);
  const itemVote = votes.find(v => v.itemId === itemId);
  if (itemVote && itemVote.count >= 10) {
    // Use votes as a demand signal — more votes = higher weight
    const voteWeight = Math.min(0.3, itemVote.count / 200); // cap at 30%
    const votePrediction = itemVote.count * 1.2; // each vote ≈ 1.2 portions
    predicted = Math.round(predicted * (1 - voteWeight) + votePrediction * voteWeight);
  }
  
  // 5. Add buffer (5-10% for safety)
  const buffer = Math.ceil(predicted * 0.07);
  predicted += buffer;
  
  // Confidence
  const dataPoints = recentLogs.length;
  const confidence: 'high' | 'medium' | 'low' = dataPoints >= 20 ? 'high' : dataPoints >= 8 ? 'medium' : 'low';
  
  // Variance for bounds
  const variance = recentLogs.reduce((s, l) => s + Math.pow(l.soldQty - weightedAvgDemand, 2), 0) / recentLogs.length;
  const stdDev = Math.sqrt(variance);
  const lowerBound = Math.max(0, Math.round(predicted - stdDev * 1.2));
  const upperBound = Math.round(predicted + stdDev * 1.2);
  
  const historicalAvg = Math.round(recentLogs.reduce((s, l) => s + l.preparedQty, 0) / recentLogs.length);
  
  // Build explanation
  const explanationParts: string[] = [];
  explanationParts.push(`Based on ${dataPoints} recent data points`);
  explanationParts.push(`${DOW_NAMES[targetDow]}s average ${Math.round(dowAvg)} sold`);
  if (weather !== 'sunny') explanationParts.push(`${weather} weather (${Math.round(weatherMult * 100)}% demand)`);
  if (event !== 'normal') explanationParts.push(`${event} event (${Math.round(eventMult * 100)}% demand)`);
  if (itemVote && itemVote.count >= 10) explanationParts.push(`${itemVote.count} student votes boosting signal`);
  explanationParts.push(`Historical avg prepared: ${historicalAvg}`);
  
  return {
    itemId,
    itemName: getItemName(itemId),
    predictedQty: predicted,
    confidence,
    explanation: explanationParts.join(' · '),
    lowerBound,
    upperBound,
    historicalAvg,
    contextMultiplier,
  };
}

/**
 * Get forecasts for all items at a canteen
 */
export function getCanteenForecast(
  canteenId: string,
  targetDate: string,
  weather: WeatherTag = 'sunny',
  event: EventTag = 'normal'
): ForecastResult[] {
  const items = foodItems.filter(f => f.canteenId === canteenId);
  return items.map(item => predictDemand(item.id, targetDate, weather, event, canteenId));
}

/**
 * Calculate forecast accuracy for past predictions
 */
export function getForecastAccuracy(canteenId: string): number {
  const logs = getLogs({ canteenId });
  if (logs.length < 14) return 0;
  
  // Compare last 7 days of actual vs what our model would have predicted
  const recentDates = [...new Set(logs.map(l => l.date))].slice(0, 7);
  let totalError = 0;
  let count = 0;
  
  for (const date of recentDates) {
    const dayLogs = logs.filter(l => l.date === date);
    for (const log of dayLogs) {
      const olderLogs = logs.filter(l => l.date < date && l.itemId === log.itemId);
      if (olderLogs.length < 5) continue;
      
      const avgSold = olderLogs.slice(0, 14).reduce((s, l) => s + l.soldQty, 0) / Math.min(olderLogs.length, 14);
      const error = Math.abs(avgSold - log.soldQty) / Math.max(log.soldQty, 1);
      totalError += error;
      count++;
    }
  }
  
  return count > 0 ? Math.round((1 - totalError / count) * 100) : 75;
}

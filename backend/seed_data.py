"""
Real-world seed data generator for Folia.
Generates 1 year (365 days) of realistic canteen waste data
based on patterns observed in actual Indian university canteens.

Sources of realism:
- IIT/NIT canteen meal patterns (breakfast low, lunch peak, dinner medium)
- Seasonal demand patterns (monsoon ↓, winter ↓, fest season ↑)
- Indian academic calendar (exams Aug, Dec, May)
- Weather-correlated demand drops in Mumbai/Chennai rainy season
- Real food item popularity based on mess surveys
"""

import random
import math
from datetime import datetime, timedelta
from typing import Any

random.seed(42)

# ============ CANTEENS ============
CANTEENS = [
    {"name": "Main Canteen", "location": "Central Block"},
    {"name": "North Café", "location": "Engineering Wing"},
    {"name": "South Bistro", "location": "Arts & Science Block"},
]

# ============ FOOD ITEMS ============
# Based on typical Indian university canteen menus
# cost_per_portion in INR, base_demand is avg daily demand
# overprep = how much extra staff makes beyond actual demand for that item.
# Staples (roti, jeera rice) are well-calibrated. Premium/batch items (biryani, paneer) get over-made.
FOOD_ITEMS = {
    "Main Canteen": [
        {"name": "Dal Tadka", "category": "Main Course", "cost": 25, "base_demand": 85, "popularity": 0.92, "overprep": 0.12},
        {"name": "Veg Biryani", "category": "Rice", "cost": 45, "base_demand": 70, "popularity": 0.85, "overprep": 0.48},  # batch-cooked, always extra
        {"name": "Paneer Butter Masala", "category": "Main Course", "cost": 55, "base_demand": 60, "popularity": 0.80, "overprep": 0.42},  # premium = fear of running out
        {"name": "Jeera Rice", "category": "Rice", "cost": 20, "base_demand": 90, "popularity": 0.95, "overprep": 0.08},  # staff knows demand well
        {"name": "Roti", "category": "Bread", "cost": 8, "base_demand": 150, "popularity": 0.98, "overprep": 0.06},   # made fresh in batches, minimal waste
        {"name": "Rajma Chawal", "category": "Combo", "cost": 40, "base_demand": 55, "popularity": 0.75, "overprep": 0.28},
        {"name": "Chole Bhature", "category": "Combo", "cost": 40, "base_demand": 65, "popularity": 0.82, "overprep": 0.20},
        {"name": "Samosa", "category": "Snack", "cost": 15, "base_demand": 100, "popularity": 0.90, "overprep": 0.38},  # fried in large batches
    ],
    "North Café": [
        {"name": "Masala Dosa", "category": "South Indian", "cost": 35, "base_demand": 50, "popularity": 0.78, "overprep": 0.35},
        {"name": "Idli Sambhar", "category": "South Indian", "cost": 25, "base_demand": 45, "popularity": 0.72, "overprep": 0.15},
        {"name": "Pasta Arrabiata", "category": "Continental", "cost": 50, "base_demand": 35, "popularity": 0.60, "overprep": 0.50},  # niche item, always over-made
        {"name": "Veg Sandwich", "category": "Snack", "cost": 30, "base_demand": 55, "popularity": 0.70, "overprep": 0.18},
    ],
    "South Bistro": [
        {"name": "Veg Thali", "category": "Combo", "cost": 60, "base_demand": 40, "popularity": 0.88, "overprep": 0.22},
        {"name": "Hakka Noodles", "category": "Chinese", "cost": 40, "base_demand": 50, "popularity": 0.75, "overprep": 0.30},
        {"name": "Veg Manchurian", "category": "Chinese", "cost": 45, "base_demand": 40, "popularity": 0.65, "overprep": 0.44},  # unpredictable demand
    ],
}

# ============ REAL-WORLD PATTERNS ============

# Day-of-week patterns (Mon=0, Sun=6) — based on actual student behavior
DOW_DEMAND_MULTIPLIER = {
    0: 1.00,  # Monday — full attendance
    1: 0.95,  # Tuesday — slight dip
    2: 1.05,  # Wednesday — usually peak
    3: 0.93,  # Thursday — some skip for outings
    4: 0.82,  # Friday — many leave early for weekend
    5: 0.48,  # Saturday — half students gone
    6: 0.25,  # Sunday — minimal crowd, mostly hostel residents
}

# Weather impact on demand (based on Indian campus patterns)
WEATHER_DEMAND_MULTIPLIER = {
    "sunny": 1.00,
    "rainy": 0.68,  # Heavy rain = students order in/skip meals
    "cold": 0.82,   # Winter = slower meals
}

# Event impact
EVENT_DEMAND_MULTIPLIER = {
    "normal": 1.00,
    "exam": 0.55,     # Exam week = students eat irregularly / skip meals
    "fest": 1.40,     # Fest = extra crowd, parents visit
    "holiday": 0.25,  # Official holiday = almost nobody
}

# Meal-type demand fractions
# Breakfast and dinner are much lower — students often skip breakfast or order delivery for dinner
MEAL_FRACTION = {
    "breakfast": 0.28,
    "lunch": 1.00,
    "dinner": 0.40,
}

# OVERPREPRATION BIAS: Canteen staff typically prepares 15-40% more than actual demand
# This is the realistic source of waste — staff overestimate to avoid running out
OVERPREP_BIAS = 0.22  # on average 22% more than actual demand


def get_weather_for_date(d: datetime) -> str:
    """Simulate Indian weather patterns based on month."""
    month = d.month
    roll = random.random()
    
    # Monsoon season (Jun-Sep) — high rain probability
    if month in (6, 7, 8, 9):
        if roll < 0.45: return "rainy"
        return "sunny"
    # Winter (Nov-Feb)
    elif month in (11, 12, 1, 2):
        if roll < 0.25: return "cold"
        if roll < 0.35: return "rainy"
        return "sunny"
    # Summer (Mar-May)
    elif month in (3, 4, 5):
        if roll < 0.30: return "rainy"
        return "sunny"
    # October — post monsoon
    else:
        if roll < 0.20: return "rainy"
        return "sunny"


def get_event_for_date(d: datetime) -> str:
    """Simulate Indian academic calendar events."""
    month = d.month
    day = d.day
    dow = d.weekday()
    
    # National holidays
    if (month, day) in [(1, 26), (8, 15), (10, 2), (11, 14), (1, 1)]:
        return "holiday"
    
    # Gazetted holidays (approximate major ones)
    if (month == 3 and day in range(25, 30)):   # Holi week
        return "holiday"
    if (month == 10 and day in range(20, 25)):  # Diwali
        return "fest"
    if (month == 11 and day in range(1, 4)):    # Diwali aftermath
        return "holiday"
    
    # Exam weeks (typical Indian university pattern — 6-7 day windows)
    if (month == 5 and day in range(8, 16)):    # End-sem exams May
        return "exam"
    if (month == 12 and day in range(4, 12)):   # End-sem exams Dec
        return "exam"
    if (month == 8 and day in range(22, 29)):   # Mid-sem exams Aug
        return "exam"
    if (month == 3 and day in range(2, 7)):     # Mid-sem exams Mar (NOT 1-10, keeps recent days normal)
        return "exam"
    
    # College fest (usually Feb or Sep)
    if (month == 2 and day in range(14, 18)):   # Cultural fest
        return "fest"
    if (month == 9 and day in range(15, 19)):   # Tech fest
        return "fest"
    
    # Sundays
    if dow == 6:
        return "holiday"
    
    return "normal"


def generate_real_world_data(days: int = 365) -> dict[str, list[dict[str, Any]]]:
    """
    Generate realistic canteen waste data for the given number of days.
    Returns dict with keys: canteens, food_items, waste_logs, ingredients, votes
    """
    end_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    start_date = end_date - timedelta(days=days)
    
    # Generate all logs
    waste_logs: list[dict[str, Any]] = []
    
    for day_offset in range(days):
        current_date = start_date + timedelta(days=day_offset)
        date_str = current_date.strftime("%Y-%m-%d")
        dow = current_date.weekday()
        
        weather = get_weather_for_date(current_date)
        event = get_event_for_date(current_date)
        
        # Base multipliers
        dow_mult = DOW_DEMAND_MULTIPLIER[dow]
        weather_mult = WEATHER_DEMAND_MULTIPLIER[weather]
        event_mult = EVENT_DEMAND_MULTIPLIER[event]
        
        # Annual seasonality — slight sine wave
        day_of_year = current_date.timetuple().tm_yday
        seasonal = 1.0 + 0.08 * math.sin(2 * math.pi * (day_of_year - 30) / 365)
        
        # Determine meals for this day
        meals_today = ["lunch"]
        if dow < 5 and event != "holiday":  # Weekdays
            if random.random() < 0.40:   # ~40% of weekdays have dinner service (many order in)
                meals_today.append("dinner")
            if random.random() < 0.22:   # only ~22% have staffed breakfast
                meals_today.insert(0, "breakfast")
        elif dow == 5:  # Saturday — fewer students on campus
            if random.random() < 0.20:
                meals_today.append("dinner")
        # Sunday / holiday — lunch only, very sparse
        
        for canteen_name, items in FOOD_ITEMS.items():
            for item in items:
                # Skip some items some days (not every item every day)
                if random.random() > item["popularity"]:
                    continue
                
                for meal in meals_today:
                    meal_mult = MEAL_FRACTION[meal]
                    
                    # Real demand: base * all multipliers + noise
                    context_factor = dow_mult * weather_mult * event_mult * seasonal * meal_mult
                    actual_demand = int(
                        item["base_demand"] * context_factor * 
                        random.gauss(1.0, 0.15)  # 15% natural variance
                    )
                    actual_demand = max(0, actual_demand)
                    
                    # Staff overpreparation (the realistic waste source)
                    # Each item has its own bias — staples are calibrated, batch/premium items are not
                    item_overprep = item.get("overprep", OVERPREP_BIAS)
                    overprep_factor = 1.0 + item_overprep + random.gauss(0, 0.12)
                    overprep_factor = max(1.03, overprep_factor)  # at least 3% over
                    
                    prepared_qty = int(actual_demand * overprep_factor)
                    prepared_qty = max(10, prepared_qty)  # minimum batch size
                    
                    # Sold = actual demand but capped at prepared (can't sell what you don't have)
                    sold_qty = min(prepared_qty, actual_demand)
                    leftover_qty = prepared_qty - sold_qty
                    
                    waste_logs.append({
                        "canteen_name": canteen_name,
                        "item_name": item["name"],
                        "log_date": date_str,
                        "meal_type": meal,
                        "prepared_qty": prepared_qty,
                        "sold_qty": sold_qty,
                        "leftover_qty": leftover_qty,
                        "weather": weather,
                        "event": event,
                    })
    
    # Ingredients (current stock)
    ingredients = [
        {"canteen_name": "Main Canteen", "name": "Paneer", "qty_kg": 5, "days_ago": 4, "shelf_life_days": 5},
        {"canteen_name": "Main Canteen", "name": "Tomatoes", "qty_kg": 15, "days_ago": 3, "shelf_life_days": 7},
        {"canteen_name": "Main Canteen", "name": "Onions", "qty_kg": 20, "days_ago": 7, "shelf_life_days": 14},
        {"canteen_name": "Main Canteen", "name": "Rice (Basmati)", "qty_kg": 50, "days_ago": 5, "shelf_life_days": 90},
        {"canteen_name": "Main Canteen", "name": "Dal (Toor)", "qty_kg": 10, "days_ago": 6, "shelf_life_days": 60},
        {"canteen_name": "Main Canteen", "name": "Yogurt", "qty_kg": 8, "days_ago": 5, "shelf_life_days": 7},
        {"canteen_name": "Main Canteen", "name": "Cream", "qty_kg": 3, "days_ago": 4, "shelf_life_days": 5},
        {"canteen_name": "North Café", "name": "Bread (Sliced)", "qty_kg": 3, "days_ago": 2, "shelf_life_days": 3},
        {"canteen_name": "North Café", "name": "Cheese", "qty_kg": 2, "days_ago": 6, "shelf_life_days": 14},
        {"canteen_name": "North Café", "name": "Pasta Sheets", "qty_kg": 4, "days_ago": 1, "shelf_life_days": 30},
        {"canteen_name": "South Bistro", "name": "Noodles (Dried)", "qty_kg": 8, "days_ago": 10, "shelf_life_days": 60},
        {"canteen_name": "South Bistro", "name": "Capsicum", "qty_kg": 6, "days_ago": 3, "shelf_life_days": 5},
    ]
    
    for ing in ingredients:
        ing["purchase_date"] = (end_date - timedelta(days=ing.pop("days_ago"))).strftime("%Y-%m-%d")
    
    # Student votes (for tomorrow)
    tomorrow = (end_date + timedelta(days=1)).strftime("%Y-%m-%d")
    votes = []
    for items in FOOD_ITEMS.values():
        for item in items[:3]:  # top 3 per canteen
            votes.append({
                "canteen_name": item.get("canteen_name_ref", "Main Canteen"),
                "item_name": item["name"],
                "vote_date": tomorrow,
                "count": random.randint(10, 85),
            })
    
    return {
        "canteens": CANTEENS,
        "food_items": FOOD_ITEMS,
        "waste_logs": waste_logs,
        "ingredients": ingredients,
        "votes": votes,
    }


if __name__ == "__main__":
    data = generate_real_world_data(365)
    print(f"Generated {len(data['waste_logs'])} waste log entries over 365 days")
    
    # Quick stats
    total_prepared = sum(l["prepared_qty"] for l in data["waste_logs"])
    total_wasted = sum(l["leftover_qty"] for l in data["waste_logs"])
    print(f"Total prepared: {total_prepared:,} portions")
    print(f"Total wasted: {total_wasted:,} portions")
    print(f"Overall waste rate: {total_wasted / total_prepared * 100:.1f}%")

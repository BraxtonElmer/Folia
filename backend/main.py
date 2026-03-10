"""
Folia FastAPI Backend
All API endpoints for the Folia Campus Food Intelligence Platform.
"""

import os
import json
import re
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Query, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from db import supabase_get, supabase_post, supabase_patch, supabase_delete
from forecast_engine import forecast_engine
from importer import process_csv, ask_gemini

load_dotenv()

app = FastAPI(
    title="Folia API",
    description="Folia — Campus Food Intelligence Platform API",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ PYDANTIC MODELS ============

class WasteLogCreate(BaseModel):
    canteen_id: str
    item_id: str
    log_date: str
    meal_type: str
    prepared_qty: int
    sold_qty: int
    leftover_qty: int
    weather: str = "sunny"
    event: str = "normal"


class IngredientCreate(BaseModel):
    canteen_id: str
    name: str
    qty_kg: float
    purchase_date: str
    shelf_life_days: int


class VoteRequest(BaseModel):
    canteen_id: str
    item_id: str


class CanteenCreate(BaseModel):
    name: str
    location: str


class CanteenUpdate(BaseModel):
    name: str | None = None
    location: str | None = None


class FoodItemCreate(BaseModel):
    canteen_id: str
    name: str
    category: str
    cost_per_portion: float


class FoodItemUpdate(BaseModel):
    canteen_id: str | None = None
    name: str | None = None
    category: str | None = None
    cost_per_portion: float | None = None


class IngredientUpdate(BaseModel):
    name: str | None = None
    qty_kg: float | None = None
    purchase_date: str | None = None
    shelf_life_days: int | None = None


class ImportRow(BaseModel):
    canteen_id: str
    item_id: str
    log_date: str
    meal_type: str
    prepared_qty: int
    sold_qty: int
    leftover_qty: int
    weather: str = "sunny"
    event: str = "normal"


class ImportCommitBody(BaseModel):
    rows: list[ImportRow]


# ============ STARTUP ============

@app.on_event("startup")
async def startup():
    """Train forecasting model on startup."""
    try:
        logs = await supabase_get("waste_logs", {"select": "*", "order": "log_date.desc", "limit": "10000"})
        if logs:
            result = forecast_engine.train(logs)
            print(f"[Prophet] Trained: {result}")
        else:
            print("[Prophet] No data found — model not trained yet")
    except Exception as e:
        print(f"[Prophet] Training skipped: {e}")


# ============ HEALTH ============

@app.get("/")
async def root():
    return {"name": "Folia API", "status": "running", "model_trained": forecast_engine.is_trained}


# ============ CANTEENS ============

@app.get("/api/canteens")
async def get_canteens():
    return await supabase_get("canteens", {"select": "*", "order": "name"})


@app.post("/api/canteens")
async def create_canteen(canteen: CanteenCreate):
    return await supabase_post("canteens", canteen.model_dump())


@app.patch("/api/canteens/{canteen_id}")
async def update_canteen(canteen_id: str, canteen: CanteenUpdate):
    data = {k: v for k, v in canteen.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, "No fields to update")
    return await supabase_patch("canteens", data, {"id": f"eq.{canteen_id}"})


@app.delete("/api/canteens/{canteen_id}")
async def delete_canteen(canteen_id: str):
    await supabase_delete("canteens", {"id": f"eq.{canteen_id}"})
    return {"deleted": True}


# ============ FOOD ITEMS ============

@app.get("/api/items")
async def get_items(canteen_id: str = None):
    params: dict = {"select": "*", "order": "name"}
    if canteen_id and canteen_id != "all":
        params["canteen_id"] = f"eq.{canteen_id}"
    return await supabase_get("food_items", params)


@app.post("/api/items")
async def create_item(item: FoodItemCreate):
    return await supabase_post("food_items", item.model_dump())


@app.patch("/api/items/{item_id}")
async def update_item(item_id: str, item: FoodItemUpdate):
    data = {k: v for k, v in item.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, "No fields to update")
    return await supabase_patch("food_items", data, {"id": f"eq.{item_id}"})


@app.delete("/api/items/{item_id}")
async def delete_item(item_id: str):
    await supabase_delete("food_items", {"id": f"eq.{item_id}"})
    return {"deleted": True}


# ============ WASTE LOGS ============

@app.get("/api/logs")
async def get_logs(
    canteen_id: str = None,
    item_id: str = None,
    start_date: str = None,
    end_date: str = None,
    meal_type: str = None,
    limit: int = 200,
):
    params: dict = {"select": "*,food_items(name,category),canteens(name)", "order": "log_date.desc", "limit": str(limit)}
    if canteen_id and canteen_id != "all":
        params["canteen_id"] = f"eq.{canteen_id}"
    if item_id:
        params["item_id"] = f"eq.{item_id}"
    if meal_type:
        params["meal_type"] = f"eq.{meal_type}"
    # PostgREST range filter using `and` to avoid duplicate key collision
    if start_date and end_date:
        params["and"] = f"(log_date.gte.{start_date},log_date.lte.{end_date})"
    elif start_date:
        params["log_date"] = f"gte.{start_date}"
    elif end_date:
        params["log_date"] = f"lte.{end_date}"
    return await supabase_get("waste_logs", params)


@app.post("/api/logs")
async def create_log(log: WasteLogCreate):
    data = log.model_dump()
    return await supabase_post("waste_logs", data)


# ============ FORECAST ============

@app.get("/api/forecast")
async def get_forecast(
    canteen_id: str,
    target_date: str = None,
    weather: str = "sunny",
    event: str = "normal",
):
    if not target_date:
        target_date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

    # Get items for this canteen
    items = await supabase_get("food_items", {"canteen_id": f"eq.{canteen_id}", "select": "*"})
    
    # Get historical averages
    logs = await supabase_get("waste_logs", {
        "canteen_id": f"eq.{canteen_id}",
        "select": "item_id,prepared_qty,sold_qty",
        "order": "log_date.desc",
        "limit": "5000",
    })
    
    # Get votes
    votes = await supabase_get("student_votes", {
        "vote_date": f"eq.{target_date}",
        "select": "*",
    })
    
    # Calculate per-item averages
    item_avgs: dict[str, dict] = {}
    for log in logs:
        iid = log["item_id"]
        if iid not in item_avgs:
            item_avgs[iid] = {"total_prepared": 0, "count": 0}
        item_avgs[iid]["total_prepared"] += log["prepared_qty"]
        item_avgs[iid]["count"] += 1

    forecasts = []
    for item in items:
        avg_data = item_avgs.get(item["id"], {"total_prepared": 0, "count": 1})
        hist_avg = avg_data["total_prepared"] / max(avg_data["count"], 1)
        
        vote = next((v for v in votes if v["item_id"] == item["id"]), None)
        vote_count = vote["count"] if vote else 0
        
        prediction = forecast_engine.predict(
            item_id=item["id"],
            target_date=target_date,
            weather=weather,
            event=event,
            item_name=item["name"],
            historical_avg_prepared=hist_avg,
            vote_count=vote_count,
        )
        forecasts.append(prediction)
    
    return {
        "target_date": target_date,
        "canteen_id": canteen_id,
        "weather": weather,
        "event": event,
        "forecasts": forecasts,
        "model_trained": forecast_engine.is_trained,
    }


@app.post("/api/forecast/train")
async def train_model():
    """Re-train the forecasting model on latest data."""
    logs = await supabase_get("waste_logs", {"select": "*", "order": "log_date.desc", "limit": "10000"})
    if not logs:
        raise HTTPException(400, "No waste logs found to train on")
    result = forecast_engine.train(logs)
    return result


# ============ ANALYTICS ============

@app.get("/api/analytics/by-item")
async def analytics_by_item(canteen_id: str = None):
    params: dict = {"select": "item_id,prepared_qty,leftover_qty,food_items(name)", "order": "log_date.desc", "limit": "10000"}
    if canteen_id and canteen_id != "all":
        params["canteen_id"] = f"eq.{canteen_id}"
    logs = await supabase_get("waste_logs", params)
    
    stats: dict[str, dict] = {}
    for log in logs:
        iid = log["item_id"]
        name = log.get("food_items", {}).get("name", "Unknown") if isinstance(log.get("food_items"), dict) else "Unknown"
        if iid not in stats:
            stats[iid] = {"name": name, "prepared": 0, "wasted": 0}
        stats[iid]["prepared"] += log["prepared_qty"]
        stats[iid]["wasted"] += log["leftover_qty"]
    
    result = [
        {
            "name": s["name"],
            "waste_rate": round(s["wasted"] / max(s["prepared"], 1) * 100, 1),
            "total_wasted": s["wasted"],
        }
        for s in stats.values()
    ]
    return sorted(result, key=lambda x: x["waste_rate"], reverse=True)


@app.get("/api/analytics/by-day")
async def analytics_by_day(canteen_id: str = None):
    params: dict = {"select": "log_date,prepared_qty,leftover_qty", "order": "log_date.desc", "limit": "10000"}
    if canteen_id and canteen_id != "all":
        params["canteen_id"] = f"eq.{canteen_id}"
    logs = await supabase_get("waste_logs", params)
    
    dow_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    dow_stats = {i: {"prepared": 0, "wasted": 0} for i in range(7)}
    
    for log in logs:
        dow = datetime.strptime(log["log_date"], "%Y-%m-%d").weekday()
        dow_stats[dow]["prepared"] += log["prepared_qty"]
        dow_stats[dow]["wasted"] += log["leftover_qty"]
    
    return [
        {
            "day": dow_names[i],
            "waste_rate": round(s["wasted"] / max(s["prepared"], 1) * 100, 1),
        }
        for i, s in dow_stats.items()
    ]


@app.get("/api/analytics/trend")
async def analytics_trend(canteen_id: str = None, days: int = 90):
    params: dict = {"select": "log_date,prepared_qty,leftover_qty", "order": "log_date.desc", "limit": "10000"}
    if canteen_id and canteen_id != "all":
        params["canteen_id"] = f"eq.{canteen_id}"
    logs = await supabase_get("waste_logs", params)
    
    daily: dict[str, dict] = {}
    for log in logs:
        d = log["log_date"]
        if d not in daily:
            daily[d] = {"prepared": 0, "wasted": 0}
        daily[d]["prepared"] += log["prepared_qty"]
        daily[d]["wasted"] += log["leftover_qty"]
    
    result = [
        {
            "date": d,
            "waste_rate": round(s["wasted"] / max(s["prepared"], 1) * 100, 1),
            "prepared": s["prepared"],
            "wasted": s["wasted"],
        }
        for d, s in sorted(daily.items())
    ]
    return result[-days:]


@app.get("/api/analytics/heatmap")
async def analytics_heatmap(canteen_id: str = None):
    params: dict = {"select": "log_date,meal_type,prepared_qty,leftover_qty", "order": "log_date.desc", "limit": "10000"}
    if canteen_id and canteen_id != "all":
        params["canteen_id"] = f"eq.{canteen_id}"
    logs = await supabase_get("waste_logs", params)
    
    dow_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    meals = ["breakfast", "lunch", "dinner"]
    stats: dict[str, dict] = {}
    
    for d in dow_names:
        for m in meals:
            stats[f"{d}-{m}"] = {"prepared": 0, "wasted": 0}
    
    for log in logs:
        dow = dow_names[datetime.strptime(log["log_date"], "%Y-%m-%d").weekday()]
        key = f"{dow}-{log['meal_type']}"
        if key in stats:
            stats[key]["prepared"] += log["prepared_qty"]
            stats[key]["wasted"] += log["leftover_qty"]
    
    return [
        {
            "day": key.split("-")[0],
            "meal": key.split("-")[1],
            "waste_rate": round(s["wasted"] / max(s["prepared"], 1) * 100),
        }
        for key, s in stats.items()
    ]


# ============ ROI ============

CO2_PER_PORTION = 0.8
WATER_PER_PORTION = 150

@app.get("/api/roi")
async def get_roi(canteen_id: str = None, start_date: str = None, end_date: str = None):
    params: dict = {"select": "item_id,prepared_qty,sold_qty,leftover_qty,food_items(cost_per_portion)", "order": "log_date.desc", "limit": "10000"}
    if canteen_id and canteen_id != "all":
        params["canteen_id"] = f"eq.{canteen_id}"
    if start_date and end_date:
        params["and"] = f"(log_date.gte.{start_date},log_date.lte.{end_date})"
    elif start_date:
        params["log_date"] = f"gte.{start_date}"
    elif end_date:
        params["log_date"] = f"lte.{end_date}"
    
    logs = await supabase_get("waste_logs", params)
    
    total_prepared = sum(l["prepared_qty"] for l in logs)
    total_wasted = sum(l["leftover_qty"] for l in logs)
    total_sold = sum(l["sold_qty"] for l in logs)
    
    total_cost_wasted = sum(
        l["leftover_qty"] * (l.get("food_items", {}).get("cost_per_portion", 30) if isinstance(l.get("food_items"), dict) else 30)
        for l in logs
    )
    
    waste_pct = (total_wasted / max(total_prepared, 1)) * 100
    
    return {
        "total_wasted_portions": total_wasted,
        "total_cost_wasted": round(total_cost_wasted, 2),
        "total_cost_saved": round(total_cost_wasted * 0.5, 2),
        "co2_prevented": round(total_wasted * CO2_PER_PORTION * 0.5),
        "water_saved": round(total_wasted * WATER_PER_PORTION * 0.5),
        "meals_equivalent": total_wasted,
        "waste_percentage": round(waste_pct, 1),
    }


# ============ BIOGAS ============

# In-memory cache: item name (lowercase) → (biogas_category, kg_per_portion)
_biogas_name_cache: dict[str, tuple[str, float]] = {}

# Biogas yield m³ per metric ton of wet waste (EBA/IEA Bioenergy data)
_BIOGAS_YIELD: dict[str, float] = {
    "grains":     430,
    "vegetables": 350,
    "fruits":     380,
    "dairy":      520,
    "meat":       600,
    "bread":      470,
    "mixed":      400,
}

_BIOGAS_KWH_PER_M3 = 1.7   # micro-CHP at 35% electrical efficiency
_BIOGAS_CO2_PER_M3 = 1.9   # kg CO2 avoided vs landfill baseline


async def _classify_items_for_biogas(item_names: list[str]) -> None:
    """
    Use Gemini to classify food item names into biogas categories.
    Results are cached in _biogas_name_cache to avoid repeated API calls.
    """
    uncached = [n for n in item_names if n.lower() not in _biogas_name_cache]
    if not uncached:
        return

    prompt = f"""You are a biogas and food science expert. Classify each Indian canteen food item
into the most appropriate wet-waste anaerobic digestion category, and estimate the wet weight
in kilograms for one standard served portion.

Biogas categories:
- grains     : cooked rice, biryani, pulao, khichdi, poha, upma, idli, dosa, idiyappam, pongal
- vegetables : sabzi, dal, sambar, rasam, curry with vegetables, salad, kootu, avial
- fruits     : fresh fruit, fruit salad, juice
- dairy      : paneer dishes, lassi, milk, curd, raita, curd rice, kheer, payasam
- meat       : chicken, mutton, fish, egg, prawn, seafood dishes
- bread      : roti, chapati, naan, paratha, puri, bhatura, bread slices, bun
- mixed      : thali, combo meal, fried snacks (samosa, vada, pakoda), noodles, pasta, sandwich, soup

Items to classify: {json.dumps(uncached)}

Return ONLY valid JSON with no markdown fences, mapping each item name to:
  "category": one of grains/vegetables/fruits/dairy/meat/bread/mixed
  "kg_per_portion": float between 0.05 and 0.60

Example:
{{"Dal Tadka": {{"category": "vegetables", "kg_per_portion": 0.25}}, "Jeera Rice": {{"category": "grains", "kg_per_portion": 0.28}}}}"""

    try:
        raw = await ask_gemini(prompt)
        raw = re.sub(r"```[a-z]*\s*|```\s*", "", raw).strip()
        classifications = json.loads(raw)
        for name, info in classifications.items():
            cat = info.get("category", "mixed")
            if cat not in _BIOGAS_YIELD:
                cat = "mixed"
            kg = max(0.05, min(0.60, float(info.get("kg_per_portion", 0.25))))
            _biogas_name_cache[name.lower()] = (cat, kg)
    except Exception:
        # On Gemini failure, cache items as mixed/0.25 to avoid repeated failures
        for name in uncached:
            if name.lower() not in _biogas_name_cache:
                _biogas_name_cache[name.lower()] = ("mixed", 0.25)


@app.get("/api/biogas")
async def get_biogas_data(canteen_id: str = None, start_date: str = None, end_date: str = None):
    params: dict = {
        "select": "log_date,leftover_qty,food_items(name,category)",
        "order": "log_date.asc",
        "limit": "20000",
    }
    if canteen_id and canteen_id != "all":
        params["canteen_id"] = f"eq.{canteen_id}"
    if start_date and end_date:
        params["and"] = f"(log_date.gte.{start_date},log_date.lte.{end_date})"
    elif start_date:
        params["log_date"] = f"gte.{start_date}"
    elif end_date:
        params["log_date"] = f"lte.{end_date}"

    logs = await supabase_get("waste_logs", params)

    # Collect unique item names and classify via Gemini (with caching)
    unique_names = list({
        log["food_items"]["name"]
        for log in logs
        if isinstance(log.get("food_items"), dict) and log["food_items"].get("name")
    })
    await _classify_items_for_biogas(unique_names)

    category_kg: dict[str, float] = {k: 0.0 for k in _BIOGAS_YIELD}
    timeline: dict[str, dict] = {}

    for log in logs:
        food_item = log.get("food_items") or {}
        item_name = food_item.get("name", "") if isinstance(food_item, dict) else ""
        biogas_cat, kg_per_portion = _biogas_name_cache.get(item_name.lower(), ("mixed", 0.25))

        leftover = log.get("leftover_qty", 0) or 0
        kg = leftover * kg_per_portion
        category_kg[biogas_cat] += kg

        date = log.get("log_date", "unknown")
        if date not in timeline:
            timeline[date] = {"date": date, "total_kg": 0.0, "biogas_m3": 0.0, "kwh": 0.0, "co2_kg": 0.0}

        biogas_m3 = (kg / 1000) * _BIOGAS_YIELD[biogas_cat]
        timeline[date]["total_kg"] = round(timeline[date]["total_kg"] + kg, 3)
        timeline[date]["biogas_m3"] = round(timeline[date]["biogas_m3"] + biogas_m3, 4)
        timeline[date]["kwh"] = round(timeline[date]["kwh"] + biogas_m3 * _BIOGAS_KWH_PER_M3, 4)
        timeline[date]["co2_kg"] = round(timeline[date]["co2_kg"] + biogas_m3 * _BIOGAS_CO2_PER_M3, 4)

    total_biogas_m3 = sum(
        (kg / 1000) * _BIOGAS_YIELD[cat]
        for cat, kg in category_kg.items()
    )

    return {
        "summary": {
            "total_kg": round(sum(category_kg.values()), 2),
            "by_category": {k: round(v, 2) for k, v in category_kg.items()},
            "total_biogas_m3": round(total_biogas_m3, 3),
            "total_kwh": round(total_biogas_m3 * _BIOGAS_KWH_PER_M3, 3),
            "total_co2_kg": round(total_biogas_m3 * _BIOGAS_CO2_PER_M3, 3),
        },
        "timeline": sorted(timeline.values(), key=lambda x: x["date"]),
    }


# ============ EXPIRY ALERTS ============

DISH_MAP = {
    "Paneer": ["Paneer Butter Masala", "Shahi Paneer", "Paneer Tikka"],
    "Tomatoes": ["Dal Tadka", "Gravy Dishes", "Pasta Sauce"],
    "Yogurt": ["Raita", "Lassi", "Dahi Chawal"],
    "Bread (Sliced)": ["Sandwiches", "French Toast", "Bread Pakora"],
    "Cheese": ["Pasta", "Grilled Sandwich", "Pizza"],
    "Cream": ["Paneer Butter Masala", "Dal Makhani", "Desserts"],
    "Capsicum": ["Fried Rice", "Manchurian", "Noodles"],
    "Onions": ["All Curries", "Biryani", "Fried Rice"],
}

@app.get("/api/expiry")
async def get_expiry_alerts(canteen_id: str = None):
    params: dict = {"select": "*", "order": "purchase_date"}
    if canteen_id and canteen_id != "all":
        params["canteen_id"] = f"eq.{canteen_id}"
    ingredients = await supabase_get("ingredients", params)
    
    today = datetime.now().date()
    alerts = []
    
    for ing in ingredients:
        purchase = datetime.strptime(ing["purchase_date"], "%Y-%m-%d").date()
        expiry = purchase + timedelta(days=ing["shelf_life_days"])
        days_left = (expiry - today).days
        
        risk = "critical" if days_left <= 1 else "warning" if days_left <= 3 else "safe"
        suggestions = DISH_MAP.get(ing["name"], ["General cooking"])
        
        alerts.append({
            "ingredient": ing,
            "days_remaining": days_left,
            "risk_level": risk,
            "suggested_dishes": suggestions,
        })
    
    return sorted(alerts, key=lambda x: x["days_remaining"])


@app.post("/api/ingredients")
async def add_ingredient(ing: IngredientCreate):
    return await supabase_post("ingredients", ing.model_dump())


@app.patch("/api/ingredients/{ingredient_id}")
async def update_ingredient(ingredient_id: str, ing: IngredientUpdate):
    data = {k: v for k, v in ing.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, "No fields to update")
    return await supabase_patch("ingredients", data, {"id": f"eq.{ingredient_id}"})


@app.delete("/api/ingredients/{ingredient_id}")
async def delete_ingredient(ingredient_id: str):
    await supabase_delete("ingredients", {"id": f"eq.{ingredient_id}"})
    return {"deleted": True}


# ============ MENU SUGGESTIONS ============

@app.get("/api/menu-suggest")
async def get_menu_suggestions(canteen_id: str):
    params = {
        "canteen_id": f"eq.{canteen_id}",
        "select": "item_id,log_date,prepared_qty,leftover_qty,food_items(name,category)",
        "order": "log_date.desc",
        "limit": "5000",
    }
    logs = await supabase_get("waste_logs", params)
    
    dow_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    item_stats: dict[str, dict] = {}
    
    for log in logs:
        iid = log["item_id"]
        name = log.get("food_items", {}).get("name", "Unknown") if isinstance(log.get("food_items"), dict) else "Unknown"
        cat = log.get("food_items", {}).get("category", "") if isinstance(log.get("food_items"), dict) else ""
        
        if iid not in item_stats:
            item_stats[iid] = {"name": name, "category": cat, "total_p": 0, "total_w": 0, "by_dow": {}}
        
        dow = datetime.strptime(log["log_date"], "%Y-%m-%d").weekday()
        if dow not in item_stats[iid]["by_dow"]:
            item_stats[iid]["by_dow"][dow] = {"p": 0, "w": 0}
        
        item_stats[iid]["total_p"] += log["prepared_qty"]
        item_stats[iid]["total_w"] += log["leftover_qty"]
        item_stats[iid]["by_dow"][dow]["p"] += log["prepared_qty"]
        item_stats[iid]["by_dow"][dow]["w"] += log["leftover_qty"]
    
    suggestions = []
    for iid, s in item_stats.items():
        waste_rate = round(s["total_w"] / max(s["total_p"], 1) * 100, 1)
        
        best_day, worst_day = "N/A", "N/A"
        best_r, worst_r = 100, 0
        for d, ds in s["by_dow"].items():
            r = ds["w"] / max(ds["p"], 1) * 100
            if r < best_r: best_r, best_day = r, dow_names[d]
            if r > worst_r: worst_r, worst_day = r, dow_names[d]
        
        # Find replacement
        replacement = None
        replacement_rate = None
        if waste_rate > 25:
            for oid, os in item_stats.items():
                if oid == iid or os["category"] != s["category"]:
                    continue
                or_ = os["total_w"] / max(os["total_p"], 1) * 100
                if or_ < waste_rate - 10:
                    replacement = os["name"]
                    replacement_rate = round(or_, 1)
                    break
        
        suggestions.append({
            "item_id": iid,
            "item_name": s["name"],
            "waste_rate": waste_rate,
            "best_day": best_day,
            "worst_day": worst_day,
            "suggested_replacement": replacement,
            "replacement_waste_rate": replacement_rate,
        })
    
    return sorted(suggestions, key=lambda x: x["waste_rate"], reverse=True)


# ============ BENCHMARKING ============

@app.get("/api/benchmark")
async def get_benchmarks():
    canteens = await supabase_get("canteens", {"select": "*"})
    
    results = []
    for canteen in canteens:
        logs = await supabase_get("waste_logs", {
            "canteen_id": f"eq.{canteen['id']}",
            "select": "log_date,prepared_qty,leftover_qty",
            "order": "log_date.desc",
            "limit": "5000",
        })
        
        total_p = sum(l["prepared_qty"] for l in logs)
        total_w = sum(l["leftover_qty"] for l in logs)
        avg_rate = round(total_w / max(total_p, 1) * 100, 1)
        
        # Trend: last 7 vs previous 7 days
        dates = sorted(set(l["log_date"] for l in logs), reverse=True)
        recent = set(dates[:7])
        previous = set(dates[7:14])
        
        recent_logs = [l for l in logs if l["log_date"] in recent]
        prev_logs = [l for l in logs if l["log_date"] in previous]
        
        r_rate = sum(l["leftover_qty"] for l in recent_logs) / max(sum(l["prepared_qty"] for l in recent_logs), 1) * 100
        p_rate = sum(l["leftover_qty"] for l in prev_logs) / max(sum(l["prepared_qty"] for l in prev_logs), 1) * 100
        
        trend = "improving" if r_rate < p_rate - 2 else "worsening" if r_rate > p_rate + 2 else "stable"
        
        results.append({
            "canteen_id": canteen["id"],
            "canteen_name": canteen["name"],
            "avg_waste_rate": avg_rate,
            "total_waste": total_w,
            "trend": trend,
        })
    
    return results


# ============ STUDENT VOTES ============

@app.get("/api/votes")
async def get_votes(date: str = None):
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    vote_date = date or tomorrow
    return await supabase_get("student_votes", {
        "vote_date": f"eq.{vote_date}",
        "select": "*,food_items(name,category,cost_per_portion),canteens(name)",
    })


@app.post("/api/votes")
async def cast_vote(vote: VoteRequest):
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    
    # Try to update existing
    existing = await supabase_get("student_votes", {
        "item_id": f"eq.{vote.item_id}",
        "vote_date": f"eq.{tomorrow}",
    })
    
    if existing:
        new_count = existing[0]["count"] + 1
        await supabase_patch("student_votes", {"count": new_count}, {
            "item_id": f"eq.{vote.item_id}",
            "vote_date": f"eq.{tomorrow}",
        })
        return {"status": "updated", "count": new_count}
    else:
        await supabase_post("student_votes", {
            "canteen_id": vote.canteen_id,
            "item_id": vote.item_id,
            "vote_date": tomorrow,
            "count": 1,
        })
        return {"status": "created", "count": 1}


# ============ WEEKLY REPORT ============

@app.get("/api/report")
async def get_weekly_report(canteen_id: str):
    logs = await supabase_get("waste_logs", {
        "canteen_id": f"eq.{canteen_id}",
        "select": "item_id,log_date,prepared_qty,sold_qty,leftover_qty,food_items(name,cost_per_portion)",
        "order": "log_date.desc",
        "limit": "5000",
    })
    
    dates = sorted(set(l["log_date"] for l in logs), reverse=True)
    week_dates = set(dates[:7])
    
    week_logs = [l for l in logs if l["log_date"] in week_dates]
    total_p = sum(l["prepared_qty"] for l in week_logs)
    total_w = sum(l["leftover_qty"] for l in week_logs)
    
    cost_wasted = sum(
        l["leftover_qty"] * (l.get("food_items", {}).get("cost_per_portion", 30) if isinstance(l.get("food_items"), dict) else 30)
        for l in week_logs
    )
    
    # Item waste rates
    item_waste: dict[str, dict] = {}
    for l in week_logs:
        iid = l["item_id"]
        name = l.get("food_items", {}).get("name", "Unknown") if isinstance(l.get("food_items"), dict) else "Unknown"
        if iid not in item_waste:
            item_waste[iid] = {"name": name, "p": 0, "w": 0}
        item_waste[iid]["p"] += l["prepared_qty"]
        item_waste[iid]["w"] += l["leftover_qty"]
    
    items_sorted = sorted(
        [{"name": v["name"], "waste_rate": round(v["w"] / max(v["p"], 1) * 100)} for v in item_waste.values()],
        key=lambda x: x["waste_rate"],
        reverse=True,
    )
    
    return {
        "week_start": min(week_dates) if week_dates else "",
        "week_end": max(week_dates) if week_dates else "",
        "total_prepared": total_p,
        "total_wasted": total_w,
        "waste_rate": round(total_w / max(total_p, 1) * 100, 1),
        "cost_saved": round(cost_wasted * 0.5, 2),
        "worst_items": items_sorted[:5],
        "best_items": list(reversed(items_sorted[-3:])),
    }


# ============ CSV IMPORT ============

@app.post("/api/import/preview")
async def import_preview(
    file: UploadFile = File(...),
    canteen_id: str = Form(...),
):
    """
    Accept a CSV upload, call Gemini to detect columns, transform rows,
    and return a preview (no DB writes). Matched items are resolved by name.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only .csv files are supported")

    csv_bytes = await file.read()
    if len(csv_bytes) > 10 * 1024 * 1024:  # 10 MB guard
        raise HTTPException(413, "File too large (max 10 MB)")

    items = await supabase_get("food_items", {
        "canteen_id": f"eq.{canteen_id}",
        "select": "id,name",
    })
    item_name_to_id = {item["name"]: item["id"] for item in items}

    try:
        result = await process_csv(csv_bytes, canteen_id, item_name_to_id)
    except Exception as e:
        raise HTTPException(500, f"Import processing failed: {e}")

    # Expose full item list so the frontend can render mapping dropdowns
    result["available_items"] = [{"id": item["id"], "name": item["name"]} for item in items]
    return result


@app.post("/api/import/commit")
async def import_commit(body: ImportCommitBody):
    """Insert the confirmed rows (already matched) into waste_logs in batches."""
    if not body.rows:
        raise HTTPException(400, "No rows provided")

    records = [r.model_dump() for r in body.rows]

    inserted = 0
    errors: list[str] = []
    batch_size = 200

    for i in range(0, len(records), batch_size):
        batch = records[i: i + batch_size]
        try:
            await supabase_post("waste_logs", batch)
            inserted += len(batch)
        except Exception as e:
            errors.append(f"Batch {i // batch_size + 1}: {e}")

    return {"inserted": inserted, "errors": errors}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))

# Folia

**Campus Food Intelligence Platform** — A full-stack system for tracking, analysing, and reducing food waste in university canteens. Built with a FastAPI backend, a Next.js frontend, Supabase as the database layer, and Facebook Prophet for demand forecasting.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Models and Analytics](#models-and-analytics)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running Locally](#running-locally)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)

---

## Overview

Folia gives campus canteen managers a single interface to:

- Log daily food preparation vs. actual sales
- Identify high-waste items and patterns across days, meals, and weather conditions
- Receive AI-generated preparation quantity recommendations for tomorrow
- Track ingredient expiry and get dish suggestions before stock goes to waste
- Benchmark canteens against each other
- Generate weekly waste reports
- Let students vote on next-day menu items to improve demand signal accuracy

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Next.js 14 (App Router)  — frontend/                │
│  React, Recharts, CSS custom properties              │
└────────────────────────┬─────────────────────────────┘
                         │ HTTP (REST)
┌────────────────────────▼─────────────────────────────┐
│  FastAPI  — backend/main.py                          │
│  Uvicorn ASGI server                                 │
│  Prophet forecasting engine  — forecast_engine.py    │
└────────────────────────┬─────────────────────────────┘
                         │ HTTP (PostgREST)
┌────────────────────────▼─────────────────────────────┐
│  Supabase (PostgreSQL)                               │
│  Tables: canteens, food_items, waste_logs,           │
│          ingredients, student_votes                  │
└──────────────────────────────────────────────────────┘
```

---

## Models and Analytics

### Demand Forecasting — Facebook Prophet

Prophet is an open-source time-series forecasting library by Meta. Folia trains one Prophet model **per food item** on historical daily sold quantities.

**Why Prophet?**
- Handles missing data and irregular time series without pre-processing
- Decomposes automatically into trend, weekly seasonality, and yearly seasonality
- Supports custom regressors for external signals (weather, campus events)
- Robust to outliers caused by exam weeks and festival spikes

**How it works in Folia:**

1. **Training data** — All waste log records are aggregated to one row per `(item_id, log_date)`, summing quantities across meal types. This gives a clean daily demand series per item.

2. **Regressors** — Six binary contextual features are added as external regressors:
   - `is_rainy`, `is_cold` — weather conditions
   - `is_exam`, `is_fest`, `is_holiday` — campus calendar events

3. **Model configuration:**
   ```
   yearly_seasonality  = True    captures annual patterns (monsoon, academic calendar)
   weekly_seasonality  = True    captures Mon–Sun demand rhythm
   daily_seasonality   = False   not enough intra-day granularity in this dataset
   changepoint_prior   = 0.05    conservative, avoids overfitting sparse campus data
   interval_width      = 0.80    80% confidence interval for preparation bounds
   ```

4. **Prediction** — For a given target date and context, Prophet returns a point estimate (`yhat`) and confidence bounds (`yhat_lower`, `yhat_upper`). A 5% safety buffer is added so the prediction errs slightly toward over-preparation rather than stockout.

5. **Vote fusion** — If at least 10 student votes exist for the target date, they are blended into the prediction with up to 30% weight. This anchors the model to actual expressed demand signals.

6. **Context multipliers** — Manual multipliers are applied on top of the model for extreme events with few historical examples (e.g. `holiday = 0.30×`, `fest = 1.35×`).

7. **Fallback** — Items with fewer than 14 historical data points use a weighted average fallback: `historical_avg × context_multiplier × 0.75`.

8. **Confidence levels** — `high` (≥ 60 training points), `medium` (25–59), `low` (< 25 or fallback mode).

### Analytics Modules

| Analysis | Method | Insight |
|---|---|---|
| Waste rate by item | `leftover / prepared × 100` aggregated per item | Identifies the highest-waste foods to reduce portion size or preparation frequency |
| Waste rate by day of week | Same ratio grouped by `weekday()` | Reveals structural patterns — e.g., attendance drops on Fridays and weekends |
| Waste trend over time | Daily aggregated waste rates over a configurable window (30/60/90/365 days) | Shows whether interventions are having a measurable effect over time |
| Waste heatmap (day × meal) | Waste rate per `(weekday, meal_type)` cell | Pinpoints the exact sessions with highest waste — e.g., Sunday dinner |
| Menu suggestions | Per-item waste rate broken down by day of week | Recommends which items to reduce or remove on high-waste days |
| ROI and environmental impact | `portions_wasted × cost_per_portion`, CO₂ at 0.8 kg/portion, water at 150 L/portion | Converts waste data into financial cost and environmental equivalents |
| Benchmarking | Cross-canteen comparison of waste rates, cost, and item breakdowns | Identifies best-performing canteens so their practices can be replicated |
| Expiry alerts | `expiry_date = purchase_date + shelf_life_days`, `days_remaining = expiry − today` | Flags ingredients near expiry (critical ≤ 1 day, warning ≤ 3 days) with dish suggestions |

### Realistic Seed Data

The seed generator (`seed_data.py`) produces 365 days of realistic canteen logs based on:

- **Staff overpreparation bias** — Staff typically prepare 15–35% more than expected demand (the primary structural source of institutional food waste)
- **Day-of-week multipliers** — Mon–Sun attendance patterns modelled on Indian university behaviour
- **Seasonal weather** — Monthly weather probability distributions for the Indian climate (monsoon June–September, winter November–February)
- **Indian academic calendar** — Exam weeks, Diwali, Holi, national holidays, and tech/cultural fests
- **Annual seasonality** — A sine-wave trend modelling slight demand oscillation over the year
- **Gaussian noise (σ = 15%)** — Natural day-to-day demand variance

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier is sufficient)

---

## Environment Variables

### Backend — `backend/.env`

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
CORS_ORIGINS=http://localhost:3000
```

### Frontend — `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Database Setup

1. Open your Supabase project's SQL editor.
2. Run the full contents of `backend/schema.sql`. This creates all tables, indexes, and Row Level Security policies.
3. Seed the database:

```bash
cd backend
pip install -r requirements.txt
python seed_to_supabase.py
```

To wipe all existing data and reseed from scratch:

```bash
python seed_to_supabase.py --force
```

---

## Running Locally

### Backend

```bash
cd backend

python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API is available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

On startup, the server automatically trains Prophet models on all available waste log data. To manually retrain after adding new data:

```bash
curl -X POST http://localhost:8000/api/forecast/train
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

---

## API Reference

All endpoints are prefixed with `/api`. The root `/` returns a health check with model status.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/canteens` | List all canteens |
| `GET` | `/api/items` | List food items; filter with `?canteen_id=` |
| `GET` | `/api/logs` | Waste logs; filters: `canteen_id`, `item_id`, `meal_type`, `start_date`, `end_date`, `limit` |
| `POST` | `/api/logs` | Create a new waste log entry |
| `GET` | `/api/forecast` | Prophet demand forecast; params: `canteen_id`, `weather`, `event`, `target_date` |
| `POST` | `/api/forecast/train` | Retrain Prophet models on current database data |
| `GET` | `/api/analytics/by-item` | Waste rate aggregated per food item |
| `GET` | `/api/analytics/by-day` | Waste rate by day of week |
| `GET` | `/api/analytics/trend` | Daily waste rate trend; param: `days` (default 90) |
| `GET` | `/api/analytics/heatmap` | Waste rate for each `(day, meal)` combination |
| `GET` | `/api/roi` | Financial and environmental impact metrics |
| `GET` | `/api/expiry` | Ingredient expiry alerts sorted by urgency |
| `POST` | `/api/ingredients` | Add a new ingredient to inventory |
| `GET` | `/api/menu-suggest` | Per-item menu optimisation recommendations |

---

## Project Structure

```
Folia/
├── backend/
│   ├── main.py              # FastAPI application and all route handlers
│   ├── forecast_engine.py   # Prophet model training, prediction, and fallback logic
│   ├── db.py                # Supabase PostgREST HTTP client
│   ├── schema.sql           # PostgreSQL schema with RLS policies
│   ├── seed_data.py         # Realistic waste data generator (365 days)
│   ├── seed_to_supabase.py  # Database seeding script with --force flag
│   ├── run_schema.py        # Schema runner utility
│   └── requirements.txt     # Python dependencies
└── frontend/
    ├── app/
    │   ├── page.tsx             # Dashboard overview (14-day avg, ROI, top wasters)
    │   ├── analytics/           # Waste analytics with day, item, trend, and heatmap views
    │   ├── forecast/            # Prophet demand forecast UI with context controls
    │   ├── log/                 # Waste log entry form and sortable history table
    │   ├── expiry/              # Ingredient expiry alerts with dish suggestions
    │   ├── menu/                # Menu optimisation recommendations
    │   ├── roi/                 # ROI and environmental impact calculator
    │   ├── benchmark/           # Cross-canteen benchmarking
    │   ├── vote/                # Student menu voting
    │   ├── report/              # Weekly report generation
    │   ├── components/          # Shared UI (DashboardLayout, Sidebar)
    │   └── lib/                 # API client, data hooks, shared types
    ├── package.json
    └── next.config.ts
```


To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

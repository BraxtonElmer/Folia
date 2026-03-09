# Folia

Food waste intelligence for campus canteens.

Folia lets canteen managers log daily prep and leftover quantities, then uses time-series forecasting to predict how much to prepare tomorrow — per item, meal type, and context like weather or upcoming events.

Built for HackForge 2026.

---

## Stack

- **Frontend** — Next.js 16 (App Router), Recharts, Lucide React
- **Backend** — FastAPI, Uvicorn
- **ML** — Facebook Prophet, pandas, scikit-learn
- **Database** — Supabase (PostgreSQL via PostgREST)

The backend trains a separate Prophet model per food item at startup. Regressors include weather conditions (`rainy`, `cold`, `hot`) and academic calendar events (`exam`, `fest`, `holiday`). Student vote data for the target date is fused as a demand signal on top of the point estimate.

---

## Getting Started

You need Node.js 18+, Python 3.11+, and a Supabase project (free tier works fine).

### Database

Run `backend/schema.sql` from the SQL Editor in your Supabase dashboard. This creates five tables — `canteens`, `food_items`, `waste_logs`, `ingredients`, `student_votes` — with RLS and public read/write policies already configured.

### Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file:

```env
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-service-role-jwt>
PORT=8000
CORS_ORIGINS=http://localhost:3000
```

> **Note:** Use the service role key, not the anon key — the seeder needs write access.

Seed one year of realistic canteen data:

```bash
python seed_to_supabase.py
```

Start the API:

```bash
uvicorn main:app --reload --port 8000
```

Startup takes 15–30 seconds while Prophet trains per item. Stan chain logs will show up in the console — that's normal.

### Frontend

```bash
cd frontend
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
npm run dev
```

Dashboard at `http://localhost:3000`. Student vote portal (no login) at `/vote`.

---

## API

Interactive docs at `http://localhost:8000/docs`.

| Endpoint | Description |
|---|---|
| `GET /api/canteens` | List canteens |
| `GET /api/items` | List food items |
| `GET /api/logs` | Waste logs with filters |
| `POST /api/logs` | Submit a waste log |
| `GET /api/forecast` | Prophet predictions for a canteen + date |
| `GET /api/analytics/by-item` | Waste rate per item |
| `GET /api/analytics/by-day` | Waste rate by day of week |
| `GET /api/analytics/trend` | Daily waste rate over time |
| `GET /api/analytics/heatmap` | Item-by-weekday waste heatmap |
| `GET /api/roi` | Financial and sustainability metrics |
| `GET /api/expiry` | Ingredient expiry risk |
| `POST /api/ingredients` | Add an ingredient |
| `GET /api/menu-suggest` | Swap recommendations for high-waste items |
| `GET /api/benchmark` | Cross-canteen waste comparison |
| `GET /api/votes` | Student vote counts |
| `POST /api/votes` | Cast a vote |
| `GET /api/report` | Weekly summary |

---

## Deploying

### Frontend — Vercel

Import the repo on [vercel.com/new](https://vercel.com/new), set the root directory to `frontend`, add `NEXT_PUBLIC_API_URL` pointing to your backend, and deploy.

### Backend — Render or Railway

Prophet models are kept in memory between requests, so this needs a persistent server — not a serverless function.

On [Render](https://render.com), create a Web Service, set root to `backend`, start command:

```
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `CORS_ORIGINS` as environment variables.

---

## License

MIT

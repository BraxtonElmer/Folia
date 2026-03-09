-- ============================================
-- ZeroWaste: Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Canteens
CREATE TABLE IF NOT EXISTS canteens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Food Items
CREATE TABLE IF NOT EXISTS food_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  canteen_id UUID REFERENCES canteens(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  cost_per_portion NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Waste Logs
CREATE TABLE IF NOT EXISTS waste_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  canteen_id UUID REFERENCES canteens(id) ON DELETE CASCADE,
  item_id UUID REFERENCES food_items(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  prepared_qty INTEGER NOT NULL DEFAULT 0,
  sold_qty INTEGER NOT NULL DEFAULT 0,
  leftover_qty INTEGER NOT NULL DEFAULT 0,
  weather TEXT DEFAULT 'sunny' CHECK (weather IN ('sunny', 'rainy', 'cold')),
  event TEXT DEFAULT 'normal' CHECK (event IN ('normal', 'exam', 'fest', 'holiday')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ingredients Inventory
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  canteen_id UUID REFERENCES canteens(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qty_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
  purchase_date DATE NOT NULL,
  shelf_life_days INTEGER NOT NULL DEFAULT 7,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student Votes
CREATE TABLE IF NOT EXISTS student_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  canteen_id UUID REFERENCES canteens(id) ON DELETE CASCADE,
  item_id UUID REFERENCES food_items(id) ON DELETE CASCADE,
  vote_date DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, vote_date)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_waste_logs_date ON waste_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_waste_logs_canteen ON waste_logs(canteen_id);
CREATE INDEX IF NOT EXISTS idx_waste_logs_item ON waste_logs(item_id);
CREATE INDEX IF NOT EXISTS idx_food_items_canteen ON food_items(canteen_id);
CREATE INDEX IF NOT EXISTS idx_student_votes_date ON student_votes(vote_date);

-- Enable Row Level Security
ALTER TABLE canteens ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_votes ENABLE ROW LEVEL SECURITY;

-- Public read access policies (for hackathon demo)
CREATE POLICY "Public read canteens" ON canteens FOR SELECT USING (true);
CREATE POLICY "Public read food_items" ON food_items FOR SELECT USING (true);
CREATE POLICY "Public read waste_logs" ON waste_logs FOR SELECT USING (true);
CREATE POLICY "Public read ingredients" ON ingredients FOR SELECT USING (true);
CREATE POLICY "Public read student_votes" ON student_votes FOR SELECT USING (true);

-- Write access policies (server-side via anon/service key)
CREATE POLICY "Public insert canteens" ON canteens FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update canteens" ON canteens FOR UPDATE USING (true);
CREATE POLICY "Public delete canteens" ON canteens FOR DELETE USING (true);

CREATE POLICY "Public insert food_items" ON food_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update food_items" ON food_items FOR UPDATE USING (true);
CREATE POLICY "Public delete food_items" ON food_items FOR DELETE USING (true);

CREATE POLICY "Public insert waste_logs" ON waste_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update waste_logs" ON waste_logs FOR UPDATE USING (true);
CREATE POLICY "Public delete waste_logs" ON waste_logs FOR DELETE USING (true);

CREATE POLICY "Public insert ingredients" ON ingredients FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update ingredients" ON ingredients FOR UPDATE USING (true);
CREATE POLICY "Public delete ingredients" ON ingredients FOR DELETE USING (true);

CREATE POLICY "Public insert student_votes" ON student_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update student_votes" ON student_votes FOR UPDATE USING (true);
CREATE POLICY "Public delete student_votes" ON student_votes FOR DELETE USING (true);

-- Public write access policies (for hackathon demo)
CREATE POLICY "Public insert waste_logs" ON waste_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert ingredients" ON ingredients FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert student_votes" ON student_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update student_votes" ON student_votes FOR UPDATE USING (true);

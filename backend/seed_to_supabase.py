"""
Seed the Supabase database with realistic canteen data for Folia.
Run this once to populate the database with 365 days of waste logs.

Usage:
  python seed_to_supabase.py          # Skip if data already exists
  python seed_to_supabase.py --force  # Wipe and reseed from scratch
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from dotenv import load_dotenv

load_dotenv()

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import supabase_get, supabase_post, supabase_delete
from seed_data import generate_real_world_data, FOOD_ITEMS


async def seed(force: bool = False):
    print("[Folia] Starting database seed...")
    if force:
        print("[!] --force flag set: clearing existing data...")
        for table in ["student_votes", "waste_logs", "ingredients", "food_items", "canteens"]:
            try:
                await supabase_delete(table, {"id": "neq.00000000-0000-0000-0000-000000000000"})
                print(f"   Cleared table: {table}")
            except Exception as e:
                print(f"   [!] Could not clear {table}: {e}")

    data = generate_real_world_data(365)
    
    # 1. Create canteens
    print("\n[1] Creating canteens...")
    canteens_response = await supabase_get("canteens", {"select": "id,name"})
    
    if canteens_response:
        print(f"   Found {len(canteens_response)} existing canteens, skipping...")
        canteen_map = {c["name"]: c["id"] for c in canteens_response}
    else:
        result = await supabase_post("canteens", data["canteens"])
        canteen_map = {c["name"]: c["id"] for c in result}
        print(f"   [+] Created {len(result)} canteens")
    
    print(f"   Canteen mapping: {canteen_map}")
    
    # 2. Create food items
    print("\n[2] Creating food items...")
    existing_items = await supabase_get("food_items", {"select": "id,name,canteen_id"})
    
    if existing_items:
        print(f"   Found {len(existing_items)} existing items, skipping...")
        item_map = {f"{i['canteen_id']}:{i['name']}": i["id"] for i in existing_items}
    else:
        items_to_insert = []
        for canteen_name, items in FOOD_ITEMS.items():
            cid = canteen_map.get(canteen_name)
            if not cid:
                print(f"   [!] Canteen '{canteen_name}' not found, skipping items")
                continue
            for item in items:
                items_to_insert.append({
                    "canteen_id": cid,
                    "name": item["name"],
                    "category": item["category"],
                    "cost_per_portion": item["cost"],
                })
        
        result = await supabase_post("food_items", items_to_insert)
        item_map = {f"{i['canteen_id']}:{i['name']}": i["id"] for i in result}
        print(f"   [+] Created {len(result)} food items")
    
    # Build name-to-ID lookup (canteen_name:item_name -> item_id)
    name_to_item_id: dict[str, str] = {}
    for key, iid in item_map.items():
        # key is canteen_uuid:item_name
        parts = key.split(":", 1)
        if len(parts) == 2:
            name_to_item_id[parts[1]] = iid
    
    # Also build by canteen name
    canteen_id_to_name = {v: k for k, v in canteen_map.items()}
    for key, iid in item_map.items():
        parts = key.split(":", 1)
        if len(parts) == 2:
            cid = parts[0]
            cname = canteen_id_to_name.get(cid, "")
            name_to_item_id[f"{cname}:{parts[1]}"] = iid
    
    # 3. Insert waste logs in batches — skip if data already exists
    print(f"\n[3] Checking waste logs...")
    existing_logs_check = await supabase_get("waste_logs", {"select": "id", "limit": "1"})
    if existing_logs_check and not force:
        print(f"   Found existing waste log data, skipping insert. Use --force to reseed.")
        inserted = 0
        logs_to_insert = []
    else:
        print(f"   Inserting {len(data['waste_logs'])} waste log entries...")

        logs_to_insert = []
        skipped = 0
        for log in data["waste_logs"]:
            cid = canteen_map.get(log["canteen_name"])
            iid = name_to_item_id.get(f"{log['canteen_name']}:{log['item_name']}") or name_to_item_id.get(log["item_name"])

            if not cid or not iid:
                skipped += 1
                continue

            logs_to_insert.append({
                "canteen_id": cid,
                "item_id": iid,
                "log_date": log["log_date"],
                "meal_type": log["meal_type"],
                "prepared_qty": log["prepared_qty"],
                "sold_qty": log["sold_qty"],
                "leftover_qty": log["leftover_qty"],
                "weather": log["weather"],
                "event": log["event"],
            })

        if skipped:
            print(f"   [!] Skipped {skipped} entries (missing canteen/item mapping)")

        # Insert in batches of 500
        batch_size = 500
        inserted = 0
        for i in range(0, len(logs_to_insert), batch_size):
            batch = logs_to_insert[i:i + batch_size]
            try:
                await supabase_post("waste_logs", batch)
                inserted += len(batch)
                pct = int(inserted / len(logs_to_insert) * 100)
                print(f"   [.] Inserted {inserted}/{len(logs_to_insert)} ({pct}%)")
            except Exception as e:
                print(f"   [X] Batch error at {i}: {e}")
                for j in range(0, len(batch), 50):
                    mini = batch[j:j+50]
                    try:
                        await supabase_post("waste_logs", mini)
                        inserted += len(mini)
                    except Exception as e2:
                        print(f"   [X] Mini-batch error: {e2}")

        print(f"   [+] Inserted {inserted} waste log entries")
    
    # 4. Insert ingredients
    print("\n[4] Creating ingredient inventory...")
    ingredients_to_insert = []
    for ing in data["ingredients"]:
        cid = canteen_map.get(ing["canteen_name"])
        if cid:
            ingredients_to_insert.append({
                "canteen_id": cid,
                "name": ing["name"],
                "qty_kg": ing["qty_kg"],
                "purchase_date": ing["purchase_date"],
                "shelf_life_days": ing["shelf_life_days"],
            })
    
    if ingredients_to_insert:
        await supabase_post("ingredients", ingredients_to_insert)
        print(f"   [+] Created {len(ingredients_to_insert)} ingredients")
    
    # 5. Insert initial votes
    print("\n[5] Creating sample votes...")
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    votes_to_insert = []
    
    # Get first few items for each canteen
    all_items = await supabase_get("food_items", {"select": "id,canteen_id,name", "order": "name"})
    import random
    random.seed(42)
    
    for item in all_items[:9]:  # First 9 items
        votes_to_insert.append({
            "canteen_id": item["canteen_id"],
            "item_id": item["id"],
            "vote_date": tomorrow,
            "count": random.randint(10, 85),
        })
    
    if votes_to_insert:
        try:
            await supabase_post("student_votes", votes_to_insert)
            print(f"   [+] Created {len(votes_to_insert)} vote entries")
        except Exception as e:
            print(f"   [!] Votes error (may already exist): {e}")
    
    # Stats
    total_prepared = sum(l["prepared_qty"] for l in logs_to_insert) if logs_to_insert else 0
    total_wasted = sum(l["leftover_qty"] for l in logs_to_insert) if logs_to_insert else 0

    print(f"\n{'='*50}")
    print(f"[Folia] Seed complete.")
    print(f"   Waste log entries : {inserted}")
    print(f"   Total prepared    : {total_prepared:,} portions")
    print(f"   Total wasted      : {total_wasted:,} portions ({total_wasted/max(total_prepared,1)*100:.1f}%)")
    print(f"   Est. cost wasted  : Rs.{total_wasted * 35:,.0f}")
    print(f"{'='*50}")


if __name__ == "__main__":
    force_flag = "--force" in sys.argv
    asyncio.run(seed(force=force_flag))

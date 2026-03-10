"""
Folia CSV Importer with Gemini AI column mapping.

Takes arbitrary CSV exports from canteen billing/POS software,
uses Gemini to detect the column structure, transforms rows into
waste_logs schema, and returns structured preview data.
"""

import csv
import io
import json
import os
import re
import unicodedata
from datetime import datetime
from difflib import get_close_matches

import httpx

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"


# ──────────────────────────────────────────────────────────────────────────────
# Gemini helpers
# ──────────────────────────────────────────────────────────────────────────────

async def ask_gemini(prompt: str) -> str:
    """Call Gemini and return the text response."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set in environment")

    async with httpx.AsyncClient(timeout=40.0) as client:
        resp = await client.post(
            f"{GEMINI_URL}?key={GEMINI_API_KEY}",
            json={"contents": [{"parts": [{"text": prompt}]}]},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def detect_mapping(headers: list[str], sample_rows: list[list[str]]) -> dict:
    """
    Ask Gemini to map CSV headers → Folia waste_log fields.
    Returns a dict with keys: mapping, defaults, date_format, compute_leftover.
    """
    sample_text = "\n".join(
        [",".join(headers)] + [",".join(row) for row in sample_rows[:6]]
    )

    prompt = f"""You are a data mapping assistant for a campus canteen food-waste tracking system.

Analyze the CSV sample below (from a billing/POS export) and return a column mapping.

CSV sample:
{sample_text}

Map CSV columns to these target fields:
- item_name   : the food dish/item name
- log_date    : the date the food was served (any date format)
- meal_type   : breakfast / lunch / dinner (may be implicit — default to "lunch")
- prepared_qty: integer quantity prepared/produced
- sold_qty    : integer quantity sold/served
- leftover_qty: integer quantity remaining / wasted (may need to be computed as prepared - sold)

Return ONLY valid JSON — no markdown fences, no explanation — with this exact structure:
{{
  "mapping": {{
    "item_name":    "<exact_csv_column_header_or_null>",
    "log_date":     "<exact_csv_column_header_or_null>",
    "meal_type":    "<exact_csv_column_header_or_null>",
    "prepared_qty": "<exact_csv_column_header_or_null>",
    "sold_qty":     "<exact_csv_column_header_or_null>",
    "leftover_qty": "<exact_csv_column_header_or_null>"
  }},
  "defaults": {{
    "meal_type": "lunch",
    "weather":   "sunny",
    "event":     "normal"
  }},
  "date_format": "<detected source date format e.g. DD/MM/YYYY or YYYY-MM-DD>",
  "compute_leftover": <true if leftover_qty is absent and should be computed as prepared - sold>
}}"""

    raw = await ask_gemini(prompt)
    # Strip any accidental markdown fences
    raw = re.sub(r"```[a-z]*\s*|```\s*", "", raw).strip()
    return json.loads(raw)


# ──────────────────────────────────────────────────────────────────────────────
# Data conversion helpers
# ──────────────────────────────────────────────────────────────────────────────

_DATE_FORMATS = [
    "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y",
    "%d/%m/%y", "%m/%d/%y", "%Y/%m/%d",
    "%d %b %Y", "%d %B %Y", "%b %d %Y", "%B %d %Y",
    "%d-%b-%Y", "%d-%B-%Y",
    "%Y%m%d",
]


def normalize_name(s: str) -> str:
    """Normalize a food item name for robust matching (handles unicode, extra spaces, punctuation)."""
    s = unicodedata.normalize("NFKC", str(s))
    s = s.lower()
    s = " ".join(s.split())  # Collapse whitespace
    s = s.strip(".,;:-/\\")
    return s


def parse_date(date_str: str, fmt_hint: str = "") -> str:
    """Parse a date string of any common format into YYYY-MM-DD."""
    date_str = str(date_str).strip()

    formats = list(_DATE_FORMATS)
    if fmt_hint:
        # Convert human-readable hint to strftime format
        hint = (fmt_hint
                .replace("YYYY", "%Y").replace("YY", "%y")
                .replace("MM", "%m").replace("DD", "%d"))
        formats = [hint] + formats

    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

    raise ValueError(f"Cannot parse date: {date_str!r}")


def safe_int(val) -> int:
    """Convert a possibly-messy string (currency, commas) to int."""
    if val is None:
        return 0
    cleaned = re.sub(r"[^\d.]", "", str(val))
    return int(float(cleaned)) if cleaned else 0


def map_meal(val: str) -> str:
    """Normalise a raw meal-type string to breakfast / lunch / dinner."""
    v = str(val).strip().lower()
    if any(k in v for k in ("break", "morn", "b/f", "bf", "bfast")):
        return "breakfast"
    if any(k in v for k in ("din", "even", "night", "supper")):
        return "dinner"
    return "lunch"


# ──────────────────────────────────────────────────────────────────────────────
# Main processing function
# ──────────────────────────────────────────────────────────────────────────────

async def process_csv(
    csv_bytes: bytes,
    canteen_id: str,
    item_name_to_id: dict[str, str],
) -> dict:
    """
    Parse the uploaded CSV, call Gemini to detect the column mapping,
    then transform every row into the waste_logs schema.

    Returns:
      {
        rows:           list of transformed row dicts (item_id may be None if unmatched),
        unmatched_items:list of item names not found in the DB,
        errors:         list of per-row error strings,
        mapping:        the column-mapping dict from Gemini,
        defaults:       the default values dict from Gemini,
        total_input:    total rows in the CSV,
      }
    """
    text = csv_bytes.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    headers = list(reader.fieldnames or [])
    all_rows = list(reader)

    if not headers or not all_rows:
        return {
            "rows": [], "unmatched_items": [], "errors": ["CSV is empty or has no headers"],
            "mapping": {}, "defaults": {}, "total_input": 0,
        }

    # ── Gemini mapping ────────────────────────────────────────────
    sample_rows = [[r.get(h, "") for h in headers] for r in all_rows[:6]]
    mapping_data = await detect_mapping(headers, sample_rows)
    col_map: dict = mapping_data.get("mapping", {})
    defaults: dict = mapping_data.get("defaults", {})
    date_fmt: str = mapping_data.get("date_format", "")
    compute_leftover: bool = mapping_data.get("compute_leftover", False)

    # Normalised item lookup (fuzzy-friendly)
    item_lookup = {normalize_name(k): v for k, v in item_name_to_id.items()}

    rows = []
    unmatched: set[str] = set()
    errors: list[str] = []

    for i, row in enumerate(all_rows, start=2):
        try:
            # ── Item name ──────────────────────────────────────────
            item_col = col_map.get("item_name")
            raw_name = str(row.get(item_col, "")).strip() if item_col else ""
            if not raw_name:
                errors.append(f"Row {i}: item name column is empty")
                continue

            # Try exact normalized match first, then fuzzy fallback
            normalized_name = normalize_name(raw_name)
            item_id = item_lookup.get(normalized_name)
            if not item_id:
                # difflib fuzzy match — cutoff 0.82 catches minor spelling differences
                close = get_close_matches(normalized_name, list(item_lookup.keys()), n=1, cutoff=0.82)
                if close:
                    item_id = item_lookup[close[0]]
            if not item_id:
                unmatched.add(raw_name)

            # ── Date ───────────────────────────────────────────────
            date_col = col_map.get("log_date")
            raw_date = str(row.get(date_col, "")).strip() if date_col else ""
            if not raw_date:
                errors.append(f"Row {i} ({raw_name}): date column is empty")
                continue
            try:
                log_date = parse_date(raw_date, date_fmt)
            except ValueError as e:
                errors.append(f"Row {i} ({raw_name}): {e}")
                continue

            # ── Meal type ──────────────────────────────────────────
            meal_col = col_map.get("meal_type")
            if meal_col and row.get(meal_col, "").strip():
                meal_type = map_meal(row[meal_col])
            else:
                meal_type = defaults.get("meal_type", "lunch")

            # ── Quantities ─────────────────────────────────────────
            prep_col = col_map.get("prepared_qty")
            sold_col = col_map.get("sold_qty")
            left_col = col_map.get("leftover_qty")

            prepared_qty = safe_int(row.get(prep_col)) if prep_col else 0
            sold_qty = safe_int(row.get(sold_col)) if sold_col else 0

            if compute_leftover or not left_col:
                leftover_qty = max(0, prepared_qty - sold_qty)
            else:
                leftover_qty = safe_int(row.get(left_col))

            rows.append({
                "canteen_id": canteen_id,
                "item_id": item_id,
                "item_name_raw": raw_name,
                "log_date": log_date,
                "meal_type": meal_type,
                "prepared_qty": prepared_qty,
                "sold_qty": sold_qty,
                "leftover_qty": leftover_qty,
                "weather": defaults.get("weather", "sunny"),
                "event": defaults.get("event", "normal"),
                "matched": item_id is not None,
            })

        except Exception as e:
            errors.append(f"Row {i}: unexpected error — {e}")

    return {
        "rows": rows,
        "unmatched_items": sorted(unmatched),
        "errors": errors,
        "mapping": col_map,
        "defaults": defaults,
        "total_input": len(all_rows),
    }

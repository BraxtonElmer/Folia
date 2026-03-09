"""
Supabase client for Folia backend.
Uses httpx to call Supabase REST API (PostgREST).
"""

import os
import httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "")
REST_URL = f"{SUPABASE_URL}/rest/v1"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


async def supabase_get(table: str, params: dict | None = None) -> list[dict]:
    """GET rows from a Supabase table."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{REST_URL}/{table}", headers=HEADERS, params=params or {})
        r.raise_for_status()
        return r.json()


async def supabase_post(table: str, data: list[dict] | dict) -> list[dict]:
    """INSERT rows into a Supabase table."""
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{REST_URL}/{table}", headers=HEADERS, json=data)
        r.raise_for_status()
        return r.json()


async def supabase_patch(table: str, data: dict, params: dict) -> list[dict]:
    """UPDATE rows in a Supabase table."""
    async with httpx.AsyncClient() as client:
        r = await client.patch(f"{REST_URL}/{table}", headers=HEADERS, json=data, params=params)
        r.raise_for_status()
        return r.json()


async def supabase_delete(table: str, params: dict) -> None:
    """DELETE rows from a Supabase table."""
    async with httpx.AsyncClient() as client:
        r = await client.delete(f"{REST_URL}/{table}", headers=HEADERS, params=params)
        r.raise_for_status()


async def supabase_rpc(fn_name: str, params: dict | None = None) -> dict:
    """Call a Supabase RPC function."""
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{SUPABASE_URL}/rest/v1/rpc/{fn_name}", headers=HEADERS, json=params or {})
        r.raise_for_status()
        return r.json()

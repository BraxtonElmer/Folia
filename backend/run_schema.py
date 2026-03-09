"""
Run schema + seed directly via Supabase PostgreSQL connection.
Supabase Postgres is accessible at: db.<project_ref>.supabase.co:5432
Password = Supabase project database password (NOT the service_role JWT)

We'll use the Supabase transaction pooler instead which accepts JWT via password.
Connection: postgresql://postgres.<ref>:<service_role_jwt>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
"""
import os
import sys
import asyncio
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SERVICE_ROLE_JWT = os.getenv("SUPABASE_ANON_KEY", "")
PROJECT_REF = SUPABASE_URL.replace("https://", "").split(".")[0]

# Supabase Transaction Pooler connection string (port 6543)
# This accepts service_role JWT as password
CONN_STRING = f"postgresql://postgres.{PROJECT_REF}:{SERVICE_ROLE_JWT}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"


def run_schema_and_seed():
    import psycopg2
    
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path, "r") as f:
        schema_sql = f.read()

    print(f"Connecting to Supabase Postgres pooler...")
    print(f"Project: {PROJECT_REF}")
    
    try:
        conn = psycopg2.connect(CONN_STRING, connect_timeout=15)
        conn.autocommit = True
        cur = conn.cursor()
        
        # Test connection
        cur.execute("SELECT version();")
        ver = cur.fetchone()
        print(f"Connected! PostgreSQL: {ver[0][:50]}")
        
        # Run schema
        print("\nRunning schema...")
        cur.execute(schema_sql)
        print("Schema created successfully!")
        
        cur.close()
        conn.close()
        return True
        
    except psycopg2.OperationalError as e:
        print(f"Connection failed: {e}")
        # Try direct connection (port 5432)
        # For direct, we need the db password, not JWT
        # Fall back to seeding via REST API instead
        return False


if __name__ == "__main__":
    ok = run_schema_and_seed()
    print(f"\nResult: {'SUCCESS' if ok else 'FAILED'}")
    sys.exit(0 if ok else 1)

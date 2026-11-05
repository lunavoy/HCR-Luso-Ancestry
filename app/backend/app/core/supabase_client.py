import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client

PROJECT_ROOT = Path(__file__).resolve().parents[4]
load_dotenv(PROJECT_ROOT / ".env")


@lru_cache
def get_supabase_client() -> Client:

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url:
        raise RuntimeError("SUPABASE_URL não configurada.")

    if not key:
        raise RuntimeError(
            "SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY não configurada."
        )

    return create_client(url, key)

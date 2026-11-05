import base64
import json
import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client

PROJECT_ROOT = Path(__file__).resolve().parents[4]
load_dotenv(PROJECT_ROOT / ".env")


def _jwt_role(key: str) -> str | None:
    parts = key.split(".")
    if len(parts) != 3:
        return None
    try:
        payload = parts[1] + "=" * (-len(parts[1]) % 4)
        return json.loads(base64.urlsafe_b64decode(payload)).get("role")
    except (ValueError, json.JSONDecodeError):
        return None


def validate_server_key(key: str) -> None:
    """Rejeita chaves públicas: com RLS ativo elas devolvem listas vazias sem erro."""
    if key.startswith("sb_publishable_") or _jwt_role(key) == "anon":
        raise RuntimeError(
            "SUPABASE_SECRET_KEY contém a chave pública (publishable/anon). "
            "Use a secret key (sb_secret_...) ou a service_role key do projeto; "
            "com a chave pública o RLS esconde as linhas e as listas ficam vazias."
        )


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

    validate_server_key(key)
    return create_client(url, key)

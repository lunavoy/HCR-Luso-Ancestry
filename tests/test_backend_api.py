import pytest

from app.backend.app.core.supabase_client import validate_server_key


def test_rejects_publishable_key():
    with pytest.raises(RuntimeError):
        validate_server_key("sb_publishable_abc")


def test_accepts_secret_key():
    validate_server_key("sb_secret_abc")

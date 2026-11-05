import pytest

from app.backend.app.core.supabase_client import validate_server_key


def test_rejects_publishable_key():
    with pytest.raises(RuntimeError):
        validate_server_key("sb_publishable_abc")


def test_accepts_secret_key():
    validate_server_key("sb_secret_abc")


def test_untouched_kraken_annotation_keeps_origin():
    from app.backend.app.api.pages import _origin

    previous = {"origin": "kraken", "parent_id": "r", "polygon": [[0, 0], [1, 0], [1, 1]],
                "baseline": None, "corrected_text": None}
    row = {"is_verified": False, "parent_id": "r", "polygon": [[0, 0], [1, 0], [1, 1]],
           "baseline": None, "corrected_text": ""}
    assert _origin(row, previous) == "kraken"
    assert _origin({**row, "polygon": [[0, 0], [2, 0], [2, 2]]}, previous) == "human"
    assert _origin({**row, "is_verified": True}, previous) == "human"
    assert _origin(row, None) == "human"

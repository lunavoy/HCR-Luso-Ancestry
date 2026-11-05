from __future__ import annotations

from fastapi import APIRouter
from fastapi import HTTPException

from ..core.supabase_client import get_supabase_client

router = APIRouter(prefix="/api", tags=["workspace"])


@router.get("/collections")
def list_collections() -> list[dict]:
    return get_supabase_client().table("collections").select("*").order("title").execute().data or []


@router.post("/collections")
def create_collection(payload: dict) -> dict:
    try:
        result = get_supabase_client().table("collections").insert(payload).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail=f"Supabase não aceitou a coleção: {exc}"
        ) from exc
    if not result.data:
        raise HTTPException(status_code=502, detail="Supabase não retornou a coleção criada.")
    return result.data[0]


@router.get("/collections/{collection_id}/documents")
def list_documents(collection_id: str) -> list[dict]:
    return get_supabase_client().table("documents").select("*").eq(
        "collection_id", collection_id).order("start_year").execute().data or []


@router.post("/documents")
def create_document(payload: dict) -> dict:
    return get_supabase_client().table("documents").insert(payload).execute().data[0]


@router.get("/documents/{document_id}/pages")
def list_document_pages(document_id: str) -> list[dict]:
    from .pages import _image_url
    rows = get_supabase_client().table("pages").select("*").eq(
        "document_id", document_id).order("page_number").execute().data or []
    return [{**row, "image_url": _image_url(row)} for row in rows]

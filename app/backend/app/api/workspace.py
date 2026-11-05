from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.supabase_client import get_supabase_client
from .pages import with_image_urls

router = APIRouter(prefix="/api", tags=["workspace"])


def _sort_documents(rows: list[dict]) -> list[dict]:
    return sorted(rows, key=lambda row: (row.get("start_year") or 0, str(row.get("title") or "")))


def _sort_pages(rows: list[dict]) -> list[dict]:
    return sorted(rows, key=lambda row: (str(row.get("document_id")), row.get("page_number") or 0))


PAGE_SIZE = 1000


def _select_all(table: str, order: str) -> list[dict]:
    """Percorre todas as linhas; o PostgREST devolve no máximo 1000 por pedido."""
    query = get_supabase_client().table(table).select("*").order(order).order("id")
    rows: list[dict] = []
    while True:
        batch = query.range(len(rows), len(rows) + PAGE_SIZE - 1).execute().data or []
        rows += batch
        if len(batch) < PAGE_SIZE:
            return rows


def _insert(table: str, payload: dict[str, Any], label: str) -> dict:
    try:
        result = get_supabase_client().table(table).insert(payload).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail=f"Supabase não aceitou {label}: {exc}"
        ) from exc
    if not result.data:
        raise HTTPException(status_code=502, detail=f"Supabase não retornou {label}.")
    return result.data[0]


@router.get("/workspace")
def workspace() -> dict[str, list[dict]]:
    """Carrega coleções, livros e páginas em três consultas (sem N+1)."""
    collections = _select_all("collections", "title")
    documents = _select_all("documents", "id")
    pages = _select_all("pages", "id")
    return {
        "collections": collections,
        "documents": _sort_documents(documents),
        "pages": with_image_urls(_sort_pages(pages)),
    }


@router.get("/collections")
def list_collections() -> list[dict]:
    return get_supabase_client().table("collections").select("*").order("title").execute().data or []


@router.post("/collections")
def create_collection(payload: dict) -> dict:
    return _insert("collections", payload, "a coleção")


@router.get("/collections/{collection_id}/documents")
def list_documents(collection_id: str) -> list[dict]:
    rows = get_supabase_client().table("documents").select("*").eq(
        "collection_id", collection_id).execute().data or []
    return _sort_documents(rows)


class DocumentCreate(BaseModel):
    collection_id: str
    title: str
    record_type: str | None = None
    start_year: int | None = None
    end_year: int | None = None
    archival_reference: str | None = None
    source_url: str | None = None


@router.post("/documents")
def create_document(payload: DocumentCreate) -> dict:
    return _insert("documents", payload.model_dump(exclude_none=True), "o livro")


@router.get("/documents/{document_id}/pages")
def list_document_pages(document_id: str) -> list[dict]:
    rows = get_supabase_client().table("pages").select("*").eq(
        "document_id", document_id).order("page_number").execute().data or []
    return with_image_urls(rows)

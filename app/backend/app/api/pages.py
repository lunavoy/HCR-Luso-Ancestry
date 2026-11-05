from __future__ import annotations

import hashlib
import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
from PIL import Image
from pydantic import BaseModel, Field

from database.annotations import pagexml_to_rows, rows_to_pagexml
from ..core.supabase_client import get_supabase_client

router = APIRouter(prefix="/api/pages", tags=["pages"])


class AnnotationUpdate(BaseModel):
    id: str
    parent_id: str | None = None
    element_type: str
    reading_order: int
    polygon: list[list[int]] = Field(min_length=3)
    baseline: list[list[int]] | None = None
    predicted_text: str | None = None
    corrected_text: str | None = None
    confidence: float | None = None
    is_verified: bool = False


def _page(page_id: str) -> dict:
    result = get_supabase_client().table("pages").select("*").eq(
        "id", page_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Página não encontrada.")
    return result.data


def _image_url(row: dict) -> str:
    bucket = row.get("storage_bucket")
    path = row.get("storage_path")
    if not bucket or not path:
        return ""
    result = get_supabase_client().storage.from_(bucket).create_signed_url(path, 3600)
    return result.get("signedURL") or result.get("signedUrl") or ""


@router.get("")
def list_pages(document_id: str | None = None) -> list[dict]:
    query = get_supabase_client().table("pages").select("*").order("page_number")
    if document_id:
        query = query.eq("document_id", document_id)
    rows = query.execute().data or []
    return [{**row, "image_url": _image_url(row)} for row in rows]


@router.get("/{page_id}")
def get_page(page_id: str) -> dict:
    row = _page(page_id)
    return {**row, "image_url": _image_url(row)}


@router.post("/import")
async def import_page(
    document_id: str = Form(...),
    page_number: int = Form(...),
    file: UploadFile = File(...),
) -> dict:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Imagem vazia.")
    suffix = Path(file.filename or "page.jpg").suffix.lower() or ".jpg"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as handle:
        handle.write(content)
        local_path = Path(handle.name)
    try:
        with Image.open(local_path) as image:
            width, height = image.size
        digest = hashlib.sha256(content).hexdigest()
        bucket = os.getenv("SUPABASE_IMAGE_BUCKET", "pages")
        storage_path = f"{document_id}/{digest}{suffix}"
        client = get_supabase_client()
        client.storage.from_(bucket).upload(
            storage_path, content, {"content-type": file.content_type or "image/jpeg"}
        )
        result = client.table("pages").upsert({
            "document_id": document_id, "page_number": page_number,
            "original_filename": file.filename or storage_path,
            "storage_bucket": bucket, "storage_path": storage_path,
            "width_px": width, "height_px": height, "sha256": digest,
            "status": "imported",
        }, on_conflict="document_id,page_number").execute()
        if not result.data:
            raise HTTPException(status_code=502, detail="Página não foi persistida.")
        row = result.data[0]
        return {**row, "image_url": _image_url(row)}
    finally:
        local_path.unlink(missing_ok=True)


@router.post("/{page_id}/segment")
def segment_page(page_id: str) -> dict:
    page = _page(page_id)
    client = get_supabase_client()
    bucket = page["storage_bucket"]
    content = client.storage.from_(bucket).download(page["storage_path"])
    suffix = Path(page["original_filename"]).suffix or ".jpg"
    with tempfile.TemporaryDirectory() as directory:
        image_path = Path(directory) / f"input{suffix}"
        xml_path = Path(directory) / "page.xml"
        image_path.write_bytes(content)
        command = [
            os.getenv("KRAKEN_COMMAND", "kraken"), "--pagexml",
            "--raise-on-error", "-i", str(image_path), str(xml_path),
            "segment", "--baseline",
        ]
        import subprocess
        completed = subprocess.run(command, capture_output=True, text=True, check=False)
        if completed.returncode:
            raise HTTPException(status_code=502, detail=completed.stderr or completed.stdout)
        parsed = pagexml_to_rows(xml_path, page_id)
        if parsed["rows"]:
            existing = client.table("annotations").select(
                "id,origin,is_verified"
            ).eq("page_id", page_id).execute().data or []
            protected = {
                row["id"] for row in existing
                if row.get("origin") == "human" or row.get("is_verified")
            }
            candidates = [row for row in parsed["rows"] if row["id"] not in protected]
            if candidates:
                client.table("annotations").upsert(
                    candidates, on_conflict="id",
                ).execute()
        xml_storage_path = f"{page_id}/segment.xml"
        client.storage.from_(bucket).upload(
            xml_storage_path, xml_path.read_bytes(),
            {"content-type": "application/xml", "upsert": "true"},
        )
        client.table("pages").update({
            "pagexml_storage_path": xml_storage_path,
        }).eq("id", page_id).execute()
        return {"page_id": page_id, "rows": parsed["rows"], "skipped": parsed["skipped"]}


@router.get("/{page_id}/pagexml")
def export_pagexml(page_id: str) -> Response:
    page = _page(page_id)
    rows = get_supabase_client().table("annotations").select("*").eq(
        "page_id", page_id).execute().data or []
    xml = rows_to_pagexml(
        rows,
        image_filename=page["original_filename"],
        width=page["width_px"],
        height=page["height_px"],
    )
    return Response(
        content=xml,
        media_type="application/xml",
        headers={"content-disposition": f'attachment; filename="{page_id}.xml"'},
    )


@router.get("/{page_id}/annotations")
def list_annotations(page_id: str) -> list[dict]:
    _page(page_id)
    result = get_supabase_client().table("annotations").select("*").eq(
        "page_id", page_id).order("reading_order").execute()
    return result.data or []


@router.put("/{page_id}/annotations")
def replace_annotations(page_id: str, annotations: list[AnnotationUpdate]) -> list[dict]:
    _page(page_id)
    client = get_supabase_client()
    existing = client.table("annotations").select(
        "id,original_polygon,original_baseline,source_xml_id,model_name"
    ).eq("page_id", page_id).execute().data or []
    originals = {row["id"]: row for row in existing}
    incoming_ids = {annotation.id for annotation in annotations}
    for existing_id in set(originals) - incoming_ids:
        client.table("annotations").delete().eq("id", existing_id).eq(
            "page_id", page_id).execute()
    rows = []
    for annotation in annotations:
        row = annotation.model_dump()
        row["page_id"] = page_id
        row["origin"] = "human"
        previous = originals.get(annotation.id)
        if previous:
            for key in ("original_polygon", "original_baseline", "source_xml_id", "model_name"):
                row[key] = previous.get(key)
        rows.append(row)
    if not rows:
        return []
    result = client.table("annotations").upsert(rows, on_conflict="id").execute()
    return result.data or []


@router.put("/{page_id}/annotations/{annotation_id}")
def update_annotation(page_id: str, annotation_id: str,
                      update: AnnotationUpdate) -> dict:
    _page(page_id)
    payload = update.model_dump()
    payload["origin"] = "human"
    if update.is_verified:
        payload["verified_at"] = "now()"
    result = get_supabase_client().table("annotations").update(payload).eq(
        "id", annotation_id).eq("page_id", page_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Anotação não encontrada.")
    return result.data[0]

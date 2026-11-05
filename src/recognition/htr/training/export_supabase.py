"""Exporta as linhas verificadas no Supabase para labels.csv + recortes PNG.

Uso: python -m recognition.htr.training.export_supabase
Depois: prepare_dataset -> train.
"""
from __future__ import annotations

import argparse
import io
import os
from collections import defaultdict
from datetime import datetime

from PIL import Image, ImageOps

from .. import config, store

PREFIX = "sb-"


def supabase_client():
    from dotenv import load_dotenv
    from supabase import create_client

    load_dotenv(config.ROOT / ".env")
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Configure SUPABASE_URL e SUPABASE_SECRET_KEY no .env da raiz do projeto.")
    return create_client(url, key)


def _points(raw) -> list[tuple[float, float]]:
    points = []
    for point in raw or []:
        if isinstance(point, dict):
            points.append((float(point["x"]), float(point["y"])))
        else:
            points.append((float(point[0]), float(point[1])))
    return points


def crop_box(points, width: int, height: int, pad: int = 4) -> tuple[int, int, int, int] | None:
    if len(points) < 2:
        return None
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    x0, y0 = max(0, int(min(xs)) - pad), max(0, int(min(ys)) - pad)
    x1, y1 = min(width, int(max(xs)) + pad), min(height, int(max(ys)) + pad)
    if x1 - x0 < 4 or y1 - y0 < 4:
        return None
    return x0, y0, x1 - x0, y1 - y0


def fetch_lines(client) -> list[dict]:
    rows, start, size = [], 0, 1000
    while True:
        batch = client.table("v_training_lines").select("*").range(start, start + size - 1).execute().data or []
        rows += batch
        if len(batch) < size:
            return rows
        start += size


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.parse_args()

    client = supabase_client()
    lines = [line for line in fetch_lines(client) if (line.get("corrected_text") or "").strip()]

    config.CROPS_DIR.mkdir(parents=True, exist_ok=True)
    by_image: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for line in lines:
        by_image[(line["storage_bucket"], line["storage_path"])].append(line)

    exported, skipped = [], 0
    now = datetime.now().isoformat(timespec="seconds")
    for (bucket, path), page_lines in by_image.items():
        data = client.storage.from_(bucket).download(path)
        with Image.open(io.BytesIO(data)) as raw:
            image = ImageOps.exif_transpose(raw).convert("RGB")
        for line in page_lines:
            box = crop_box(_points(line.get("polygon")), image.width, image.height)
            if not box:
                skipped += 1
                continue
            x, y, w, h = box
            uid = f"{PREFIX}{line['id']}"
            image.crop((x, y, x + w, y + h)).save(config.CROPS_DIR / f"{uid}.png")
            exported.append({"id": uid, "crop_file": f"{uid}.png", "text": line["corrected_text"].strip(),
                             "predicted": "", "confidence": "", "was_correct": "",
                             "source_image": str(line["page_id"]), "x": x, "y": y, "w": w, "h": h,
                             "timestamp": now})
        image.close()

    previous = store._read_rows()
    local = [row for row in previous if not row["id"].startswith(PREFIX)]
    current_ids = {row["id"] for row in exported}
    for row in previous:
        if row["id"].startswith(PREFIX) and row["id"] not in current_ids:
            (config.CROPS_DIR / row["crop_file"]).unlink(missing_ok=True)
    rows = local + exported
    store._write_rows(rows)
    store._write_lexicon(rows)
    if not exported:
        print("Nenhuma linha verificada com transcrição no Supabase. "
              "Marque linhas como verificadas no editor e guarde a página.")
    print(f"Exportadas {len(exported)} linhas do Supabase ({skipped} ignoradas por polígono inválido); "
          f"{len(local)} confirmações locais mantidas. Total: {len(rows)} em {config.LABELS_CSV}")


if __name__ == "__main__":
    main()

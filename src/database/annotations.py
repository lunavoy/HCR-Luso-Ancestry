"""Conversão determinística entre PAGE XML e public.annotations."""
from __future__ import annotations

import uuid
import xml.etree.ElementTree as ET
from pathlib import Path, PureWindowsPath
from typing import Any, Iterable

import cv2
import numpy as np

Point = list[int]
PAGE_NS = "http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15"


def _points(element: ET.Element | None) -> list[Point]:
    value = element.get("points") if element is not None else None
    if not value:
        return []
    return [[int(round(float(x))), int(round(float(y)))]
            for pair in value.split() for x, y in [pair.split(",", 1)]]


def clean_polygon(points: Iterable[Point], eps: float = 1.5) -> list[Point]:
    values = [list(point) for point in points]
    result = [point for index, point in enumerate(values)
              if index == 0 or point != values[index - 1]]
    if len(result) > 1 and result[0] == result[-1]:
        result.pop()
    if len(result) >= 4:
        approximation = cv2.approxPolyDP(
            np.asarray(result, dtype=np.int32).reshape(-1, 1, 2), eps, True)
        result = [[int(value) for value in point[0]] for point in approximation]
    return result


def _own_text(element: ET.Element) -> str | None:
    for child in element:
        if child.tag.endswith("TextEquiv"):
            unicode_ = next((item for item in child
                              if item.tag.endswith("Unicode")), None)
            if unicode_ is not None:
                return unicode_.text or ""
    return None


def _line_type(custom: str | None) -> str | None:
    if custom and "{type:" in custom:
        return custom.split("{type:", 1)[1].split(";", 1)[0].strip() or None
    return None


def pagexml_to_rows(xml_path: Path, page_id: str,
                    *, model_name: str = "kraken") -> dict[str, Any]:
    page_uuid = uuid.UUID(str(page_id))
    root = ET.parse(xml_path).getroot()
    page = root.find(".//{*}Page")
    if page is None:
        raise ValueError(f"PAGE XML sem elemento Page: {xml_path}")
    try:
        width, height = int(page.get("imageWidth")), int(page.get("imageHeight"))
    except (TypeError, ValueError) as exc:
        raise ValueError("PAGE XML sem imageWidth/imageHeight válidos.") from exc

    rows: list[dict[str, Any]] = []
    skipped: list[str] = []

    def add(element: ET.Element, kind: str, order: int,
            parent_id: str | None, fallback: str) -> str | None:
        source_id = element.get("id") or fallback
        polygon = clean_polygon(_points(element.find("{*}Coords")))
        if len(polygon) < 3:
            skipped.append(source_id)
            return None
        baseline = None
        if kind == "line":
            baseline = clean_polygon(_points(element.find("{*}Baseline"))) or None
        row_id = str(uuid.uuid5(page_uuid, source_id))
        rows.append({
            "id": row_id, "page_id": str(page_uuid), "parent_id": parent_id,
            "element_type": kind, "polygon": polygon, "baseline": baseline,
            "reading_order": order, "predicted_text": _own_text(element),
            "corrected_text": None, "confidence": None, "is_verified": False,
            "model_name": model_name, "source_xml_id": source_id, "origin": "kraken",
            "original_polygon": [point[:] for point in polygon],
            "original_baseline": [point[:] for point in baseline] if baseline else None,
            "line_type": _line_type(element.get("custom")) if kind == "line" else None,
        })
        return row_id

    for region_index, region in enumerate(page.findall("{*}TextRegion")):
        region_id = add(region, "region", region_index, None,
                        f"region-{region_index}")
        for line_index, line in enumerate(region.findall("{*}TextLine")):
            add(line, "line", line_index, region_id,
                f"region-{region_index}-line-{line_index}")
    for line_index, line in enumerate(page.findall("{*}TextLine")):
        add(line, "line", line_index, None, f"orphan-line-{line_index}")

    filename = page.get("imageFilename")
    return {
        "image_filename": PureWindowsPath(filename).name if filename else None,
        "image_width": width, "image_height": height,
        "rows": rows, "skipped": skipped,
    }


def _bbox(polygon: list[Point]) -> tuple[int, int, int, int]:
    xs = [x for x, _ in polygon]
    ys = [y for _, y in polygon]
    return min(xs), min(ys), max(xs), max(ys)


def _rect(x0: int, y0: int, x1: int, y1: int, pad: int) -> list[list[int]]:
    x0, y0, x1, y1 = max(x0 - pad, 0), max(y0 - pad, 0), x1 + pad, y1 + pad
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]


def _auto_row(page_uuid: uuid.UUID, source_id: str, kind: str, polygon: list[list[int]],
              order: int, parent_id: str | None) -> dict[str, Any]:
    return {
        "id": str(uuid.uuid5(page_uuid, source_id)), "page_id": str(page_uuid),
        "parent_id": parent_id, "element_type": kind, "polygon": polygon,
        "baseline": None, "reading_order": order, "predicted_text": None,
        "corrected_text": None, "confidence": None, "is_verified": False,
        "model_name": "kraken+espacos", "source_xml_id": source_id, "origin": "kraken",
        "original_polygon": [point[:] for point in polygon], "original_baseline": None,
        "line_type": None,
    }


def group_records(rows: list[dict[str, Any]], page_id: str, *,
                  existing_records: list[dict[str, Any]] = (),
                  gap_factor: float = 1.8, pad: int = 8) -> list[dict[str, Any]]:
    """Agrupa as linhas em registros (assentos), separando-os pelos espaços verticais
    maiores do que ``gap_factor`` vezes o espaçamento mediano entre linhas.

    Devolve as linhas originais com a hierarquia registro → região → linha: regiões
    que atravessam mais de um registro são divididas. Grupos cujo centro cai num
    registro de ``existing_records`` (revistos) ficam ligados a ele em vez de gerar
    um registro novo."""
    page_uuid = uuid.UUID(str(page_id))
    lines = [row for row in rows if row["element_type"] == "line" and row.get("polygon")]
    if not lines:
        return rows
    center = lambda row: (_bbox(row["polygon"])[1] + _bbox(row["polygon"])[3]) / 2
    lines.sort(key=center)
    centers = [center(row) for row in lines]
    gaps = [b - a for a, b in zip(centers, centers[1:])]
    median = sorted(gaps)[len(gaps) // 2] if gaps else 0
    groups = [[lines[0]]]
    for line, gap in zip(lines[1:], gaps):
        if median and gap > gap_factor * median:
            groups.append([])
        groups[-1].append(line)

    def covering(box: tuple[int, int, int, int]) -> str | None:
        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        for record in existing_records:
            x0, y0, x1, y1 = _bbox(record["polygon"])
            if x0 <= cx <= x1 and y0 <= cy <= y1:
                return record["id"]
        return None

    records: list[dict[str, Any]] = []
    record_of: dict[str, str] = {}
    for index, group in enumerate(groups):
        boxes = [_bbox(line["polygon"]) for line in group]
        box = (min(b[0] for b in boxes), min(b[1] for b in boxes),
               max(b[2] for b in boxes), max(b[3] for b in boxes))
        record_id = covering(box)
        if record_id is None:
            record = _auto_row(page_uuid, f"record-{index}", "record", _rect(*box, pad), index, None)
            records.append(record)
            record_id = record["id"]
        for line in group:
            record_of[line["id"]] = record_id

    regions = {row["id"]: row for row in rows if row["element_type"] == "region"}
    split_regions: list[dict[str, Any]] = []
    for region_id, region in regions.items():
        children = [line for line in lines if line.get("parent_id") == region_id]
        owners = sorted({record_of[line["id"]] for line in children})
        if len(owners) <= 1:
            region["parent_id"] = owners[0] if owners else None
            continue
        region["_drop"] = True
        for part, owner in enumerate(owners):
            members = [line for line in children if record_of[line["id"]] == owner]
            boxes = [_bbox(line["polygon"]) for line in members]
            box = (min(b[0] for b in boxes), min(b[1] for b in boxes),
                   max(b[2] for b in boxes), max(b[3] for b in boxes))
            sub = _auto_row(page_uuid, f"{region['source_xml_id']}-part-{part}", "region",
                            _rect(*box, pad // 2), region["reading_order"], owner)
            split_regions.append(sub)
            for line in members:
                line["parent_id"] = sub["id"]
    for line in lines:
        if not line.get("parent_id"):
            line["parent_id"] = record_of[line["id"]]
    kept = [row for row in rows if not row.pop("_drop", False)]
    return records + split_regions + kept


def rows_to_pagexml(rows: list[dict[str, Any]], *, image_filename: str,
                    width: int, height: int) -> str:
    missing = [row.get("source_xml_id") or row["id"] for row in rows
               if row["element_type"] == "line" and not row.get("baseline")]
    if missing:
        raise ValueError(f"Linhas sem baseline, impossível exportar: {missing}")
    ET.register_namespace("", PAGE_NS)
    q = lambda tag: f"{{{PAGE_NS}}}{tag}"
    root = ET.Element(q("PcGts"))
    page = ET.SubElement(root, q("Page"), {
        "imageFilename": image_filename, "imageWidth": str(width),
        "imageHeight": str(height),
    })

    def points(values: list[Point]) -> str:
        return " ".join(f"{x},{y}" for x, y in values)

    def put_line(parent: ET.Element, row: dict[str, Any]) -> None:
        attrs = {"id": row.get("source_xml_id") or row["id"]}
        if row.get("line_type"):
            attrs["custom"] = f"type {{type:{row['line_type']};}}"
        line = ET.SubElement(parent, q("TextLine"), attrs)
        ET.SubElement(line, q("Coords"), {"points": points(row["polygon"])})
        ET.SubElement(line, q("Baseline"), {"points": points(row["baseline"])})
        if row.get("corrected_text"):
            text = ET.SubElement(ET.SubElement(line, q("TextEquiv")), q("Unicode"))
            text.text = row["corrected_text"]

    lines = sorted((row for row in rows if row["element_type"] == "line"),
                   key=lambda row: row.get("reading_order") or 0)
    regions = sorted((row for row in rows if row["element_type"] == "region"),
                     key=lambda row: row.get("reading_order") or 0)
    for region in regions:
        element = ET.SubElement(page, q("TextRegion"), {
            "id": region.get("source_xml_id") or region["id"],
        })
        ET.SubElement(element, q("Coords"), {"points": points(region["polygon"])})
        for line in lines:
            if line.get("parent_id") == region["id"]:
                put_line(element, line)
    for line in lines:
        if not line.get("parent_id"):
            put_line(page, line)
    ET.indent(root)
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(
        root, encoding="unicode")

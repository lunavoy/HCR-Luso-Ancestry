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


def group_records(rows: list[dict[str, Any]], page_id: str, *,
                  gap_factor: float = 1.8, pad: int = 8) -> list[dict[str, Any]]:
    """Agrupa as linhas em registros (assentos) separando-os pelos espaços verticais
    maiores do que ``gap_factor`` vezes o espaçamento mediano entre linhas."""
    boxes = []
    for row in rows:
        if row["element_type"] == "line" and row.get("polygon"):
            xs = [x for x, _ in row["polygon"]]
            ys = [y for _, y in row["polygon"]]
            boxes.append((min(xs), min(ys), max(xs), max(ys)))
    if not boxes:
        return []
    boxes.sort(key=lambda b: (b[1] + b[3]) / 2)
    centers = [(b[1] + b[3]) / 2 for b in boxes]
    spacings = sorted(b - a for a, b in zip(centers, centers[1:]))
    median = spacings[len(spacings) // 2] if spacings else 0
    groups = [[boxes[0]]]
    for box, gap in zip(boxes[1:], (b - a for a, b in zip(centers, centers[1:]))):
        if median and gap > gap_factor * median:
            groups.append([])
        groups[-1].append(box)
    page_uuid = uuid.UUID(str(page_id))
    records = []
    for index, group in enumerate(groups):
        x0, y0 = min(b[0] for b in group) - pad, min(b[1] for b in group) - pad
        x1, y1 = max(b[2] for b in group) + pad, max(b[3] for b in group) + pad
        x0, y0 = max(x0, 0), max(y0, 0)
        polygon = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
        source_id = f"record-{index}"
        records.append({
            "id": str(uuid.uuid5(page_uuid, source_id)), "page_id": str(page_uuid),
            "parent_id": None, "element_type": "record", "polygon": polygon,
            "baseline": None, "reading_order": index, "predicted_text": None,
            "corrected_text": None, "confidence": None, "is_verified": False,
            "model_name": "kraken+espacos", "source_xml_id": source_id, "origin": "kraken",
            "original_polygon": [point[:] for point in polygon], "original_baseline": None,
            "line_type": None,
        })
    return records


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

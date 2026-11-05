#!/usr/bin/env python
"""Valida PAGE XML do Kraken contra a imagem e gera um overlay independente.

Uso:
    python scripts/check_pagexml.py IMAGEM.jpg PAGINA.xml
    python scripts/check_pagexml.py IMAGEM.jpg PAGINA.xml --out overlay.png \
        --json limpo.json

Este relatório ajuda a separar problemas de segmentação/conversão de problemas
do frontend. Ele não testa a comunicação com a API ou com o Supabase.
"""
from __future__ import annotations

import argparse
import json
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image

Point = tuple[int, int]


def parse_points(value: str | None) -> list[Point]:
    if not value:
        return []
    points: list[Point] = []
    for pair in value.split():
        try:
            x, y = pair.split(",", 1)
            points.append((int(round(float(x))), int(round(float(y)))))
        except ValueError as exc:
            raise ValueError(f"Coordenada PAGE XML inválida: {pair!r}") from exc
    return points


def clean_polygon(points: list[Point], eps: float = 1.5) -> list[Point]:
    """Remove duplicados, fechamento repetido e serrilhado de um polígono."""
    cleaned = [
        point for index, point in enumerate(points)
        if index == 0 or point != points[index - 1]
    ]
    if len(cleaned) > 1 and cleaned[0] == cleaned[-1]:
        cleaned.pop()
    if len(cleaned) >= 4:
        approximation = cv2.approxPolyDP(
            np.asarray(cleaned, dtype=np.int32).reshape(-1, 1, 2),
            eps,
            True,
        )
        return [tuple(int(value) for value in point[0]) for point in approximation]
    return cleaned


def _required_element(parent: ET.Element, name: str) -> ET.Element:
    element = parent.find(f"{{*}}{name}")
    if element is None:
        raise ValueError(f"PAGE XML sem elemento obrigatório: {name}")
    return element


def parse_pagexml(xml_path: Path) -> dict[str, Any]:
    try:
        root = ET.parse(xml_path).getroot()
    except ET.ParseError as exc:
        raise ValueError(f"PAGE XML inválido: {xml_path}") from exc

    page = root.find(".//{*}Page")
    if page is None:
        raise ValueError("PAGE XML não contém elemento Page.")
    try:
        width = int(page.attrib["imageWidth"])
        height = int(page.attrib["imageHeight"])
    except (KeyError, ValueError) as exc:
        raise ValueError("Page sem imageWidth/imageHeight válidos.") from exc

    data: dict[str, Any] = {
        "width": width,
        "height": height,
        "regions": [],
    }
    reading_order = 0
    for region in page.findall("{*}TextRegion"):
        coords = _required_element(region, "Coords")
        region_points = clean_polygon(parse_points(coords.get("points")))
        parsed_region: dict[str, Any] = {
            "id": region.get("id"),
            "polygon": region_points,
            "lines": [],
        }
        for line in region.findall("{*}TextLine"):
            line_coords = _required_element(line, "Coords")
            baseline_element = line.find("{*}Baseline")
            raw_points = parse_points(line_coords.get("points"))
            baseline = parse_points(
                baseline_element.get("points") if baseline_element is not None else None
            )
            parsed_region["lines"].append({
                "id": line.get("id"),
                "reading_order": reading_order,
                "polygon": clean_polygon(raw_points),
                "raw_points": len(raw_points),
                "baseline": baseline,
            })
            reading_order += 1
        data["regions"].append(parsed_region)
    return data


def read_bgr(path: Path) -> np.ndarray:
    image = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"Não foi possível abrir a imagem: {path}")
    return image


def flag_line(line: dict[str, Any], region_polygon: list[Point]) -> tuple[list[str], tuple[int, int]]:
    polygon = line["polygon"]
    if not polygon:
        return ["polígono ausente"], (0, 0)
    xs, ys = zip(*polygon)
    width, height = max(xs) - min(xs), max(ys) - min(ys)
    flags: list[str] = []
    if width < 150 or width < 3 * height:
        flags.append(f"curta ({width}x{height}px)")
    baseline = line["baseline"]
    if not baseline:
        flags.append("baseline ausente")
    elif region_polygon and cv2.pointPolygonTest(
        np.asarray(region_polygon, dtype=np.int32),
        (float(baseline[0][0]), float(baseline[0][1])),
        False,
    ) < 0:
        flags.append("baseline fora da região")
    return flags, (width, height)


def _inside_image(points: list[Point], width: int, height: int) -> bool:
    return all(0 <= x < width and 0 <= y < height for x, y in points)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Valida PAGE XML e gera overlay independente do frontend."
    )
    parser.add_argument("image", type=Path)
    parser.add_argument("xml", type=Path)
    parser.add_argument("--out", type=Path, default=Path("overlay.png"))
    parser.add_argument("--json", dest="json_path", type=Path)
    args = parser.parse_args()

    data = parse_pagexml(args.xml)
    image = read_bgr(args.image)
    image_height, image_width = image.shape[:2]
    problems: list[str] = []

    with Image.open(args.image) as pil:
        orientation = pil.getexif().get(274, 1)
        raw_width, raw_height = pil.size
    if orientation != 1:
        problems.append(
            f"EXIF orientation={orientation}: normalize a imagem antes de comparar."
        )
    if (raw_width, raw_height) != (data["width"], data["height"]):
        problems.append(
            f"Tamanho da imagem {raw_width}x{raw_height} != "
            f"XML {data['width']}x{data['height']}."
        )

    if (image_width, image_height) != (data["width"], data["height"]):
        problems.append("OpenCV e PAGE XML usam dimensões diferentes.")

    overlay = image.copy()
    palette = [(255, 120, 0), (0, 170, 0), (200, 0, 200), (0, 140, 255), (160, 160, 0)]
    rows: list[dict[str, Any]] = []
    heights: list[int] = []
    for region in data["regions"]:
        region_polygon = region["polygon"]
        if len(region_polygon) >= 2:
            cv2.polylines(
                image, [np.asarray(region_polygon, dtype=np.int32)],
                True, (255, 0, 0), 3,
            )
        if not _inside_image(region_polygon, data["width"], data["height"]):
            problems.append(f"Região {region['id'] or '-'} excede os limites da imagem.")
        for line in region["lines"]:
            flags, (width, height) = flag_line(line, region_polygon)
            if not _inside_image(line["polygon"], data["width"], data["height"]):
                flags.append("polígono fora da imagem")
            if not _inside_image(line["baseline"], data["width"], data["height"]):
                flags.append("baseline fora da imagem")
            heights.append(height)
            color = (0, 128, 255) if flags else palette[
                line["reading_order"] % len(palette)
            ]
            if len(line["polygon"]) >= 3:
                cv2.fillPoly(
                    overlay, [np.asarray(line["polygon"], dtype=np.int32)], color
                )
                cv2.polylines(
                    image, [np.asarray(line["polygon"], dtype=np.int32)],
                    True, color, 2,
                )
            if len(line["baseline"]) >= 2:
                cv2.polylines(
                    image, [np.asarray(line["baseline"], dtype=np.int32)],
                    False, (0, 0, 255), 2,
                )
                label_x, label_y = line["baseline"][0]
            elif line["polygon"]:
                label_x, label_y = line["polygon"][0]
            else:
                label_x, label_y = 0, 15
            cv2.putText(
                image,
                f"{line['reading_order']}{'!' if flags else ''}",
                (label_x, max(15, label_y - 30)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 0, 255),
                2,
            )
            rows.append({
                "reading_order": line["reading_order"],
                "width": width,
                "height": height,
                "raw_points": line["raw_points"],
                "clean_points": len(line["polygon"]),
                "flags": flags,
            })

    output = cv2.addWeighted(overlay, 0.3, image, 0.7, 0)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    encoded_ok, encoded = cv2.imencode(".png", output)
    if not encoded_ok:
        raise OSError(f"Não foi possível codificar overlay: {args.out}")
    args.out.write_bytes(encoded.tobytes())

    line_count = len(rows)
    print(
        f"Imagem {raw_width}x{raw_height} | regiões: {len(data['regions'])} | "
        f"linhas: {line_count}"
    )
    if heights:
        print(f"Altura mediana do polígono de linha: {int(np.median(heights))} px")
    for row in rows:
        print(
            f"{row['reading_order']:>3} {row['width']:>5} {row['height']:>4} "
            f"{row['raw_points']:>7} {row['clean_points']:>10}  "
            f"{'; '.join(row['flags']) or '-'}"
        )
    for problem in problems:
        print(f"PROBLEMA: {problem}")
    print(f"Overlay salvo em {args.out}")
    if args.json_path:
        args.json_path.parent.mkdir(parents=True, exist_ok=True)
        args.json_path.write_text(
            json.dumps({**data, "rows": rows, "problems": problems},
                       ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"JSON salvo em {args.json_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

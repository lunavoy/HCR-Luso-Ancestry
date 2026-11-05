from src.recognition.htr.training.export_supabase import _points, crop_box


def test_points_accepts_pairs_and_dicts():
    assert _points([[1, 2], {"x": 3, "y": 4}]) == [(1.0, 2.0), (3.0, 4.0)]


def test_crop_box_pads_and_clamps():
    assert crop_box([(2, 3), (50, 3), (50, 20), (2, 20)], 40, 100) == (0, 0, 40, 24)


def test_crop_box_rejects_degenerate():
    assert crop_box([(5, 5)], 100, 100) is None
    assert crop_box([(5, 5), (6, 5)], 100, 100, pad=0) is None


def test_public_keys_are_rejected():
    from src.recognition.htr.training.export_supabase import _is_public_key
    assert _is_public_key("sb_publishable_x")
    assert not _is_public_key("sb_secret_x")


def _line(row_id, y, parent=None):
    return {"id": row_id, "element_type": "line", "parent_id": parent,
            "polygon": [[10, y], [500, y], [500, y + 20], [10, y + 20]]}


def test_group_records_splits_regions_per_record():
    import uuid
    from src.database.annotations import group_records

    region = {"id": "r", "element_type": "region", "parent_id": None, "reading_order": 0,
              "source_xml_id": "r", "polygon": [[0, 0], [600, 0], [600, 300], [0, 300]]}
    lines = [_line(f"l{i}", y, "r") for i, y in enumerate((0, 30, 60, 90, 200, 230, 260))]
    rows = group_records([region, *lines], str(uuid.uuid4()))
    records = [r for r in rows if r["element_type"] == "record"]
    regions = [r for r in rows if r["element_type"] == "region"]
    assert len(records) == 2 and len(regions) == 2
    assert {r["parent_id"] for r in regions} == {r["id"] for r in records}
    by_id = {r["id"]: r for r in rows}
    owner = lambda line: by_id[line["parent_id"]]["parent_id"]
    assert owner(by_id["l0"]) != owner(by_id["l6"])


def test_group_records_reuses_reviewed_record():
    import uuid
    from src.database.annotations import group_records

    reviewed = {"id": "kept", "polygon": [[0, 0], [600, 0], [600, 120], [0, 120]]}
    lines = [_line(f"l{i}", y) for i, y in enumerate((0, 30, 60, 90, 200, 230, 260))]
    rows = group_records(lines, str(uuid.uuid4()), existing_records=[reviewed])
    records = [r for r in rows if r["element_type"] == "record"]
    assert len(records) == 1
    assert next(r for r in rows if r["id"] == "l0")["parent_id"] == "kept"


def test_pagexml_keeps_lines_owned_by_records():
    from src.database.annotations import rows_to_pagexml

    rows = [
        {"id": "rec", "element_type": "record", "parent_id": None, "polygon": [[0, 0], [9, 0], [9, 9]]},
        {"id": "l1", "element_type": "line", "parent_id": "rec", "reading_order": 0,
         "polygon": [[0, 0], [9, 0], [9, 5]], "baseline": [[0, 5], [9, 5]]},
    ]
    assert 'id="l1"' in rows_to_pagexml(rows, image_filename="a.png", width=10, height=10)

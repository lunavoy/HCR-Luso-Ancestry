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


def test_group_records_splits_on_large_gaps():
    import uuid
    from src.database.annotations import group_records

    def line(y):
        return {"element_type": "line", "polygon": [[10, y], [500, y], [500, y + 20], [10, y + 20]]}

    rows = [line(y) for y in (0, 30, 60, 90, 200, 230, 260)]
    records = group_records(rows, str(uuid.uuid4()))
    assert len(records) == 2
    assert all(r["element_type"] == "record" for r in records)
    assert records[0]["polygon"][2][1] < records[1]["polygon"][0][1]

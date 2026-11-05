from src.recognition.htr.training.export_supabase import _points, crop_box


def test_points_accepts_pairs_and_dicts():
    assert _points([[1, 2], {"x": 3, "y": 4}]) == [(1.0, 2.0), (3.0, 4.0)]


def test_crop_box_pads_and_clamps():
    assert crop_box([(2, 3), (50, 3), (50, 20), (2, 20)], 40, 100) == (0, 0, 40, 24)


def test_crop_box_rejects_degenerate():
    assert crop_box([(5, 5)], 100, 100) is None
    assert crop_box([(5, 5), (6, 5)], 100, 100, pad=0) is None

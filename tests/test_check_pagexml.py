from pathlib import Path

import cv2
import numpy as np

from scripts.check_pagexml import parse_pagexml


def test_parse_pagexml_preserves_lines_and_baselines(tmp_path: Path):
    xml = tmp_path / "page.xml"
    xml.write_text(
        """<PcGts xmlns="http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15">
          <Page imageWidth="300" imageHeight="200">
            <TextRegion id="r1">
              <Coords points="10,10 290,10 290,190 10,190"/>
              <TextLine id="l1">
                <Coords points="20,30 280,30 280,50 20,50 20,30"/>
                <Baseline points="22,45 278,45"/>
              </TextLine>
            </TextRegion>
          </Page>
        </PcGts>""",
        encoding="utf-8",
    )

    result = parse_pagexml(xml)

    assert result["width"] == 300
    assert result["regions"][0]["polygon"] == [
        (10, 10), (290, 10), (290, 190), (10, 190)
    ]
    assert result["regions"][0]["lines"][0]["baseline"] == [(22, 45), (278, 45)]


def test_overlay_checker_handles_missing_baseline(tmp_path: Path, monkeypatch):
    image = tmp_path / "page.png"
    xml = tmp_path / "page.xml"
    output = tmp_path / "overlay.png"
    cv2.imwrite(str(image), np.zeros((200, 300, 3), dtype=np.uint8))
    xml.write_text(
        """<PcGts xmlns="http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15">
          <Page imageWidth="300" imageHeight="200">
            <TextRegion id="r1">
              <Coords points="10,10 290,10 290,190 10,190"/>
              <TextLine id="l1">
                <Coords points="20,30 280,30 280,50 20,50"/>
              </TextLine>
            </TextRegion>
          </Page>
        </PcGts>""",
        encoding="utf-8",
    )

    from scripts import check_pagexml

    monkeypatch.setattr(
        "sys.argv",
        ["check_pagexml", str(image), str(xml), "--out", str(output)],
    )
    assert check_pagexml.main() == 0
    assert output.is_file()

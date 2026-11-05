import copy
import uuid
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

from database.annotations import pagexml_to_rows, rows_to_pagexml


def _xml(path: Path) -> None:
    path.write_text(
        """<PcGts xmlns="http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15">
  <Page imageFilename="F:\\\\archive\\\\page.jpg" imageWidth="300" imageHeight="200">
    <TextRegion id="r1"><Coords points="0,0 290,0 290,190 0,190"/>
      <TextLine id="l1"><Coords points="10,10 280,10 280,40 10,40"/>
        <Baseline points="10,35 280,35"/>
      </TextLine>
    </TextRegion>
  </Page>
</PcGts>""",
        encoding="utf-8",
    )


def test_pagexml_rows_are_deterministic_and_preserve_original(tmp_path: Path):
    source = tmp_path / "page.xml"
    _xml(source)
    page_id = str(uuid.uuid4())
    first = pagexml_to_rows(source, page_id)
    second = pagexml_to_rows(source, page_id)
    assert [row["id"] for row in first["rows"]] == [row["id"] for row in second["rows"]]
    edited = copy.deepcopy(first["rows"])
    line = next(row for row in edited if row["element_type"] == "line")
    line["polygon"][0] = [20, 20]
    line["corrected_text"] = "texto revisto"
    exported = ET.fromstring(rows_to_pagexml(
        edited, image_filename="page.jpg", width=300, height=200))
    exported_line = next(item for item in exported.iter() if item.tag.endswith("TextLine"))
    assert exported_line.find("{*}Coords").get("points").startswith("20,20")
    assert line["original_polygon"][0] == [10, 10]


def test_export_requires_baseline(tmp_path: Path):
    source = tmp_path / "page.xml"
    _xml(source)
    rows = pagexml_to_rows(source, str(uuid.uuid4()))["rows"]
    next(row for row in rows if row["element_type"] == "line")["baseline"] = None
    with pytest.raises(ValueError, match="sem baseline"):
        rows_to_pagexml(rows, image_filename="page.jpg", width=300, height=200)

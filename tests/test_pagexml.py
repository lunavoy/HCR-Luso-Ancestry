from pathlib import Path

from database.pagexml import load_pagexml


def test_load_pagexml_preserves_polygons_baselines_and_words(tmp_path: Path):
    source = tmp_path / "page.xml"
    source.write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
<PcGts xmlns="http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15">
  <Page imageFilename="page.jpg">
    <TextRegion id="r1">
      <Coords points="10,20 200,20 200,100 10,100"/>
      <TextLine id="l1">
        <Coords points="12,30 198,30 198,55 12,55"/>
        <Baseline points="12,50 198,50"/>
        <Word id="w1">
          <Coords points="15,32 40,32 40,52 15,52"/>
          <TextEquiv><Unicode>Maria</Unicode></TextEquiv>
        </Word>
      </TextLine>
    </TextRegion>
  </Page>
</PcGts>
""",
        encoding="utf-8",
    )

    records = load_pagexml(source, "page.jpg")

    assert records[0]["source_image"] == "page.jpg"
    assert records[0]["polygon"] == [[10, 20], [200, 20], [200, 100], [10, 100]]
    assert records[0]["lines"][0]["baseline"] == [[12, 50], [198, 50]]
    assert records[0]["words"][0]["text"] == "Maria"
    assert records[0]["words"][0]["points"][0] == [15, 32]


def test_pagexml_uses_line_text_image_metadata_and_keeps_orphans(tmp_path: Path):
    source = tmp_path / "page.xml"
    source.write_text(
        """<PcGts xmlns="http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15">
  <Page imageFilename="F:\\\\archive\\\\page.jpg" imageWidth="2250" imageHeight="1500">
    <TextRegion id="r1"><Coords points="0,0 100,0 100,100 0,100"/>
      <TextLine id="l1"><Coords points="5,5 90,5 90,30 5,30"/>
        <Word><Coords points="5,5 30,5 30,30 5,30"/>
          <TextEquiv><Unicode>Maria</Unicode></TextEquiv></Word>
        <Word><Coords points="35,5 90,5 90,30 35,30"/>
          <TextEquiv><Unicode>Ferreira</Unicode></TextEquiv></Word>
        <TextEquiv><Unicode>Maria Ferreira</Unicode></TextEquiv>
      </TextLine>
    </TextRegion>
    <TextLine id="orphan"><Coords points="5,40 90,40 90,60 5,60"/>
      <Baseline points="5,55 90,55"/></TextLine>
  </Page>
</PcGts>""",
        encoding="utf-8",
    )

    records = load_pagexml(source)

    assert records[0]["source_image"] == "page.jpg"
    assert records[0]["image_size"] == {"width": 2250, "height": 1500}
    assert records[0]["lines"][0]["text"] == "Maria Ferreira"
    assert records[1]["id"] == "orphan-lines"
    assert records[1]["lines"][0]["id"] == "orphan"

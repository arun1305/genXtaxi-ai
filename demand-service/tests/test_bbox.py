import pytest

from app.geo.bbox import parse_bbox


def test_valid():
    assert parse_bbox("3.0,36.7,3.1,36.8") == (3.0, 36.7, 3.1, 36.8)


@pytest.mark.parametrize("raw", ["", "garbage", "1,2,3", "a,b,c,d", "3.1,36.7,3.0,36.8", "0,0,200,10"])
def test_invalid(raw):
    with pytest.raises(ValueError):
        parse_bbox(raw)

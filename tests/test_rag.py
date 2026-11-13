import pytest
from helpers import text_pdf

from rag import Index, split_text


def test_split_text_empty():
    assert split_text("") == []
    assert split_text("   \n  ") == []


def test_split_text_long_text_makes_several_chunks():
    text = ("This is a sentence about plants. " * 100).strip()
    chunks = split_text(text, size=300, overlap=50)
    assert len(chunks) > 3
    assert all(c.strip() for c in chunks)


def test_split_text_keeps_hindi():
    text = "यह एक परीक्षा है। " * 100
    chunks = split_text(text, size=300, overlap=40)
    assert len(chunks) > 1
    assert "परीक्षा" in " ".join(chunks)


def test_search_finds_the_relevant_chunk():
    idx = Index()
    idx.add_file("a.txt", b"Photosynthesis happens in chloroplasts.\n\nThe French Revolution began in 1789.")
    hits = idx.search("when did the french revolution begin", k=1)
    assert hits and "1789" in hits[0].text


def test_search_unrelated_returns_nothing():
    idx = Index()
    idx.add_file("a.txt", b"Photosynthesis happens in chloroplasts.")
    assert idx.search("zzzz qqqq") == []


def test_search_hindi_query_matches_hindi_text():
    idx = Index()
    idx.add_file("h.txt", "प्रकाश संश्लेषण क्लोरोप्लास्ट में होता है।\n\nफ्रांसीसी क्रांति 1789 में शुरू हुई।".encode())
    hits = idx.search("क्लोरोप्लास्ट", k=1)
    assert hits and "क्लोरोप्लास्ट" in hits[0].text


def test_hindi_words_are_not_split_at_vowel_signs():
    import re

    from rag import TOKEN

    assert re.findall(TOKEN, "क्लोरोप्लास्ट में होता है") == ["क्लोरोप्लास्ट", "में", "होता", "है"]


def test_hindi_search_ranks_the_right_sentence_first():
    idx = Index()
    idx.add_file("h.txt", "प्रकाश संश्लेषण क्लोरोप्लास्ट में होता है।\n\nफ्रांसीसी क्रांति 1789 में शुरू हुई।".encode())
    top = idx.search("फ्रांसीसी क्रांति कब शुरू हुई", k=1)[0]
    assert "1789" in top.text


def test_pdf_chunks_carry_page_numbers():
    idx = Index()
    idx.add_file("b.pdf", text_pdf(["Page one is about plants.", "Page two is about the revolution."]))
    hit = idx.search("revolution", k=1)[0]
    assert hit.page == 2 and hit.source == "b.pdf"


def test_remove_file():
    idx = Index()
    idx.add_file("a.txt", b"Plants make glucose.")
    idx.remove_file("a.txt")
    assert idx.chunks == [] and idx.search("glucose") == []


def test_unsupported_type_raises():
    with pytest.raises(ValueError):
        Index().add_file("x.exe", b"abc")

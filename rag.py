"""Minimal RAG core: load PDFs/notes, chunk them, retrieve relevant chunks."""
from __future__ import annotations

import io
import re
from dataclasses import dataclass

from pypdf import PdfReader
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel

# Word pattern that keeps Devanagari vowel signs (matras) inside the word.
# Python's default \w drops them, which would split Hindi words into fragments.
TOKEN = r"[\wऀ-ॿ]{2,}"

@dataclass
class Chunk:
    text: str
    source: str  # file name
    page: int | None  # page number for PDFs, None for notes


def load_file(name: str, data: bytes) -> list[tuple[str, int | None]]:
    """Return a list of (text, page) pairs for an uploaded file."""
    lower = name.lower()
    if lower.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(data))
        return [(p.extract_text() or "", i + 1) for i, p in enumerate(reader.pages)]
    if lower.endswith((".txt", ".md")):
        return [(data.decode("utf-8", errors="ignore"), None)]
    raise ValueError(f"Unsupported file type: {name}")


def split_text(text: str, size: int = 900, overlap: int = 150) -> list[str]:
    """Split text into ~size-char chunks on paragraph/sentence boundaries."""
    text = re.sub(r"[ \t]+", " ", text).strip()
    if not text:
        return []
    parts = re.split(r"(?<=[.!?।])\s+|\n{2,}", text)
    chunks, cur = [], ""
    for part in parts:
        if len(cur) + len(part) + 1 <= size:
            cur = f"{cur} {part}".strip()
        else:
            if cur:
                chunks.append(cur)
            cur = (cur[-overlap:] + " " + part).strip() if overlap else part
    if cur:
        chunks.append(cur)
    return chunks


class Index:
    """TF-IDF index over chunks (no API key or model download needed)."""

    def __init__(self) -> None:
        self.chunks: list[Chunk] = []
        self._vec: TfidfVectorizer | None = None
        self._matrix = None

    def add_file(self, name: str, data: bytes) -> int:
        added = 0
        for text, page in load_file(name, data):
            for piece in split_text(text):
                self.chunks.append(Chunk(piece, name, page))
                added += 1
        self._rebuild()
        return added

    def remove_file(self, name: str) -> None:
        self.chunks = [c for c in self.chunks if c.source != name]
        self._rebuild()

    def _rebuild(self) -> None:
        if not self.chunks:
            self._vec, self._matrix = None, None
            return
        self._vec = TfidfVectorizer(
            ngram_range=(1, 2), sublinear_tf=True, strip_accents="unicode", token_pattern=TOKEN
        )
        self._matrix = self._vec.fit_transform([c.text for c in self.chunks])

    def search(self, query: str, k: int = 5) -> list[Chunk]:
        if self._vec is None:
            return []
        scores = linear_kernel(self._vec.transform([query]), self._matrix).ravel()
        top = scores.argsort()[::-1][:k]
        return [self.chunks[i] for i in top if scores[i] > 0]

import io
import json

from pypdf import PdfWriter
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

SID = "test-session-0123456789"
SID2 = "other-session-9876543210"
NOTES = b"Photosynthesis happens in chloroplasts. Plants make glucose from sunlight and water."


def h(sid: str = SID) -> dict:
    return {"X-Session-Id": sid}


def text_pdf(pages: list[str]) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    for p in pages:
        c.drawString(60, 780, p)
        c.showPage()
    c.save()
    return buf.getvalue()


def blank_pdf() -> bytes:
    w = PdfWriter()
    w.add_blank_page(width=200, height=200)
    buf = io.BytesIO()
    w.write(buf)
    return buf.getvalue()


def upload(client, name="notes.txt", data=NOTES, sid=SID):
    return client.post("/api/upload", files={"file": (name, data)}, headers=h(sid))


def ask(client, question="where does photosynthesis happen", sid=SID):
    return client.post("/api/chat", json={"question": question}, headers=h(sid))


def events(resp) -> list[dict]:
    return [json.loads(line) for line in resp.text.splitlines() if line.strip()]

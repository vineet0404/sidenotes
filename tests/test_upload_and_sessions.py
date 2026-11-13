from helpers import NOTES, SID, SID2, ask, blank_pdf, h, text_pdf, upload

import server


def test_upload_text_file(client):
    r = upload(client)
    assert r.status_code == 200
    files = r.json()["files"]
    assert files[0]["name"] == "notes.txt" and files[0]["parts"] >= 1


def test_upload_pdf_with_text(client):
    r = upload(client, "doc.pdf", text_pdf(["Hello from a real PDF page."]))
    assert r.status_code == 200 and r.json()["files"][0]["name"] == "doc.pdf"


def test_upload_wrong_extension(client):
    assert upload(client, "virus.exe", b"abc").status_code == 415


def test_upload_too_large(client, monkeypatch):
    monkeypatch.setattr(server, "MAX_FILE_BYTES", 10)
    r = upload(client, "big.txt", b"x" * 11)
    assert r.status_code == 413 and "larger than" in r.json()["detail"]


def test_upload_blank_pdf_is_rejected(client):
    r = upload(client, "scan.pdf", blank_pdf())
    assert r.status_code == 422 and "No text found" in r.json()["detail"]


def test_upload_corrupt_pdf_is_rejected(client):
    r = upload(client, "bad.pdf", b"this is not a pdf")
    assert r.status_code == 422 and "read" in r.json()["detail"]


def test_file_limit_and_replacement(client, monkeypatch):
    monkeypatch.setattr(server, "MAX_FILES", 1)
    assert upload(client, "a.txt").status_code == 200
    assert upload(client, "b.txt").status_code == 400
    again = upload(client, "a.txt", b"Replaced content about the revolution.")
    assert again.status_code == 200 and len(again.json()["files"]) == 1


def test_delete_file(client):
    upload(client)
    r = client.delete("/api/files/notes.txt", headers=h())
    assert r.status_code == 200 and r.json()["files"] == []


def test_missing_or_invalid_session_id(client):
    assert client.get("/api/state").status_code == 400
    assert client.get("/api/state", headers={"X-Session-Id": "short"}).status_code == 400


def test_sessions_are_isolated(client):
    upload(client, sid=SID)
    other = client.get("/api/state", headers=h(SID2)).json()
    assert other["files"] == []
    assert ask(client, sid=SID2).status_code == 400  # no files in the other session


def test_state_reports_limits(client):
    s = client.get("/api/state", headers=h()).json()
    assert s["limit"] == server.MAX_QUESTIONS and s["max_files"] == server.MAX_FILES


def test_reset_clears_chat_but_keeps_files(client):
    upload(client)
    ask(client)
    r = client.post("/api/reset", headers=h()).json()
    assert r["messages"] == [] and len(r["files"]) == 1


def test_notes_constant_is_searchable_text():
    assert b"chloroplasts" in NOTES

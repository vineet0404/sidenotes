import json

from helpers import SID, ask, h, upload

import server


def lines():
    if not server.FEEDBACK_FILE.exists():
        return []
    return [json.loads(x) for x in server.FEEDBACK_FILE.read_text(encoding="utf-8").splitlines() if x]


def chat_once(client):
    upload(client)
    ask(client)  # messages: 0 = user, 1 = assistant


def send(client, **body):
    return client.post("/api/feedback", json=body, headers=h(SID))


def test_thumbs_up_is_saved_and_logged(client):
    chat_once(client)
    r = send(client, index=1, value="up")
    assert r.status_code == 200
    assert client.get("/api/state", headers=h()).json()["messages"][1]["feedback"] == "up"
    rec = lines()[0]
    assert rec["value"] == "up" and rec["sources"] == 1 and "answer" not in rec and "question" not in rec


def test_thumbs_down_without_opt_in_has_no_content(client):
    chat_once(client)
    send(client, index=1, value="down", reason="wrong_source", comment="Cited page 3 but it is on page 4", share=False)
    rec = lines()[0]
    assert rec["reason"] == "wrong_source" and rec["comment"].startswith("Cited page 3")
    assert "question" not in rec and "answer" not in rec


def test_thumbs_down_with_opt_in_includes_question_and_answer(client):
    chat_once(client)
    send(client, index=1, value="down", reason="wrong_answer", share=True)
    rec = lines()[0]
    assert rec["question"] == "where does photosynthesis happen"
    assert rec["answer"].startswith("Photosynthesis happens")


def test_share_is_ignored_for_thumbs_up(client):
    chat_once(client)
    send(client, index=1, value="up", share=True)
    assert "answer" not in lines()[0]


def test_log_never_contains_session_id_or_file_text(client):
    chat_once(client)
    send(client, index=1, value="down", reason="other")
    raw = server.FEEDBACK_FILE.read_text(encoding="utf-8")
    assert SID not in raw and "chloroplasts" not in raw


def test_feedback_can_be_changed(client):
    chat_once(client)
    send(client, index=1, value="up")
    send(client, index=1, value="down", reason="other")
    assert client.get("/api/state", headers=h()).json()["messages"][1]["feedback"] == "down"
    assert len(lines()) == 2


def test_feedback_rejects_user_message_and_bad_index(client):
    chat_once(client)
    assert send(client, index=0, value="up").status_code == 400
    assert send(client, index=9, value="up").status_code == 400
    assert send(client, index=-1, value="up").status_code == 400


def test_feedback_rejects_bad_value_reason_and_long_comment(client):
    chat_once(client)
    assert send(client, index=1, value="meh").status_code == 422
    assert send(client, index=1, value="down", reason="because").status_code == 422
    assert send(client, index=1, value="down", reason="other", comment="x" * 301).status_code == 422


def test_feedback_needs_a_session(client):
    r = client.post("/api/feedback", json={"index": 1, "value": "up"})
    assert r.status_code == 400


def test_feedback_is_rate_limited(client, monkeypatch):
    monkeypatch.setattr(server, "FEEDBACK_PER_MIN", 2)
    chat_once(client)
    assert send(client, index=1, value="up").status_code == 200
    assert send(client, index=1, value="up").status_code == 200
    assert send(client, index=1, value="up").status_code == 429


def test_config_endpoint(client, monkeypatch):
    monkeypatch.setattr(server, "CONTACT_EMAIL", "hello@example.org")
    assert client.get("/api/config").json() == {"contact": "hello@example.org"}


def test_legal_pages_are_served_and_linked(client):
    for page in ("privacy", "terms"):
        r = client.get(f"/{page}.html")
        assert r.status_code == 200 and "Sidenote" in r.text
    home = client.get("/").text
    assert "/privacy.html" in home and "/terms.html" in home


def test_design_previews_are_served_and_not_indexed(client):
    for page in ("login", "library", "pricing"):
        r = client.get(f"/design/{page}.html")
        assert r.status_code == 200 and "noindex" in r.text


def test_theme_script_and_tokens_are_served(client):
    assert "contrast" in client.get("/theme.js").text
    css = client.get("/style.css").text
    for name in ("night", "sepia", "forest", "ocean", "rose", "contrast"):
        assert f'data-theme="{name}"' in css

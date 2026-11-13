import pytest
from fastapi.testclient import TestClient

import llm
import server


@pytest.fixture(autouse=True)
def clean_state(monkeypatch, tmp_path):
    """Fresh sessions, fresh rate limits, a fake model, and a temp feedback file for every test."""
    server.SESSIONS.clear()
    server._hits.clear()
    server._daily.clear()
    monkeypatch.setattr(server, "FEEDBACK_FILE", tmp_path / "feedback.jsonl", raising=False)
    monkeypatch.setattr(
        llm, "stream_answer", lambda system, messages: iter(["Photosynthesis ", "happens in chloroplasts [1]."])
    )
    yield


@pytest.fixture
def client():
    return TestClient(server.app)

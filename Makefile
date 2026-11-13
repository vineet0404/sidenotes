.PHONY: dev test lint fix

dev:
	LLM_BASE_URL=$${LLM_BASE_URL:-http://localhost:11434/v1} uvicorn server:app --reload --port 8000

test:
	pytest

lint:
	ruff check .

fix:
	ruff check . --fix

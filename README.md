# Sidenote: PDF / notes chatbot (website)

Visitors upload a PDF or notes and ask questions in Hindi, English or Hinglish.
Every answer carries numbered citations; clicking one opens the source page with the
matching sentence highlighted.

```
static/   index.html, style.css, app.js   the website
server.py FastAPI: sessions, upload, streaming chat, limits
rag.py    PDF/text loading, chunking, TF-IDF retrieval
llm.py    LLM backend (self-hosted OpenAI-compatible, or Claude)
```

## Run locally
```bash
ollama pull qwen2.5:7b
pip install -r requirements.txt
LLM_BASE_URL=http://localhost:11434/v1 LLM_MODEL=qwen2.5:7b \
  uvicorn server:app --port 8000          # open http://localhost:8000
```
Keep ONE uvicorn worker: sessions live in process memory.

## Put it online
1. Rent a VM (GPU like L4/T4 for the model, or a CPU VM + a separate GPU box).
2. `docker compose up -d`, then `docker compose exec ollama ollama pull qwen2.5:7b`.
3. Put a domain + HTTPS in front (Caddy or Cloudflare). Set `TRUST_PROXY=1` only when
   a proxy is really in front, otherwise visitors can spoof their IP and dodge limits.

To use Claude instead: `LLM_BACKEND=claude ANTHROPIC_API_KEY=... `.

## Settings (env vars)
| Var | Default | Meaning |
|---|---|---|
| LLM_BACKEND, LLM_BASE_URL, LLM_MODEL, LLM_API_KEY | openai, local Ollama | model endpoint |
| MAX_QUESTIONS_PER_SESSION | 30 | free-tier cap per browser session |
| RATE_PER_MIN / IP_DAILY_QUESTIONS | 8 / 150 | per-IP limits |
| MAX_FILE_MB / MAX_FILES | 10 / 5 | uploads per visitor |
| SESSION_TTL_MIN / MAX_SESSIONS | 120 / 300 | how long files stay, and memory cap |

The product name "Sidenote" appears only in `static/index.html`; replace it there to rebrand.

## Not built yet (needed before charging money)
- Accounts and payments: the free cap is per browser session, so clearing site data
  resets it (the per-IP limits only soften this). Add login, per-user usage in a
  database, and Razorpay/Stripe.
- Scanned PDFs (needs OCR), and better retrieval (multilingual embeddings).
- A privacy policy and terms; users upload their own documents.

# Sidenote: feature checklist

Tick items as you finish them. Part 1 is what exists today. Part 2 is what to build, in order. Hours are rough estimates for one developer.

## Part 1: already built

- [x] Landing page with example, how it works, privacy
- [x] Workspace: files rail, chat, source panel
- [x] Dark and light mode; works on mobile
- [x] Upload PDF, TXT, MD (5 files, 10 MB each), drag and drop, remove file
- [x] Streaming answers; English, Hindi, Hinglish questions
- [x] Numbered citations; source panel with the matching sentence highlighted
- [x] Stop, Copy answer, New chat, starter questions, follow-up memory
- [x] Private per-visitor session; files deleted after 2 hours
- [x] Question cap per session, per-IP rate limit, upload checks
- [x] Self-hosted LLM (Ollama or vLLM) or Claude through one setting
- [x] Docker files

Not yet tested: a real LLM. Only a mock server was used.

## Part 2: to build, step by step

### Step 1: test with a real model (about 3 hours)
- [ ] Run Ollama or a hosted model and ask 30 questions over 10 real PDFs
- [ ] Note wrong answers, slow answers, bad citations
- **Done when:** you know if answer quality is good enough to show people

### Step 2: foundations (about 8 hours)
- [ ] Put the project in git
- [ ] Write tests for chunking, search, upload checks, session isolation, rate limits
- [ ] Set up CI (lint + tests on every push)
- **Done when:** CI is green on a fresh clone

### Step 3: beta deploy (about 12 hours)
- [ ] Rent a small VPS, add a domain and HTTPS (Caddy)
- [ ] Connect the model, run with Docker
- [ ] Add error tracking (Sentry) and an uptime check
- **Done when:** a friend can open the site on their phone and get an answer

### Step 4: learn from users (about 10 hours)
- [ ] Thumbs up/down on every answer
- [ ] Product analytics: visit, upload, question, citation click, limit hit
- [ ] Feedback form; privacy and terms pages
- [ ] Invite 20-30 people and talk to 10 of them
- [ ] Measure real cost per question
- **Done when:** 20 people used it and you know your cost per question

### Step 5: accounts and saved library (about 28 hours)
- [ ] PostgreSQL and Google sign-in
- [ ] Save files, passages and chats per user
- [ ] Library page and chat history
- [ ] Delete my account and all files
- **Done when:** you return the next day and your files and chats are still there

### Step 6: better search (about 12 hours)
- [ ] Multilingual embeddings (for example bge-m3) with pgvector
- [ ] Combine with keyword search
- [ ] Test set of 40 questions to measure quality
- **Done when:** Hinglish questions find English passages

### Step 7: plans and payments (about 22 hours)
- [ ] Free, Plus and Pro plans in a config file
- [ ] Per-user question and file limits
- [ ] Razorpay subscription and webhook
- [ ] Pricing page; legal pages reviewed
- **Done when:** a test payment upgrades an account and a failed payment downgrades it

### Step 8: features that keep users (after launch)
- [ ] OCR for scanned PDFs
- [ ] In-page PDF viewer with highlight
- [ ] Notebook: save highlights with notes
- [ ] DOCX, PPTX, Excel, web links
- [ ] Flashcards and quizzes
- [ ] Export chat; share link

Build the step 8 items in the order your users ask for them.

## How this maps to the other documents

- Steps 2-4 are the first 30 days of the 90-day plan (Phase 1).
- Steps 5-6 are days 31-60 (Phase 2).
- Step 7 is days 61-90 (Phase 3).
- Step 8 comes after day 90.
- Full detail for each step is in DEVELOPMENT_PLAN.md; the wider idea list is in FEATURES.md.

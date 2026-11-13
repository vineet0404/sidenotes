# Sidenote: development plan

A step-by-step plan to take Sidenote from the current working prototype to a paid public product. Each phase has a goal, ordered steps, and a "done when" test, so you always know whether a phase is finished.

**How to read the estimates.** Days are *working days for one developer working full time*, including testing. Working part time, roughly double them. Treat every number as a guess to revise after Phase 1, when you will know your real speed and real costs.

**How to use it.** Work one phase at a time. Do not start the next phase until the current "done when" is true. Tick the boxes as you go and write what you learned at the bottom of each phase.

---

## 0. Ground rules

### 0.1 Where you are now

A working prototype: FastAPI backend, vanilla JS front end, in-memory per-visitor sessions, TF-IDF retrieval, streaming answers with numbered citations, a source panel with highlighted sentences, self-hosted or Claude LLM through `llm.py`, per-session and per-IP limits, Docker files. No accounts, no database, no payments, no tests.

### 0.2 Stack decisions

| Area | Choice | Why | Alternative |
|---|---|---|---|
| Backend | FastAPI (keep) | Already built; good for streaming | Django if you want built-in admin |
| Database | PostgreSQL 16 + pgvector | One database for users, files, chats and vectors | Qdrant for vectors if you outgrow pgvector |
| ORM and migrations | SQLAlchemy 2 + Alembic | Standard, well documented | SQLModel |
| Cache and queue | Redis + arq (or RQ) | Sessions, rate limits, background jobs | Postgres-based queue to run fewer services |
| File storage | S3-compatible (Cloudflare R2, MinIO) | Cheap, standard API | Local disk volume during beta only |
| Login | Google OAuth 2.0 (authlib), server-side session cookie | Fewest steps for users | Add email codes later |
| LLM serving | Ollama in development, vLLM in production | vLLM batches requests, so one GPU serves more people | llama.cpp server for CPU-only |
| Chat model | A 7-8B instruct model (Qwen2.5-7B-Instruct class) | Good quality for its size, decent Hindi | Claude API for paid tiers. Check the license of any model before commercial use |
| Embeddings | bge-m3 or multilingual-e5-large | Multilingual: Hindi, Hinglish and English in one space | Smaller e5 model if latency matters |
| PDF text and coordinates | pypdf now; pypdfium2 for character boxes | Permissive licenses | PyMuPDF is AGPL: avoid unless you buy a commercial license |
| OCR | Tesseract (`hin+eng`) through OCRmyPDF | Free, runs on your server | Cloud OCR for handwriting |
| PDF viewer | pdf.js | Open source, widely used | Embedded browser viewer (no highlight control) |
| Payments | Razorpay (India), Stripe (global) | UPI and cards in India; Stripe for abroad | Lemon Squeezy / Paddle as merchant of record |
| Email | Resend (or similar) | Simple API | SES |
| Hosting | One VM for web + one GPU machine | Simple to reason about | Managed platform later |
| HTTPS and proxy | Caddy | Automatic certificates | nginx + certbot |
| Monitoring | Sentry, PostHog, uptime check, Grafana or hosted metrics | Errors, product analytics, availability, performance | Self-hosted alternatives |
| CI | GitHub Actions | Free tier is enough | GitLab CI |

### 0.3 Definition of done (applies to every task)

- Code merged through a pull request, reviewed (self-review is fine when solo)
- Tests written for the new behaviour, including the failure path
- Config and docs updated (`.env.example`, README)
- Deployed to staging and clicked through on desktop and a phone, in light and dark mode
- No new console or server errors; user-facing errors say what happened and what to do
- No document text or personal data written to logs

### 0.4 Working method

- Trunk-based: short-lived branches, one pull request per task, merge to `main` only when CI is green
- Tag each phase when done (`v0.2-beta`, `v0.3-accounts`, ...)
- Keep a decision log (Appendix G): one line per decision, with the date and the reason
- Weekly: demo to yourself or a friend, review metrics, reorder the next week

---

## Phase 0: Foundations (about 3 days)

**Goal:** a safe place to build, with tests that catch mistakes.

- [ ] **0.1 Version control.** Initialise git, add `.gitignore` (Python, `.env`, `__pycache__`, uploads), commit the prototype, tag it `v0.1-prototype`. Create a private GitHub repo.
- [ ] **0.2 Restructure into a package.** Move code to `app/` with folders for API routes, core settings, services (retrieval, LLM, billing later) and models. Keep behaviour identical. Target layout is in Appendix A.
- [ ] **0.3 Central configuration.** Read all settings through one `Settings` class (pydantic-settings). Add `.env.example`. No secrets in the repository, ever.
- [ ] **0.4 Tooling.** `ruff` for lint and format, `pytest`, `pre-commit` hooks, a `Makefile` with `make dev`, `make test`, `make lint`.
- [ ] **0.5 Write tests for what exists.**
  - chunking: empty text, very long text, Hindi text, overlap
  - search: finds the right chunk, returns nothing for unrelated words
  - upload: wrong extension, too large, corrupt PDF, empty PDF, duplicate name
  - sessions: user A cannot see user B's files; session expiry
  - rate limits and question cap
  - chat streaming with a fake LLM (make the LLM injectable so tests never call a model)
- [ ] **0.6 Continuous integration.** GitHub Actions runs lint, tests and a Docker build on every pull request.
- [ ] **0.7 Logging.** Structured JSON logs with a request id. Log events (upload size, duration, status), never document text or questions.
- [ ] **0.8 Environments.** Define `local`, `staging`, `production` with separate settings.

**Done when:** a fresh clone runs with `make dev`; CI is green; the tests above exist and pass.

---

## Phase 1: Beta on the real internet (about 5 days)

**Goal:** 20-50 real people use the current version, and you learn what they do and what it costs.

- [ ] **1.1 Pick hosting.** One small VM for the web app, one GPU machine for the model (or a single GPU VM during beta). Rough VRAM guide: a 7B model in 4-bit needs about 6 GB; in 16-bit about 16 GB. Check your chosen model's real numbers.
- [ ] **1.2 Set up the GPU machine.** NVIDIA drivers, Docker, NVIDIA container toolkit. Run vLLM (or Ollama). Test with a direct request to `/v1/chat/completions`.
- [ ] **1.3 Measure the model.** Tokens per second, time to first token, and how many simultaneous questions it handles before latency becomes unpleasant. Write the numbers down. They decide your concurrency limit and your cost per question (Appendix F).
- [ ] **1.4 Protect the GPU.** Add a limit on simultaneous model calls. When full, return a clear "busy, retry in N seconds" message (a proper queue comes in Phase 6).
- [ ] **1.5 Domain and HTTPS.** Point DNS, run Caddy in front of the app, set `TRUST_PROXY=1`, and confirm the app sees real client IPs.
- [ ] **1.6 Hardening basics.**
  - security headers (Content-Security-Policy, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`)
  - maximum request size at the proxy
  - proxy timeouts and no response buffering, so streaming works
  - CORS closed (same-origin only)
- [ ] **1.3b Fonts.** Self-host the two web fonts (download and serve them) so the page does not depend on Google Fonts and loads fast.
- [ ] **1.7 Monitoring.** Sentry for back end and front end; an uptime check on `/health`; basic metrics (requests, latency, errors); GPU utilisation.
- [ ] **1.8 Product analytics.** Events: `landing_view`, `upload_started`, `upload_succeeded`, `question_asked`, `citation_opened`, `limit_hit`, `copy_clicked`. Never send document content or question text.
- [ ] **1.9 Feedback.** Thumbs up/down on every answer (store counts), plus a short feedback form.
- [ ] **1.10 Minimum legal text.** A short privacy note and terms page, and the "answers can be wrong" notice. Replace with proper versions in Phase 3.
- [ ] **1.11 Load test.** k6 or Locust at 20 concurrent users doing upload then three questions. Fix what breaks first.
- [ ] **1.12 Invite users.** Friends, classmates, communities. Tell them it is a beta and that sessions reset on restart.

**Questions the beta must answer:** What do people upload? What do they ask, in which language? How often does the model say "not found" wrongly? Where do visitors drop off? What did a question really cost?

**Done when:** at least 20 people completed upload-then-question; no unexplained crashes for a week; you know cost per question; you have a ranked list of the top 10 problems.

---

## Phase 2: Accounts, database, saved library (about 12 days)

**Goal:** users have accounts, and their files and chats are still there tomorrow.

- [ ] **2.1 Services.** Provision PostgreSQL (managed if you can) and Redis. Add SQLAlchemy models and Alembic migrations (schema in Appendix B). Every schema change from now on is a migration.
- [ ] **2.2 Login with Google.** Flow: `/auth/login` -> Google -> `/auth/callback` -> create or find the user by Google `sub` -> set a session. Cookie flags: `HttpOnly`, `Secure`, `SameSite=Lax`. Add expiry and logout. Protect state-changing requests against CSRF (custom header check or double-submit token).
- [ ] **2.3 Keep a no-sign-up trial.** Anonymous visitors get a small allowance (for example one file and five questions) so the landing page still converts. When they sign in, move their trial files and chat into the account.
- [ ] **2.4 File upload pipeline.**
  1. validate extension, file signature (magic bytes) and size
  2. store the original in object storage under `user_id/file_id`
  3. create a `files` row with status `processing`
  4. a background job extracts text and chunks, then sets `ready` or `failed` with a reason
  5. store a checksum to detect duplicates
- [ ] **2.5 Background worker.** Run the ingestion job in a worker (arq). Add retries, a per-file time limit, a page limit, and clear failure messages. The UI shows progress states: uploaded, reading, ready, failed.
- [ ] **2.6 Persist chunks.** Store chunks with page number and order. Replace the in-memory index with PostgreSQL full-text search (`tsvector`, `simple` configuration so Hindi and English both work) as the interim search until embeddings arrive in Phase 4. Search is always filtered by the asking user's files.
- [ ] **2.7 Conversations.** Tables and endpoints for conversations and messages (citations stored with each answer). Create, list, rename, delete. A conversation is scoped to a chosen set of files.
- [ ] **2.8 Front end.**
  - sign-in button and account menu
  - library: files with status, size, date, delete
  - conversation list in the sidebar; "New chat"
  - choose which files a chat covers
  - empty, loading and error states for each screen
- [ ] **2.9 Account controls.** "Delete my account": removes files, chunks, conversations and stored objects. "Download my data": JSON or zip.
- [ ] **2.10 Retention job.** Scheduled cleanup that deletes expired files according to the user's plan.
- [ ] **2.11 Remove in-memory sessions.** All state lives in Postgres and Redis, so you can run several web workers.
- [ ] **2.12 Tests.**
  - OAuth flow with a mocked provider
  - **authorization on every endpoint:** user A requesting user B's file, chat, message or note must fail (write these explicitly)
  - ingestion success, failure, retry
  - deletion removes database rows *and* stored objects
  - anonymous-to-account merge

**Security notes.** Filter every query by the signed-in user. Use random UUIDs, not counters. Serve downloads through short-lived signed URLs.

**Done when:** you sign in, upload, close the browser, come back the next day, and your files and chats are there; the authorization tests prove user B cannot reach user A's data; deleting an account leaves nothing behind in the database or storage.

---

## Phase 3: Plans, quotas, payments, legal (about 10 days)

**Goal:** you can charge money safely.

- [ ] **3.1 Plans as configuration.** Define Free and Pro (Team later) in a config file, not in code: questions per day or month, number of files, size per file, pages, retention days, model tier, feature flags.
- [ ] **3.2 Usage metering.** A `usage_events` table: user, type, model, tokens in and out, estimated cost, time. Check and reserve quota atomically (a Redis counter or a database row lock) so two simultaneous requests cannot both pass the last slot. Release the slot if the request fails.
- [ ] **3.3 Enforce limits and explain them.** A dependency that checks quota before every question or upload. The UI shows the meter, a clear "limit reached" message and an upgrade button.
- [ ] **3.4 Razorpay subscriptions (test mode first).**
  1. create plans in the Razorpay dashboard
  2. backend creates a subscription, front end opens Razorpay Checkout
  3. **webhook** endpoint: verify the `X-Razorpay-Signature` header (HMAC-SHA256 of the raw request body with your webhook secret) before trusting anything
  4. process each event id only once (idempotent), then update the `subscriptions` table
  5. handle statuses: created, active, pending or halted, cancelled, completed
  6. failed renewal: keep access for a short grace period, then downgrade
  7. cancellation: access continues until the period ends
  8. plan changes: apply at the next billing date (simplest, avoids proration bugs)
  Check Razorpay's current rules for recurring payments in India before launch.
- [ ] **3.5 Provider abstraction.** Put billing behind a `BillingProvider` interface so adding Stripe for international customers later does not touch the rest of the code.
- [ ] **3.6 Billing page and emails.** Current plan, usage, renewal date, cancel button, receipts. Emails: welcome, receipt, payment failed, 80% of limit used, cancellation confirmed.
- [ ] **3.7 Pricing page.** Plan comparison, FAQ, monthly and yearly options, local currency.
- [ ] **3.8 Tax and invoicing.** In India this usually means GST registration and compliant invoices once you cross the applicable threshold or sell to businesses. Ask a chartered accountant what applies to you and when. Keep clean records from the first rupee.
- [ ] **3.9 Abuse prevention.** Verified Google accounts only, block disposable emails, Cloudflare Turnstile (or similar) on sign-up, per-user and per-IP limits, a flag-and-ban tool.
- [ ] **3.10 Minimal admin panel.** Search users, see usage, override a plan, ban, delete data. Protected by role and two-factor, with an audit log of every admin action.
- [ ] **3.11 Proper legal documents.** Privacy policy (what you collect, why, how long, and which services see it: hosting, Sentry, PostHog, Razorpay), terms of use, refund policy (payment providers require one), consent notice at sign-up, a grievance contact, deletion process. If you serve India, review obligations under the Digital Personal Data Protection Act; for EU users, GDPR. Have a lawyer review before charging.
- [ ] **3.12 Tests.** Webhook signature rejection, replayed events do nothing twice, concurrent requests cannot exceed quota, upgrade, downgrade, failed payment, cancellation. Use the provider's test mode and webhook simulators.

**Done when:** a test-mode purchase upgrades an account; a failed payment downgrades it after the grace period; concurrent requests cannot exceed the quota; legal pages are live and linked from sign-up and the footer.

---

## Phase 4: Retrieval quality (about 12 days)

**Goal:** noticeably better answers, especially for Hindi and Hinglish questions.

**Rule: measure first.** Do 4.1-4.3 before changing anything, so every later change is judged by numbers.

- [ ] **4.1 Build the evaluation set.** 60-100 questions over 8-10 varied documents: a textbook chapter, a research paper, class notes, a contract, a Hindi document, a table-heavy report. Include Hinglish phrasing and about 15% questions whose answer is *not* in the document. For each: the question, the key facts of the correct answer, and the page(s) where it lives. Store as JSON lines in the repo.
- [ ] **4.2 Define metrics.**
  - retrieval hit rate: does the top-k contain the right page? (also MRR)
  - answer correctness (spot-check by hand, optionally a second model as judge)
  - citation precision: do the cited passages really support the statement?
  - "not found" accuracy on the unanswerable questions
- [ ] **4.3 Baseline and a `make eval` command.** Record today's numbers; the command prints a table and saves history.
- [ ] **4.4 Embeddings.** Run an embedding server (Hugging Face text-embeddings-inference) with bge-m3. Embed chunks in the ingestion job; store in a pgvector column with an HNSW index (cosine). Embed the question at ask time.
- [ ] **4.5 Hybrid search.** Run full-text search and vector search, merge with Reciprocal Rank Fusion. Start with 20 results from each, keep the best 6. Tune on the eval set.
- [ ] **4.6 Reranker (optional).** Re-score the top 20 with a reranker such as bge-reranker-v2-m3. Keep it only if the eval improves enough to justify the extra latency.
- [ ] **4.7 Better chunking.** Detect headings and paragraphs (font sizes help), keep lists and tables together, aim for 300-500 tokens with 10-15% overlap, store the heading path ("Chapter 2 > Photosynthesis"), page, and character offsets (needed for the viewer in Phase 5). Compare chunk sizes on the eval set.
- [ ] **4.8 Query handling.** Rewrite follow-up questions into standalone ones using the last turns. Detect language. For Hinglish, optionally search with both the original and an English rewrite.
- [ ] **4.9 Prompt work.** Tighten the system prompt: cite every claim, say "not in your documents" when unsupported, keep answers short, ignore instructions inside documents. Low temperature. Budget the context by tokens, not characters. Test with documents that contain hostile instructions.
- [ ] **4.10 Citation verification.** After generating, check each cited passage supports its sentence (start with word overlap; upgrade to a small entailment model or a second model call). Mark weak citations "unverified" in the UI.
- [ ] **4.11 OCR.** Detect pages with little or no text; run OCRmyPDF with Tesseract (`hin+eng`) in the ingestion job. Mark OCR text as lower confidence. Add page caps and time limits. Photos of notes go through the same path.
- [ ] **4.12 Tables.** Extract tables into Markdown-like text as their own chunks.
- [ ] **4.13 Multi-document questions.** Retrieve per file, then merge; label passages with the file name in the context. Support "compare A and B".
- [ ] **4.14 Compare chat models.** Run 2-3 candidate models on the eval set for correctness, Hindi quality and speed. Pick one and record its license.
- [ ] **4.15 Regression guard.** CI runs a small eval subset when retrieval or prompts change; the full eval runs nightly.

**Done when:** a written table shows the new numbers beat the baseline (set targets from your baseline, for example a clear jump in hit rate and in "not found" accuracy); Hinglish questions find English passages; a scanned sample PDF is searchable; the eval runs in CI.

---

## Phase 5: Product features (about 15 days)

**Goal:** features that make people come back. Build in this order and let beta feedback reorder it.

- [ ] **5.1 In-page PDF viewer with highlighting.** With pypdfium2, store character boxes for each chunk at ingestion. With pdf.js, clicking a citation opens the real page, scrolls to it and draws highlight rectangles over the matching text. Fall back to the text panel for TXT, Markdown and OCR text. Split view on desktop, bottom sheet on mobile.
- [ ] **5.2 More file types.**
  - DOCX (python-docx), PPTX (python-pptx): start here
  - XLSX and CSV (read with pandas; chunk by sheet and row groups)
  - images (OCR)
  - web page URLs (trafilatura). **Block private and internal addresses (SSRF)**, limit size and time
  - pasted text
  - YouTube transcripts (check the terms of service first)
  - Google Drive picker later
- [ ] **5.3 Summary on upload.** A background job writes a short summary, key topics and five suggested questions, shown in the ready state. Control cost: summarise in stages and cap tokens.
- [ ] **5.4 Notebook (the signature feature).** From the source panel, "Save to notebook" stores the quote, file, page, offsets, your note and tags. Notebook view: search, filter by file, edit, delete, export. Optional "ask my notes" mode.
- [ ] **5.5 Collections.** Group files into subjects or projects and ask across a collection.
- [ ] **5.6 Chat tools.** Edit a question and re-run, regenerate an answer, delete a message, pin an answer, search across past chats.
- [ ] **5.7 Share links.** Create a read-only snapshot of a conversation containing only the messages and the cited passages (not the full document). Unguessable token, expiry, one-click revoke, `noindex`. Show a privacy warning before creating.
- [ ] **5.8 Export.** Conversation or notebook to Markdown, PDF and Word, with citations.
- [ ] **5.9 Study tools.** Flashcards and multiple-choice quizzes generated from chosen pages with page references. Require structured JSON output and validate it. Spaced repetition later.
- [ ] **5.10 Feedback loop.** Thumbs plus a reason, stored with the question, the retrieved passages and the answer. An admin view lists low-rated answers; good examples feed the eval set.
- [ ] **5.11 Voice (optional).** Browser speech input (Hindi and English) and read-aloud.
- [ ] **5.12 Front-end engineering.** When the vanilla JS gets hard to maintain (likely around 5.4-5.6), move to Vite + TypeScript with a small component framework. Run an accessibility audit (axe, keyboard navigation, contrast). Add interface translation scaffolding.
- [ ] **5.13 End-to-end tests.** Playwright flows: sign in, upload, ask, open citation, save to notebook, share, export.

**Done when:** each feature has acceptance criteria written in its pull request and an end-to-end test; the viewer highlights the right text on at least ten varied PDFs.

---

## Phase 6: Security, reliability, scale (about 8 days, then ongoing)

**Goal:** it stays up, stays safe and stays affordable when strangers use it.

- [ ] **6.1 Security review.**
  - authentication and sessions; authorization tests on every endpoint
  - input validation everywhere
  - **file parsing in a sandbox:** run PDF, DOCX and PPTX parsing in a separate low-privilege worker with CPU, memory and time limits; guard against zip bombs and decompression bombs (DOCX and PPTX are zip files)
  - SSRF protection for URL import
  - XSS (the renderer escapes text; add a strict Content-Security-Policy)
  - CSRF, rate limits, secrets management
  - dependency scanning (`pip-audit`, Dependabot)
  - containers: non-root user, minimal images
  - encrypted backups
- [ ] **6.2 Prompt-injection tests.** Keep a set of hostile documents in the test suite (instructions to reveal the system prompt, to change language, to output links). The model must have no tools that act on a user's behalf. Never render external images or links from model output without escaping.
- [ ] **6.3 Reliability.**
  - readiness and liveness checks
  - graceful shutdown that lets streams finish
  - timeouts and retries with backoff for the model
  - circuit breaker with a **fallback model** (smaller model or hosted API) when the GPU is down
  - a real queue with position and estimated wait
- [ ] **6.4 Scale.** Stateless web replicas behind the proxy; Redis for sessions and limits; workers scaled by queue depth; more model replicas when needed; cache embeddings and repeated answers; connection pooling (pgbouncer); index tuning and pagination.
- [ ] **6.5 Backups and recovery.** Daily database backups plus point-in-time recovery, versioned object storage, and a **restore drill** you actually run. Write down your recovery time and acceptable data-loss targets.
- [ ] **6.6 Dashboards and alerts.** Latency (median and 95th percentile), error rate, queue depth, GPU utilisation, tokens per second, cost per question. Alerts: error spike, slow answers, disk nearly full, GPU down, payment webhook failures. A short runbook for each alert.
- [ ] **6.7 Cost controls.** Per-user token caps, maximum context size, model routing (small model by default, larger for Pro), a kill switch for abusive spikes, budget alerts.
- [ ] **6.8 Load and failure tests.** Repeat the Phase 1 load test at higher volume; deliberately stop the model, the database and Redis and confirm the app degrades gracefully with clear messages.
- [ ] **6.9 Compliance housekeeping.** A data map (what is stored where), a list of services that touch user data, a retention schedule, proof of deletion, and an incident plan (who decides, how users are told).

**Done when:** the checklist above is green; a restore drill succeeded; a simulated GPU outage fell back gracefully; the load test target is met without errors.

---

## Phase 7: Launch and growth (about 5 days, then ongoing)

**Goal:** a calm launch, and a routine for improving afterwards.

- [ ] **7.1 Pre-launch checklist.** Legal pages live; pricing page; status page; support email; help and FAQ; onboarding; email flows tested; analytics funnels built; SEO basics (titles, descriptions, social preview image, sitemap, robots); performance and accessibility checks; real-device phone testing; browser matrix.
- [ ] **7.2 Onboarding.** A one-click demo document, a short first-run checklist, and good empty states, so a new visitor reaches a cited answer in under a minute.
- [ ] **7.3 Growth.** Landing pages per use case (study notes, research papers, contracts); guides and short demo videos; student and exam-prep communities; a referral reward; partnerships with coaching institutes; a Product Hunt launch once payments work.
- [ ] **7.4 Support routine.** Shared inbox, canned replies, bug triage, a public changelog.
- [ ] **7.5 Weekly metrics review.** Activation, weekly active users, 7-day retention, free-to-paid conversion, cost per question, gross margin, thumbs-up rate. Keep a backlog of experiments with an owner and a date.
- [ ] **7.6 First 90 days.** Month 1: stabilise, fix the top issues. Month 2: test pricing, ship the most-requested feature. Month 3: talk to five businesses about the embeddable widget and decide whether B2B is worth building.

**Done when:** a stranger can find the site, try it without signing up, pay, get help, and cancel, with no manual work from you.

---

## Appendix A: suggested repository layout

```
sidenote/
  app/
    main.py              FastAPI app, middleware, routers
    core/                settings, security, logging
    api/                 routes: auth, files, chat, billing, notebook, admin
    services/            retrieval, llm, ingestion, billing providers, email
    models/              SQLAlchemy models
    workers/             arq jobs: ingest, embed, ocr, summarise
  migrations/            Alembic
  static/                front end (or web/ if you move to Vite + TypeScript)
  tests/                 unit, integration, e2e
  eval/                  evaluation set and runner
  docs/                  FEATURES.md, DEVELOPMENT_PLAN.md, runbooks
  Dockerfile  docker-compose.yml  Makefile  .env.example
```

## Appendix B: database sketch

| Table | Key columns |
|---|---|
| users | id, google_sub, email, name, plan, created_at, banned |
| files | id, user_id, name, type, size, checksum, storage_key, status, error, pages, created_at, expires_at |
| chunks | id, file_id, page, ord, heading_path, text, char_start, char_end, boxes (json), tsv, embedding |
| collections | id, user_id, name |
| collection_files | collection_id, file_id |
| conversations | id, user_id, title, created_at |
| conversation_files | conversation_id, file_id |
| messages | id, conversation_id, role, content, citations (json), feedback, created_at |
| notes | id, user_id, file_id, page, quote, char_start, char_end, note, tags, created_at |
| shares | id, conversation_id, token_hash, expires_at, revoked |
| usage_events | id, user_id, type, model, tokens_in, tokens_out, est_cost, created_at |
| subscriptions | id, user_id, provider, provider_sub_id, plan, status, current_period_end |
| webhook_events | id, provider, event_id (unique), received_at, processed |
| audit_log | id, admin_id, action, target, created_at |

Index `chunks.embedding` with HNSW and `chunks.tsv` with GIN. Foreign keys cascade on delete.

## Appendix C: API outline

```
Auth        GET /auth/login   GET /auth/callback   POST /auth/logout   GET /api/me
Files       POST /api/files   GET /api/files   GET /api/files/{id}   DELETE /api/files/{id}
Chat        POST /api/conversations   GET /api/conversations   GET /api/conversations/{id}
            POST /api/conversations/{id}/messages   (streams NDJSON)
            DELETE /api/conversations/{id}
Notebook    POST /api/notes   GET /api/notes   PATCH /api/notes/{id}   DELETE /api/notes/{id}
Share       POST /api/conversations/{id}/share   DELETE /api/shares/{id}   GET /s/{token}
Billing     POST /api/billing/subscribe   POST /api/billing/cancel   POST /webhooks/razorpay
Account     GET /api/account/export   DELETE /api/account
Admin       GET /admin/users   POST /admin/users/{id}/plan   POST /admin/users/{id}/ban
Health      GET /health   GET /ready
```

## Appendix D: environment variables

```
APP_ENV, SECRET_KEY, BASE_URL, TRUST_PROXY
DATABASE_URL, REDIS_URL
S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
LLM_BACKEND, LLM_BASE_URL, LLM_MODEL, LLM_API_KEY, FALLBACK_LLM_*
EMBED_URL, EMBED_MODEL, RERANK_URL
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
RESEND_API_KEY, SENTRY_DSN, POSTHOG_KEY, TURNSTILE_SECRET
Limits: MAX_FILE_MB, MAX_FILES, plan limits live in plans.yaml
```

## Appendix E: timeline

| Phase | Full-time days | Running total | Milestone |
|---|---|---|---|
| 0 Foundations | 3 | 3 | Tests and CI green |
| 1 Beta | 5 | 8 | First 20-50 real users |
| 2 Accounts and library | 12 | 20 | Sign in; files persist |
| 3 Plans and payments | 10 | 30 | First paid test purchase |
| 4 Retrieval quality | 12 | 42 | Eval shows improvement |
| 5 Product features | 15 | 57 | Viewer, notebook, sharing |
| 6 Security and scale | 8 | 65 | Restore and outage drills pass |
| 7 Launch | 5 | 70 | Public launch |

About 14 weeks full time, so plan on 4 months part time at best, and add a buffer. Phases 2 and 3 are the minimum for charging money; you can launch a paid version after Phase 3 and do Phases 4-6 in parallel with real customers.

## Appendix F: monthly cost worksheet

Fill the right column with real quotes and your own measurements.

| Item | How to estimate | Your number |
|---|---|---|
| GPU machine | hourly price x hours running per month | |
| Web VM | monthly price | |
| Database and Redis | managed price or VM share | |
| Object storage | GB stored x price, plus requests | |
| Email | plan price | |
| Monitoring and analytics | plan prices | |
| Domain and misc | yearly price / 12 | |
| Payment fees | percentage of revenue (check the provider's rate card) | |
| **Total fixed** | sum of the rows above | |

Per question: `cost per question = GPU cost per hour / questions answered per hour`. Take the throughput from your Phase 1 measurements, then add embedding and OCR cost per file. Break-even paying users = total fixed cost / (price per user - variable cost per user).

## Appendix G: decision log and weekly routine

**Decision log template:** date, decision, options considered, reason, what would make us revisit it.

**Weekly routine:** Monday plan the week from this document; Wednesday check metrics and errors; Friday demo, update the checklists, write what you learned, and reorder next week.

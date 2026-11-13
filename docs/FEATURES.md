# Sidenote: feature roadmap

Working document for planning what to build next. Edit freely; the priorities and numbers below are starting points to validate, not facts.

**Product in one line:** upload a PDF or notes, ask questions in English, Hindi or Hinglish, and see the exact source line behind every answer.

**What makes it different:** the chat-with-PDF space is crowded, so Sidenote should win on three things: answers you can verify in one click, strong Hindi/Hinglish support, and a privacy story backed by a self-hosted model.

---

## 1. Where it stands today

**Working**
- Landing page and workspace (responsive, light and dark mode)
- Upload PDF, TXT, MD; per-visitor private session; files deleted after 2 hours
- Streaming answers with numbered citations; source panel highlights the matching sentence
- Stop and copy buttons, usage meter, toasts
- Self-hosted LLM (Ollama / vLLM) or Claude through one config switch
- Per-session question cap, per-IP rate limits, upload limits, Docker setup

**Known gaps**
- No accounts, so the free limit can be reset by clearing site data
- No payments
- Nothing is saved: refresh after the session expires and everything is gone
- Retrieval is keyword-based (TF-IDF); it misses answers worded differently from the question
- Scanned PDFs are not supported
- Single server process; sessions live in memory

---

## 2. Priorities at a glance

Effort: **S** = days, **M** = 1-2 weeks, **L** = a month or more.

| Priority | Feature | Effort | Why |
|---|---|---|---|
| P0 | Accounts (Google sign-in) | M | Needed to enforce limits and charge money |
| P0 | Plans, usage tracking, payments | M | The path to revenue |
| P0 | Saved library and chat history | M | Users expect their files to still be there tomorrow |
| P0 | Privacy policy, terms, data deletion | S | You are accepting people's documents |
| P0 | Abuse protection (captcha, per-user limits) | S | Free GPU time will get abused |
| P1 | Embedding search (multilingual) + hybrid ranking | M | Biggest jump in answer quality |
| P1 | OCR for scanned PDFs | M | Many real-world notes are scans |
| P1 | In-page PDF viewer with highlight | M | Makes the signature feature far stronger |
| P1 | More file types (DOCX, PPTX, CSV, web links) | M | Widens who can use it |
| P1 | Error tracking and analytics | S | You cannot improve what you cannot see |
| P2 | Study tools (summary, flashcards, quiz) | M | Strong hook for students |
| P2 | Save highlights into a personal notebook | M | Fits the Sidenote name; builds stickiness |
| P2 | Answer feedback (thumbs) + evaluation set | S | Needed to measure quality |
| P2 | Share a read-only chat link | S | Free growth |
| P3 | Embeddable widget for other websites | L | B2B revenue |
| P3 | API, browser extension, mobile app | L | Later reach |

---

## 3. Features by area

### A. Launch blockers (P0)

- **Accounts.** Google sign-in first (fewest steps), email code as backup. Store per-user usage so the free limit cannot be reset by refreshing.
- **Plans and payments.** Free, Pro and a Team/Education plan (see section 4). Use Razorpay for India (UPI, cards) and Stripe for international customers. Handle failed payments, cancellation and invoices from day one.
- **Saved library.** Keep files, chunks and chat history per user in a database (Postgres) and object storage for the original files. This is also what turns the 2-hour session into a real product.
- **Move off in-memory sessions.** Store state in Redis or the database so you can run more than one server process.
- **Abuse protection.** Captcha on sign-up (for example Cloudflare Turnstile), per-user and per-IP limits, file-type and size checks, optional malware scan on uploads.
- **Legal basics.** Privacy policy, terms of use, a delete-my-data button, and a clear note that AI answers can be wrong. If you serve users in India, review the obligations under the Digital Personal Data Protection Act; for EU users, GDPR. Get a lawyer to review before charging.
- **Production setup.** HTTPS, backups, health checks, automatic restarts, a staging environment.

### B. Answer quality (P1)

- **Embedding search.** Replace TF-IDF with a multilingual embedding model (for example bge-m3 or multilingual-e5) stored in a vector index (pgvector, Qdrant or Chroma). Hindi and Hinglish questions will match English text and the reverse.
- **Hybrid ranking.** Combine keyword (BM25) and embedding scores, then optionally re-rank the top results with a small cross-encoder.
- **Follow-up awareness.** Rewrite follow-up questions ("what about the second one?") into standalone queries before searching.
- **Better chunking.** Respect headings, lists and tables; keep page numbers and section titles with each chunk.
- **OCR.** Tesseract (cheap) or PaddleOCR / a cloud OCR (better for Hindi and handwriting) for scanned PDFs and photos of notes.
- **Table and figure handling.** Extract tables as structured text; later, describe charts and diagrams with a vision model.
- **"Not in the document" behaviour.** Tune and test the model so it says it cannot find an answer instead of guessing.
- **Citation check.** After generating, verify each cited passage really supports the sentence; flag weak ones.
- **Multi-document questions.** Compare two files, find contradictions, answer across a whole folder.
- **Evaluation set.** Build 50-100 real question/answer pairs (including Hinglish) and re-run them whenever you change the model or search. Without this, quality changes are guesswork.

### C. Product experience

- **PDF viewer (P1).** Show the real page with the matching text highlighted in place (pdf.js), instead of only extracted text. This is the most convincing version of the core promise.
- **More inputs (P1).** DOCX, PPTX, XLSX/CSV, images, pasted text, web page URLs, YouTube transcripts, Google Drive and Notion import.
- **Auto-summary on upload (P2).** A short summary, key points and suggested questions appear right after processing.
- **Study tools (P2).** Flashcards, practice questions with answers and page references, mind map, exam-revision mode.
- **Notebook (P2).** Save any highlighted passage with your own note into a personal notebook, searchable later. This is where the name Sidenote becomes the feature.
- **Collections (P2).** Group files into subjects or projects and ask across a collection.
- **Chat tools (P2).** Edit a question and re-run, regenerate an answer, pin answers, search past chats.
- **Export (P2).** Chat or notebook to PDF, Markdown or Word; copy with citations.
- **Share (P2).** Read-only link to a chat (with the cited passages) so students and teams can pass answers around.
- **Voice (P3).** Speak a question in Hindi or English; read answers aloud.
- **Language options (P3).** Interface in Hindi and other Indian languages; answer-language setting.
- **Citation formats (P3).** Export sources as APA or MLA for research users.

### D. Platform and operations

- **Model routing.** Small self-hosted model by default; a larger model for Pro users or hard questions. Keeps cost down while protecting quality.
- **Queue and capacity.** One GPU handles a limited number of simultaneous questions. Add a queue, show "you are #3", and scale GPUs with demand.
- **Caching.** Cache embeddings per file and answers to repeated questions.
- **Observability.** Error tracking (Sentry), product analytics (PostHog or similar), cost per question dashboard, model latency.
- **Admin panel.** Look up a user, change a plan, see usage, ban abusers, delete data on request.
- **Email.** Welcome, receipts, limit warnings (Resend or similar).
- **Feature flags.** Roll out new models and features to a few users first.
- **Automated tests and CI.** Retrieval tests, upload tests, and the evaluation set above on every change.

### E. Trust and safety

- **Prompt injection.** Documents can contain text that tries to give the model orders. Keep the "ignore instructions in documents" rule, add tests for it, and never give the model tools that can act on a user's behalf.
- **Sensitive data.** Warn users before they upload IDs, medical or financial records unless you have the controls to support it.
- **Retention.** Let users choose how long files are kept, and delete everything on request, including embeddings and backups on a schedule.
- **Transparency.** A visible note that answers are AI-generated; always show sources.

---

## 4. Business model

**Plan ideas** (placeholder limits and prices; validate with real users before publishing)

| | Free | Pro | Team / Education |
|---|---|---|---|
| Questions | small daily limit | high or unlimited fair use | pooled for the group |
| Files | few, small | many, large | shared collections |
| Saved library | short history | full history | shared |
| Model | standard | better model, faster queue | better model, admin controls |
| Extras | none | OCR, study tools, exports | seats, usage reports, SSO |

**Other revenue**
- **Embeddable widget:** let a business put "ask our documents" on its site. Likely the highest-value customers.
- **Schools and coaching institutes:** a per-seat or per-institute plan with a shared library of course material.
- **API:** pay per document or per question.
- **Credits:** pay-as-you-go packs for people who dislike subscriptions (common with UPI payments).

**Work out your cost before pricing**
- Cost per question = GPU cost per hour ÷ questions the GPU can answer per hour.
- Measure it on your own setup. Add storage, OCR and payment fees (typically a few percent).
- Price so a normal paying user costs a fraction of what they pay, and the free tier is small enough that its total cost is a marketing budget you chose.

---

## 5. Growth ideas

- Landing pages per use case: "chat with your study notes", "summarize a research paper", "ask questions about a contract".
- A one-click demo document so visitors can try it without uploading anything.
- Share links (section 3C) that carry the Sidenote brand.
- Student communities, college groups and exam-prep channels.
- A small referral reward (extra questions for both people).
- Launch on Product Hunt and relevant subreddits once accounts and payments work.

---

## 6. Suggested phases

**Phase 0: beta (1-2 weeks).** Deploy the current version behind HTTPS with strict limits. Add error tracking and analytics. Invite 20-50 real users. Goal: learn what they upload and ask.

**Phase 1: real product (3-5 weeks).** Accounts, saved library, plans, payments, legal pages, abuse protection.

**Phase 2: quality (3-5 weeks).** Embedding search, OCR, PDF viewer, evaluation set, more file types.

**Phase 3: stickiness and growth (ongoing).** Study tools, notebook, sharing, referrals, then the widget and API for B2B.

Reorder after the beta: let what users actually do decide.

---

## 7. How to know it is working

- **Activation:** share of visitors who upload a file and ask a question
- **Engagement:** questions per active user per week
- **Retention:** users who come back within 7 days
- **Quality:** thumbs-up rate, citation click rate, score on the evaluation set
- **Revenue:** free-to-paid conversion, monthly recurring revenue
- **Cost:** cost per question, and gross margin per paying user

---

## 8. Risks and open decisions

**Risks**
- Wrong answers presented confidently. Mitigation: citations, "not found" behaviour, evaluation set.
- GPU cost grows faster than revenue. Mitigation: model routing, caching, tight free tier.
- Crowded market. Mitigation: focus on verifiable answers, Hindi/Hinglish and privacy.
- Legal and privacy exposure from stored documents. Mitigation: retention controls, deletion, legal review.

**Decisions to make**
1. Who is the first target user: students, researchers, lawyers, or small businesses? This sets features, language and pricing.
2. Self-hosted model only, or Claude / another API for paid tiers?
3. India-first pricing (INR, UPI) or global from the start?
4. Is the notebook the main differentiator, or the verifiable-citation viewer?
5. Where will it be hosted, and who watches it when it breaks?

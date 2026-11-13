(() => {
  const $ = (id) => document.getElementById(id);
  const el = {
    landing: $("landing"), app: $("app"), column: $("column"), scroll: $("scroll"), files: $("files"), filesHead: $("filesHead"),
    left: $("left"), meter: $("meter"), meterBar: $("meterBar"), topLeft: $("topLeft"), newChat: $("newChat"),
    drop: $("drop"), landDrop: $("landDrop"), pick: $("pick"), landPick: $("landPick"), file: $("file"),
    composer: $("composer"), q: $("q"), send: $("send"), panel: $("panel"), panelBody: $("panelBody"), panelNav: $("panelNav"), srcPrev: $("srcPrev"), srcNext: $("srcNext"), srcPos: $("srcPos"),
    closePanel: $("closePanel"), toggleRail: $("toggleRail"), backdrop: $("backdrop"), toasts: $("toasts"),
  };

  // ----- session id (private to this browser) -----
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2) + "00000000");
  let sid;
  try { sid = localStorage.getItem("sidenote_sid"); } catch (e) {}
  if (!sid) { sid = newId(); try { localStorage.setItem("sidenote_sid", sid); } catch (e) {} }

  const state = { files: [], asked: 0, limit: 30, messages: [], busy: false, uploading: 0, maxFiles: 5, maxMb: 10, ttl: 2 };
  let abortCtl = null;

  // ----- helpers -----
  async function api(path, opts = {}) {
    const res = await fetch(path, { ...opts, headers: { "X-Session-Id": sid, ...(opts.headers || {}) } });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(typeof d.detail === "string" ? d.detail : "Something went wrong. Try again.");
    }
    return res.json();
  }
  function toast(msg, kind) {
    const t = document.createElement("div"); t.className = "toast" + (kind === "err" ? " err" : ""); t.textContent = msg;
    while (el.toasts.children.length > 1) el.toasts.firstChild.remove(); // one at a time
    el.toasts.append(t); setTimeout(() => t.remove(), kind === "err" ? 6000 : 2200);
  }
  const esc = (t) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function applyState(s) {
    Object.assign(state, { files: s.files, asked: s.asked, limit: s.limit, messages: s.messages, maxFiles: s.max_files, maxMb: s.max_file_mb, ttl: s.ttl_hours });
    document.querySelectorAll("[data-ttl]").forEach((n) => (n.textContent = state.ttl));
    document.querySelectorAll("[data-maxmb]").forEach((n) => (n.textContent = state.maxMb));
    document.querySelectorAll("[data-maxfiles]").forEach((n) => (n.textContent = state.maxFiles));
  }

  // ----- answer rendering (escape first, then add our own tags) -----
  function answerHtml(text, sources) {
    let h = esc(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    h = h.split(/\n{2,}/).map((b) => {
      const ls = b.split("\n");
      if (ls.every((l) => /^\s*[-*•]\s+/.test(l))) return "<ul>" + ls.map((l) => "<li>" + l.replace(/^\s*[-*•]\s+/, "") + "</li>").join("") + "</ul>";
      if (ls.every((l) => /^\s*\d+[.)]\s+/.test(l))) return "<ol>" + ls.map((l) => "<li>" + l.replace(/^\s*\d+[.)]\s+/, "") + "</li>").join("") + "</ol>";
      return "<p>" + ls.join("<br>") + "</p>";
    }).join("");
    return h.replace(/\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g, (m, list) => {
      const nums = list.split(",").map((x) => parseInt(x, 10));
      if (!nums.every((n) => sources[n - 1])) return m;
      return nums.map((n) => `<button type="button" class="cite" data-n="${n}" aria-label="Open source ${n}">${n}</button>`).join("");
    });
  }

  // ----- views -----
  function renderView() {
    const ws = state.files.length > 0 || state.messages.length > 0 || state.uploading > 0;
    el.landing.hidden = ws; el.app.hidden = !ws;
    document.body.dataset.view = ws ? "app" : "landing";
  }

  function renderRail() {
    el.files.textContent = "";
    state.files.forEach((f) => {
      const ext = (f.name.split(".").pop() || "").toUpperCase().slice(0, 3);
      const li = document.createElement("li");
      li.innerHTML = `<span class="badge">${esc(ext)}</span><span class="finfo"><span class="fname"></span><span class="fmeta">${f.parts} passage${f.parts === 1 ? "" : "s"}</span></span>`;
      li.querySelector(".fname").textContent = f.name; li.querySelector(".fname").title = f.name;
      const x = document.createElement("button"); x.type = "button"; x.className = "x"; x.textContent = "×";
      x.setAttribute("aria-label", "Remove " + f.name);
      x.addEventListener("click", () => removeFile(f.name));
      li.append(x); el.files.append(li);
    });
    for (let i = 0; i < state.uploading; i++) {
      const li = document.createElement("li"); li.className = "busy";
      li.innerHTML = '<span class="badge">…</span><span class="finfo"><span class="fname">Reading file</span><span class="fmeta">Extracting text</span></span>';
      el.files.append(li);
    }
    el.filesHead.hidden = !state.files.length && !state.uploading;

    const left = Math.max(state.limit - state.asked, 0);
    el.left.textContent = `${left} of ${state.limit} questions left`;
    el.topLeft.textContent = `${left} left`;
    el.meter.setAttribute("aria-valuemax", state.limit); el.meter.setAttribute("aria-valuenow", state.asked);
    el.meterBar.style.width = Math.min(100, (state.asked / state.limit) * 100) + "%";
    el.meter.classList.toggle("low", left <= Math.ceil(state.limit * 0.15));
    el.newChat.hidden = !state.messages.length;
    updateComposer();
  }

  function updateComposer() {
    const hasFiles = state.files.length > 0;
    el.q.disabled = !hasFiles;
    el.q.placeholder = hasFiles ? "Ask about your documents" : "Add a file to start asking";
    if (state.busy) { el.send.textContent = "Stop"; el.send.classList.add("stop"); el.send.disabled = false; }
    else { el.send.textContent = "Ask"; el.send.classList.remove("stop"); el.send.disabled = !hasFiles || !el.q.value.trim(); }
  }

  // ----- upload -----
  async function uploadFiles(list) {
    const files = Array.from(list);
    for (const f of files) {
      const fd = new FormData(); fd.append("file", f);
      state.uploading++; renderView(); renderRail();
      try { applyState(await api("/api/upload", { method: "POST", body: fd })); toast(`Added ${f.name}`); }
      catch (e) { toast(e.message, "err"); }
      state.uploading--;
      renderView(); renderRail(); renderThread();
    }
    document.body.classList.remove("rail-open"); syncRailUi();
    if (state.files.length) el.q.focus();
  }
  async function removeFile(name) {
    try { applyState(await api("/api/files/" + encodeURIComponent(name), { method: "DELETE" })); } catch (e) { toast(e.message, "err"); }
    renderView(); renderRail(); renderThread();
  }

  // ----- thread -----
  function readyNode() {
    const sec = document.createElement("section"); sec.className = "ready";
    const parts = state.files.reduce((n, f) => n + f.parts, 0);
    const ideas = ["Summarize this document", "List the main points", "What are the key dates and numbers?"];
    sec.innerHTML = `<h2>Ask your first question</h2><p class="sub">Sidenote has read ${state.files.length} file${state.files.length === 1 ? "" : "s"} (${parts} passages). Try one of these or type your own. Hindi and Hinglish work too.</p><div class="ideas"></div>`;
    ideas.forEach((i) => { const b = document.createElement("button"); b.type = "button"; b.textContent = i; b.dataset.idea = i; sec.querySelector(".ideas").append(b); });
    return sec;
  }

  // ----- feedback (Helpful / Not helpful) -----
  let formCount = 0;
  function feedbackGroup(art) {
    const g = document.createElement("span"); g.className = "fb";
    [["up", "Helpful"], ["down", "Not helpful"]].forEach(([v, label]) => {
      const b = document.createElement("button"); b.type = "button"; b.dataset.act = "fb"; b.dataset.v = v; b.textContent = label;
      b.setAttribute("aria-pressed", String(art._fb === v));
      g.append(b);
    });
    return g;
  }
  function refreshFeedback(art) {
    art.querySelectorAll("[data-act=fb]").forEach((b) => b.setAttribute("aria-pressed", String(art._fb === b.dataset.v)));
  }
  function openFeedbackForm(art) {
    if (art.querySelector(".fb-form")) return art.querySelector(".fb-form textarea").focus();
    const id = ++formCount;
    const reasons = [["wrong_answer", "Wrong answer"], ["wrong_source", "Wrong source"], ["not_found", "Missed what is in my file"], ["other", "Something else"]];
    const f = document.createElement("form"); f.className = "fb-form"; f.setAttribute("aria-label", "Tell us what went wrong");
    f.innerHTML = `<p class="fb-title">What went wrong?</p>
      <div class="fb-reasons" role="radiogroup" aria-label="Reason">${reasons.map(([v, l], i) => `<label><input type="radio" name="r${id}" value="${v}"${i === 0 ? " checked" : ""}><span>${l}</span></label>`).join("")}</div>
      <label class="sr" for="fbc${id}">Comment (optional)</label>
      <textarea id="fbc${id}" maxlength="300" rows="2" placeholder="Anything else? (optional)"></textarea>
      <label class="fb-share"><input type="checkbox" name="share"> Include this question and answer so the developer can fix it</label>
      <p class="fb-note">Unless you tick the box, only your choice and comment are sent. Your files are never sent.</p>
      <div class="fb-actions"><button type="submit" class="btn small">Send feedback</button><button type="button" class="btn ghost small" data-act="fb-cancel">Cancel</button></div>`;
    art.append(f); f.querySelector("input[type=radio]").focus();
  }
  async function sendFeedback(art, value, extra) {
    if (art._idx == null) return;
    try {
      await api("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ index: art._idx, value, ...(extra || {}) }) });
      art._fb = value; refreshFeedback(art);
      const f = art.querySelector(".fb-form"); if (f) f.remove();
      toast("Thanks for the feedback");
    } catch (e) { toast(e.message, "err"); }
  }

  function turnNode(question, answer, sources, idx, fb) {
    const art = document.createElement("article"); art.className = "turn"; art._sources = sources; art._text = answer;
    art._idx = idx == null ? null : idx; art._fb = fb || null;
    const q = document.createElement("h3"); q.className = "q"; q.textContent = question;
    const a = document.createElement("div"); a.className = "a";
    art.append(q, a);
    setAnswer(art, answer, sources, true);
    return art;
  }

  function setAnswer(art, text, sources, final) {
    art._sources = sources; art._text = text;
    const a = art.querySelector(".a");
    a.classList.remove("pending", "fail");
    a.classList.toggle("streaming", !final);
    a.innerHTML = answerHtml(text, sources);
    let foot = art.querySelector(".turn-foot");
    if (final && text) {
      if (!foot) { foot = document.createElement("div"); foot.className = "turn-foot"; art.append(foot); }
      foot.textContent = "";
      const copy = document.createElement("button"); copy.type = "button"; copy.dataset.act = "copy"; copy.textContent = "Copy answer";
      foot.append(copy);
      if (art._idx != null) foot.append(feedbackGroup(art));
      if (sources.length) {
        const sep = document.createElement("span"); sep.className = "sep"; foot.append(sep);
        const lab = document.createElement("span"); lab.textContent = "Sources:"; foot.append(lab);
        sources.forEach((s) => {
          const b = document.createElement("button"); b.type = "button"; b.dataset.n = s.n;
          b.innerHTML = `<span class="n">${s.n}</span>` + esc(s.file) + (s.page ? ", p." + s.page : "");
          foot.append(b);
        });
      }
    }
  }

  function renderThread() {
    el.column.textContent = "";
    if (!state.messages.length) { if (state.files.length) el.column.append(readyNode()); return; }
    for (let i = 0; i < state.messages.length; i += 2) {
      const u = state.messages[i], a = state.messages[i + 1];
      el.column.append(turnNode(u.content, a ? a.content : "", a ? a.sources || [] : [], a ? i + 1 : null, a ? a.feedback : null));
    }
    el.scroll.scrollTop = el.scroll.scrollHeight;
  }

  // ----- source panel -----
  function openPanel(sources, n) {
    if (!sources || !sources.length) return;
    el.panelBody.textContent = "";
    panelSources = sources; panelCur = Math.max(0, sources.findIndex((x) => x.n === n));
    sources.forEach((s) => {
      const box = document.createElement("section"); box.className = "src" + (s.n === n ? " picked" : ""); box.id = "src-" + s.n;
      const h = document.createElement("h3");
      h.innerHTML = `<span class="n">${s.n}</span><span>${esc(s.file)}</span>` + (s.page ? `<span class="pg">page ${s.page}</span>` : "");
      const p = document.createElement("p");
      const at = s.highlight ? s.text.indexOf(s.highlight) : -1;
      if (at >= 0) {
        const m = document.createElement("mark"); m.textContent = s.highlight;
        p.append(s.text.slice(0, at), m, s.text.slice(at + s.highlight.length));
      } else p.textContent = s.text;
      box.append(h, p); el.panelBody.append(box);
    });
    el.panel.hidden = false; el.app.classList.add("src-open");
    pickSource(panelCur, false);
    el.closePanel.focus({ preventScroll: true });
  }
  let panelSources = [], panelCur = 0;
  function pickSource(i, scroll = true) {
    if (!panelSources.length) return;
    panelCur = (i + panelSources.length) % panelSources.length;
    panelSources.forEach((s, k) => { const b = $("src-" + s.n); if (b) b.classList.toggle("picked", k === panelCur); });
    el.panelNav.hidden = panelSources.length < 2;
    el.srcPos.textContent = `${panelCur + 1} of ${panelSources.length}`;
    const target = $("src-" + panelSources[panelCur].n); if (target) target.scrollIntoView({ block: "start", behavior: scroll ? "smooth" : "auto" });
  }
  function closePanel() { el.panel.hidden = true; el.app.classList.remove("src-open"); }

  // ----- chat -----
  async function ask(question) {
    question = question.trim();
    if (!question || state.busy || !state.files.length) return;
    state.busy = true; updateComposer();
    if (!state.messages.length) el.column.textContent = "";
    const art = turnNode(question, "", []);
    const a = art.querySelector(".a"); a.classList.add("pending"); a.textContent = "Reading your pages…";
    el.column.append(art); el.scroll.scrollTop = el.scroll.scrollHeight;
    el.q.value = ""; autosize(); updateComposer();

    abortCtl = new AbortController();
    let sources = [], text = "", ok = false;
    try {
      const res = await fetch("/api/chat", { method: "POST", signal: abortCtl.signal, headers: { "Content-Type": "application/json", "X-Session-Id": sid }, body: JSON.stringify({ question }) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(typeof d.detail === "string" ? d.detail : "Something went wrong. Try again.");
      }
      const reader = res.body.getReader(), dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!ln) continue;
          const ev = JSON.parse(ln);
          if (ev.type === "sources") sources = ev.sources;
          else if (ev.type === "token") {
            text += ev.text;
            const near = el.scroll.scrollHeight - el.scroll.scrollTop - el.scroll.clientHeight < 120;
            setAnswer(art, text, sources, false); if (near) el.scroll.scrollTop = el.scroll.scrollHeight;
          } else if (ev.type === "error") throw new Error(ev.message);
          else if (ev.type === "done") ok = true;
        }
      }
      if (!ok && !text) throw new Error("The answer stopped early. Ask again.");
      setAnswer(art, text, sources, true);
    } catch (e) {
      if (e.name === "AbortError") {

        if (text) { setAnswer(art, text, sources, true); const n = document.createElement("p"); n.className = "note"; n.textContent = "Stopped before finishing."; art.append(n); }
        else { const a2 = art.querySelector(".a"); a2.classList.remove("pending", "streaming"); a2.textContent = "Stopped."; a2.classList.add("pending"); }
      } else {
        const a2 = art.querySelector(".a"); a2.classList.remove("pending", "streaming"); a2.classList.add("fail"); a2.textContent = e.message;
      }
    }
    abortCtl = null;
    try { applyState(await api("/api/state")); } catch (e) {}
    if (ok && art._text) { art._idx = state.messages.length - 1; setAnswer(art, art._text, art._sources, true); } // enables feedback
    state.busy = false; renderRail();
    el.q.focus();
  }

  // ----- events -----
  el.column.addEventListener("click", async (e) => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.idea) return ask(t.dataset.idea);
    const art = t.closest(".turn");
    if (t.dataset.act === "fb" && art) {
      if (t.dataset.v === "up") { if (art._fb !== "up") sendFeedback(art, "up"); }
      else openFeedbackForm(art);
      return;
    }
    if (t.dataset.act === "fb-cancel" && art) { art.querySelector(".fb-form").remove(); return; }
    if (t.dataset.act === "copy" && art) {
      try { await navigator.clipboard.writeText(art._text); toast("Answer copied"); } catch (err) { toast("Couldn't copy. Select the text instead.", "err"); }
      return;
    }
    if (t.dataset.n && art) openPanel(art._sources, parseInt(t.dataset.n, 10));
  });
  el.column.addEventListener("submit", (e) => {
    const f = e.target.closest(".fb-form"); if (!f) return;
    e.preventDefault();
    const art = f.closest(".turn");
    const reason = (f.querySelector("input[type=radio]:checked") || {}).value || "other";
    sendFeedback(art, "down", { reason, comment: f.querySelector("textarea").value, share: f.querySelector("input[name=share]").checked });
  });
  el.closePanel.addEventListener("click", closePanel);
  el.srcPrev.addEventListener("click", () => pickSource(panelCur - 1));
  el.srcNext.addEventListener("click", () => pickSource(panelCur + 1));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el.panel.hidden) { closePanel(); el.q.focus(); } });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.panel.hidden) closePanel();
    if (e.key === "/" && !el.app.hidden && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) && !el.q.disabled) { e.preventDefault(); el.q.focus(); }
  });

  [el.pick, el.landPick].forEach((b) => b.addEventListener("click", () => el.file.click()));
  el.file.addEventListener("change", () => { if (el.file.files.length) uploadFiles(el.file.files); el.file.value = ""; });
  const dropTargets = () => [el.landDrop, el.drop];
  ["dragenter", "dragover"].forEach((n) => document.addEventListener(n, (e) => { e.preventDefault(); dropTargets().forEach((d) => d.classList.add("over")); }));
  ["dragleave", "drop"].forEach((n) => document.addEventListener(n, (e) => { e.preventDefault(); dropTargets().forEach((d) => d.classList.remove("over")); }));
  document.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); });

  el.composer.addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.busy) { if (abortCtl) abortCtl.abort(); return; }
    ask(el.q.value);
  });
  el.q.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!state.busy) ask(el.q.value); } });
  function autosize() { el.q.style.height = "auto"; el.q.style.height = Math.min(el.q.scrollHeight, 160) + "px"; }
  el.q.addEventListener("input", () => { autosize(); updateComposer(); });

  el.newChat.addEventListener("click", async () => {
    try { applyState(await api("/api/reset", { method: "POST" })); } catch (e) { toast(e.message, "err"); }
    closePanel(); renderRail(); renderThread();
  });

  function syncRailUi() {
    const open = document.body.classList.contains("rail-open");
    el.backdrop.hidden = !open; el.toggleRail.setAttribute("aria-expanded", String(open));
  }
  el.toggleRail.addEventListener("click", () => { document.body.classList.toggle("rail-open"); syncRailUi(); });
  el.backdrop.addEventListener("click", () => { document.body.classList.remove("rail-open"); syncRailUi(); });

  // ----- start -----
  renderView(); renderRail();
  api("/api/state").then((s) => { applyState(s); renderView(); renderRail(); renderThread(); }).catch((e) => toast(e.message, "err"));
})();

(function () {
  const THEMES = [
    ["system", "System", null],
    ["paper", "Paper", ["#F6F7FB", "#161A2E", "#2338C9", "#FFE14D"]],
    ["night", "Night", ["#11131E", "#E9ECF8", "#93A2FF", "#FFE14D"]],
    ["sepia", "Sepia", ["#F3EAD7", "#3A2F22", "#8A3B2B", "#F5D56A"]],
    ["forest", "Forest", ["#EEF4EE", "#12241A", "#1D6A44", "#FFE14D"]],
    ["ocean", "Ocean", ["#0B1822", "#E3F1F7", "#4FC3D9", "#FFD84D"]],
    ["rose", "Rose", ["#FBF2F4", "#2A1520", "#B0254E", "#FFE14D"]],
    ["contrast", "High contrast", ["#FFFFFF", "#000000", "#0030C8", "#FFEB3B"]],
  ];
  const KEY = "sidenote_theme", root = document.documentElement;
  const known = (v) => THEMES.some((t) => t[0] === v);
  const norm = (v) => (v === "light" ? "paper" : v === "dark" ? "night" : v);
  function stored() { try { const v = norm(localStorage.getItem(KEY)); return known(v) ? v : "system"; } catch (e) { return "system"; } }
  function apply(id) {
    if (id === "system") root.removeAttribute("data-theme"); else root.dataset.theme = id;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(root).getPropertyValue("--pen").trim() || "#2338C9";
  }
  apply(stored());

  let pop = null, anchor = null;
  function close() { if (pop) { pop.remove(); pop = null; } document.removeEventListener("mousedown", away, true); document.removeEventListener("keydown", key, true); if (anchor) anchor.setAttribute("aria-expanded", "false"); }
  function away(e) { if (pop && !pop.contains(e.target) && e.target !== anchor) close(); }
  function key(e) { if (e.key === "Escape") { const a = anchor; close(); if (a) a.focus(); } }
  function open(btn) {
    close(); anchor = btn; btn.setAttribute("aria-expanded", "true");
    pop = document.createElement("div"); pop.className = "theme-pop"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Choose a theme");
    const cur = stored();
    pop.innerHTML = "<fieldset><legend>Theme</legend>" + THEMES.map(([id, name, c]) => {
      const sw = c ? `<span class="sw" style="background:${c[0]}"><i style="width:22px;background:${c[1]}"></i><i style="width:12px;background:${c[2]}"></i><i style="width:8px;background:${c[3]}"></i></span>`
        : `<span class="sw" style="background:linear-gradient(90deg,#F6F7FB 50%,#11131E 50%)"><i style="width:22px;background:#888"></i></span>`;
      return `<label class="theme-opt"><input type="radio" name="theme" value="${id}"${id === cur ? " checked" : ""}>${sw}<span>${name}</span></label>`;
    }).join("") + "</fieldset>";
    document.body.append(pop);
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    let left = Math.min(Math.max(12, r.left), innerWidth - w - 12);
    let top = r.bottom + 8; if (top + h > innerHeight - 12) top = Math.max(12, r.top - h - 8);
    pop.style.left = left + "px"; pop.style.top = top + "px";
    pop.addEventListener("change", (e) => { const v = e.target.value; apply(v); try { if (v === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, v); } catch (err) {} });
    document.addEventListener("mousedown", away, true); document.addEventListener("keydown", key, true);
    (pop.querySelector("input:checked") || pop.querySelector("input")).focus();
  }
  document.querySelectorAll(".theme-btn").forEach((b) => {
    b.textContent = "Theme"; b.setAttribute("aria-haspopup", "dialog"); b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", () => (pop && anchor === b ? close() : open(b)));
  });
})();

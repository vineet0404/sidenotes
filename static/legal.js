fetch("/api/config").then((r) => r.json()).then((c) => {
  if (!c.contact) return;
  const a = document.getElementById("contactLink");
  a.href = "mailto:" + c.contact; a.textContent = c.contact;
  document.getElementById("contact").hidden = false;
}).catch(() => {});

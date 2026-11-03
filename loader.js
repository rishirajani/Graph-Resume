/* Loads the app. For a tailored link (#for/<id>.<key>) it first fetches that link's
   scrambled file, unlocks it with the key from the address, and prepares the data the
   company should see. The key never leaves the browser: the part after # isn't sent to
   any server. */
(function () {
  const m = location.hash.match(/^#for\/([A-Za-z0-9_-]{4,16})\.([A-Za-z0-9_-]{16,64})/);
  const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
  const load = (src) => new Promise((resolve, reject) => {
    const s = document.createElement("script"); s.src = src; s.async = false;
    s.onload = resolve; s.onerror = () => reject(new Error("Couldn't load " + src));
    document.body.appendChild(s);
  });

  async function prepare() {
    if (!m) return;
    const [, id, key] = m;
    const F = (window.GR_FOR = { id, token: `${id}.${key}`, status: "loading" });
    try {
      const r = await fetch(`for/${id}.json`, { cache: "no-store" });
      if (!r.ok) { F.status = "gone"; return; }
      const box = await r.json();
      const k = await crypto.subtle.importKey("raw", b64u(key), "AES-GCM", false, ["decrypt"]);
      const p = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64u(box.iv) }, k, b64u(box.ct))));
      // end dates are enforced by publishing: an ended or switched-off link's file is removed from the site

      // what the company sees: the public data, minus what this link leaves out, plus what it adds
      const base = window.RESUME_PUBLIC || window.RESUME;
      const R = JSON.parse(JSON.stringify(base));
      const omit = new Set(p.omit || []), addIds = new Set((p.add || []).map((n) => n.id));
      const unhide = (n) => { const c = { ...n }; delete c.private; return c; };
      R.nodes = R.nodes.map((n) => (omit.has(n.id) ? { ...n, private: true } : addIds.has(n.id) ? unhide(n) : n));
      const have = new Set(R.nodes.map((n) => n.id));
      for (const n of p.add || []) if (!have.has(n.id)) { R.nodes.push(unhide(n)); have.add(n.id); }
      window.RESUME = R;
      if (window.GR_OWNER) window.GR_OWNER.source = "public";   // even on your own device, show it as they see it
      Object.assign(F, { status: "ok", company: p.company || "", role: p.role || "", note: p.note || "", focus: p.focus || [], mode: p.mode || "highlight" });
    } catch (e) {
      F.status = "error"; F.error = e.message;
    }
  }

  window.GR_SCRIPTS = prepare().then(() => load("app.js")).then(() => load("studio.js")).then(() => load("customize.js"));
})();

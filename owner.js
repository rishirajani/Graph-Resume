/* Owner view: on your own devices, swap the public data for your private master.
   Runs before app.js. For visitors (no GitHub token in this browser) it does nothing.

   Your private repo's resume.js is fetched with a fine-grained GitHub token kept in
   this browser's local storage, cached there for instant loads, and refreshed in the
   background on each visit. */
(function () {
  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  let cfg = null; try { cfg = JSON.parse(get("gr.gh") || "null"); } catch {}
  let asVisitor = false; try { asVisitor = sessionStorage.getItem("gr.asVisitor") === "1"; } catch {}

  const O = (window.GR_OWNER = { configured: !!(cfg && cfg.repo && cfg.token), source: "public", asVisitor, error: "" });

  // A file that still holds private nodes is the master itself (the claude.ai preview, or a local copy).
  if ((window.RESUME?.nodes || []).some((n) => n.private)) O.source = "master";
  if (!O.configured) return;

  const evalMaster = (text) => {
    const w = {}; new Function("window", text)(w);
    if (!w.RESUME || !Array.isArray(w.RESUME.nodes)) throw new Error("The file doesn't define window.RESUME.");
    return w.RESUME;
  };

  const cached = get("gr.masterCache");
  if (cached && !asVisitor) {
    try { window.RESUME = evalMaster(cached); O.source = "master"; } catch (e) { O.error = "Cached copy unreadable: " + e.message; }
  }

  O.fetchMaster = async function () {
    const r = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/resume.js`, {
      headers: { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github.raw+json", "X-GitHub-Api-Version": "2022-11-28" },
      cache: "no-store"
    });
    if (!r.ok) throw new Error(r.status === 401 ? "GitHub didn't accept the token." : r.status === 404 ? "Repository or resume.js not found, or the token can't read it." : `GitHub answered ${r.status}.`);
    const text = await r.text();
    evalMaster(text); // check it parses before keeping it
    return text;
  };

  // refresh in the background; reload once if the master changed
  O.refreshed = O.fetchMaster().then((text) => {
    if (text === cached) return false;
    set("gr.masterCache", text);
    if (!asVisitor && get("gr.masterCache") === text) location.reload();   // only if it was stored, so this can't loop
    return true;
  }).catch((e) => { O.error = e.message; return false; });
})();

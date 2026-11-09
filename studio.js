/* Graph resume: owner studio.
   Writes a CV and cover letter for one job description using only facts from resume.js.
   The LLM selects and phrases; titles, organisations and dates always come from the graph. */
(function () {
  "use strict";
  const G = window.GR;
  const { $, $$, esc, byId, me, allNodes, runtime, ready, toast } = G;

  const LS = {
    get(k, d) { try { const v = localStorage.getItem("gr." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("gr." + k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem("gr." + k); } catch {} }
  };
  const SS = {
    get(k) { try { return sessionStorage.getItem("gr." + k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem("gr." + k, v); } catch {} }
  };

  const DEFAULT_MODEL = { gemini: "gemini-2.5-flash", anthropic: "claude-sonnet-5-5", "openai-compatible": "" };
  const OPENROUTER = "https://openrouter.ai/api/v1";
  // Free OpenRouter models rotate often; edit the list in Model settings if one disappears.
  const PRESETS = {
    "claude-sonnet": { provider: "anthropic", model: "claude-sonnet-5-5" },
    "claude-haiku":  { provider: "anthropic", model: "claude-haiku-5-5" },
    "or-free":       { provider: "openai-compatible", baseUrl: OPENROUTER,
                       model: "nvidia/nemotron-3-ultra-550b-a55b:free, thinkingmachines/inkling:free, nvidia/nemotron-3.5-super-vl:free, dots-studio/dots-3-note-preview:free, thinkingmachines/inkling-small:free" },
    "or-kimi":       { provider: "openai-compatible", baseUrl: OPENROUTER, model: "moonshotai/kimi-k2.6" },
    "gemini-flash":  { provider: "gemini", model: "gemini-2.5-flash" }
  };
  const modelList = (m) => String(m || "").split(/[,\n]+/).map((x) => x.trim()).filter(Boolean);
  // one key per provider (and per OpenAI-compatible host), so switching presets keeps them apart
  const keySlot = (provider, base) => provider === "openai-compatible" ? `key:oai:${(() => { try { return new URL(base || OPENROUTER).host; } catch { return "custom"; } })()}` : `key:${provider}`;
  function getKey(provider, base) {
    const k = LS.get(keySlot(provider, base), "");
    if (k) return k;
    // migrate the single key saved by earlier versions
    const old = LS.get("apiKey", "");
    if (old && LS.get("provider", "") === provider) { LS.set(keySlot(provider, base), old); LS.del("apiKey"); return old; }
    return "";
  }
  let current = null; // last generation { input, result }

  /* ================= access ================= */
  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  const usingClaude = () => runtime.inArtifact && runtime.isOwner && !!runtime.sample;

  // copies of this code (a friend's site) learn about new versions from the original site
  let updateChecked = false;
  async function checkForUpdate() {
    if (updateChecked) return; updateChecked = true;
    const C = window.GRCORE;
    if (!C?.UPSTREAM || location.href.startsWith(C.UPSTREAM) || runtime.inArtifact) return;
    try {
      const r = await fetch(C.UPSTREAM + "version.json", { cache: "no-store" });
      if (!r.ok) return;
      const v = await r.json();
      const newer = (a, b) => { const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
      if (!newer(v.version, C.VERSION)) return;
      const el = $("#update-notice");
      el.innerHTML = `<b>Version ${esc(v.version)} is available</b> (you have ${esc(C.VERSION)}).
        ${(v.notes || []).length ? `<ul>${v.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
        To update: in your repository on GitHub, open <b>Actions → Update Graph Resume → Run workflow</b>. Your resume.js and settings stay as they are.`;
      el.hidden = false;
    } catch {}
  }

  async function enterStudio() {
    await ready;
    checkForUpdate();
    ["#gate", "#settings", "#workspace", "#visibility", "#links", "#customize", "#apps", "#jobs"].forEach((s) => ($(s).hidden = true));
    if (runtime.inArtifact && !runtime.isOwner) {
      $("#gate").hidden = false;
      $("#gate").innerHTML = "<h2>Owner only</h2><p>The studio is available to the owner of this page.</p>";
      return;
    }
    if (usingClaude()) { $("#workspace").hidden = false; renderHistory(); return; }
    const hash = (G.R.site?.ownerPassphraseSha256 || "").trim().toLowerCase();
    if (hash && SS.get("unlocked") !== hash) { $("#gate").hidden = false; $("#gate-pass").focus(); return; }
    if (!getKey(LS.get("provider", "anthropic"), LS.get("baseUrl", ""))) { openSettings(); return; }
    $("#workspace").hidden = false; renderHistory();
  }
  window.addEventListener("gr:view", (e) => { if (e.detail === "studio") enterStudio(); });

  $("#gate-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const want = (G.R.site?.ownerPassphraseSha256 || "").trim().toLowerCase();
    const got = await sha256($("#gate-pass").value);
    if (got === want) { SS.set("unlocked", want); $("#gate-error").hidden = true; LS.set("owner", true); enterStudio(); }
    else $("#gate-error").hidden = false;
  });

  /* ================= settings ================= */
  function openSettings() {
    ["#gate", "#workspace"].forEach((s) => ($(s).hidden = true));
    $("#settings").hidden = false;
    $("#settings-claude-note").hidden = !usingClaude();
    const p = LS.get("provider", "anthropic");
    $("#provider").value = p;
    $("#model").value = LS.get("model", DEFAULT_MODEL[p]);
    $("#base-url").value = LS.get("baseUrl", OPENROUTER);
    $("#preset").value = LS.get("preset", "");
    $("#api-key").value = getKey(p, $("#base-url").value);
    $("#show-drafts").checked = G.showDrafts();
    const priv = LS.get("private", {});
    $("#priv-phone").value = priv.phone || "";
    $("#priv-availability").value = priv.availability || "";
    const gh = LS.get("gh", {}) || {};
    $("#gh-repo").value = gh.repo || ""; $("#gh-token").value = gh.token || "";
    const O = window.GR_OWNER || {};
    $("#gh-status").textContent = !O.configured ? "Not connected." : O.error ? O.error
      : G.ownerView ? `Connected. Using your private master: ${G.allNodes.filter((n) => n.private).length} hidden from visitors.` : "Connected.";
    $("#priv-notes").value = priv.notes || "";
    syncProvider();
  }
  function syncProvider() {
    const p = $("#provider").value;
    $("#base-url-field").hidden = p !== "openai-compatible";
    $("#model").placeholder = p === "openai-compatible" ? "e.g. a model id from your provider" : DEFAULT_MODEL[p];
  }
  $("#provider").addEventListener("change", () => {
    $("#model").value = DEFAULT_MODEL[$("#provider").value]; $("#preset").value = "";
    $("#api-key").value = getKey($("#provider").value, $("#base-url").value); syncProvider();
  });
  $("#preset").addEventListener("change", () => {
    const pr = PRESETS[$("#preset").value]; if (!pr) return;
    $("#provider").value = pr.provider; $("#model").value = pr.model;
    if (pr.baseUrl) $("#base-url").value = pr.baseUrl;
    $("#api-key").value = getKey(pr.provider, $("#base-url").value);
    syncProvider();
  });
  ["#model", "#base-url"].forEach((s) => $(s).addEventListener("input", () => ($("#preset").value = "")));
  $("#base-url").addEventListener("change", () => ($("#api-key").value = getKey($("#provider").value, $("#base-url").value)));
  $("#studio-settings-btn").addEventListener("click", () => { ["#visibility", "#links", "#customize", "#apps", "#jobs"].forEach((x) => ($(x).hidden = true)); openSettings(); });

  /* ---------------- GitHub (private master) ---------------- */
  const ghHeaders = () => { const gh = LS.get("gh", {}) || {}; return { Authorization: `Bearer ${gh.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }; };
  const ghUrl = (p) => `https://api.github.com/repos/${(LS.get("gh", {}) || {}).repo}/contents/${p}`;
  async function ghGet(p) {
    const r = await fetch(ghUrl(p), { headers: ghHeaders(), cache: "no-store" });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(r.status === 401 ? "GitHub didn't accept the token." : `Couldn't read ${p} (GitHub answered ${r.status}).`);
    const j = await r.json(); return { sha: j.sha, text: b64ToText(j.content) };
  }
  async function ghPut(p, text, sha, message) {
    const r = await fetch(ghUrl(p), { method: "PUT", headers: ghHeaders(), body: JSON.stringify({ message, content: textToB64(text), ...(sha ? { sha } : {}) }) });
    if (r.status === 409 || r.status === 422) throw new Error(`${p} changed on GitHub in the meantime. Try again.`);
    if (r.status === 403 || r.status === 404) throw new Error("The token can read but not save. Give it Contents: Read and write on your private repository.");
    if (!r.ok) throw new Error(`GitHub answered ${r.status} when saving ${p}.`);
  }
  const connected = () => !!(window.GR_OWNER?.configured && G.ownerView);
  // why this page can't save to your private master, in words you can act on
  function notConnectedNote(extra = "") {
    const O = window.GR_OWNER || {};
    const C = window.GRCORE, live = (C?.UPSTREAM || "") + "#studio";
    let msg;
    if (runtime.inArtifact) msg = `This claude.ai preview can't reach GitHub, so it can't save here. Manage links and visibility on your live site${C?.UPSTREAM ? `: <a href="${esc(live)}" target="_blank" rel="noopener">${esc(live.replace(/^https?:\/\//, ""))}</a>` : ""}. To make a link for a CV here, use the <b>Tailored link</b> tab next to that CV.`;
    else if (O.asVisitor) msg = `This tab is showing your site as a visitor sees it, so your private master isn't loaded. <button class="btn ghost small" type="button" data-back-to-owner>Back to your view</button>`;
    else if (O.configured && O.error) msg = `Couldn't load your private master: ${esc(O.error)} Check the repository and token under <b>Model settings → Private master on GitHub</b>.`;
    else if (O.configured) msg = `Your private master is still loading. Reload the page in a moment.`;
    else msg = `Connect this browser to your private master first: <b>Model settings → Private master on GitHub</b>.`;
    return `<p class="note">${msg}${extra ? " " + extra : ""}</p>`;
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-back-to-owner]")) return;
    try { sessionStorage.removeItem("gr.asVisitor"); } catch {}
    location.reload();
  });

  /* ---------------- tailored links ---------------- */
  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
  const b64u = (u) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const linkCode = () => { const A = "abcdefghijkmnpqrstuvwxyz23456789"; return [...rand(6)].map((x) => A[x % A.length]).join(""); };
  const siteBase = () => (G.R.site?.baseIri || location.href.split("#")[0]).replace(/[?#].*$/, "");
  const linkUrl = (l) => `${siteBase()}#for/${l.id}.${l.key}`;
  const plusMonths = (m) => { const d = new Date(); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10); };
  const LINK_TYPES = ["Role", "Break", "Volunteer", "Education", "Project", "Certification", "Award", "Publication", "Language"];
  const publicIds = () => new Set(G.publicNodes.map((n) => n.id));

  // a hidden item plus whatever it needs to show properly (its company, school, skills)
  function withDependencies(ids) {
    const pub = publicIds(), out = new Map();
    const visit = (id) => {
      const n = byId.get(id); if (!n || out.has(id) || n.type === "Person") return;
      out.set(id, n);
      refsOf(n).forEach((r) => { if (!pub.has(r) && ["Organization", "School", "Skill", "SkillGroup"].includes(byId.get(r)?.type)) visit(r); });
    };
    ids.forEach(visit);
    return [...out.values()].map((n) => { const c = JSON.parse(JSON.stringify(n)); delete c.private; return c; });
  }

  // what a tailored CV contains: its items and its skills
  function cvContents(result) {
    const cv = result?.cv || {};
    const items = [...(cv.experience || []), ...(cv.projects || []), ...(cv.education || []), ...(cv.volunteering || [])].map((x) => x.id)
      .concat(cv.certifications || [], cv.awards || [], cv.languages || []);
    const skills = (cv.skills || []).flatMap((g) => g.ids || []);
    const ok = (id) => byId.has(id);
    return { items: [...new Set(items)].filter(ok), skills: [...new Set(skills)].filter(ok) };
  }

  // A short code that carries a CV's link settings from one copy of the site to another,
  // e.g. from the claude.ai preview (where the CV was written) to the live site (which saves links).
  const TRANSFER = "GRLINK2:";
  function transferCode(x = current) {
    const c = cvContents(x.result);
    const data = { id: x.link?.id, key: x.link?.key, company: x.input?.company || x.result?.job?.company || "", role: x.result?.job?.title || "", items: c.items, skills: c.skills };
    return TRANSFER + b64u(new TextEncoder().encode(JSON.stringify(data)));
  }
  // In a page that can't save links (the claude.ai preview), fix the link's address now,
  // so it can go into this CV straight away; the live site later creates the link at it.
  function reserveLink() {
    if (current.link?.url) return current.link;
    const id = linkCode(), key = b64u(rand(16));
    const company = current.input?.company || current.result?.job?.company || "";
    current.link = { id, key, url: linkUrl({ id, key }), company, pending: true, inCv: false };
    updateHistoryItem();
    return current.link;
  }
  function readTransfer(text) {
    const t = String(text || "").trim();
    if (!t.startsWith(TRANSFER)) throw new Error(t.startsWith("GRLINK1:") ? "That code is from an older version. Make the tailored link again next to the CV and copy the new code." : "That isn't a code from “Make tailored link”.");
    const b = t.slice(TRANSFER.length).replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b.padEnd(Math.ceil(b.length / 4) * 4, "=")), (ch) => ch.charCodeAt(0));
    const d = JSON.parse(new TextDecoder().decode(bytes));
    const ok = (id) => byId.has(id);
    const okId = /^[a-z0-9]{6}$/.test(d.id || ""), okKey = /^[A-Za-z0-9_-]{22}$/.test(d.key || "");
    return { id: okId && okKey ? d.id : null, key: okId && okKey ? d.key : null,
      company: String(d.company || "").slice(0, 80), role: String(d.role || "").slice(0, 100),
      items: (d.items || []).filter(ok), skills: (d.skills || []).filter(ok), missing: [...(d.items || []), ...(d.skills || [])].filter((id) => !ok(id)).length };
  }
  function copyTransfer() {
    if (!current) return;
    if (!connected()) reserveLink();
    G.copyText(transferCode()).then(() => toast("Copied. On your live site: Tailored links → New link → paste.", 4500));
    if ($("#tab-link") && !$("#tab-link").hidden) renderLinkTab();
  }

  // The link form, used after a CV (prefilled from it), under Tailored links → New link, and to edit a live link.
  // init: { company, role, items, skills, id?, key?, edit? }: items and skills are what the CV contains;
  // id and key, when given, are the address the preview already put into the CV;
  // edit, when given, is a live link being changed: { id, key, note, mode, omit, created, expires, sha }.
  function mountLinkForm(root, init, onCreated) {
    const ed = init.edit || null;
    const pub = publicIds(), inCv = new Set(init.items || []);
    const items = allNodes.filter((n) => LINK_TYPES.includes(n.type));
    const shownItems = items.filter((n) => pub.has(n.id)), hiddenItems = items.filter((n) => !pub.has(n.id));
    const sub = (n) => [G.dateRange(n), byId.get(n.org || n.school)?.short || byId.get(n.org || n.school)?.label].filter(Boolean).join(" · ");
    const row = (n, name, checked) => `<label class="vis-row"><input type="checkbox" name="${name}" value="${esc(n.id)}" ${checked ? "checked" : ""}><span><span class="vis-label">${esc(n.label)}</span> <span class="vis-meta">${esc(sub(n))}</span></span></label>`;
    const fromCv = inCv.size > 0, nSkills = (init.skills || []).length;
    const allSkills = allNodes.filter((n) => n.type === "Skill"), skillOn = new Set(init.skills || []);
    const omitOn = new Set(ed?.omit || []), mode0 = ed?.mode === "only" ? "only" : "highlight";
    const usesHidden = hiddenItems.some((n) => inCv.has(n.id));
    root.innerHTML = `<div class="link-form">
      <div class="field two">
        <div><label>Company</label><input data-f="company" type="text" maxlength="80" value="${esc(init.company || "")}"></div>
        <div><label>Role</label><input data-f="role" type="text" maxlength="100" value="${esc(init.role || "")}"></div>
      </div>
      <div class="field"><label>A short note to them <span class="opt">optional</span></label>
        <textarea data-f="note" rows="3" maxlength="500" placeholder="e.g. why this team, or what you'd like them to look at first">${esc(ed?.note || "")}</textarea></div>
      <div class="field"><label>What they see</label>
        <label class="check"><input type="radio" name="mode" value="highlight" ${mode0 === "highlight" ? "checked" : ""}> Your whole graph, with what's highlighted below lit up</label>
        <label class="check"><input type="radio" name="mode" value="only" ${mode0 === "only" ? "checked" : ""}> Only what's highlighted below (everything else left out of this link)</label></div>
      <div class="field"><label>Highlight</label>
        <p class="help" style="margin-top:0">${ed ? "Ticked: what this link highlights now. Change as you like." : fromCv ? `Ticked: what this CV contains${nSkills ? `, plus its ${nSkills} skill${nSkills === 1 ? "" : "s"}` : ""}. Change as you like.` : "Tick the roles, projects and other items that matter most for this job."}</p>
        ${shownItems.map((n) => row(n, "focus", inCv.has(n.id))).join("")}</div>
      ${hiddenItems.length ? `<details ${usesHidden ? "open" : ""}><summary>Also show items hidden from visitors (${hiddenItems.length})</summary>
        ${usesHidden ? '<p class="help">Ticked where the CV uses them, so the link matches what you sent.</p>' : ""}${hiddenItems.map((n) => row(n, "add", inCv.has(n.id))).join("")}</details>` : ""}
      <details data-skills><summary>Highlighted skills (<span data-f="nskills">${skillOn.size}</span> of ${allSkills.length})</summary>
        <p class="help">${skillOn.size ? "Ticked: the skills this link lights up. Untick any you don't want to point at." : "Tick the skills to light up for this job."}</p>
        ${allSkills.map((n) => `<label class="vis-row"><input type="checkbox" name="skill" value="${esc(n.id)}" ${skillOn.has(n.id) ? "checked" : ""}><span><span class="vis-label">${esc(n.label)}</span> <span class="vis-meta">${esc(byId.get(n.group)?.label || "")}</span></span></label>`).join("")}</details>
      <details data-omit ${mode0 === "only" ? "hidden" : ""}><summary>Leave things out of this link</summary>${shownItems.map((n) => row(n, "omit", omitOn.has(n.id))).join("")}</details>
      <div class="field two" style="margin-top:16px">
        <div><label>Works until</label><input data-f="expires" type="date" value="${esc(ed?.expires || plusMonths(6))}" min="${new Date().toISOString().slice(0, 10)}"></div>
        <div style="align-self:end"><button class="btn ink wide" data-f="create" type="button">${ed ? "Save changes" : "Create link"}</button></div>
      </div>
      <p class="help" data-f="status" role="status"></p></div>`;
    const q = (k) => root.querySelector(`[data-f="${k}"]`);
    root.querySelector("[data-skills]").addEventListener("change", () => (q("nskills").textContent = root.querySelectorAll('input[name="skill"]:checked').length));
    // "only what's highlighted" makes the leave-out list unnecessary
    root.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", () => { root.querySelector("[data-omit]").hidden = r.value === "only" && r.checked; }));
    q("create").addEventListener("click", async () => {
      const st = (t) => (q("status").textContent = t);
      const val = (name) => [...root.querySelectorAll(`input[name="${name}"]:checked`)].map((b) => b.value);
      const company = q("company").value.trim(), role = q("role").value.trim(), note = q("note").value.trim(), expires = q("expires").value;
      const mode = root.querySelector('input[name="mode"]:checked').value;
      if (!expires) { st("Pick an end date. You can extend it or switch it off later."); return; }
      const addIds = val("add"), picked = [...val("focus"), ...addIds];
      if (!picked.length) { st("Highlight at least one item."); return; }
      const added = withDependencies(addIds), visible = new Set([...pub, ...added.map((n) => n.id)]);
      const skills = val("skill").filter((id) => visible.has(id));
      let omit = mode === "highlight" ? val("omit") : [];
      if (mode === "only") {
        // leave out every item and skill that isn't highlighted; their companies and schools follow
        const keep = new Set([...picked, ...skills]);
        omit = allNodes.filter((n) => pub.has(n.id) && (LINK_TYPES.includes(n.type) || n.type === "Skill") && !keep.has(n.id)).map((n) => n.id);
        // and skill areas left with none of their skills
        const keptGroups = new Set([...keep].map((id) => byId.get(id)).filter((n) => n?.type === "Skill").map((n) => n.group));
        omit.push(...allNodes.filter((n) => n.type === "SkillGroup" && pub.has(n.id) && !keptGroups.has(n.id)).map((n) => n.id));
      }
      const focus = [...new Set([...picked.filter((id) => !omit.includes(id)), ...skills])];
      q("create").disabled = true; st(ed ? "Saving the link…" : "Creating the link…");
      if (ed) {
        // same address and key, new contents: links already sent keep working
        try {
          const keyBytes = fromB64u(ed.key), iv = rand(12);
          const payload = { v: 1, company, role, note, mode, focus, omit, add: added, created: ed.created || new Date().toISOString().slice(0, 10), updated: new Date().toISOString().slice(0, 10) };
          const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
          const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(payload))));
          const file = await ghGet(`links/${ed.id}.json`);
          await ghPut(`links/${ed.id}.json`, JSON.stringify({ v: 1, iv: b64u(iv), ct: b64u(ct) }) + "\n", file?.sha || null, `Tailored link ${ed.id}: edited`);
          const reg = await readRegistry();
          const entry = reg.data.links.find((l) => l.id === ed.id);
          if (entry) { Object.assign(entry, { company, role, expires }); await ghPut("links.json", JSON.stringify(reg.data, null, 2) + "\n", reg.sha, `Tailored link ${ed.id}: ${company || "no company"}, edited`); }
          toast("Link updated. It changes on your site in a minute or two.", 4500);
          onCreated(entry || { id: ed.id, key: ed.key, company, role, expires });
        } catch (e) { st(e.message); q("create").disabled = false; }
        return;
      }
      try {
        const reg0 = await readRegistry();
        if (init.id && reg0.data.links.some((l) => l.id === init.id)) throw new Error(`This tailored link (code ${init.id}) has already been created. Find it in the list below.`);
        const id = init.id || linkCode(), iv = rand(12);
        const keyBytes = init.key ? Uint8Array.from(atob(init.key.replace(/-/g, "+").replace(/_/g, "/") + "=="), (ch) => ch.charCodeAt(0)) : rand(16);
        const payload = { v: 1, company, role, note, mode, focus, omit, add: added, created: new Date().toISOString().slice(0, 10) };
        const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
        const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(payload))));
        await ghPut(`links/${id}.json`, JSON.stringify({ v: 1, iv: b64u(iv), ct: b64u(ct) }) + "\n", null, `Tailored link ${id}`);
        const reg = await readRegistry();
        const entry = { id, key: b64u(keyBytes), company, role, created: payload.created, expires, off: false };
        reg.data.links.push(entry);
        await ghPut("links.json", JSON.stringify(reg.data, null, 2) + "\n", reg.sha, `Tailored link ${id}: ${company || "no company"}`);
        toast("Link created");
        onCreated(entry);
      } catch (e) { st(e.message); q("create").disabled = false; }
    });
  }
  const fromB64u = (t) => Uint8Array.from(atob(String(t).replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(String(t).length / 4) * 4, "=")), (ch) => ch.charCodeAt(0));
  // what a live link contains, decrypted with its key from your private registry
  async function readLinkPayload(entry) {
    const file = await ghGet(`links/${entry.id}.json`);
    if (!file) throw new Error(`The file for link ${entry.id} is missing from your private repository.`);
    const box = JSON.parse(file.text);
    const key = await crypto.subtle.importKey("raw", fromB64u(entry.key), "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64u(box.iv) }, key, fromB64u(box.ct));
    return JSON.parse(new TextDecoder().decode(plain));
  }
  // opens the link as the company sees it, in a new tab
  const openBtn = (url) => `<a class="btn ghost small" href="${esc(url)}" target="_blank" rel="noopener">Open</a>`;
  const NOT_COUNTED = "Opening it from a browser connected to your private master isn't counted as a visit.";
  function linkResultHtml(entry, extra = "") {
    const url = entry.url || linkUrl(entry);
    return `<p>Link for <b>${esc(entry.company || "this job")}</b>, code <code>${esc(entry.id)}</code>${entry.expires ? `, works until ${esc(entry.expires)}` : ", active"}.</p>
      <div class="link-out"><input readonly value="${esc(url)}"><button class="btn ink small" data-copy-link type="button">Copy</button>${openBtn(url)}</div>${extra}
      <p class="help">${entry.activatedElsewhere ? "Activated on your live site; manage, extend or switch it off there under <b>Tailored links</b>." : "It goes live a minute or two after you made it. Manage, extend or switch it off under <b>Tailored links</b>."} ${NOT_COUNTED}</p>`;
  }

  function renderLinkTab() {
    const el = $("#tab-link");
    if (!current) { el.innerHTML = ""; return; }
    const inCvBox = () => `<label class="check" style="margin-top:12px"><input type="checkbox" id="link-in-cv" ${current.link.inCv ? "checked" : ""}> Add it to this CV and cover letter as “${esc(CVUI().linkLabel || "Portfolio")}”, next to your email and LinkedIn (the wording can be changed under Customize → CV and letter)</label>`;
    const wireInCv = () => $("#link-in-cv").addEventListener("change", (e) => { current.link.inCv = e.target.checked; updateHistoryItem(); refreshContact(); });
    if (current.link?.url && current.link.pending) {
      // made here, still to be created on the live site
      el.innerHTML = `<div class="link-form">
        <p>Tailored link for <b>${esc(current.link.company || "this job")}</b>, code <code>${esc(current.link.id)}</code>:</p>
        <div class="link-out"><input readonly value="${esc(current.link.url)}"><button class="btn ghost small" data-copy-link type="button">Copy link</button>${openBtn(current.link.url)}</div>
        ${inCvBox()}
        <div class="note" style="margin-top:14px"><b>Still to do:</b> until you activate it, this address opens your normal public site. To activate it, copy the code and paste it on your live site, connected to your private repository, under <b>Tailored links → New link</b>. It then highlights exactly what's in this CV.
          <p style="margin:10px 0 0"><button class="btn ink small" id="link-transfer" type="button">Copy code for the live site</button></p>
          <p class="help" style="margin:10px 0 0">Already activated it? This page can't check, so open the link: if it says “Prepared for ${esc(current.link.company || "…")}”, it's live. <button class="btn ghost small" id="link-mark-live" type="button">Mark as activated</button></p></div></div>`;
      el.querySelector("[data-copy-link]").addEventListener("click", () => G.copyText(current.link.url).then(() => toast("Link copied")));
      $("#link-transfer").addEventListener("click", copyTransfer);
      $("#link-mark-live").addEventListener("click", () => { current.link.pending = false; current.link.activatedElsewhere = true; updateHistoryItem(); renderLinkTab(); toast("Marked as activated"); });
      wireInCv();
      return;
    }
    if (current.link?.url) {
      el.innerHTML = `<div class="link-form">${linkResultHtml(current.link, inCvBox())}</div>`;
      el.querySelector("[data-copy-link]").addEventListener("click", () => G.copyText(current.link.url).then(() => toast("Link copied")));
      wireInCv();
      return;
    }
    if (!connected()) {
      // e.g. the claude.ai preview: the CV is written here, the link is created on the live site
      el.innerHTML = `<div class="link-form">
        <p>A tailored link opens your graph for this job: their company and role at the top, your note, and what's in this CV highlighted. Only people with the link can open it.</p>
        <p class="help">This page can't save links, so it works in two steps: make the link here (its address is fixed straight away, so you can put it in this CV), then activate it on your live site with a code.</p>
        <p><button class="btn ink small" id="link-reserve" type="button">Make tailored link</button></p></div>`;
      $("#link-reserve").addEventListener("click", () => { reserveLink(); renderLinkTab(); });
      return;
    }
    const c = cvContents(current.result);
    el.innerHTML = `<p class="help" style="margin-top:0">A short link that opens your graph for this job: their company and the role at the top, your note, and what's in this CV highlighted. Only people with the link can open it.</p><div id="link-form-tab"></div>`;
    mountLinkForm($("#link-form-tab"), { company: current.input.company || current.result.job?.company || "", role: current.result.job?.title || "", items: c.items, skills: c.skills },
      (entry) => { current.link = { id: entry.id, url: linkUrl(entry), company: entry.company, expires: entry.expires, inCv: false }; updateHistoryItem(); renderLinkTab(); });
  }

  function updateHistoryItem() {
    const h = LS.get("history", []);
    const i = h.findIndex((x) => x.at === current.at);
    if (i >= 0) { h[i] = current; LS.set("history", h); }
  }

  async function readRegistry() {
    const f = await ghGet("links.json");
    return { sha: f?.sha, data: f ? JSON.parse(f.text) : { links: [] } };
  }

  async function openLinks() {
    ["#gate", "#settings", "#workspace", "#visibility", "#customize", "#apps", "#jobs"].forEach((x) => ($(x).hidden = true));
    $("#links").hidden = false;
    const body = $("#links-body"), st = (t) => ($("#links-status").textContent = t);
    $("#links-new").hidden = true; $("#links-new-box").hidden = true;
    if (!connected()) { body.innerHTML = notConnectedNote(); return; }
    body.innerHTML = `<p class="help">Loading…</p>`; st("");
    $("#links-new").hidden = false;
    let reg, visits;
    try { [reg, visits] = await Promise.all([readRegistry(), readVisits()]); } catch (e) { body.innerHTML = ""; st(e.message); return; }
    const seen = (l) => { const d = visits?.links?.[l.id]; return d?.visitors ? `${d.visitors}<br><span class="vis-meta">last ${esc(fmtDay(d.last))}</span>` : visits ? "0" : "—"; };
    const today = new Date().toISOString().slice(0, 10);
    const links = reg.data.links.slice().reverse();
    if (!links.length) { body.innerHTML = `<p class="help">No tailored links yet. Make one with <b>New link</b>, or from a CV in its <b>Tailored link</b> tab.</p>`; return; }
    const state = (l) => (l.off ? "Switched off" : l.expires && l.expires < today ? "Ended" : "Active");
    body.innerHTML = `<table class="links-table"><thead><tr><th>Company and role</th><th>Code</th><th>Made</th><th>Works until</th><th>State</th><th>Visitors</th><th></th></tr></thead><tbody>${
      links.map((l) => `<tr data-id="${esc(l.id)}" class="${state(l) === "Active" ? "" : "state-off"}">
        <td><b>${esc(l.company || "—")}</b><br>${esc(l.role || "")}</td><td><code>${esc(l.id)}</code></td><td class="nowrap">${esc(l.created || "")}</td>
        <td><input type="date" value="${esc(l.expires || "")}" aria-label="Works until"></td><td>${state(l)}</td><td>${seen(l)}</td>
        <td><div class="link-actions"><button class="btn ghost small" data-act="copy" type="button">Copy link</button>${openBtn(linkUrl(l))}<button class="btn ghost small" data-act="edit" type="button">Edit</button>
          <button class="btn ghost small" data-act="toggle" type="button">${l.off ? "Switch on" : "Switch off"}</button></div></td></tr>`).join("")
    }</tbody></table>`;
    const save = async (mutate, msg) => {
      st("Saving…");
      try { const r = await readRegistry(); mutate(r.data.links); await ghPut("links.json", JSON.stringify(r.data, null, 2) + "\n", r.sha, msg); st("Saved. Your site updates in a minute or two."); openLinks(); }
      catch (e) { st(e.message); }
    };
    $$("#links-body tr[data-id]").forEach((tr) => {
      const id = tr.dataset.id, l = reg.data.links.find((x) => x.id === id);
      tr.querySelector('[data-act="copy"]').addEventListener("click", () => G.copyText(linkUrl(l)).then(() => toast("Link copied")));
      tr.querySelector('[data-act="edit"]').addEventListener("click", () => editLink(l));
      tr.querySelector('[data-act="toggle"]').addEventListener("click", () => save((ls) => { const x = ls.find((y) => y.id === id); x.off = !x.off; }, `Tailored link ${id}: switched ${l.off ? "on" : "off"}`));
      tr.querySelector('input[type="date"]').addEventListener("change", (e) => save((ls) => { ls.find((y) => y.id === id).expires = e.target.value; }, `Tailored link ${id}: works until ${e.target.value}`));
    });
  }
  // Edit a live link: same address, so CVs and letters you've sent keep working
  async function editLink(entry) {
    const box = $("#links-new-box"), st = (t) => ($("#links-status").textContent = t);
    st("Opening the link…");
    let p;
    try { p = await readLinkPayload(entry); } catch (e) { st(e.message); return; }
    st("");
    const linkTypes = (ids) => ids.filter((id) => byId.has(id) && LINK_TYPES.includes(byId.get(id).type));
    const added = (p.add || []).map((n) => n.id || n).filter((id) => byId.has(id));
    const items = [...new Set([...linkTypes(p.focus || []), ...linkTypes(added)])];
    const skills = (p.focus || []).filter((id) => byId.get(id)?.type === "Skill");
    box.hidden = false; $("#links-new").hidden = true;
    box.innerHTML = `<h3 style="margin:0 0 6px">Edit link for ${esc(entry.company || "this job")} <span class="vis-meta">code ${esc(entry.id)}</span></h3>
      <p class="help">The address stays the same, so the CVs and letters you've already sent keep working. Changes show on your site a minute or two after you save.</p>
      <div id="links-edit-form"></div><p><button class="btn ghost small" type="button" id="links-edit-cancel">Cancel</button></p>`;
    mountLinkForm($("#links-edit-form"), { company: p.company ?? entry.company, role: p.role ?? entry.role, items, skills,
      edit: { id: entry.id, key: entry.key, note: p.note || "", mode: p.mode, omit: p.omit || [], created: p.created || entry.created, expires: entry.expires } },
      () => { box.hidden = true; box.innerHTML = ""; openLinks(); });
    $("#links-edit-cancel").addEventListener("click", () => { box.hidden = true; box.innerHTML = ""; $("#links-new").hidden = false; });
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("#studio-links-btn").addEventListener("click", openLinks);
  $("#cv-link-tab").addEventListener("click", () => selectTab("link"));
  // New link: blank, or prefilled from a code copied next to a CV
  $("#links-new").addEventListener("click", () => {
    const box = $("#links-new-box"); box.hidden = false; $("#links-new").hidden = true;
    box.innerHTML = `<h3 style="margin:0 0 6px">New link</h3>
      <div class="field"><label for="links-code">Code from the CV's Tailored link tab <span class="opt">optional</span></label>
        <div class="row"><input id="links-code" type="text" spellcheck="false" placeholder="GRLINK2:…"><button class="btn ghost small" id="links-code-use" type="button">Use</button></div>
        <p class="help" id="links-code-msg">Paste it to highlight exactly what your CV contains, or leave it empty and choose below.</p></div>
      <div id="links-new-form"></div>`;
    const mount = (init) => mountLinkForm($("#links-new-form"), init, (entry) => {
      box.innerHTML = `<h3 style="margin:0 0 6px">New link</h3>${linkResultHtml(entry)}`;
      box.querySelector("[data-copy-link]").addEventListener("click", () => G.copyText(linkUrl(entry)).then(() => toast("Link copied")));
      openLinks().then(() => { $("#links-new-box").hidden = false; $("#links-new").hidden = false; });
    });
    mount({ company: "", role: "", items: [], skills: [] });
    $("#links-code-use").addEventListener("click", () => {
      try {
        const init = readTransfer($("#links-code").value);
        mount(init);
        $("#links-code-msg").textContent = `Using the CV for ${init.company || "this job"}: ${init.items.length} items and ${init.skills.length} skills.` + (init.id ? ` The link keeps the address already in your CV (code ${init.id}).` : "") + (init.missing ? ` ${init.missing} no longer exist in your graph and were skipped.` : "");
      } catch (e) { $("#links-code-msg").textContent = e.message; }
    });
  });
  $("#links-back").addEventListener("click", () => { $("#links").hidden = true; enterStudio(); });

  /* ---------------- applications ---------------- */
  // A private list of the jobs you've applied for, kept in applications.json in your private
  // repository (never published). Each can point at its tailored link, whose visitors come from
  // tracker/visits.json, written hourly from GoatCounter by .github/workflows/visits.yml.
  const APP_STATUS = ["Preparing", "Applied", "Interviewing", "Offer", "Accepted", "Rejected", "Withdrawn", "No reply"];
  const OPEN_STATUS = new Set(["Preparing", "Applied", "Interviewing", "Offer"]);
  const todayIso = () => new Date().toISOString().slice(0, 10);
  const fmtDay = (d) => { if (!d) return ""; const x = new Date(d + "T12:00:00Z"); return isNaN(x) ? d : x.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
  const daysSince = (d) => (d ? Math.round((Date.parse(todayIso()) - Date.parse(d)) / 864e5) : null);
  const appId = () => "a-" + linkCode();
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "");

  async function readApps() {
    const f = await ghGet("applications.json");
    return { sha: f?.sha, data: f ? JSON.parse(f.text) : { applications: [] } };
  }
  async function readVisits() {
    try { const f = await ghGet("tracker/visits.json"); return f ? JSON.parse(f.text) : null; } catch { return null; }
  }
  function visitsHtml(v, code) {
    if (!code) return "";
    const d = v?.links?.[code];
    if (!d || !d.visitors) return `<span class="app-visits none">No visitors yet</span>`;
    const pages = (d.pages || []).map((p) => {
      const n = byId.get(p.page), name = p.page === "read" ? "Read as text" : n ? (n.short || n.label || n.name || p.page).replace(/\n/g, " ") : (p.title || p.page);
      return `<li>${esc(name)} <span class="vis-meta">${p.visitors}</span></li>`;
    }).join("");
    const days = Object.entries(d.days || {}).map(([day, n]) => `<li>${esc(fmtDay(day))} <span class="vis-meta">${n}</span></li>`).join("");
    return `<details class="app-visits"><summary><b>${d.visitors}</b> visitor${d.visitors === 1 ? "" : "s"}, last ${esc(fmtDay(d.last))}</summary>
      <div class="app-visits-body"><div><h4>By day</h4><ul>${days}</ul></div>${pages ? `<div><h4>What they opened</h4><ul>${pages}</ul></div>` : ""}</div></details>`;
  }
  function appCard(a, links, v) {
    const link = a.link && links.find((l) => l.id === a.link);
    const age = daysSince(a.applied);
    const due = a.followUp && a.followUp <= todayIso() && OPEN_STATUS.has(a.status);
    const url = safeUrl(a.url);
    const hist = (a.history || []).map((h) => `${esc(h.status)} ${esc(fmtDay(h.date))}`).join(" → ");
    return `<article class="app ${OPEN_STATUS.has(a.status) ? "" : "closed"}" data-id="${esc(a.id)}">
      <header class="app-head">
        <div><h3>${esc(a.company || "—")}</h3><p class="app-role">${esc(a.role || "")}</p></div>
        <select data-f="status" aria-label="Status for ${esc(a.company || "this application")}" class="app-status s-${esc((a.status || "").toLowerCase().replace(/\s+/g, "-"))}">
          ${APP_STATUS.map((s) => `<option${s === a.status ? " selected" : ""}>${s}</option>`).join("")}</select>
      </header>
      <p class="app-meta">${a.applied ? `Applied ${esc(fmtDay(a.applied))}${age != null && age >= 0 ? ` <span class="vis-meta">(${age === 0 ? "today" : age === 1 ? "yesterday" : age + " days ago"})</span>` : ""}` : "Not applied yet"}
        ${a.salary ? ` · Salary asked: ${esc(/^\d{4,7}$/.test(String(a.salary).trim()) ? "€" + Number(a.salary).toLocaleString("en-GB") : a.salary)}` : ""}${url ? ` · <a href="${esc(url)}" target="_blank" rel="noopener">Job posting</a>` : ""}</p>
      ${a.link ? `<div class="app-link">${link ? `Tailored link <code>${esc(link.id)}</code>${link.off ? " (switched off)" : ""}` : `Tailored link <code>${esc(a.link)}</code> (no longer in your links)`} · ${visitsHtml(v, a.link)}</div>` : ""}
      <div class="app-foot">
        <div class="app-follow${due ? " due" : ""}"><label>Follow up on <input type="date" data-f="followUp" value="${esc(a.followUp || "")}"></label>${due ? ` <b>Due</b>` : ""}</div>
        <details class="app-notes"${a.notes ? " open" : ""}><summary>Notes${hist ? " and history" : ""}</summary>
          <textarea data-f="notes" rows="2" placeholder="Who you talked to, what's next…">${esc(a.notes || "")}</textarea>
          ${hist ? `<p class="help">${hist}</p>` : ""}</details>
        <div class="app-actions">${link ? `<button class="btn ghost small" data-act="copy" type="button">Copy link</button>${openBtn(linkUrl(link))}` : ""}
          <button class="btn ghost small" data-act="edit" type="button">Edit</button>
          <button class="btn ghost small" data-act="delete" type="button">Delete</button></div>
      </div>
    </article>`;
  }
  function appForm(a, links) {
    const opt = (l) => `<option value="${esc(l.id)}"${l.id === a.link ? " selected" : ""}>${esc(l.company || "—")} · ${esc(l.role || "")} (${esc(l.id)})</option>`;
    return `<form class="app-form">
      <div class="grid2">
        <div class="field"><label for="af-company">Company</label><input id="af-company" type="text" required value="${esc(a.company || "")}"></div>
        <div class="field"><label for="af-role">Role</label><input id="af-role" type="text" value="${esc(a.role || "")}"></div>
        <div class="field"><label for="af-applied">Applied on <span class="opt">empty if not yet</span></label><input id="af-applied" type="date" value="${esc(a.applied || "")}"></div>
        <div class="field"><label for="af-status">Status</label><select id="af-status">${APP_STATUS.map((s) => `<option${s === (a.status || "Applied") ? " selected" : ""}>${s}</option>`).join("")}</select></div>
        <div class="field"><label for="af-link">Tailored link <span class="opt">optional</span></label><select id="af-link"><option value="">None</option>${links.slice().reverse().map(opt).join("")}</select></div>
        <div class="field"><label for="af-salary">Salary you asked for <span class="opt">optional</span></label><input id="af-salary" type="text" value="${esc(a.salary || "")}" placeholder="e.g. €63,000"></div>
        <div class="field"><label for="af-url">Job posting <span class="opt">optional</span></label><input id="af-url" type="url" value="${esc(a.url || "")}" placeholder="https://…"></div>
        <div class="field"><label for="af-follow">Follow up on <span class="opt">optional</span></label><input id="af-follow" type="date" value="${esc(a.followUp || "")}"></div>
      </div>
      <div class="field"><label for="af-notes">Notes <span class="opt">optional</span></label><textarea id="af-notes" rows="3">${esc(a.notes || "")}</textarea></div>
      <div class="row end"><button class="btn ghost small" type="button" data-act="cancel">Cancel</button><button class="btn ink small" type="submit">Save</button></div>
    </form>`;
  }
  async function openApps() {
    ["#gate", "#settings", "#workspace", "#visibility", "#links", "#customize", "#jobs"].forEach((x) => ($(x).hidden = true));
    $("#apps").hidden = false;
    const body = $("#apps-body"), box = $("#apps-form-box"), st = (t) => ($("#apps-status").textContent = t);
    $("#apps-new").hidden = true; box.hidden = true; box.innerHTML = "";
    if (!connected()) { body.innerHTML = notConnectedNote(); $("#apps-summary").innerHTML = ""; return; }
    body.innerHTML = `<p class="help">Loading…</p>`; st("");
    let apps, reg, visits;
    try { [apps, reg, visits] = await Promise.all([readApps(), readRegistry(), readVisits()]); }
    catch (e) { body.innerHTML = ""; st(e.message); return; }
    $("#apps-new").hidden = false;
    const links = reg.data.links, list = apps.data.applications || [];
    // one save at a time, so a note and a status changed together don't overwrite each other
    let chain = Promise.resolve();
    const save = (mutate, msg, after) => (chain = chain.then(() => saveNow(mutate, msg, after)));
    const saveNow = async (mutate, msg, after) => {
      st("Saving…");
      try { const r = await readApps(); r.data.applications = r.data.applications || []; mutate(r.data.applications); await ghPut("applications.json", JSON.stringify(r.data, null, 2) + "\n", r.sha, msg); st("Saved."); after ? after() : openApps(); }
      catch (e) { st(e.message); }
    };
    const showForm = (a, isNew) => {
      box.hidden = false; $("#apps-new").hidden = true;
      box.innerHTML = `<h3 style="margin:0 0 10px">${isNew ? "New application" : `Edit ${esc(a.company || "application")}`}</h3>${appForm(a, links)}`;
      const f = box.querySelector("form");
      f.querySelector('[data-act="cancel"]').addEventListener("click", () => { box.hidden = true; box.innerHTML = ""; $("#apps-new").hidden = false; });
      // choosing a link fills in its company and role if they're still empty
      f.querySelector("#af-link").addEventListener("change", (e) => {
        const l = links.find((x) => x.id === e.target.value); if (!l) return;
        if (!$("#af-company").value) $("#af-company").value = l.company || "";
        if (!$("#af-role").value) $("#af-role").value = l.role || "";
      });
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        const val = (id) => $(id).value.trim();
        const next = { company: val("#af-company"), role: val("#af-role"), applied: val("#af-applied"), status: val("#af-status"),
          link: val("#af-link"), salary: val("#af-salary"), url: val("#af-url"), followUp: val("#af-follow"), notes: $("#af-notes").value.trim() };
        Object.keys(next).forEach((k) => { if (next[k] === "" && k !== "company") delete next[k]; });
        if (isNew) {
          const item = { id: appId(), ...next, history: [{ status: next.status, date: next.applied || todayIso() }] };
          save((as) => as.push(item), `Application: ${next.company}${next.role ? ", " + next.role : ""}`);
        } else {
          save((as) => {
            const x = as.find((y) => y.id === a.id); if (!x) throw new Error("This application was deleted in the meantime.");
            if (x.status !== next.status) (x.history = x.history || []).push({ status: next.status, date: todayIso() });
            for (const k of ["company", "role", "applied", "status", "link", "salary", "url", "followUp", "notes"]) { if (k in next) x[k] = next[k]; else delete x[k]; }
          }, `Application ${a.company}: edited`);
        }
      });
      box.scrollIntoView({ behavior: "smooth", block: "start" });
      $("#af-company").focus({ preventScroll: true });
    };
    $("#apps-new").onclick = () => showForm({ status: "Applied", applied: todayIso() }, true);

    // summary: where things stand, and links that have no application yet
    const count = (s) => list.filter((a) => a.status === s).length;
    const totalVisitors = Object.values(visits?.links || {}).reduce((n, d) => n + (d.visitors || 0), 0);
    const unlinked = links.filter((l) => !l.off && !list.some((a) => a.link === l.id));
    $("#apps-summary").innerHTML = list.length ? `<p class="apps-counts">${[["Applied", count("Applied")], ["Interviewing", count("Interviewing")], ["Offer", count("Offer") + count("Accepted")], ["Closed", count("Rejected") + count("Withdrawn") + count("No reply")]]
      .map(([k, n]) => `<span><b>${n}</b> ${k.toLowerCase()}</span>`).join("")}<span><b>${totalVisitors}</b> link visitor${totalVisitors === 1 ? "" : "s"}</span></p>
      <p class="help">${visits ? `Visitor counts come from GoatCounter every hour${totalVisitors ? `; the last new visit was recorded ${esc(fmtDay(Object.values(visits.links || {}).map((d) => d.last).filter(Boolean).sort().at(-1) || visits.updated.slice(0, 10)))}` : "; nobody has opened a tailored link yet"}. People who block trackers aren't counted, so a link can be opened without showing up here.` : "Visitor counts appear here once the hourly <code>Visit counts</code> workflow has run (it needs the <code>GOATCOUNTER_TOKEN</code> secret)."}</p>` : "";
    // newest first: by the date you applied (not applied yet counts as today), then most recently added
    const sorted = list.map((a, i) => [a, i]).sort(([a, i], [b, j]) => String(b.applied || todayIso()).localeCompare(String(a.applied || todayIso())) || j - i).map(([a]) => a);
    body.innerHTML = (unlinked.length ? `<div class="note apps-unlinked"><b>Tailored links without an application:</b> ${unlinked.map((l) => `<button class="btn ghost small" type="button" data-from-link="${esc(l.id)}">Add ${esc(l.company || l.id)}</button>`).join(" ")}</div>` : "")
      + (sorted.length ? sorted.map((a) => appCard(a, links, visits)).join("") : `<p class="help">No applications yet. Add one with <b>New application</b>.</p>`);

    $$("#apps-body [data-from-link]").forEach((b) => b.addEventListener("click", () => {
      const l = links.find((x) => x.id === b.dataset.fromLink);
      showForm({ company: l.company, role: l.role, link: l.id, status: "Applied", applied: (l.created || todayIso()).slice(0, 10) }, true);
    }));
    $$("#apps-body article.app").forEach((el) => {
      const id = el.dataset.id, a = list.find((x) => x.id === id);
      const link = a.link && links.find((l) => l.id === a.link);
      const setField = (field, value, msg) => save((as) => {
        const x = as.find((y) => y.id === id); if (!x) throw new Error("This application was deleted in the meantime.");
        if (field === "status" && x.status !== value) (x.history = x.history || []).push({ status: value, date: todayIso() });
        if (value) x[field] = value; else delete x[field];
      }, msg, field === "notes" ? () => {} : undefined);
      el.querySelector('[data-f="status"]').addEventListener("change", (e) => setField("status", e.target.value, `Application ${a.company}: ${e.target.value}`));
      el.querySelector('[data-f="followUp"]').addEventListener("change", (e) => setField("followUp", e.target.value, `Application ${a.company}: follow up ${e.target.value || "cleared"}`));
      el.querySelector('[data-f="notes"]').addEventListener("change", (e) => setField("notes", e.target.value.trim(), `Application ${a.company}: notes`));
      el.querySelector('[data-act="edit"]').addEventListener("click", () => showForm(a, false));
      const del = el.querySelector('[data-act="delete"]');
      del.addEventListener("click", () => {
        if (del.dataset.armed) return save((as) => { const i = as.findIndex((y) => y.id === id); if (i >= 0) as.splice(i, 1); }, `Application ${a.company}: deleted`);
        del.dataset.armed = "1"; del.textContent = "Delete for good?"; del.classList.add("danger");
        setTimeout(() => { if (del.isConnected) { delete del.dataset.armed; del.textContent = "Delete"; del.classList.remove("danger"); } }, 4000);
      });
      if (link) el.querySelector('[data-act="copy"]').addEventListener("click", () => G.copyText(linkUrl(link)).then(() => toast("Link copied")));
    });
  }
  $("#studio-apps-btn").addEventListener("click", openApps);

  /* ---------------- jobs ---------------- */
  // Postings found by the daily job search (.github/workflows/jobs.yml → jobs/inbox.json), ranked
  // against jobs/preferences.json and your graph. What you save or dismiss is kept in
  // jobs/state.json in your private repository.
  const JOB_FILTERS = [["review", "To review"], ["saved", "Saved"], ["dismissed", "Dismissed"], ["all", "All"]];
  let jobsView = { filter: "review", hideGerman: false };
  async function readJobState() {
    const f = await ghGet("jobs/state.json");
    const data = f ? JSON.parse(f.text) : {};
    return { sha: f?.sha, data: { saved: data.saved || [], dismissed: data.dismissed || [], lastLooked: data.lastLooked || "" } };
  }
  function jobCard(j, st, isNew) {
    const saved = st.saved.includes(j.refnr), dismissed = st.dismissed.includes(j.refnr);
    const age = daysSince(j.posted);
    const tag = (t) => `<span class="job-tag${/German required|Pay up to|Listed since/.test(t) ? " warn" : /applied/i.test(t) ? " done" : ""}">${esc(t)}</span>`;
    const real = (u) => { const v = safeUrl(u); try { return v && new URL(v).pathname.length > 1 ? v : ""; } catch { return ""; } };
    const href = real(j.url) || real(j.baUrl);
    return `<article class="job${dismissed ? " closed" : ""}" data-ref="${esc(j.refnr)}">
      <header class="app-head">
        <div><h3>${href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(j.title)}</a>` : esc(j.title)}${isNew ? ` <span class="job-new">New</span>` : ""}</h3>
          <p class="app-role">${esc(j.company)}${j.place ? ` · ${esc(j.place)}` : ""}${j.posted ? ` · <span class="vis-meta">${age > 60 ? `first posted ${esc(fmtDay(j.posted))}` : `posted ${age === 0 ? "today" : age === 1 ? "yesterday" : age + " days ago"}`}</span>` : ""}
          ${real(j.url) && real(j.baUrl) ? ` · <a class="vis-meta" href="${esc(j.baUrl)}" target="_blank" rel="noopener">agency listing</a>` : ""}</p></div>
        <span class="job-score" title="Fit score from your preferences and skills">${j.score}</span>
      </header>
      <p class="job-why">${(j.why || []).map((w) => `<span class="job-chip">${esc(w)}</span>`).join("")}${(j.tags || []).map(tag).join("")}</p>
      ${j.skills?.length ? `<p class="app-meta">Your skills in it: ${j.skills.map(esc).join(", ")}${j.skillCount > j.skills.length ? ` and ${j.skillCount - j.skills.length} more` : ""}</p>` : ""}
      ${j.description ? `<details class="app-notes"><summary>Job description${j.from ? ` <span class="vis-meta">(full text from ${esc(j.from)})</span>` : ` <span class="vis-meta">(as listed by the agency; may be shortened)</span>`}</summary><div class="job-desc">${esc(j.description)}</div></details>` : ""}
      <div class="app-actions">
        <button class="btn ink small" data-act="write" type="button">Write CV &amp; letter</button>
        <button class="btn ghost small" data-act="track" type="button">Add to Applications</button>
        <button class="btn ghost small" data-act="save" type="button">${saved ? "Saved ✓" : "Save"}</button>
        <button class="btn ghost small" data-act="dismiss" type="button">${dismissed ? "Restore" : "Not for me"}</button>
      </div>
    </article>`;
  }
  async function openJobs() {
    ["#gate", "#settings", "#workspace", "#visibility", "#links", "#customize", "#apps", "#jobs"].forEach((x) => ($(x).hidden = true));
    $("#jobs").hidden = false;
    const body = $("#jobs-body"), st = (t) => ($("#jobs-status").textContent = t);
    $("#jobs-summary").innerHTML = ""; $("#jobs-filters").innerHTML = "";
    if (!connected()) { body.innerHTML = notConnectedNote(); return; }
    body.innerHTML = `<p class="help">Loading…</p>`; st("");
    let inbox, state;
    try {
      const f = await ghGet("jobs/inbox.json");
      inbox = f ? JSON.parse(f.text) : null; state = await readJobState();
    } catch (e) { body.innerHTML = ""; st(e.message); return; }
    if (!inbox) { body.innerHTML = `<p class="help">No job list yet. The <code>Job search</code> workflow in your private repository writes it every morning.</p>`; return; }
    const jobs = inbox.jobs || [], s = state.data;
    const lastLooked = s.lastLooked;
    const isNew = (j) => !lastLooked || (j.found || "") > lastLooked.slice(0, 10);
    const saveState = async (mutate, quiet) => {
      try { const r = await readJobState(); mutate(r.data); await ghPut("jobs/state.json", JSON.stringify(r.data, null, 1) + "\n", r.sha, "Jobs: " + (quiet || "updated")); Object.assign(s, r.data); if (!quiet) st("Saved."); }
      catch (e) { st(e.message); }
    };
    const render = () => {
      const counts = { review: jobs.filter((j) => !s.dismissed.includes(j.refnr)).length, saved: jobs.filter((j) => s.saved.includes(j.refnr)).length, dismissed: jobs.filter((j) => s.dismissed.includes(j.refnr)).length, all: jobs.length };
      $("#jobs-filters").innerHTML = JOB_FILTERS.map(([k, label]) => `<button class="btn ghost small" type="button" data-filter="${k}"${jobsView.filter === k ? ' aria-pressed="true"' : ""}>${label} <span class="vis-meta">${counts[k]}</span></button>`).join("")
        + `<label class="job-hide"><input type="checkbox" id="jobs-hide-german"${jobsView.hideGerman ? " checked" : ""}> Hide roles that require German</label>`;
      let list = jobs.filter((j) => jobsView.filter === "all" ? true : jobsView.filter === "saved" ? s.saved.includes(j.refnr) : jobsView.filter === "dismissed" ? s.dismissed.includes(j.refnr) : !s.dismissed.includes(j.refnr));
      if (jobsView.hideGerman) list = list.filter((j) => !(j.tags || []).includes("German required"));
      body.innerHTML = list.length ? list.map((j) => jobCard(j, s, isNew(j))).join("") : `<p class="help">Nothing here.</p>`;
      $$("#jobs-filters [data-filter]").forEach((b) => b.addEventListener("click", () => { jobsView.filter = b.dataset.filter; render(); }));
      $("#jobs-hide-german").addEventListener("change", (e) => { jobsView.hideGerman = e.target.checked; render(); });
      $$("#jobs-body article.job").forEach((el) => {
        const j = jobs.find((x) => x.refnr === el.dataset.ref);
        el.querySelector('[data-act="save"]').addEventListener("click", () => saveState((d) => {
          d.saved = d.saved.includes(j.refnr) ? d.saved.filter((r) => r !== j.refnr) : [...d.saved, j.refnr];
        }).then(render));
        el.querySelector('[data-act="dismiss"]').addEventListener("click", () => saveState((d) => {
          d.dismissed = d.dismissed.includes(j.refnr) ? d.dismissed.filter((r) => r !== j.refnr) : [...d.dismissed, j.refnr];
        }).then(render));
        el.querySelector('[data-act="write"]').addEventListener("click", async () => {
          await enterStudio();
          $("#jd").value = `${j.title}\n${j.company}${j.place ? ", " + j.place : ""}\n\n${j.description || ""}`.trim();
          $("#company").value = j.company || "";
          $("#jd").dispatchEvent(new Event("input", { bubbles: true }));
          $("#jd-form").scrollIntoView({ behavior: "smooth", block: "start" });
          if ((j.description || "").length < 400) toast("The posting's text is short; paste the full description from the job page if you have it.");
        });
        el.querySelector('[data-act="track"]').addEventListener("click", async () => {
          st("Adding to Applications…");
          try {
            const r = await readApps(); r.data.applications = r.data.applications || [];
            if (r.data.applications.some((a) => a.url && (a.url === j.url || a.url === j.baUrl))) { st("It's already in Applications."); return; }
            r.data.applications.push({ id: appId(), company: j.company, role: j.title, status: "Preparing", url: safeUrl(j.url) || j.baUrl, history: [{ status: "Preparing", date: todayIso() }] });
            await ghPut("applications.json", JSON.stringify(r.data, null, 2) + "\n", r.sha, `Application: ${j.company}, ${j.title} (from Jobs)`);
            st(`Added to Applications as "Preparing".`);
          } catch (e) { st(e.message); }
        });
      });
    };
    const newCount = jobs.filter((j) => isNew(j) && !s.dismissed.includes(j.refnr)).length;
    const german = jobs.filter((j) => (j.tags || []).includes("German required")).length;
    $("#jobs-summary").innerHTML = `<p class="apps-counts"><span><b>${newCount}</b> new since you last looked</span><span><b>${jobs.length}</b> in the list</span><span><b>${german}</b> require German</span></p>
      <p class="help">Updated ${esc(fmtDay((inbox.updated || "").slice(0, 10)))} from the Federal Employment Agency's job database. Ranked by role type (knowledge and ontology engineering first), place (Munich, then Berlin, then remote), your skills in the posting, seniority and German. Change what it looks for in <code>jobs/preferences.json</code>.</p>`;
    render();
    if (newCount && jobs.length) saveState((d) => { d.lastLooked = new Date().toISOString(); }, "looked");
  }
  $("#studio-jobs-btn").addEventListener("click", openJobs);
  $("#jobs-back").addEventListener("click", () => { $("#jobs").hidden = true; enterStudio(); });

  /* ---------------- studio tabs: show which panel is open ---------------- */
  // Each panel has its button; the open one is marked, whichever way it was opened.
  const PANEL_BTN = { "#workspace": "#studio-jd-btn", "#jobs": "#studio-jobs-btn", "#apps": "#studio-apps-btn", "#links": "#studio-links-btn",
    "#visibility": "#studio-vis-btn", "#customize": "#studio-customize-btn", "#settings": "#studio-settings-btn" };
  function markOpenPanel() {
    for (const [panel, btn] of Object.entries(PANEL_BTN)) {
      const b = $(btn); if (!b) continue;
      if ($(panel) && !$(panel).hidden) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    }
  }
  const panelWatch = new MutationObserver(markOpenPanel);
  Object.keys(PANEL_BTN).forEach((p) => $(p) && panelWatch.observe($(p), { attributes: true, attributeFilter: ["hidden"] }));
  markOpenPanel();
  $("#studio-jd-btn").addEventListener("click", () => enterStudio());
  $("#apps-back").addEventListener("click", () => { $("#apps").hidden = true; enterStudio(); });

  /* ---------------- what visitors see ---------------- */
  const VIS_GROUPS = [
    ["Experience", ["Role", "Break"]], ["Volunteering", ["Volunteer"]], ["Education", ["Education"]], ["Projects", ["Project"]],
    ["Certificates, awards and publications", ["Certification", "Award", "Publication"]], ["Languages", ["Language"]], ["Skills", ["Skill"]]
  ];
  const REF = ["org", "school", "skills", "group", "partOf", "promotedFrom", "via", "partner", "includes"];
  const refsOf = (n) => REF.flatMap((f) => [].concat(n[f] ?? []));
  let visWant = null; // id -> hidden?

  // same rule as tools/publish.mjs: what else drops out when these are hidden
  function cascadeOf(hiddenIds) {
    const out = new Set(hiddenIds);
    for (let changed = true; changed; ) {
      changed = false;
      const kept = allNodes.filter((n) => !out.has(n.id)), used = new Set(kept.flatMap(refsOf));
      const cand = new Set(allNodes.filter((n) => out.has(n.id)).flatMap(refsOf));
      for (const n of kept) if (["Organization", "School", "Skill"].includes(n.type) && cand.has(n.id) && !used.has(n.id)) { out.add(n.id); changed = true; }
    }
    return [...out].filter((id) => !hiddenIds.has(id));
  }

  function openVisibility() {
    ["#gate", "#settings", "#workspace", "#links", "#customize", "#apps", "#jobs"].forEach((x) => ($(x).hidden = true));
    $("#visibility").hidden = false;
    const O = window.GR_OWNER || {};
    if (!G.ownerView || !O.configured) {
      $("#vis-body").innerHTML = notConnectedNote(runtime.inArtifact ? "" : "Changes are saved there and published from there.");
      $("#vis-save").disabled = true; $("#vis-cascade").hidden = true; return;
    }
    visWant = Object.fromEntries(allNodes.map((n) => [n.id, !!n.private]));
    const row = (n) => {
      const sub = n.type === "Skill" ? "" : [G.dateRange?.(n) || "", n.org ? byId.get(n.org)?.short || byId.get(n.org)?.label : n.school ? byId.get(n.school)?.short || byId.get(n.school)?.label : ""].filter(Boolean).join(" · ");
      return `<label class="vis-row" data-id="${esc(n.id)}"><input type="checkbox" ${n.private ? "" : "checked"} aria-label="Show ${esc(n.label)} to visitors">
        <span><span class="vis-label">${esc(n.label)}</span>${sub ? ` <span class="vis-meta">${esc(sub)}</span>` : ""}</span></label>`;
    };
    $("#vis-body").innerHTML = VIS_GROUPS.map(([title, types]) => {
      const newest = (x, y) => String(y.end || "9999").localeCompare(String(x.end || "9999")) || String(y.start || "").localeCompare(String(x.start || ""));
      const ns = allNodes.filter((n) => types.includes(n.type)).sort((x, y) => (types[0] === "Skill" || types[0] === "Language" ? 0 : newest(x, y)));
      if (!ns.length) return "";
      if (types[0] === "Skill") {
        // skills by area, folded
        const areas = allNodes.filter((n) => n.type === "SkillGroup");
        return `<details class="vis-group"><summary>${title} <span class="vis-meta">${ns.filter((n) => !n.private).length} of ${ns.length} shown</span></summary>${
          areas.map((a) => { const xs = ns.filter((n) => n.group === a.id); return xs.length ? `<p class="vis-meta" style="margin:12px 0 2px">${esc(a.label)}</p>${xs.map(row).join("")}` : ""; }).join("")
        }${ns.filter((n) => !n.group).map(row).join("")}</details>`;
      }
      return `<div class="vis-group"><h3>${title}</h3>${ns.map(row).join("")}</div>`;
    }).join("");
    $$("#vis-body .vis-row").forEach((r) => {
      r.classList.toggle("off", !r.querySelector("input").checked);
      r.querySelector("input").addEventListener("change", (e) => { visWant[r.dataset.id] = !e.target.checked; updateVis(); });
    });
    $("#vis-status").textContent = "";
    updateVis();
  }
  function visChanges() { return allNodes.filter((n) => visWant && visWant[n.id] !== !!n.private); }
  function updateVis() {
    const changes = visChanges();
    $$("#vis-body .vis-row").forEach((r) => {
      r.classList.toggle("off", visWant[r.dataset.id]);
      r.classList.toggle("changed", visWant[r.dataset.id] !== !!byId.get(r.dataset.id).private);
    });
    const hidden = new Set(Object.keys(visWant).filter((id) => visWant[id]));
    const extra = cascadeOf(hidden).map((id) => byId.get(id)?.label).filter(Boolean);
    $("#vis-cascade").hidden = !extra.length;
    $("#vis-cascade").textContent = extra.length ? `Also left out, because only hidden items use them: ${extra.join(", ")}.` : "";
    $("#vis-save").disabled = !changes.length;
    $("#vis-save").textContent = changes.length ? `Save and publish (${changes.length} ${changes.length === 1 ? "change" : "changes"})` : "Save and publish";
  }

  const b64ToText = (b) => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
  const textToB64 = (t) => { const u = new TextEncoder().encode(t); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
  const reEsc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // flip `private: true` on the node's own line, keeping the rest of the file as you wrote it
  function applyVisibility(text, changes) {
    for (const n of changes) {
      const head = `(id:\\s*"${reEsc(n.id)}",\\s*type:\\s*"[^"]+")`;
      const hide = visWant[n.id];
      const re = hide ? new RegExp(head + "(?!,\\s*private:\\s*true)") : new RegExp(head + ",\\s*private:\\s*true");
      if (!re.test(text)) throw new Error(`Couldn't find "${n.label}" in your resume.js in the usual form, so nothing was saved. Ask Claude to change it, or edit the file.`);
      text = text.replace(re, hide ? "$1, private: true" : "$1");
    }
    // check the result says exactly what was asked
    const w = {}; new Function("window", text)(w);
    for (const m of w.RESUME.nodes) if (!!m.private !== !!visWant[m.id] && visWant[m.id] !== undefined) throw new Error(`"${m.label}" came out differently than asked, so nothing was saved.`);
    return text;
  }

  $("#vis-save").addEventListener("click", async () => {
    const changes = visChanges(); if (!changes.length) return;
    const gh = LS.get("gh", {}) || {};
    const api = `https://api.github.com/repos/${gh.repo}/contents/resume.js`;
    const headers = { Authorization: `Bearer ${gh.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    $("#vis-save").disabled = true; $("#vis-status").textContent = "Saving to your private repository…";
    try {
      const r = await fetch(api, { headers, cache: "no-store" });
      if (!r.ok) throw new Error(r.status === 401 ? "GitHub didn't accept the token." : `Couldn't read resume.js (GitHub answered ${r.status}).`);
      const cur = await r.json();
      const text = applyVisibility(b64ToText(cur.content), changes);
      const hid = changes.filter((n) => visWant[n.id]).map((n) => n.label), shown = changes.filter((n) => !visWant[n.id]).map((n) => n.label);
      const message = [hid.length && `Hide from visitors: ${hid.join(", ")}`, shown.length && `Show to visitors: ${shown.join(", ")}`].filter(Boolean).join("; ");
      const put = await fetch(api, { method: "PUT", headers, body: JSON.stringify({ message, content: textToB64(text), sha: cur.sha }) });
      if (put.status === 409 || put.status === 422) throw new Error("resume.js changed on GitHub in the meantime. Reload the page and try again.");
      if (put.status === 403 || put.status === 404) throw new Error("The token can read but not save. Give it Contents: Read and write on your private repository.");
      if (!put.ok) throw new Error(`GitHub answered ${put.status} when saving.`);
      try { localStorage.setItem("gr.masterCache", text); } catch {}
      $("#vis-status").textContent = "Saved. Your public site updates in a minute or two. Reloading…";
      setTimeout(() => { location.hash = "studio"; location.reload(); }, 1200);
    } catch (e) { $("#vis-status").textContent = e.message; $("#vis-save").disabled = false; }
  });
  $("#studio-vis-btn").addEventListener("click", openVisibility);
  $("#vis-cancel").addEventListener("click", () => { $("#visibility").hidden = true; enterStudio(); });
  $("#settings-save").addEventListener("click", () => {
    const p = $("#provider").value;
    LS.set("provider", p);
    LS.set("model", $("#model").value.trim() || DEFAULT_MODEL[p]);
    LS.set("baseUrl", $("#base-url").value.trim().replace(/\/+$/, ""));
    LS.set("preset", $("#preset").value);
    LS.set(keySlot(p, $("#base-url").value), $("#api-key").value.trim());
    LS.set("owner", true);
    LS.set("private", { phone: $("#priv-phone").value.trim(), availability: $("#priv-availability").value.trim(), notes: $("#priv-notes").value });
    try { localStorage.setItem("gr.showDrafts", $("#show-drafts").checked ? "1" : "0"); } catch {}
    G.applyDraftMarks();
    if (!usingClaude() && !$("#api-key").value.trim()) { toast("Add an API key for this provider to start writing."); return; }
    toast("Settings saved");
    $("#settings").hidden = true; $("#workspace").hidden = false; renderHistory();
  });
  // private master on GitHub
  $("#gh-connect").addEventListener("click", async () => {
    const repo = $("#gh-repo").value.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$|\/$/g, "");
    const token = $("#gh-token").value.trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !token) { $("#gh-status").textContent = "Enter the repository as owner/name and a token."; return; }
    $("#gh-status").textContent = "Checking…";
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/contents/resume.js`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw+json", "X-GitHub-Api-Version": "2022-11-28" }, cache: "no-store"
      });
      if (!r.ok) throw new Error(r.status === 401 ? "GitHub didn't accept the token." : r.status === 404 ? "Couldn't find resume.js there, or the token can't read that repository." : `GitHub answered ${r.status}.`);
      const text = await r.text();
      const w = {}; new Function("window", text)(w);
      if (!w.RESUME?.nodes) throw new Error("That resume.js doesn't define window.RESUME.");
      LS.set("gh", { repo, token }); LS.set("owner", true);
      try { localStorage.setItem("gr.masterCache", text); } catch {}
      $("#gh-status").textContent = `Loaded ${w.RESUME.nodes.length} items. Reloading…`;
      setTimeout(() => location.reload(), 600);
    } catch (e) { $("#gh-status").textContent = e.message; }
  });
  $("#gh-disconnect").addEventListener("click", () => {
    LS.del("gh"); try { localStorage.removeItem("gr.masterCache"); } catch {}
    $("#gh-repo").value = ""; $("#gh-token").value = "";
    $("#gh-status").textContent = "Disconnected. This browser now sees what visitors see.";
    setTimeout(() => location.reload(), 800);
  });

  $("#settings-forget").addEventListener("click", () => {
    try { Object.keys(localStorage).filter((k) => k.startsWith("gr.key:")).forEach((k) => localStorage.removeItem(k)); } catch {}
    LS.del("apiKey"); $("#api-key").value = ""; toast("All keys removed from this browser");
  });
  $("#pass-hash-btn").addEventListener("click", async () => {
    const v = $("#pass-new").value;
    if (!v) { toast("Type a passphrase first."); return; }
    $("#pass-hash-out").textContent = await sha256(v);
  });

  /* ================= grounding source ================= */
  // private notes typed in settings, as { nodeId: [notes] }
  function privateNotes() {
    const out = {};
    String(LS.get("private", {}).notes || "").split("\n").forEach((line) => {
      const m = line.match(/^\s*([\w-]+)\s*:\s*(.+?)\s*$/);
      if (m && byId.has(m[1])) (out[m[1]] = out[m[1]] || []).push(m[2]);
    });
    return out;
  }
  // a skill whose only evidence is a degree: listed as coursework, not as practical experience
  function courseworkOnly(id) {
    const users = allNodes.filter((n) => (n.skills || []).includes(id));
    return users.length > 0 && users.every((n) => n.type === "Education");
  }
  const availability = () => String(LS.get("private", {}).availability || "").trim();
  function factsForModel() {
    const people = {
      id: "me", name: me.name, headline: me.headline, location: me.location, email: me.email,
      links: me.links, summary: me.summary
    };
    const nodes = allNodes.filter((n) => n.id !== "me").map((n) => {
      const o = { id: n.id, type: n.type, label: n.label };
      const org = byId.get(n.org)?.label, school = byId.get(n.school)?.label, group = byId.get(n.group)?.label;
      if (org) o.organization = org;
      if (school) o.school = school;
      if (group) o.skillArea = group;
      const dr = G.dateRange(n); if (dr) o.dates = dr;
      ["location", "employment", "status", "level", "issuer", "date", "venue", "url"].forEach((k) => { if (n[k]) o[k] = n[k]; });
      const summary = n.summary || n.description;
      if (summary && !G.isPlaceholder(summary)) o.summary = summary;
      const hls = G.clean(n.highlights); if (hls.length) o.highlights = hls;
      if (n.skills?.length) o.skills = n.skills;
      if (n.partOf) o.partOf = n.partOf;
      if (n.promotedFrom) o.promotedFrom = n.promotedFrom;
      if (n.via) o.via = n.via;
      if (n.partner) o.coRunBy = byId.get(n.partner)?.label;
      if (n.private) o.hiddenFromVisitors = true;
      if (n.type === "Skill" && courseworkOnly(n.id)) o.evidence = "coursework only";
      const pn = privateNotes()[n.id]; if (pn) o.notes = pn;
      return o;
    });
    return { candidate: people, nodes };
  }

  function buildPrompt(input) {
    const pages = input.length === "2" ? 2 : 1;
    const limits = pages === 1
      ? "At most 3 bullets per role, at most 2 projects with at most 2 bullets each, profile summary at most 55 words, at most 4 skill groups."
      : "At most 5 bullets per role, at most 4 projects with at most 3 bullets each, profile summary at most 80 words.";
    const lang = input.lang === "auto" ? "the same language as the job description" : input.lang;
    const british = input.lang === "British English";
    const system = `You write CVs and cover letters for one specific job, using ONLY the candidate's knowledge graph (JSON below).

Hard rules
1. Never invent employers, job titles, dates, degrees, tools, numbers, metrics or achievements. Every claim must be traceable to graph nodes. If a number is not in the graph, do not write it.
2. You may select, reorder, merge, shorten and rephrase graph facts, and you may use the job's vocabulary when it truthfully describes a graph fact.
3. When the job asks for something the graph does not support, record it as a "gap" in fit. Do not imply that experience in the CV. In the cover letter, write at most one sentence about gaps, framed as what the candidate wants to learn next; never claim the experience, never open a paragraph with a gap or an apology ("To be candid", "Although I have not"), and never compare the candidate's years of experience with the job's.
4. Refer to roles, projects, education, skills and languages by their exact node "id". The app fills in titles, organisations and dates from the graph, so do not repeat them in bullets.
5. Bullets start with a strong past-tense verb (present tense for current work), are concrete, at most 28 words. ${limits}
6. Choose projects by relevance to this job. The app lists projects, education, awards and certifications newest first, and experience newest first and combines a role with the role it was promoted from (promotedFrom), so list experience in any order and do not write a bullet that only states a promotion. Leave out nodes that do not help this application, with one exception: always include current roles (no end date), even unrelated ones, with at least one short bullet, so the timeline has no apparent gap. "Volunteer" nodes never go in experience; list each current one in "volunteering" with one or two short bullets (the candidate removes the section per CV when it doesn't help), and a finished one only when it helps this application. Likewise include a "Break" node in experience (using its id, with its summary condensed into one bullet) whenever omitting it would leave an unexplained gap of six months or more between the roles you list.
7. Keep the graph's limiting words when you rephrase a fact: "proof of concept", "prototype", "pilot", "co-defined", "together with", "supported", "part-time", "coursework" and the like stay attached to that fact in the CV and the letter. Never turn a proof of concept into a production system or a shared result into a solo one.
8. Skills with "evidence": "coursework only" were learned in a degree, not used in work or projects. Include one only if the job asks for it, and then only in a skill group named for coursework (in ${lang}, e.g. "Coursework"), never in bullets or the profile as practical experience.
8b. In English, use ${british ? "British spelling (organise, recognised, modelling, colour, centre)" : "American spelling (organize, recognized, analyze, modeling, color, center), as the graph does"} consistently in the CV and the letter.
9. If the candidate's availability is given, state it once, in the cover letter's last paragraph, in your own words. Otherwise say nothing about start dates.
10. The cover letter is 230 to 340 words, 3 or 4 paragraphs, specific to this company and role. No clichés such as "I am writing to express my interest". Do not include the address block, date or signature; the app adds them.
11. Write everything in ${lang}. Return section titles in that language too.
12. Respond with one JSON object only, no markdown, matching this shape:
{
  "job": { "title": "", "company": "", "languageCode": "en" },
  "fit": {
    "summary": "two or three sentences on how well the graph matches this job, honest about gaps",
    "requirements": [ { "requirement": "short requirement from the job", "evidence": ["node-id"], "strength": "strong|partial|gap", "note": "one short clause" } ]
  },
  "cv": {
    "headline": "one line positioning the candidate for this role",
    "summary": "profile paragraph",
    "experience": [ { "id": "role-node-id", "bullets": [""] } ],
    "projects": [ { "id": "project-node-id", "bullets": [""] } ],
    "volunteering": [ { "id": "volunteer-node-id", "bullets": [""] } ],
    "education": [ { "id": "education-node-id", "note": "optional one line, e.g. thesis relevant to this job" } ],
    "skills": [ { "group": "group name", "ids": ["skill-node-id"] } ],
    "languages": ["language-node-id"],
    "awards": ["award-node-id"],
    "certifications": ["certification-node-id"],
    "sectionTitles": { "profile": "", "experience": "", "projects": "", "education": "", "skills": "", "languages": "", "awards": "", "certifications": "", "volunteering": "" }
  },
  "coverLetter": { "subject": "", "greeting": "", "paragraphs": [""], "closing": "" }
}
List 6 to 12 requirements in fit, covering the job's must-haves first.${input.wantLetter ? "" : ' Set "coverLetter" to null.'}`;

    const user = `CANDIDATE KNOWLEDGE GRAPH
${JSON.stringify(factsForModel())}

JOB DESCRIPTION
${input.jd}

${input.company ? `Company: ${input.company}\n` : ""}${input.contact ? `Hiring contact: ${input.contact}\n` : ""}${input.notes ? `Candidate's note on emphasis: ${input.notes}\n` : ""}${availability() ? `Candidate's availability: ${availability()}\n` : ""}CV length: ${pages} page${pages > 1 ? "s" : ""}.`;
    return { system, user };
  }

  /* ================= model providers ================= */
  async function callModel({ system, user }, onProgress) {
    if (usingClaude()) {
      const res = await runtime.sample([{ role: "user", content: `${system}\n\n${user}` }], {
        modelTier: "complex", cache: false,
        onText: ({ text }) => onProgress?.(text.length)
      });
      return { text: res.text, model: "Claude (claude.ai)" };
    }
    const provider = LS.get("provider", "anthropic");
    const base = (LS.get("baseUrl", OPENROUTER) || OPENROUTER).replace(/\/+$/, "");
    const models = modelList(LS.get("model", DEFAULT_MODEL[provider]) || DEFAULT_MODEL[provider]);
    const key = getKey(provider, base);
    if (!key) throw new Error("Add an API key for this provider in Model settings first.");
    if (!models.length) throw new Error("Set a model in Model settings.");
    try {
      // OpenRouter does the fallback on its side when given a list
      if (provider === "openai-compatible" && /openrouter\.ai/.test(base) && models.length > 1) {
        return await callOpenAICompatible(base, key, models, system, user);
      }
      // everywhere else: try each model in turn on errors that a different model could fix
      let lastErr;
      for (const m of models) {
        try {
          if (provider === "gemini") return await callGemini(key, m, system, user);
          if (provider === "anthropic") return await callAnthropic(key, m, system, user);
          return await callOpenAICompatible(base, key, [m], system, user);
        } catch (e) {
          lastErr = e;
          if (!e.retryable || m === models[models.length - 1]) throw e;
          onProgress?.(0, `${m} unavailable, trying the next model…`);
        }
      }
      throw lastErr;
    } catch (e) {
      if (e instanceof TypeError) throw new Error("The request didn't reach the provider. Check your connection, or that this provider allows requests from a browser.");
      throw e;
    }
  }
  async function callGemini(key, model, system, user) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.4, responseMimeType: "application/json" }
      })
    });
    const j = await readJson(r);
    return { text: (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join(""), model };
  }
  async function callAnthropic(key, model, system, user) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({ model, max_tokens: 8000, temperature: 0.4, system, messages: [{ role: "user", content: user }] })
    });
    const j = await readJson(r);
    return { text: (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join(""), model: j.model || model };
  }
  async function callOpenAICompatible(base, key, models, system, user) {
    const body = { temperature: 0.4, messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_object" } };
    if (models.length > 1) body.models = models; else body.model = models[0];
    const send = (b) => fetch(`${base}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify(b) });
    let r = await send(body);
    if (r.status === 400) { delete body.response_format; r = await send(body); } // some models reject JSON mode
    const j = await readJson(r);
    return { text: j.choices?.[0]?.message?.content || "", model: j.model || models[0] };
  }
  async function readJson(r) {
    let j = null; try { j = await r.json(); } catch {}
    if (r.ok) return j || {};
    const msg = j?.error?.message || j?.message || r.statusText;
    const fail = (text, retryable) => Object.assign(new Error(text), { retryable, status: r.status });
    if (r.status === 401 || r.status === 403) throw fail(`The provider rejected the API key (${r.status}). Check it in Model settings.`, false);
    if (r.status === 402) throw fail(`The provider needs credit on your account before it will answer (${msg}).`, false);
    if (r.status === 429) throw fail("Rate limit reached. Free models allow only a few requests; wait a minute and try again.", true);
    if (r.status === 404) throw fail(`Model not found. Check the model name in Model settings. (${msg})`, true);
    throw fail(`The provider returned an error (${r.status}): ${msg}`, r.status >= 500);
  }
  function parseModelJson(text) {
    let t = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a < 0 || b < a) throw new Error("The model didn't return a CV. Try again, or switch to a stronger model.");
    try { return JSON.parse(t.slice(a, b + 1)); }
    catch { throw new Error("The model's answer was cut off or malformed. Try again, or choose 1 page."); }
  }

  /* ================= grounding check ================= */
  // common British spellings in CVs and letters, and their American forms
  const BRITISH_STEMS = "organi|recogni|reali|prioriti|optimi|standardi|visuali|utili|speciali|summari|minimi|maximi|customi|centrali|normali|categori|characteri|finali|initiali|authori|emphasi|mobili|moneti|personali|operationali|productioni|containeri|digitali|synchroni|tokeni|vectori|apologi|familiari|moderni|industriali|capitali|stabili|generali|formali";
  const BRITISH_RE = new RegExp(`\\b(?:(?:${BRITISH_STEMS})s(?:e|ed|es|ing|ation|ations|er|ers)|(?:analy|paraly|cataly)s(?:e|ed|ing)|model+ing|modelled|labelled|labelling|travelled|travelling|cancelled|behaviours?|colours?|favour(?:ed|ite|able)?|honour(?:ed)?|labour|centres?|programmes?|licenced|catalogue|judgement|enrolment|fulfilment|defence|neighbour(?:ing|hood)?)\\b`, "gi");
  function toAmerican(w) {
    const lower = w.toLowerCase(), cap = (x) => (w[0] === w[0].toUpperCase() ? x[0].toUpperCase() + x.slice(1) : x);
    const map = { modelling: "modeling", modelled: "modeled", labelled: "labeled", labelling: "labeling", travelled: "traveled", travelling: "traveling", cancelled: "canceled",
      labour: "labor", catalogue: "catalog", judgement: "judgment", enrolment: "enrollment", fulfilment: "fulfillment", defence: "defense", licenced: "licensed" };
    if (map[lower]) return cap(map[lower]);
    if (/^(?:analy|paraly|cataly)s/.test(lower)) return cap(lower.replace(/s(e|ed|es|ing)$/, "z$1"));
    if (/our/.test(lower)) return cap(lower.replace("our", "or"));
    if (/^centre/.test(lower)) return cap(lower.replace("centre", "center"));
    if (/^programme/.test(lower)) return cap(lower.replace("programme", "program"));
    return cap(lower.replace(/is(e|ed|es|ing|ation|ations|er|ers)$/, "iz$1"));
  }
  // the reverse: American forms (as the graph writes them) and their British spellings
  const AMERICAN_RE = new RegExp(`\\b(?:(?:${BRITISH_STEMS})z(?:e|ed|es|ing|ation|ations|er|ers)|(?:analy|paraly|cataly)z(?:e|ed|es|ing)|modeling|modeled|labeled|labeling|traveled|traveling|canceled|behaviors?|colors?|favor(?:ed|ite|able)?|honor(?:ed)?|labor|centers?|catalog|defense|enrollment|fulfillment)\\b`, "gi");
  function toBritish(w) {
    const lower = w.toLowerCase(), cap = (x) => (w[0] === w[0].toUpperCase() ? x[0].toUpperCase() + x.slice(1) : x);
    const map = { modeling: "modelling", modeled: "modelled", labeled: "labelled", labeling: "labelling", traveled: "travelled", traveling: "travelling", canceled: "cancelled",
      labor: "labour", catalog: "catalogue", defense: "defence", enrollment: "enrolment", fulfillment: "fulfilment" };
    if (map[lower]) return cap(map[lower]);
    if (/^(?:analy|paraly|cataly)z/.test(lower)) return cap(lower.replace(/z(e|ed|es|ing)$/, "s$1"));
    if (/^(?:behavior|color|favor|honor)/.test(lower)) return cap(lower.replace("or", "our"));
    if (/^center/.test(lower)) return cap(lower.replace("center", "centre"));
    return cap(lower.replace(/iz(e|ed|es|ing|ation|ations|er|ers)$/, "is$1"));
  }
  const britishText = (t) => String(t).replace(AMERICAN_RE, toBritish);
  function groundingCheck(result) {
    const warnings = [];
    const known = (id) => byId.has(id);
    const drop = (arr, label) => (arr || []).filter((x) => {
      const id = typeof x === "string" ? x : x?.id;
      if (known(id)) return true;
      warnings.push(`Removed a ${label} reference that isn't in your graph (${id || "no id"}).`); return false;
    });
    const cv = result.cv || {};
    cv.experience = drop(cv.experience, "role").filter((x) => ["Role", "Break"].includes(byId.get(x.id).type));
    cv.projects = drop(cv.projects, "project");
    cv.volunteering = drop(cv.volunteering, "volunteering").filter((x) => byId.get(x.id).type === "Volunteer");
    cv.education = drop(cv.education, "education");
    cv.languages = drop(cv.languages, "language");
    cv.awards = drop(cv.awards, "award");
    cv.certifications = drop(cv.certifications, "certification");
    cv.skills = (cv.skills || []).map((g) => ({ group: g.group, ids: drop(g.ids, "skill") })).filter((g) => g.ids.length);
    (result.fit?.requirements || []).forEach((r) => (r.evidence = (r.evidence || []).filter(known)));
    result.cv = cv;

    // numbers that appear in the output but nowhere in the graph
    const corpus = JSON.stringify(factsForModel()); // includes private notes, so e.g. a GPA isn't flagged
    const norm = (s) => s.replace(",", ".").replace(/\.0+$/, "");
    const graphNums = new Set((corpus.match(/\d+(?:[.,]\d+)?/g) || []).map(norm));
    const texts = [cv.headline, cv.summary, ...(cv.experience || []).flatMap((x) => x.bullets || []), ...(cv.projects || []).flatMap((x) => x.bullets || []),
      ...(cv.volunteering || []).flatMap((x) => x.bullets || []), ...(cv.education || []).map((x) => x.note), ...(result.coverLetter?.paragraphs || []), result.coverLetter?.subject].filter(Boolean);
    const unknownNums = new Set();
    texts.forEach((t) => (String(t).match(/\d+(?:[.,]\d+)?/g) || []).forEach((n) => { if (!graphNums.has(norm(n))) unknownNums.add(n); }));
    if (unknownNums.size) warnings.push(`These numbers aren't in your graph; check or remove them: ${[...unknownNums].join(", ")}.`);
    // "N years" claims need the same phrase in the graph, not just the digit somewhere
    const lowerCorpus = corpus.toLowerCase();
    const yearClaims = new Set();
    texts.forEach((t) => (String(t).match(/\d+\+?\s*(?:years?|yrs?|jahre?n?)/gi) || []).forEach((m) => {
      if (!lowerCorpus.includes(m.toLowerCase().replace(/\s+/g, " "))) yearClaims.add(m);
    }));
    if (yearClaims.size) warnings.push(`Years-of-experience claims your graph doesn't state: ${[...yearClaims].join(", ")}. Add dates to your roles or remove the claim.`);
    // spelling: the graph is written in American English, so British forms in an American CV stand out
    if (/^en/i.test(result.job?.languageCode || "en") && result.spelling !== "British") {
      const found = new Map();
      texts.forEach((t) => (String(t).match(BRITISH_RE) || []).forEach((w) => found.set(w, toAmerican(w))));
      if (found.size) warnings.push(`British spellings in an American-English CV or letter: ${[...found].map(([b, a]) => `${b} → ${a}`).join(", ")}. Fix them in the text, or choose British spelling before generating.`);
    }
    // and the reverse; skill names, award notes and project titles from the graph are converted when the CV is drawn
    if (/^en/i.test(result.job?.languageCode || "en") && result.spelling === "British") {
      const found = new Map();
      texts.forEach((t) => (String(t).match(AMERICAN_RE) || []).forEach((w) => found.set(w, toBritish(w))));
      if (found.size) warnings.push(`American spellings in a British-English CV or letter: ${[...found].map(([a, b]) => `${a} → ${b}`).join(", ")}. Fix them in the text, or choose American spelling before generating.`);
    }

    // drafts used
    const used = new Set([...(cv.experience || []), ...(cv.projects || []), ...(cv.education || []), ...(cv.volunteering || [])].map((x) => x.id));
    (cv.languages || []).forEach((id) => used.add(id));
    const drafts = [...used].map((id) => byId.get(id)).filter((n) => n?.draft);
    if (drafts.length) warnings.push(`Uses nodes still marked draft, so their details may be incomplete: ${drafts.map((n) => n.label + (n.org ? ` (${byId.get(n.org)?.label})` : "")).join(", ")}.`);
    // items you've hidden on the public site: fine on a CV, but worth knowing
    const hidden = [...used].map((id) => byId.get(id)).filter((n) => n?.private);
    if (hidden.length) warnings.push(`Includes items hidden from visitors on your site: ${hidden.map((n) => n.label).join(", ")}. Keep them if they help this application; a reader who opens your site won't find them there.`);
    // coursework-only skills shown as practical skills
    const courseGroup = /course|studi|kurs|academ|degree|uni/i;
    const asPractice = (cv.skills || []).filter((g) => !courseGroup.test(g.group || "")).flatMap((g) => g.ids).filter(courseworkOnly);
    if (asPractice.length) warnings.push(`Listed as practical skills, but your graph has them only from a degree: ${asPractice.map((id) => byId.get(id).label).join(", ")}. Move them to a coursework group or remove them.`);
    // limiting words ("proof of concept"…) that got lost when a fact was rephrased
    const QUAL = ["proof of concept", "proof-of-concept", "prototype", "pilot", "co-defined", "co-founded", "coursework"];
    const textOf = (n) => [n.summary, n.description, ...(G.clean(n.highlights) || [])].filter(Boolean);
    const nodesMentioning = (term) => allNodes.filter((n) => n.type !== "Skill" && textOf(n).some((t) => t.includes(term))).length;
    const letter = result.coverLetter?.paragraphs || [];
    // a tool that several of your roles or projects use (e.g. PostgreSQL) isn't tied to one proof of concept
    const commonSkill = (w) => allNodes.some((k) => k.type === "Skill" && k.label.includes(w) && allNodes.filter((n) => (n.skills || []).includes(k.id)).length >= 2);
    [...(cv.experience || []), ...(cv.projects || [])].forEach((x) => {
      const n = byId.get(x.id);
      textOf(n).forEach((t) => QUAL.filter((q) => t.toLowerCase().includes(q)).forEach((q) => {
        // distinctive names in that line (e.g. "SAP HANA"), not tools used everywhere
        const names = [...new Set((t.match(/\b[A-Z][A-Za-z0-9]*[A-Z0-9][A-Za-z0-9]*(?:\s[A-Z][A-Za-z0-9]+)*\b/g) || []))].filter((w) => nodesMentioning(w) <= 1 && !commonSkill(w));
        const inCv = (x.bullets || []).filter((b) => names.some((w) => b.includes(w)));
        if (inCv.length && !inCv.some((b) => b.toLowerCase().includes(q.replace("-", " ")) || b.toLowerCase().includes(q))) warnings.push(`${n.label}: your graph calls the ${names.join(", ")} work a ${q}; the CV bullet doesn't say so.`);
        letter.forEach((p, i) => {
          const hit = names.filter((w) => p.includes(w));
          if (hit.length && !p.toLowerCase().includes(q.replace("-", " ")) && !p.toLowerCase().includes(q)) warnings.push(`Cover letter, paragraph ${i + 1}, mentions ${hit.join(", ")}, which your graph describes as a ${q}. Make sure the letter says so.`);
        });
      }));
    });
    // a letter paragraph that opens with a gap or an apology
    const opensWeak = /^(to be (candid|honest|frank)|admittedly|honestly|unfortunately|although i (have not|haven't|lack)|while i (have not|haven't|lack)|i have not yet|i do not (yet )?have|i don't (yet )?have)\b/i;
    letter.forEach((p, i) => { if (opensWeak.test(String(p).trim())) warnings.push(`Cover letter, paragraph ${i + 1}, opens with a gap. Lead with what you bring and keep the gap to one forward-looking sentence.`); });
    const words = /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+years?\b/gi;
    const wordYears = new Set();
    texts.forEach((t) => (String(t).match(words) || []).forEach((m) => { if (!lowerCorpus.includes(m.toLowerCase())) wordYears.add(m); }));
    if (wordYears.size) warnings.push(`Years-of-experience wording your graph doesn't state: ${[...wordYears].join(", ")}.`);
    const undated = (cv.experience || []).map((x) => byId.get(x.id)).filter((n) => !n.start);
    if (undated.length) warnings.push(`No dates in the graph for: ${undated.map((n) => `${n.label}, ${byId.get(n.org)?.label || ""}`).join("; ")}.`);
    return warnings;
  }

  /* ================= generate ================= */
  $("#jd-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = {
      jd: $("#jd").value.trim(), company: $("#company").value.trim(), contact: $("#contact").value.trim(),
      lang: $("#lang").value, length: $("#length").value, notes: $("#notes").value.trim(), wantLetter: $("#want-letter").checked
    };
    if (input.jd.length < 80) { status("Paste the full job description, at least a few lines.", true); return; }
    const btn = $("#generate-btn"); btn.disabled = true;
    const t0 = Date.now();
    const tick = setInterval(() => status(`Writing from your graph… ${Math.round((Date.now() - t0) / 1000)}s`), 1000);
    status("Writing from your graph…");
    try {
      const out = await callModel(buildPrompt(input), (n, note) => status(note || `Writing from your graph… ${(n / 1000).toFixed(1)}k characters`));
      const result = parseModelJson(out.text);
      result.writtenBy = out.model;
      result.spelling = input.lang === "British English" ? "British" : "American";
      result.warnings = groundingCheck(result);
      current = { input, result, at: Date.now() };
      saveHistory(current);
      renderResult(current);
      status(`Done, written by ${out.model}. Review the fit, then edit and export.`);
    } catch (err) {
      console.error(err);
      status(err?.message || "Something went wrong. Try again.", true);
      if (err?.code === "not_granted") status("Claude access wasn't granted for this page.", true);
      if (err?.code === "rate_limited") status("Too many requests right now. Wait a moment and try again.", true);
    } finally { clearInterval(tick); btn.disabled = false; }
  });
  function status(msg, err) { const s = $("#gen-status"); s.textContent = msg; s.classList.toggle("err", !!err); }

  /* ================= history ================= */
  function saveHistory(entry) {
    const h = LS.get("history", []);
    h.unshift({ at: entry.at, input: entry.input, result: entry.result });
    LS.set("history", h.slice(0, 8));
    renderHistory();
  }
  function renderHistory() {
    const h = LS.get("history", []);
    $("#history").innerHTML = h.length ? `<h3>Recent</h3>` + h.map((x, i) => {
      const j = x.result?.job || {};
      return `<button type="button" data-h="${i}">${esc(j.title || "Untitled role")}${j.company ? `, ${esc(j.company)}` : ""}<br><span>${new Date(x.at).toLocaleDateString()}</span></button>`;
    }).join("") : "";
    $$("#history [data-h]").forEach((b) => b.addEventListener("click", () => {
      const x = LS.get("history", [])[+b.dataset.h]; if (!x) return;
      current = x;
      Object.entries({ jd: "jd", company: "company", contact: "contact", lang: "lang", length: "length", notes: "notes" }).forEach(([k, id]) => ($("#" + id).value = x.input[k] ?? ""));
      $("#want-letter").checked = !!x.input.wantLetter;
      renderResult(x);
    }));
  }

  /* ================= render results ================= */
  const TITLES_EN = { profile: "Profile", experience: "Experience", projects: "Projects", education: "Education", skills: "Skills", languages: "Languages", awards: "Awards", certifications: "Certifications", volunteering: "Volunteering" };
  function chipFor(id) {
    const n = byId.get(id); if (!n) return "";
    const org = ["Role", "Volunteer"].includes(n.type) ? byId.get(n.org)?.label : "";
    return `<button type="button" class="chip" data-node="${esc(id)}" style="--c:var(${G.TYPE[n.type]?.color || "--c-other"})"><span class="dot"></span>${esc(n.label)}${org ? `, ${esc(org)}` : ""}</button>`;
  }

  function renderResult({ input, result }) {
    $("#results").hidden = false;
    const fit = result.fit || { requirements: [] };
    const reqs = fit.requirements || [];
    const count = (s) => reqs.filter((r) => r.strength === s).length;
    const w = result.warnings || [];
    $("#tab-fit").innerHTML = `
      <p class="fit-summary">${esc(fit.summary || "")}</p>
      <div class="fit-score">
        <div><strong>${count("strong")}</strong>strong matches</div>
        <div><strong>${count("partial")}</strong>partial</div>
        <div><strong>${count("gap")}</strong>gaps</div>
        <div style="align-self:end"><button class="btn ink small" id="lens-btn" type="button">Highlight matches on the graph</button></div>
      </div>
      <table class="reqs">
        <thead><tr><th scope="col">Requirement</th><th scope="col">Match</th><th scope="col">Evidence in your graph</th></tr></thead>
        <tbody>${reqs.map((r) => `<tr>
          <td>${esc(r.requirement)}${r.note ? `<div class="muted">${esc(r.note)}</div>` : ""}</td>
          <td><span class="strength ${esc(r.strength)}">${esc({ strong: "Strong", partial: "Partial", gap: "Gap" }[r.strength] || r.strength)}</span></td>
          <td><div class="chips">${(r.evidence || []).map(chipFor).join("") || '<span class="muted">Nothing in the graph yet</span>'}</div></td>
        </tr>`).join("")}</tbody>
      </table>
      <div class="checks ${w.length ? "" : "ok"}">
        <h3>${w.length ? "Check before sending" : "Every claim traces back to your graph"}</h3>
        ${w.length ? `<ul>${w.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : '<p class="muted" style="margin:0;font-size:14px">No unknown numbers, nodes or drafts were used.</p>'}
      </div>`;
    $("#lens-btn").addEventListener("click", () => showLens(result));
    $$("#tab-fit [data-node]").forEach((b) => b.addEventListener("click", () => { showLens(result, b.dataset.node); }));

    const letter = result.coverLetter;
    $("#tab-letter").hidden = true;
    $('[data-tab="letter"]').hidden = !letter;
    paintDocs(result, input);
    selectTab("fit");
    $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showLens(result, focusId) {
    const best = {};
    (result.fit?.requirements || []).forEach((r) => (r.evidence || []).forEach((id) => {
      if (best[id] !== "strong") best[id] = r.strength === "strong" ? "strong" : best[id] || r.strength;
    }));
    const cv = result.cv || {};
    [...(cv.experience || []), ...(cv.projects || []), ...(cv.education || [])].forEach((x) => (best[x.id] = best[x.id] || "partial"));
    (cv.skills || []).forEach((g) => g.ids.forEach((id) => (best[id] = best[id] || "partial")));
    const matches = Object.entries(best).filter(([id]) => byId.get(id) && !byId.get(id).private).map(([id, strength]) => ({ id, strength }));
    const j = result.job || {};
    G.setLens(matches, `${matches.length} nodes match ${j.title || "this role"}${j.company ? ` at ${j.company}` : ""}`);
    location.hash = focusId || "";
  }

  function selectTab(t) {
    $$('#results [role="tab"]').forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
    $("#tab-fit").hidden = t !== "fit"; $("#tab-cv").hidden = t !== "cv"; $("#tab-letter").hidden = t !== "letter"; $("#tab-link").hidden = t !== "link";
    if (t === "link") renderLinkTab();
  }
  $$('#results [role="tab"]').forEach((b) => b.addEventListener("click", () => selectTab(b.dataset.tab)));

  // CV and letter style from the site settings (ui.js): layout, accent, section order, titles
  const CVUI = () => (window.GRUI ? window.GRUI.ui.cv : { layout: "classic", accent: "", order: ["profile", "experience", "projects", "education", "skills", "awards", "certifications", "volunteering", "languages"], titles: {} });
  const CV_ACCENT = { classic: "#1D2A40", modern: "#2C46C7", compact: "#1D2A40" };
  function styleCv(el, cvui = CVUI()) {
    el.classList.remove("cv-classic", "cv-modern", "cv-compact");
    el.classList.add("cv-" + cvui.layout);
    el.style.setProperty("--cv-accent", cvui.accent || CV_ACCENT[cvui.layout]);
  }
  // The preview is drawn as separate A4 sheets, broken where the printed PDF breaks.
  // Breaks are measured on an invisible copy laid out exactly like the printed page
  // (210 mm wide, print margins), so the window's width can't skew them.
  const SHEET_GAP = 18; // px of grey between sheets on screen
  const BLOCKS = "h1, h2, .p-item, .p-skills > p, .p-summary, .l-head, .l-meta, p, ul > li";
  const pageMargin = (el) => (el.classList.contains("cv-compact") ? 11 : 15);
  const PRINT_SLACK_MM = 6;
  // a copy of the page without the on-screen sheet spacing, for exports and measuring
  function cleanCopy(paper) {
    const c = paper.cloneNode(true);
    c.removeAttribute("contenteditable"); c.style.removeProperty("min-height"); c.classList.remove("sheets");
    c.querySelectorAll(".pg-start").forEach((e) => { e.classList.remove("pg-start"); e.style.removeProperty("margin-top"); if (!e.getAttribute("class")) e.removeAttribute("class"); if (!e.getAttribute("style")) e.removeAttribute("style"); });
    return c;
  }
  // the copy that goes to the printer: page breaks forced where the screen shows them, so the PDF has
  // the same pages as the preview instead of the browser working them out again
  function printCopy(paper) {
    const c = cleanCopy(paper);
    if (!paper.textContent.trim()) return c;
    const blocks = [...c.querySelectorAll(BLOCKS)];
    pageCuts(paper).forEach((cut) => { const b = cut.at >= 0 ? blocks[cut.at] : null; if (b) b.style.breakBefore = "page"; });
    return c;
  }
  function pageCuts(paper) {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none";
    const el = cleanCopy(paper); el.removeAttribute("id");
    const side = el.classList.contains("cv-compact") ? 14 : 17;
    el.style.cssText += `;width:210mm !important;min-height:0 !important;padding:0 ${side}mm !important;margin:0 !important;box-sizing:border-box !important`;
    probe.appendChild(el); document.body.appendChild(probe);
    const pr = el.getBoundingClientRect(), mm = pr.width / 210;
    // a little short of the sheet: browsers lay text out a few pixels differently on screen and on
    // paper (fonts, zoom, operating system), and the printed copy breaks exactly where the screen does
    const perPage = (297 - 2 * pageMargin(el) - PRINT_SLACK_MM) * mm;
    const y = (n) => n.getBoundingClientRect().top - pr.top, yb = (n) => n.getBoundingClientRect().bottom - pr.top;
    const blocks = [...el.querySelectorAll(BLOCKS)];
    // blocks printed whole (styles.css keeps them together): entries, skill lines, summaries, letter heads
    const WHOLE = ".p-item, .p-skills > p, .p-summary, .l-head, .l-meta";
    const keep = [...el.querySelectorAll(WHOLE + ", h2")];
    // what a heading must stay with: the first block of its section
    const firstAfter = (h) => { let n = h.nextElementSibling; while (n && !n.matches(WHOLE) && n.firstElementChild) n = n.firstElementChild; return n; };
    const last = blocks.reduce((m, n) => Math.max(m, yb(n)), 0);
    const cuts = [];
    let from = 0;
    while (from + perPage < last - 2 && cuts.length < 10) {
      let cut = from + perPage;
      // an entry isn't split across pages, and a heading stays with what follows it
      const item = keep.find((n) => n.matches(WHOLE) && y(n) < cut && yb(n) > cut && y(n) > from);
      if (item) {
        // an entry with four or more bullets may break between bullets, keeping its title with the
        // first two and the last two together (the same rules styles.css gives the printer)
        const lis = item.matches(".p-item") ? [...item.querySelectorAll(":scope > ul > li")] : [];
        let k = -1;
        if (lis.length >= 4) for (let i = 2; i <= lis.length - 2; i++) if (yb(lis[i - 1]) <= cut + 0.5 && y(lis[i]) > from + 1) k = i;
        cut = k > 0 ? y(lis[k]) : y(item);
      }
      const head = keep.find((n) => n.nodeName === "H2" && y(n) < cut && (!firstAfter(n) || y(firstAfter(n)) >= cut - 1) && y(n) > from);
      if (head) cut = y(head);
      // the block that starts the next page, by its place in the page (same order on screen)
      let at = blocks.findIndex((n) => y(n) >= cut - 1 && y(n) > from + 1);
      let inside = null;
      if (at < 0 || y(blocks[at]) > cut + 2) {
        // the break falls inside a paragraph (long letters): it breaks between lines there
        const i = blocks.findIndex((n) => y(n) < cut && yb(n) > cut && !n.querySelector("p, li"));
        if (i >= 0) {
          // at least two lines stay at the bottom and two move to the next page, as browsers print
          const b = blocks[i], lh = parseFloat(getComputedStyle(b).lineHeight) || 16, lines = Math.round((yb(b) - y(b)) / lh);
          let before = Math.floor((cut - y(b)) / lh);
          if (lines - before < 2) before = lines - 2;
          if (before < 2) { cut = y(b); at = i; }
          else { cut = y(b) + before * lh; inside = { index: i, offset: (cut - y(b)) / (yb(b) - y(b)) }; at = -1; }
        }
      }
      cuts.push({ cut, at, inside }); from = cut;
    }
    probe.remove();
    return cuts;
  }
  function markPages(paper) {
    const wrap = paper?.parentElement; if (!wrap) return;
    const tab = paper.id === "cv-paper" ? "cv" : paper.id === "cl-paper" ? "letter" : null;
    // Breaks are measured on a hidden copy, so the page itself is only touched where something
    // actually changed. Clearing and redrawing every sheet on each keystroke moved the text under
    // the cursor and made the view jump while editing.
    const empty = !paper.textContent.trim();
    const cuts = empty ? [] : pageCuts(paper), pages = empty ? 0 : cuts.length + 1;
    const visible = !!paper.offsetHeight;
    const rect = paper.getBoundingClientRect(), mm = rect.width / 210;
    // on a narrow screen the page isn't drawn at A4 width, so sheets wouldn't be true to size: mark the breaks with a line instead
    const trueSize = visible && pages > 0 && Math.abs(rect.width - 210 * 96 / 25.4) < 4;
    const blocks = visible ? [...paper.querySelectorAll(BLOCKS)] : [];
    const starts = new Set(trueSize ? cuts.filter((c) => c.at >= 0).map((c) => blocks[c.at]).filter(Boolean) : []);
    paper.querySelectorAll(".pg-start").forEach((e) => { if (!starts.has(e)) { e.classList.remove("pg-start"); e.style.removeProperty("margin-top"); } });
    if (paper.classList.contains("sheets") !== trueSize) paper.classList.toggle("sheets", trueSize);
    const guides = [];
    if (visible && pages) {
      const sheet = 297 * mm, margin = pageMargin(paper) * mm;
      const top = () => paper.getBoundingClientRect().top;
      cuts.forEach((c, k) => {
        const n = k + 1; // sheets before this break
        const el = c.at >= 0 ? blocks[c.at] : null;
        let lineY;
        if (el && trueSize) {
          const want = n * (sheet + SHEET_GAP) + margin;
          // move it only by the difference (twice at most, as collapsing margins can absorb part of it)
          for (let i = 0; i < 2; i++) {
            const off = want - (el.getBoundingClientRect().top - top());
            if (Math.abs(off) <= 0.5) break;
            const m = parseFloat(getComputedStyle(el).marginTop) || 0;
            el.classList.add("pg-start"); el.style.marginTop = `${Math.max(0, m + off)}px`;
          }
          lineY = n * sheet + (n - 1) * SHEET_GAP;
        } else if (el) {
          lineY = el.getBoundingClientRect().top - top() - 4;
        } else if (c.inside && blocks[c.inside.index]) {
          const r = blocks[c.inside.index].getBoundingClientRect();
          lineY = r.top - top() + c.inside.offset * r.height;
        } else return;
        guides.push({ page: n + 1, gap: !!(el && trueSize), top: paper.offsetTop + lineY });
      });
      const mh = trueSize ? `${pages * sheet + (pages - 1) * SHEET_GAP}px` : "";
      if (paper.style.minHeight !== mh) paper.style.minHeight = mh;
    } else if (paper.style.minHeight) paper.style.removeProperty("min-height");
    // the grey gaps and lines sit beside the page; redraw them only when they moved
    const key = guides.map((g) => `${g.page}:${g.gap}:${Math.round(g.top)}:${paper.offsetLeft}:${paper.offsetWidth}`).join("|");
    if (wrap.dataset.guides !== key || (visible && wrap.querySelectorAll(".page-guide").length !== guides.length)) {
      wrap.querySelectorAll(".page-guide").forEach((e) => e.remove());
      guides.forEach((s) => {
        const g = document.createElement("div");
        g.className = "page-guide" + (s.gap ? " gap" : ""); g.setAttribute("aria-hidden", "true"); g.dataset.page = s.page;
        g.style.top = `${s.top}px`;
        // a gap is 2px wider than the page on each side, so it also covers the page's editing outline
        g.style.left = `${paper.offsetLeft - (s.gap ? 2 : 0)}px`; g.style.width = `${paper.offsetWidth + (s.gap ? 4 : 0)}px`;
        if (s.gap) g.style.height = `${SHEET_GAP}px`;
        g.innerHTML = `<span>Page ${s.page}</span>`;
        wrap.appendChild(g);
      });
      if (visible) wrap.dataset.guides = key;
    }
    if (!tab) return;
    const want = tab === "cv" ? Number(current?.input?.length) || 0 : 1;
    const over = pages > 0 && want > 0 && pages > want;
    const btn = $(`#results [data-tab="${tab}"]`);
    if (btn) {
      let badge = btn.querySelector(".tab-pages");
      if (!badge) { badge = document.createElement("span"); badge.className = "tab-pages"; btn.appendChild(badge); }
      badge.textContent = pages ? `${pages} p.` : "";
      badge.classList.toggle("over", over);
      btn.title = pages ? `${pages} page${pages === 1 ? "" : "s"}${over ? `; you asked for ${want}` : ""}` : "";
    }
    const nav = $(`#tab-${tab} .page-nav`);
    if (nav) {
      nav.innerHTML = pages > 1 ? `<span>Page</span>${Array.from({ length: pages }, (_, i) => `<button type="button" data-page="${i + 1}">${i + 1}</button>`).join("")}${over ? `<em>you asked for ${want}</em>` : ""}`
        : pages === 1 ? `<span>1 page</span>` : "";
    }
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".page-nav [data-page]"); if (!b) return;
    const tab = b.closest(".tab"), n = Number(b.dataset.page);
    const target = n === 1 ? tab.querySelector(".paper") : tab.querySelector(`.page-guide[data-page="${n}"]`);
    target?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  });
  const pageObserver = window.ResizeObserver ? new ResizeObserver((es) => es.forEach((e) => markPages(e.target))) : null;
  ["#cv-paper", "#cl-paper"].forEach((sel) => {
    const el = $(sel); if (!el) return;
    pageObserver?.observe(el);
    let t, t2;
    el.addEventListener("input", () => {
      clearTimeout(t); t = setTimeout(() => markPages(el), 250);
      clearTimeout(t2); t2 = setTimeout(() => saveEdits(sel === "#cv-paper" ? "cv" : "cl"), 400);
    });
  });
  window.addEventListener("resize", () => ["#cv-paper", "#cl-paper"].forEach((sel) => $(sel) && markPages($(sel))));
  /* ----- this CV's section order (starts from your Customize order) ----- */
  const sectionStash = new Map(); // hidden sections' nodes, kept with your edits until shown again
  function cvSections() {
    const base = CVUI().order;
    const own = current?.sections;
    const order = own?.order ? [...own.order.filter((k) => base.includes(k)), ...base.filter((k) => !own.order.includes(k))] : [...base];
    return { order, hidden: (own?.hidden || []).filter((k) => order.includes(k)), custom: !!own };
  }
  function cvLook() { const c = cvSections(); return Object.assign({}, CVUI(), { order: c.order, hidden: c.hidden }); }
  // which sections this CV has content for, with their titles as shown
  function cvSectionList() {
    const probe = document.createElement("div");
    probe.innerHTML = renderCv(current.result, Object.assign({}, CVUI(), { order: cvSections().order, hidden: [] }));
    const paper = $("#cv-paper");
    return [...probe.querySelectorAll("h2[data-sec]")].map((h) => ({ key: h.dataset.sec, title: (paper.querySelector(`h2[data-sec="${h.dataset.sec}"]`) || h).textContent.trim() }));
  }
  // the nodes of one section in the page: its heading and everything up to the next section
  function sectionNodes(paper, key) {
    const h = paper.querySelector(`h2[data-sec="${key}"]`); if (!h) return sectionStash.get(key) || null;
    const nodes = [h]; let n = h.nextSibling;
    while (n && !(n.nodeType === 1 && n.matches?.("h2[data-sec]"))) { nodes.push(n); n = n.nextSibling; }
    return nodes;
  }
  function applySections() {
    const paper = $("#cv-paper"), { order, hidden } = cvSections();
    const groups = new Map(order.map((k) => [k, sectionNodes(paper, k)]).filter(([, v]) => v));
    groups.forEach((nodes) => nodes.forEach((n) => n.remove()));
    order.forEach((k) => {
      const nodes = groups.get(k); if (!nodes) return;
      if (hidden.includes(k)) sectionStash.set(k, nodes);
      else { sectionStash.delete(k); nodes.forEach((n) => paper.appendChild(n)); }
    });
    markPages(paper);
  }
  function setSections(order, hidden) {
    current.sections = order ? { order, hidden } : undefined;
    updateHistoryItem(); applySections(); renderSectionPanel();
    if (current.edits?.cv) saveEdits("cv");
  }
  function renderSectionPanel() {
    const box = $("#cv-sections"); if (!box || !current?.result) return;
    const { order, hidden, custom } = cvSections();
    const list = cvSectionList(), keys = list.map((x) => x.key);
    $("#cv-sections-btn").textContent = custom ? "Sections (this CV)…" : "Sections…";
    box.innerHTML = `<p class="help">Order and show sections for this CV only. New CVs start from your order in Customize.</p>
      <ol class="sec-list">${list.map(({ key, title }, i) => `<li data-key="${key}" class="${hidden.includes(key) ? "off" : ""}">
        <label class="check"><input type="checkbox" data-act="show" ${hidden.includes(key) ? "" : "checked"}> <span>${esc(title)}</span></label>
        <span class="sec-move"><button type="button" class="btn ghost small" data-act="up" aria-label="Move ${esc(title)} up" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" class="btn ghost small" data-act="down" aria-label="Move ${esc(title)} down" ${i === list.length - 1 ? "disabled" : ""}>↓</button></span></li>`).join("")}</ol>
      <div class="row end"><button type="button" class="btn ghost small" data-act="reset" ${custom ? "" : "disabled"}>Use my default order</button><button type="button" class="btn ink small" data-act="done">Done</button></div>`;
    box.onclick = (e) => {
      const b = e.target.closest("[data-act]"); if (!b || b.dataset.act === "show") return;
      if (b.dataset.act === "done") { box.hidden = true; $("#cv-sections-btn").setAttribute("aria-expanded", "false"); return; }
      if (b.dataset.act === "reset") { setSections(null); return; }
      const key = b.closest("li").dataset.key, i = keys.indexOf(key), j = b.dataset.act === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= keys.length) return;
      const shown = [...keys]; [shown[i], shown[j]] = [shown[j], shown[i]];
      // sections without content keep their place at the end
      setSections([...shown, ...order.filter((k) => !shown.includes(k))], hidden);
      $(`#cv-sections li[data-key="${key}"] [data-act="${b.dataset.act}"]`)?.focus();
    };
    box.onchange = (e) => {
      const c = e.target.closest('[data-act="show"]'); if (!c) return;
      const key = c.closest("li").dataset.key;
      const h = new Set(hidden); c.checked ? h.delete(key) : h.add(key);
      setSections(order, [...h]);
    };
  }
  $("#cv-sections-btn").addEventListener("click", () => {
    const box = $("#cv-sections"); box.hidden = !box.hidden;
    $("#cv-sections-btn").setAttribute("aria-expanded", String(!box.hidden));
    if (!box.hidden) renderSectionPanel();
  });
  /* ----- your hand edits, saved with the CV and letter in your history ----- */
  const fragmentHtml = (nodes) => { const d = document.createElement("div"); nodes.forEach((n) => d.appendChild(n.cloneNode(true))); return cleanCopy(d).innerHTML; };
  function saveEdits(which) {
    if (!current?.result) return;
    const paper = which === "cv" ? $("#cv-paper") : $("#cl-paper");
    if (!paper.textContent.trim()) return;
    current.edits = current.edits || {};
    current.edits[which] = cleanCopy(paper).innerHTML;
    if (which === "cv") current.edits.cvHidden = Object.fromEntries([...sectionStash].map(([k, nodes]) => [k, fragmentHtml(nodes)]));
    updateHistoryItem(); showEditState();
  }
  function showEditState() {
    ["cv", "cl"].forEach((w) => {
      const b = $(`[data-restore="${w}"]`); if (!b) return;
      b.hidden = !current?.edits?.[w];
      b.textContent = "Restore generated text"; delete b.dataset.armed;
      const note = $(`#tab-${w === "cv" ? "cv" : "letter"} .edit-note`);
      if (note) note.textContent = current?.edits?.[w] ? "Your edits are saved with this " + (w === "cv" ? "CV." : "letter.") : "Click any text to edit; edits are saved as you type.";
    });
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-restore]"); if (!b || !current) return;
    if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "Click again to discard your edits"; setTimeout(() => { if (b.dataset.armed) { delete b.dataset.armed; b.textContent = "Restore generated text"; } }, 4000); return; }
    const w = b.dataset.restore;
    if (current.edits) { delete current.edits[w]; if (w === "cv") delete current.edits.cvHidden; }
    updateHistoryItem(); paintDocs(current.result, current.input); toast(w === "cv" ? "CV restored to the generated text" : "Letter restored to the generated text");
  });
  // the contact line alone, e.g. when the tailored link is added, without touching your edits
  function refreshContact() {
    const cv = $("#cv-paper .p-contact"), cl = $("#cl-paper .l-head p");
    if (cv) cv.innerHTML = contactLine();
    if (cl) cl.innerHTML = contactLine();
    if (current?.edits?.cv) saveEdits("cv");
    if (current?.edits?.cl) saveEdits("cl");
    ["#cv-paper", "#cl-paper"].forEach((sel) => markPages($(sel)));
  }
  function paintDocs(result, input) {
    const ed = current?.result === result ? current.edits || {} : {};
    // every section is drawn, then this CV's hidden ones are set aside, so they can be shown again
    sectionStash.clear();
    if (ed.cv) {
      $("#cv-paper").innerHTML = ed.cv;
      Object.entries(ed.cvHidden || {}).forEach(([k, html]) => { const t = document.createElement("template"); t.innerHTML = html; sectionStash.set(k, [...t.content.childNodes]); });
    } else $("#cv-paper").innerHTML = renderCv(result, Object.assign(cvLook(), { hidden: [] }));
    styleCv($("#cv-paper"));
    applySections(); renderSectionPanel();
    if (result.coverLetter) { $("#cl-paper").innerHTML = ed.cl || renderLetter(result, input); styleCv($("#cl-paper")); }
    showEditState();
    (document.fonts?.ready || Promise.resolve()).then(() => { markPages($("#cv-paper")); markPages($("#cl-paper")); });
  }
  function contactLine() {
    const a = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;
    const phone = LS.get("private", {}).phone;
    const parts = [
      me.location ? esc(me.location) : "",
      phone ? a("tel:" + phone.replace(/[^\d+]/g, ""), phone) : "",
      me.email ? a("mailto:" + me.email, me.email) : "",
      ...(me.links || []).filter((l) => l.url).map((l) => a(l.url, l.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")))
    ].filter(Boolean);
    if (current?.link?.inCv && current.link.url) parts.push(`<a href="${esc(current.link.url)}">${esc(CVUI().linkLabel || "Portfolio")}</a>`);
    return parts.join("  |  ");
  }
  // Experience as shown on a CV: newest first, and a role combined with the roles it was promoted from
  // One CV entry per job: a role and the roles it was promoted from (or to) are shown together,
  // under the latest title, with the dates of the whole stay. The model may pick any one of them;
  // the rest of the chain comes from the graph so the dates and titles are never cut short.
  function experienceView(list) {
    const items = (list || []).filter((x) => byId.has(x.id));
    const inList = new Map(items.map((x) => [x.id, x]));
    const promotedTo = new Map();
    for (const n of allNodes) if (n.promotedFrom && byId.has(n.promotedFrom)) promotedTo.set(n.promotedFrom, n.id);
    const topOf = (id) => { const seen = new Set([id]); while (promotedTo.has(id) && !seen.has(promotedTo.get(id))) { id = promotedTo.get(id); seen.add(id); } return id; };
    const groups = new Map();
    for (const x of items) { const t = topOf(x.id); if (!groups.has(t)) groups.set(t, []); groups.get(t).push(x); }
    const view = [...groups.entries()].map(([topId, picked]) => {
      const chain = [];
      for (let id = topId, seen = new Set(); id && byId.has(id) && !seen.has(id); id = byId.get(id).promotedFrom) { seen.add(id); chain.push(byId.get(id)); }
      const n = chain[0], earlier = chain.slice(1);
      let bul = chain.flatMap((c) => (inList.get(c.id)?.bullets || []));
      if (earlier.length) bul = bul.filter((b) => !/^(promoted|befördert)\b/i.test(String(b).trim()));
      const start = chain.map((c) => c.start).filter(Boolean).sort()[0] || n.start;
      return { id: n.id, node: n, earlier, bullets: bul, start, order: Math.min(...picked.map((x) => items.indexOf(x))) };
    });
    const key = (e) => String(e.start || "0000");
    return view.sort((a, b) => key(b).localeCompare(key(a)) || String(b.node.end || "9999").localeCompare(String(a.node.end || "9999")));
  }
  function renderCv(result, cvui = CVUI()) {
    const cv = result.cv || {};
    // your own section titles apply to English CVs; for other languages the model's titles win
    const english = !result.job?.languageCode || /^en/i.test(result.job.languageCode);
    const T = english ? Object.assign({}, TITLES_EN, cv.sectionTitles || {}, cvui.titles) : Object.assign({}, TITLES_EN, cvui.titles, cv.sectionTitles || {});
    const sec = (title, body) => (body ? `<h2>${esc(title)}</h2>${body}` : "");
    const row = (left, right) => `<div class="p-row"><span class="p-title">${left}</span><span class="p-dates">${esc(right || "")}</span></div>`;
    const bullets = (b) => ((b || []).length ? `<ul>${b.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");

    const english_ = english;
    // text taken straight from the graph (written in American English) follows the chosen spelling;
    // names of organisations, schools, issuers and job titles are left as they are
    const sp = english && result.spelling === "British" ? britishText : (x) => x;
    const exp = experienceView(cv.experience).map((e) => {
      const n = e.node, org = byId.get(n.org);
      const sub = [n.location, n.employment].filter(Boolean).join(", ");
      if (!e.earlier.length) {
        return `<div class="p-item">${row(esc(n.label) + (org ? `, ${esc(org.label)}` : ""), G.dateRange(n))}${sub ? `<div class="p-sub">${esc(sub)}</div>` : ""}${bullets(e.bullets)}</div>`;
      }
      // a promotion: the employer once, then each title on its own line with its own dates, latest first.
      // This is how application forms that read CVs expect it; a "Promoted from …" note beside one set of
      // dates was read by them as a second job, and gave the later title the dates of the whole stay.
      const roles = [n, ...e.earlier].map((r) => `<div class="p-row p-role"><span class="p-title">${esc(r.label)}</span><span class="p-dates">${esc(G.dateRange(r))}</span></div>`).join("");
      return `<div class="p-item p-chain">${row(org ? esc(org.label) : esc(n.label), "")}${sub ? `<div class="p-sub">${esc(sub)}</div>` : ""}${roles}${bullets(e.bullets)}</div>`;
    }).join("");
    // newest first, like experience: ongoing items on top, then by end date, then by start date
    const when = (n) => [n.end || (n.start ? "9999" : n.date || ""), n.start || n.date || ""];
    const newest = (getNode) => (a, b) => { const [ea, sa] = when(getNode(a)), [eb, sb] = when(getNode(b)); return eb.localeCompare(ea) || sb.localeCompare(sa); };
    const node = (x) => byId.get(typeof x === "string" ? x : x.id) || {};
    const proj = (cv.projects || []).filter((x) => byId.has(x.id)).sort(newest(node)).map((x) => {
      const n = byId.get(x.id);
      return `<div class="p-item">${row(esc(sp(n.label)), G.dateRange(n) || n.status)}${bullets(x.bullets)}</div>`;
    }).join("");
    const vol = (cv.volunteering || []).filter((x) => byId.has(x.id)).sort(newest(node)).map((x) => {
      const n = byId.get(x.id), org = byId.get(n.org);
      const sub = [n.location, n.employment].filter(Boolean).join(", ");
      return `<div class="p-item">${row(esc(n.label) + (org ? `, ${esc(org.label)}` : ""), G.dateRange(n))}${sub ? `<div class="p-sub">${esc(sub)}</div>` : ""}${bullets(x.bullets)}</div>`;
    }).join("");
    const edu = (cv.education || []).filter((x) => byId.has(x.id)).sort(newest(node)).map((x) => {
      const n = byId.get(x.id); const s = byId.get(n.school);
      return `<div class="p-item">${row(esc(n.label), G.dateRange(n))}${s ? `<div class="p-sub">${esc(s.label)}</div>` : ""}${x.note ? `<p class="p-summary">${esc(x.note)}</p>` : ""}</div>`;
    }).join("");
    const skills = (cv.skills || []).map((g) => `<p><b>${esc(sp(g.group))}:</b> ${g.ids.map((id) => esc(sp(byId.get(id).label))).join(", ")}</p>`).join("");
    const awards = (cv.awards || []).filter((id) => byId.has(id)).sort(newest(node)).map((id) => {
      const n = byId.get(id); const o = byId.get(n.org);
      return `<div class="p-item">${row(esc(n.label) + (o ? `, ${esc(o.label)}` : ""), G.fmtDate(n.date))}${n.summary ? `<p class="p-summary">${esc(sp(n.summary))}</p>` : ""}</div>`;
    }).join("");
    const certs = (cv.certifications || []).filter((id) => byId.has(id)).sort(newest(node)).map((id) => {
      const n = byId.get(id);
      return `<div class="p-item">${row(esc(n.label) + (n.issuer ? `, ${esc(n.issuer)}` : ""), G.fmtDate(n.date))}</div>`;
    }).join("");
    const langs = (cv.languages || []).map((id) => { const n = byId.get(id); return esc(n.label + (n.level ? ` (${n.level})` : "")); }).join(", ");

    const SECTIONS = {
      profile: () => sec(T.profile, cv.summary ? `<p class="p-summary">${esc(cv.summary)}</p>` : ""),
      experience: () => sec(T.experience, exp),
      projects: () => sec(T.projects, proj),
      education: () => sec(T.education, edu),
      skills: () => sec(T.skills, skills ? `<div class="p-skills">${skills}</div>` : ""),
      awards: () => sec(T.awards, awards),
      certifications: () => sec(T.certifications, certs),
      volunteering: () => sec(T.volunteering, vol),
      languages: () => sec(T.languages, langs ? `<p class="p-summary">${langs}</p>` : "")
    };
    return `
      <h1>${esc(me.name)}</h1>
      <p class="p-headline">${esc(cv.headline || me.headline || "")}</p>
      <p class="p-contact">${contactLine()}</p>
      ${cvui.order.filter((k) => !(cvui.hidden || []).includes(k)).map((k) => (SECTIONS[k] ? SECTIONS[k]().replace("<h2>", `<h2 data-sec="${k}">`) : "")).join("\n")}`;
  }

  function renderLetter(result, input) {
    const L = result.coverLetter || {};
    const code = (result.job?.languageCode || (input.lang === "German" ? "de" : "en")).toLowerCase();
    const date = new Intl.DateTimeFormat(code.startsWith("de") ? "de-DE" : "en-GB", { dateStyle: "long" }).format(new Date());
    const company = input.company || result.job?.company || "";
    return `
      <div class="l-head"><h1>${esc(me.name)}</h1><p>${contactLine()}</p></div>
      <p class="l-meta">${[input.contact, company].filter(Boolean).map(esc).join("<br>")}${company || input.contact ? "<br><br>" : ""}${esc(date)}</p>
      ${L.subject ? `<p><b>${esc(L.subject)}</b></p>` : ""}
      <p>${esc(L.greeting || "")}</p>
      ${(L.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join("")}
      <p>${esc(L.closing || "")}<br>${esc(me.name)}</p>`;
  }

  /* ================= export ================= */
  function fileBase(kind) {
    const j = current?.result?.job || {};
    const slug = (s) => String(s || "").normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
    return [slug(me.name), kind, slug(j.company || current?.input?.company)].filter(Boolean).join("_");
  }

  // Walk the (possibly hand-edited) paper DOM into simple blocks so every export matches what you see.
  function toBlocks(root) {
    const blocks = [];
    const runs = (el) => {
      const out = [];
      el.childNodes.forEach((c) => {
        if (c.nodeType === 3) { if (c.textContent) out.push({ text: c.textContent }); }
        else if (c.nodeName === "BR") out.push({ text: "\n" });
        else if (/^(B|STRONG)$/.test(c.nodeName)) runs(c).forEach((r) => out.push({ ...r, bold: true }));
        else if (/^(I|EM)$/.test(c.nodeName)) runs(c).forEach((r) => out.push({ ...r, italic: true }));
        else if (c.nodeName === "A" && c.getAttribute("href")) runs(c).forEach((r) => out.push({ ...r, href: c.getAttribute("href") }));
        else out.push(...runs(c));
      });
      return out;
    };
    const walk = (el) => {
      for (const c of el.children) {
        if (c.nodeName === "H1") blocks.push({ kind: "title", runs: runs(c) });
        else if (c.nodeName === "H2") blocks.push({ kind: "heading", runs: runs(c) });
        else if (c.nodeName === "UL") [...c.children].forEach((li) => blocks.push({ kind: "bullet", runs: runs(li) }));
        else if (c.classList.contains("p-row")) blocks.push({ kind: "row", left: c.children[0]?.innerText || "", right: c.children[1]?.innerText || "" });
        else if (c.nodeName === "P" || c.classList.contains("p-sub")) blocks.push({ kind: c.classList.contains("p-sub") ? "sub" : c.classList.contains("p-headline") ? "lead" : c.classList.contains("p-contact") ? "contact" : "para", runs: runs(c) });
        else if (c.children.length) walk(c);
        else if (c.textContent.trim()) blocks.push({ kind: "para", runs: runs(c) });
      }
    };
    walk(root);
    return blocks;
  }

  function toMarkdown(root) {
    const md = (rs) => rs.map((r) => (r.href ? `[${r.text}](${r.href})` : r.bold ? `**${r.text.trim()}** ` : r.italic ? `*${r.text}*` : r.text)).join("").replace(/\n/g, "  \n").trim();
    return toBlocks(root).map((b) => {
      switch (b.kind) {
        case "title": return `# ${md(b.runs)}`;
        case "heading": return `\n## ${md(b.runs)}`;
        case "bullet": return `- ${md(b.runs)}`;
        case "row": return `\n**${b.left.trim()}**${b.right.trim() ? `  \n${b.right.trim()}` : ""}`;
        case "sub": return `*${md(b.runs)}*`;
        default: return `${md(b.runs)}\n`;
      }
    }).join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  let docxLoading;
  function loadDocx() {
    if (window.docx) return Promise.resolve(window.docx);
    return (docxLoading ||= new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = window.GR_V?.["lib/docx.js"] ? `lib/docx.js?v=${window.GR_V["lib/docx.js"]}` : "lib/docx.js";
      s.onload = () => res(window.docx); s.onerror = () => rej(new Error("Couldn't load the Word exporter."));
      document.head.appendChild(s);
    }));
  }
  async function toDocx(root, isLetter) {
    const d = await loadDocx();
    const cvui = CVUI(), layout = cvui.layout;
    const accent = (cvui.accent || CV_ACCENT[layout]).replace("#", "").toUpperCase();
    const compact = layout === "compact", modern = layout === "modern";
    const { Document, Packer, Paragraph, TextRun, TabStopType, BorderStyle, LevelFormat, AlignmentType, ExternalHyperlink } = d;
    const font = isLetter ? "Georgia" : "Calibri";
    const textWidth = 11906 - 2 * 1080;
    const mk = (rs, extra = {}) => rs.flatMap((r) => {
      const t = r.text.split("\n").map((t, i) => new TextRun({ text: t, bold: r.bold, italics: r.italic, break: i ? 1 : 0, ...extra, ...(r.href ? { underline: {} } : {}) }));
      return r.href && ExternalHyperlink ? [new ExternalHyperlink({ link: r.href, children: t })] : t;
    });
    const children = toBlocks(root).map((b) => {
      switch (b.kind) {
        case "title": return new Paragraph({ children: mk(b.runs, { bold: true, size: isLetter ? (compact ? 30 : 32) : compact ? 34 : modern ? 44 : 40, font, ...(modern ? { color: accent } : {}) }), spacing: { after: 40 } });
        case "lead": return new Paragraph({ children: mk(b.runs, { size: compact ? 20 : 22, ...(modern ? { color: accent } : {}) }), spacing: { after: 40 } });
        case "contact": return new Paragraph({ children: mk(b.runs, { size: 18, color: "444444" }), spacing: { after: 160 } });
        case "heading": return modern
          ? new Paragraph({ keepNext: true, children: mk(b.runs, { bold: true, size: 17, color: accent, allCaps: true, characterSpacing: 40 }), spacing: { before: 240, after: 80 } })
          : new Paragraph({ keepNext: true, children: mk(b.runs, { bold: true, size: compact ? 19 : 20, color: accent }), spacing: { before: compact ? 140 : 220, after: compact ? 50 : 80 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "BFC6CF", space: 2 } } });
        case "row": return new Paragraph({ keepNext: true, keepLines: true, tabStops: [{ type: TabStopType.RIGHT, position: textWidth }], spacing: { before: compact ? 60 : 100, after: 20 },
          children: [new TextRun({ text: b.left.trim(), bold: true }), new TextRun({ text: b.right.trim() ? `\t${b.right.trim()}` : "", color: "444444", size: 19 })] });
        case "sub": return new Paragraph({ keepNext: true, children: mk(b.runs, { color: "444444", size: 19 }), spacing: { after: 20 } });
        case "bullet": return new Paragraph({ children: mk(b.runs), numbering: { reference: "bul", level: 0 }, spacing: { after: compact ? 10 : 30 } });
        default: return new Paragraph({ children: mk(b.runs), spacing: { after: isLetter ? 200 : 60 } });
      }
    });
    const doc = new Document({
      creator: me.name, title: fileBase(isLetter ? "Cover-letter" : "CV"),
      styles: { default: { document: { run: { font, size: isLetter ? (compact ? 21 : 22) : compact ? 19 : 20 } } } },
      numbering: { config: [{ reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 300, hanging: 200 } } } }] }] },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: compact ? { top: 760, bottom: 760, left: 900, right: 900 } : { top: 1000, bottom: 1000, left: 1080, right: 1080 } } }, children }]
    });
    return Packer.toBlob(doc);
  }

  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const fontLink = () => { const f = window.GRUI?.FONTS[window.GRUI.ui.fonts]; return f?.href ? `<link href="${esc(f.href)}" rel="stylesheet">` : ""; };
  function standaloneHtml(root, title) {
    const cssText = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules].map((r) => r.cssText); } catch { return []; } })
      // the page's own rules only: the site's print and narrow-screen rules would change its margins on paper
      .filter((t) => /\.paper|:root/.test(t) && !/^@media/.test(t)).join("\n");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
${fontLink()}
<style>${cssText}\n:root{--sans:${css("--sans")};--serif:${css("--serif")}}\n*{box-sizing:border-box}body{margin:0;background:#fff}.paper{margin:0 auto}
@page{size:A4;margin:15mm 0}@page compact{size:A4;margin:11mm 0}
@media print{.paper{width:auto;min-height:0;margin:0;padding-top:0!important;padding-bottom:0!important}.paper.cv-compact{page:compact}.print-hint{display:none}}
.print-hint{font:14px/1.45 system-ui,sans-serif;background:#FFF6D6;border-bottom:1px solid #E8D48A;padding:10px 16px;text-align:center}
@media screen{body{background:#DCE1E7}.paper{margin:20px auto;box-shadow:0 1px 4px rgba(0,0,0,.15)}}</style></head>
<body><div class="print-hint">This is a print-ready page, not the PDF yet. Press <b>Ctrl+P</b> (<b>⌘P</b> on a Mac), choose <b>Save as PDF</b> and paper size <b>A4</b>, with margins left at default.</div>${printCopy(root).outerHTML}<script>document.fonts.ready.then(()=>setTimeout(()=>print(),300))<\/script></body></html>`;
  }

  async function doPrint(root, title) {
    await ready;
    if (runtime.inArtifact) {
      // printing isn't allowed inside claude.ai, so hand over a print-ready page instead
      const ok = await G.saveFile(`${title}.html`, standaloneHtml(root, title), "text/html");
      if (ok) toast("Open the saved file; it opens the print dialog so you can save as PDF.", 5000);
      return;
    }
    const pr = $("#print-root");
    pr.innerHTML = ""; pr.appendChild(printCopy(root));
    const old = document.title; document.title = title;
    setTimeout(() => { window.print(); document.title = old; pr.innerHTML = ""; }, 60);
  }

  $$("[data-export]").forEach((b) => b.addEventListener("click", async () => {
    if (!current) return;
    const [doc, kind] = b.dataset.export.split("-");
    const root = doc === "cv" ? $("#cv-paper") : $("#cl-paper");
    const name = fileBase(doc === "cv" ? "CV" : "Cover-letter");
    try {
      if (kind === "pdf") return doPrint(root, name);
      if (kind === "md") return G.saveFile(`${name}.md`, toMarkdown(root), "text/markdown");
      if (kind === "copy") return G.copyText(root.innerText);
      if (kind === "docx") { b.disabled = true; const blob = await toDocx(root, doc === "cl"); await G.saveFile(`${name}.docx`, blob, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"); }
    } catch (e) { console.error(e); toast(e.message || "Export failed."); }
    finally { b.disabled = false; }
  }));

  // test hook: lets the test suite render a result without calling a model
  window.GR.studio = { renderResult: (x) => { x.result.warnings = groundingCheck(x.result); current = x; renderResult(x); }, buildPrompt, groundingCheck, toMarkdown, toBlocks, standaloneHtml, markPages,
    // for customize.js
    renderCv, renderLetter, styleCv, getCurrent: () => current, ghGet, ghPut, connected, enterStudio };
})();

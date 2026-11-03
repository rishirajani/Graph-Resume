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

  async function enterStudio() {
    await ready;
    ["#gate", "#settings", "#workspace", "#visibility", "#links"].forEach((s) => ($(s).hidden = true));
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
  $("#studio-settings-btn").addEventListener("click", () => { $("#visibility").hidden = true; $("#links").hidden = true; openSettings(); });

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

  /* ---------------- company links ---------------- */
  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
  const b64u = (u) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const linkCode = () => { const A = "abcdefghijkmnpqrstuvwxyz23456789"; return [...rand(6)].map((x) => A[x % A.length]).join(""); };
  const siteBase = () => (G.R.site?.baseIri || location.href.split("#")[0]).replace(/[?#].*$/, "");
  const linkUrl = (l) => `${siteBase()}#for/${l.id}.${l.key}`;
  const plusMonths = (m) => { const d = new Date(); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10); };
  const LINK_TYPES = ["Role", "Break", "Education", "Project", "Certification", "Award", "Publication", "Language"];
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

  function renderLinkTab() {
    const el = $("#tab-link");
    if (!current) { el.innerHTML = ""; return; }
    if (!connected()) {
      el.innerHTML = `<p class="note">To make company links, connect this browser to your private master first: <b>Model settings → Private master on GitHub</b>.</p>`; return;
    }
    if (current.link?.url) {
      el.innerHTML = `<div class="link-form">
        <p>Link for <b>${esc(current.link.company || "this job")}</b>, code <code>${esc(current.link.id)}</code>, works until ${esc(current.link.expires || "you switch it off")}.</p>
        <div class="link-out"><input id="link-url" readonly value="${esc(current.link.url)}"><button class="btn ink small" id="link-copy" type="button">Copy</button></div>
        <label class="check" style="margin-top:12px"><input type="checkbox" id="link-in-cv" ${current.link.inCv ? "checked" : ""}> Add it to this CV as "Interactive version" (next to your email and LinkedIn)</label>
        <p class="help">It goes live a minute or two after you made it. Manage, extend or switch it off under <b>Company links</b>.</p></div>`;
      $("#link-copy").addEventListener("click", () => G.copyText(current.link.url).then(() => toast("Link copied")));
      $("#link-in-cv").addEventListener("change", (e) => { current.link.inCv = e.target.checked; updateHistoryItem(); $("#cv-paper").innerHTML = renderCv(current.result); if (current.result.coverLetter) $("#cl-paper").innerHTML = renderLetter(current.result, current.input); });
      return;
    }
    const reqs = current.result.fit?.requirements || [];
    const evidence = new Set(reqs.filter((r) => r.strength !== "gap").flatMap((r) => r.evidence || []));
    const items = allNodes.filter((n) => LINK_TYPES.includes(n.type));
    const pub = publicIds();
    const shownItems = items.filter((n) => pub.has(n.id)), hiddenItems = items.filter((n) => !pub.has(n.id) && n.type !== "Person");
    const row = (n, name, checked) => `<label class="vis-row"><input type="checkbox" name="${name}" value="${esc(n.id)}" ${checked ? "checked" : ""}><span><span class="vis-label">${esc(n.label)}</span> <span class="vis-meta">${esc([G.dateRange(n), byId.get(n.org || n.school)?.short || byId.get(n.org || n.school)?.label].filter(Boolean).join(" · "))}</span></span></label>`;
    const skillCount = [...evidence].filter((id) => byId.get(id)?.type === "Skill").length;
    el.innerHTML = `<div class="link-form">
      <p class="help" style="margin-top:0">A short link that opens your graph for this job: their company and the role at the top, your note, and the most relevant parts highlighted. Only people with the link can open it.</p>
      <div class="field two">
        <div><label for="link-company">Company</label><input id="link-company" type="text" maxlength="80" value="${esc(current.input.company || current.result.job?.company || "")}"></div>
        <div><label for="link-role">Role</label><input id="link-role" type="text" maxlength="100" value="${esc(current.result.job?.title || "")}"></div>
      </div>
      <div class="field"><label for="link-note">A short note to them <span class="opt">optional</span></label>
        <textarea id="link-note" rows="3" maxlength="500" placeholder="e.g. why this team, or what you'd like them to look at first"></textarea></div>
      <div class="field"><label>Highlight</label>
        <p class="help" style="margin-top:0">Ticked from the fit analysis${skillCount ? `, plus ${skillCount} matching skill${skillCount === 1 ? "" : "s"}` : ""}. Change as you like.</p>
        ${shownItems.map((n) => row(n, "focus", evidence.has(n.id))).join("")}</div>
      ${hiddenItems.length ? `<details><summary>Also show items hidden from visitors (${hiddenItems.length})</summary>${hiddenItems.map((n) => row(n, "add", false)).join("")}</details>` : ""}
      <details><summary>Leave things out of this link</summary>${shownItems.map((n) => row(n, "omit", false)).join("")}</details>
      <div class="field two" style="margin-top:16px">
        <div><label for="link-expires">Works until</label><input id="link-expires" type="date" value="${plusMonths(6)}" min="${new Date().toISOString().slice(0, 10)}"></div>
        <div style="align-self:end"><button class="btn ink wide" id="link-create" type="button">Create link</button></div>
      </div>
      <p class="help" id="link-status" role="status"></p></div>`;
    $("#link-create").addEventListener("click", () => createLink(evidence));
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

  async function createLink(evidence) {
    const st = (t) => ($("#link-status").textContent = t);
    const val = (sel) => $$(`#tab-link input[name="${sel}"]:checked`).map((b) => b.value);
    const company = $("#link-company").value.trim(), role = $("#link-role").value.trim(), note = $("#link-note").value.trim();
    const expires = $("#link-expires").value;
    if (!expires) { st("Pick an end date. You can extend it or switch it off later."); return; }
    const omit = val("omit"), addIds = val("add");
    const skills = [...evidence].filter((id) => byId.get(id)?.type === "Skill");
    const focus = [...new Set([...val("focus").filter((id) => !omit.includes(id)), ...addIds, ...skills])];
    $("#link-create").disabled = true; st("Creating the link…");
    try {
      const id = linkCode(), keyBytes = rand(16), iv = rand(12);
      const payload = { v: 1, company, role, note, focus, omit, add: withDependencies(addIds), created: new Date().toISOString().slice(0, 10) };
      const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(payload))));
      await ghPut(`links/${id}.json`, JSON.stringify({ v: 1, iv: b64u(iv), ct: b64u(ct) }) + "\n", null, `Company link ${id}`);
      const reg = await readRegistry();
      const entry = { id, key: b64u(keyBytes), company, role, created: payload.created, expires, off: false };
      reg.data.links.push(entry);
      await ghPut("links.json", JSON.stringify(reg.data, null, 2) + "\n", reg.sha, `Company link ${id}: ${company || "no company"}`);
      current.link = { id, url: linkUrl(entry), company, expires, inCv: false };
      updateHistoryItem();
      renderLinkTab();
      toast("Link created");
    } catch (e) { st(e.message); $("#link-create").disabled = false; }
  }

  async function openLinks() {
    ["#gate", "#settings", "#workspace", "#visibility"].forEach((x) => ($(x).hidden = true));
    $("#links").hidden = false;
    const body = $("#links-body"), st = (t) => ($("#links-status").textContent = t);
    if (!connected()) { body.innerHTML = `<p class="note">Connect this browser to your private master first: <b>Model settings → Private master on GitHub</b>.</p>`; return; }
    body.innerHTML = `<p class="help">Loading…</p>`; st("");
    let reg;
    try { reg = await readRegistry(); } catch (e) { body.innerHTML = ""; st(e.message); return; }
    const today = new Date().toISOString().slice(0, 10);
    const links = reg.data.links.slice().reverse();
    if (!links.length) { body.innerHTML = `<p class="help">No links yet. Make one from a job's result, in the <b>Company link</b> tab.</p>`; return; }
    const state = (l) => (l.off ? "Switched off" : l.expires && l.expires < today ? "Ended" : "Active");
    body.innerHTML = `<table class="links-table"><thead><tr><th>Company and role</th><th>Code</th><th>Made</th><th>Works until</th><th>State</th><th></th></tr></thead><tbody>${
      links.map((l) => `<tr data-id="${esc(l.id)}" class="${state(l) === "Active" ? "" : "state-off"}">
        <td><b>${esc(l.company || "—")}</b><br>${esc(l.role || "")}</td><td><code>${esc(l.id)}</code></td><td>${esc(l.created || "")}</td>
        <td><input type="date" value="${esc(l.expires || "")}" aria-label="Works until"></td><td>${state(l)}</td>
        <td><button class="btn ghost small" data-act="copy" type="button">Copy link</button>
          <button class="btn ghost small" data-act="toggle" type="button">${l.off ? "Switch on" : "Switch off"}</button></td></tr>`).join("")
    }</tbody></table>`;
    const save = async (mutate, msg) => {
      st("Saving…");
      try { const r = await readRegistry(); mutate(r.data.links); await ghPut("links.json", JSON.stringify(r.data, null, 2) + "\n", r.sha, msg); st("Saved. Your site updates in a minute or two."); openLinks(); }
      catch (e) { st(e.message); }
    };
    $$("#links-body tr[data-id]").forEach((tr) => {
      const id = tr.dataset.id, l = reg.data.links.find((x) => x.id === id);
      tr.querySelector('[data-act="copy"]').addEventListener("click", () => G.copyText(linkUrl(l)).then(() => toast("Link copied")));
      tr.querySelector('[data-act="toggle"]').addEventListener("click", () => save((ls) => { const x = ls.find((y) => y.id === id); x.off = !x.off; }, `Company link ${id}: switched ${l.off ? "on" : "off"}`));
      tr.querySelector('input[type="date"]').addEventListener("change", (e) => save((ls) => { ls.find((y) => y.id === id).expires = e.target.value; }, `Company link ${id}: works until ${e.target.value}`));
    });
  }
  $("#studio-links-btn").addEventListener("click", openLinks);
  $("#links-back").addEventListener("click", () => { $("#links").hidden = true; enterStudio(); });

  /* ---------------- what visitors see ---------------- */
  const VIS_GROUPS = [
    ["Experience", ["Role", "Break"]], ["Education", ["Education"]], ["Projects", ["Project"]],
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
    ["#gate", "#settings", "#workspace", "#links"].forEach((x) => ($(x).hidden = true));
    $("#visibility").hidden = false;
    const O = window.GR_OWNER || {};
    if (!G.ownerView || !O.configured) {
      $("#vis-body").innerHTML = `<p class="note">Connect this browser to your private master first: <b>Model settings → Private master on GitHub</b>. Changes are saved there and published from there.</p>`;
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
    LS.set("private", { phone: $("#priv-phone").value.trim(), notes: $("#priv-notes").value });
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
    const system = `You write CVs and cover letters for one specific job, using ONLY the candidate's knowledge graph (JSON below).

Hard rules
1. Never invent employers, job titles, dates, degrees, tools, numbers, metrics or achievements. Every claim must be traceable to graph nodes. If a number is not in the graph, do not write it.
2. You may select, reorder, merge, shorten and rephrase graph facts, and you may use the job's vocabulary when it truthfully describes a graph fact.
3. When the job asks for something the graph does not support, record it as a "gap" in fit. Do not imply that experience in the CV. In the cover letter you may show genuine interest in learning it, never claim it.
4. Refer to roles, projects, education, skills and languages by their exact node "id". The app fills in titles, organisations and dates from the graph, so do not repeat them in bullets.
5. Bullets start with a strong past-tense verb (present tense for current work), are concrete, at most 28 words. ${limits}
6. Order experience and projects by relevance to this job, most relevant first. Leave out nodes that do not help this application, with one exception: always include current roles (no end date), even unrelated ones, with at least one short bullet, so the timeline has no apparent gap. Likewise include a "Break" node in experience (using its id, with its summary condensed into one bullet) whenever omitting it would leave an unexplained gap of six months or more between the roles you list.
7. The cover letter is 230 to 340 words, 3 or 4 paragraphs, specific to this company and role. No clichés such as "I am writing to express my interest". Do not include the address block, date or signature; the app adds them.
8. Write everything in ${lang}. Return section titles in that language too.
9. Respond with one JSON object only, no markdown, matching this shape:
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
    "education": [ { "id": "education-node-id", "note": "optional one line, e.g. thesis relevant to this job" } ],
    "skills": [ { "group": "group name", "ids": ["skill-node-id"] } ],
    "languages": ["language-node-id"],
    "awards": ["award-node-id"],
    "certifications": ["certification-node-id"],
    "sectionTitles": { "profile": "", "experience": "", "projects": "", "education": "", "skills": "", "languages": "", "awards": "", "certifications": "" }
  },
  "coverLetter": { "subject": "", "greeting": "", "paragraphs": [""], "closing": "" }
}
List 6 to 12 requirements in fit, covering the job's must-haves first.${input.wantLetter ? "" : ' Set "coverLetter" to null.'}`;

    const user = `CANDIDATE KNOWLEDGE GRAPH
${JSON.stringify(factsForModel())}

JOB DESCRIPTION
${input.jd}

${input.company ? `Company: ${input.company}\n` : ""}${input.contact ? `Hiring contact: ${input.contact}\n` : ""}${input.notes ? `Candidate's note on emphasis: ${input.notes}\n` : ""}CV length: ${pages} page${pages > 1 ? "s" : ""}.`;
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
      ...(cv.education || []).map((x) => x.note), ...(result.coverLetter?.paragraphs || []), result.coverLetter?.subject].filter(Boolean);
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

    // drafts used
    const used = new Set([...(cv.experience || []), ...(cv.projects || []), ...(cv.education || [])].map((x) => x.id));
    (cv.languages || []).forEach((id) => used.add(id));
    const drafts = [...used].map((id) => byId.get(id)).filter((n) => n?.draft);
    if (drafts.length) warnings.push(`Uses nodes still marked draft, so their details may be incomplete: ${drafts.map((n) => n.label + (n.org ? ` (${byId.get(n.org)?.label})` : "")).join(", ")}.`);
    // items you've hidden on the public site: fine on a CV, but worth knowing
    const hidden = [...used].map((id) => byId.get(id)).filter((n) => n?.private);
    if (hidden.length) warnings.push(`Includes items hidden from visitors on your site: ${hidden.map((n) => n.label).join(", ")}. Keep them if they help this application; a reader who opens your site won't find them there.`);
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
  const TITLES_EN = { profile: "Profile", experience: "Experience", projects: "Projects", education: "Education", skills: "Skills", languages: "Languages", awards: "Awards", certifications: "Certifications" };
  function chipFor(id) {
    const n = byId.get(id); if (!n) return "";
    const org = n.type === "Role" ? byId.get(n.org)?.label : "";
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

    $("#cv-paper").innerHTML = renderCv(result);
    const letter = result.coverLetter;
    $("#tab-letter").hidden = true;
    $('[data-tab="letter"]').hidden = !letter;
    if (letter) $("#cl-paper").innerHTML = renderLetter(result, input);
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

  function contactLine() {
    const parts = [me.location, LS.get("private", {}).phone, me.email, ...(me.links || []).map((l) => l.url.replace(/^https?:\/\/(www\.)?/, ""))].filter(Boolean).map(esc);
    if (current?.link?.inCv && current.link.url) parts.push(`<a href="${esc(current.link.url)}">Interactive version</a>`);
    return parts.join("  |  ");
  }
  function renderCv(result) {
    const cv = result.cv || {};
    const T = Object.assign({}, TITLES_EN, cv.sectionTitles || {});
    const sec = (title, body) => (body ? `<h2>${esc(title)}</h2>${body}` : "");
    const row = (left, right) => `<div class="p-row"><span class="p-title">${left}</span><span class="p-dates">${esc(right || "")}</span></div>`;
    const bullets = (b) => ((b || []).length ? `<ul>${b.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");

    const exp = (cv.experience || []).map((x) => {
      const n = byId.get(x.id), org = byId.get(n.org);
      const sub = [n.location, n.employment].filter(Boolean).join(", ");
      return `<div class="p-item">${row(esc(n.label) + (org ? `, ${esc(org.label)}` : ""), G.dateRange(n))}${sub ? `<div class="p-sub">${esc(sub)}</div>` : ""}${bullets(x.bullets)}</div>`;
    }).join("");
    const proj = (cv.projects || []).map((x) => {
      const n = byId.get(x.id);
      return `<div class="p-item">${row(esc(n.label), G.dateRange(n) || n.status)}${bullets(x.bullets)}</div>`;
    }).join("");
    const edu = (cv.education || []).map((x) => {
      const n = byId.get(x.id); const s = byId.get(n.school);
      return `<div class="p-item">${row(esc(n.label), G.dateRange(n))}${s ? `<div class="p-sub">${esc(s.label)}</div>` : ""}${x.note ? `<p class="p-summary">${esc(x.note)}</p>` : ""}</div>`;
    }).join("");
    const skills = (cv.skills || []).map((g) => `<p><b>${esc(g.group)}:</b> ${g.ids.map((id) => esc(byId.get(id).label)).join(", ")}</p>`).join("");
    const awards = (cv.awards || []).map((id) => {
      const n = byId.get(id); const o = byId.get(n.org);
      return `<div class="p-item">${row(esc(n.label) + (o ? `, ${esc(o.label)}` : ""), G.fmtDate(n.date))}${n.summary ? `<p class="p-summary">${esc(n.summary)}</p>` : ""}</div>`;
    }).join("");
    const certs = (cv.certifications || []).map((id) => {
      const n = byId.get(id);
      return `<div class="p-item">${row(esc(n.label) + (n.issuer ? `, ${esc(n.issuer)}` : ""), G.fmtDate(n.date))}</div>`;
    }).join("");
    const langs = (cv.languages || []).map((id) => { const n = byId.get(id); return esc(n.label + (n.level ? ` (${n.level})` : "")); }).join(", ");

    return `
      <h1>${esc(me.name)}</h1>
      <p class="p-headline">${esc(cv.headline || me.headline || "")}</p>
      <p class="p-contact">${contactLine()}</p>
      ${sec(T.profile, cv.summary ? `<p class="p-summary">${esc(cv.summary)}</p>` : "")}
      ${sec(T.experience, exp)}
      ${sec(T.projects, proj)}
      ${sec(T.education, edu)}
      ${sec(T.skills, skills ? `<div class="p-skills">${skills}</div>` : "")}
      ${sec(T.awards, awards)}
      ${sec(T.certifications, certs)}
      ${sec(T.languages, langs ? `<p class="p-summary">${langs}</p>` : "")}`;
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
      const s = document.createElement("script"); s.src = "lib/docx.js";
      s.onload = () => res(window.docx); s.onerror = () => rej(new Error("Couldn't load the Word exporter."));
      document.head.appendChild(s);
    }));
  }
  async function toDocx(root, isLetter) {
    const d = await loadDocx();
    const { Document, Packer, Paragraph, TextRun, TabStopType, BorderStyle, LevelFormat, AlignmentType, ExternalHyperlink } = d;
    const font = isLetter ? "Georgia" : "Calibri";
    const textWidth = 11906 - 2 * 1080;
    const mk = (rs, extra = {}) => rs.flatMap((r) => {
      const t = r.text.split("\n").map((t, i) => new TextRun({ text: t, bold: r.bold, italics: r.italic, break: i ? 1 : 0, ...extra, ...(r.href ? { color: "1D4ED8", underline: {} } : {}) }));
      return r.href && ExternalHyperlink ? [new ExternalHyperlink({ link: r.href, children: t })] : t;
    });
    const children = toBlocks(root).map((b) => {
      switch (b.kind) {
        case "title": return new Paragraph({ children: mk(b.runs, { bold: true, size: isLetter ? 32 : 40, font }), spacing: { after: 40 } });
        case "lead": return new Paragraph({ children: mk(b.runs, { size: 22 }), spacing: { after: 40 } });
        case "contact": return new Paragraph({ children: mk(b.runs, { size: 18, color: "444444" }), spacing: { after: 160 } });
        case "heading": return new Paragraph({ children: mk(b.runs, { bold: true, size: 20, color: "1D2A40" }), spacing: { before: 220, after: 80 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "BFC6CF", space: 2 } } });
        case "row": return new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: textWidth }], spacing: { before: 100, after: 20 },
          children: [new TextRun({ text: b.left.trim(), bold: true }), new TextRun({ text: b.right.trim() ? `\t${b.right.trim()}` : "", color: "444444", size: 19 })] });
        case "sub": return new Paragraph({ children: mk(b.runs, { color: "444444", size: 19 }), spacing: { after: 20 } });
        case "bullet": return new Paragraph({ children: mk(b.runs), numbering: { reference: "bul", level: 0 }, spacing: { after: 30 } });
        default: return new Paragraph({ children: mk(b.runs), spacing: { after: isLetter ? 200 : 60 } });
      }
    });
    const doc = new Document({
      creator: me.name, title: fileBase(isLetter ? "Cover-letter" : "CV"),
      styles: { default: { document: { run: { font, size: isLetter ? 22 : 20 } } } },
      numbering: { config: [{ reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 300, hanging: 200 } } } }] }] },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 1080, right: 1080 } } }, children }]
    });
    return Packer.toBlob(doc);
  }

  function standaloneHtml(root, title) {
    const cssText = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules].map((r) => r.cssText); } catch { return []; } })
      .filter((t) => /\.paper|:root|@page/.test(t)).join("\n");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400..800&family=Newsreader:opsz,wght@6..72,300..600&display=swap" rel="stylesheet">
<style>${cssText}\nbody{margin:0;background:#fff}.paper{margin:0 auto}@media print{@page{size:A4;margin:0}}</style></head>
<body>${root.outerHTML.replace(/contenteditable="true"/g, "")}<script>document.fonts.ready.then(()=>setTimeout(()=>print(),300))<\/script></body></html>`;
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
    pr.innerHTML = ""; const clone = root.cloneNode(true); clone.removeAttribute("contenteditable"); pr.appendChild(clone);
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
  window.GR.studio = { renderResult: (x) => { x.result.warnings = groundingCheck(x.result); current = x; renderResult(x); }, buildPrompt, groundingCheck, toMarkdown, toBlocks };
})();

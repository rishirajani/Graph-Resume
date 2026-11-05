/* Graph resume: the studio's Customize panel.
   Edits `site.ui` (see ui.js) with a live preview: the site in a frame of itself
   (?uipreview), and a CV and letter built from your graph. Saves to the private
   master when this browser is connected; otherwise gives you the settings to paste
   into resume.js. */
(function () {
  "use strict";
  const G = window.GR, U = window.GRUI;
  if (!G || !U || !G.studio) return;
  const { $, $$, esc, toast, publicNodes, byId, me } = G;
  const S = G.studio;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  let draft = null, czTab = "site";

  const LOOK_KEYS = ["theme", "fonts", "colors", "labelSize"];       // apply live in the preview
  const COLOR_LABELS = { role: "Experience", org: "Organisations", edu: "Education", project: "Projects", skill: "Skills", other: "More", highlight: "Highlight" };
  const SECTION_LABELS = { profile: "Profile", experience: "Experience", projects: "Projects", education: "Education", skills: "Skills", awards: "Awards", certifications: "Certifications", languages: "Languages" };
  const GROUPS = [["exp", "Experience"], ["edu", "Education"], ["proj", "Projects"], ["other", "More (languages, certificates, awards)"]];

  /* ---------------- preview ---------------- */
  function postPreview(reload) {
    try { sessionStorage.setItem("gr.uiPreview", JSON.stringify(draft)); } catch {}
    const f = $("#cz-frame");
    if (!f.src) { f.src = location.pathname + "?uipreview=1"; return; }
    try { f.contentWindow.postMessage({ type: "gr-ui", ui: draft, reload }, location.origin); } catch { f.src = f.src; }
  }

  // a CV from the graph itself, so the layout can be judged before any job is analysed
  function sampleResult() {
    const pub = publicNodes.filter((n) => n.id !== "me");
    const newest = (a, b) => String(b.end || "9999").localeCompare(String(a.end || "9999")) || String(b.start || "").localeCompare(String(a.start || ""));
    const pick = (type, k) => pub.filter((n) => n.type === type).sort(newest).slice(0, k);
    const groups = pub.filter((n) => n.type === "SkillGroup").slice(0, 4).map((g) => ({ group: g.label, ids: pub.filter((s) => s.type === "Skill" && s.group === g.id).slice(0, 6).map((s) => s.id) })).filter((g) => g.ids.length);
    return {
      job: { languageCode: "en" },
      cv: {
        headline: me.headline, summary: me.summary,
        experience: pick("Role", 3).map((n) => ({ id: n.id, bullets: (n.highlights || []).slice(0, 2) })),
        projects: pick("Project", 2).map((n) => ({ id: n.id, bullets: (n.highlights || []).slice(0, 1) })),
        education: pick("Education", 2).map((n) => ({ id: n.id })),
        skills: groups,
        certifications: pick("Certification", 2).map((n) => n.id),
        awards: pick("Award", 1).map((n) => n.id),
        languages: pub.filter((n) => n.type === "Language").map((n) => n.id)
      },
      coverLetter: {
        subject: "Application: (the role)", greeting: "Dear hiring team,",
        paragraphs: ["This is a preview of the letter layout. Each real cover letter is written from your graph for one specific job, in three or four short paragraphs.",
          "The name, contact line, date and closing are added by the site; the accent colour and layout follow your CV settings."],
        closing: "Kind regards,"
      }
    };
  }
  function renderPapers() {
    const cur = S.getCurrent();
    const res = cur?.result || sampleResult();
    $("#cz-cv-note").textContent = cur ? "Your latest CV, in the chosen style." : "A sample CV from your graph (not tailored to a job), in the chosen style.";
    const cv = $("#cz-cv-paper"), le = $("#cz-letter-paper");
    cv.innerHTML = S.renderCv(res, draft.cv); S.styleCv(cv, draft.cv);
    // the papers use the chosen font pair, even before it's saved
    const font = U.FONTS[draft.fonts];
    if (font.href) {
      let l = document.getElementById("gr-fonts-preview");
      if (!l) { l = document.createElement("link"); l.id = "gr-fonts-preview"; l.rel = "stylesheet"; document.head.appendChild(l); }
      if (l.href !== font.href) l.href = font.href;
    }
    const letterRes = cur?.result?.coverLetter ? cur.result : sampleResult();
    le.innerHTML = S.renderLetter(letterRes, cur?.input || {}); S.styleCv(le, draft.cv);
    [cv, le].forEach((p) => { p.style.setProperty("--sans", font.sans); p.style.setProperty("--serif", font.serif); });
    // fit the A4 page into the preview column
    requestAnimationFrame(() => {
      const w = $("#cz-cv").clientWidth || 800, z = Math.min(1, (w - 40) / 800);
      [cv, le].forEach((p) => (p.style.zoom = String(z)));
    });
  }
  // desktop previews at 1280×800, phone at 390×844, scaled down to the column
  let device = "desktop";
  function fitFrame() {
    const wrap = $("#cz-site"), f = $("#cz-frame");
    if (!wrap || wrap.hidden) return;
    const [w, h] = device === "phone" ? [390, 844] : [1280, 800];
    const avail = wrap.parentElement.clientWidth;
    const maxH = Math.min(window.innerHeight * 0.78, 820);
    const z = device === "phone" ? Math.min(1, maxH / h) : Math.min(1, avail / w);
    f.style.width = w + "px"; f.style.height = h + "px"; f.style.transform = `scale(${z})`;
    wrap.classList.toggle("phone", device === "phone");
    wrap.style.height = Math.round(h * z + (device === "phone" ? 20 : 0)) + "px";
    f.style.left = device === "phone" ? `${Math.max(0, (avail - w * z) / 2)}px` : "0"; f.style.top = device === "phone" ? "10px" : "0";
  }
  window.addEventListener("resize", fitFrame);
  $$("#customize [data-device]").forEach((b) => b.addEventListener("click", () => {
    device = b.dataset.device;
    $$("#customize [data-device]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    if (czTab !== "site") showTab("site");
    fitFrame();
  }));

  function showTab(t) {
    czTab = t;
    $$('#customize [data-cz]').forEach((b) => b.setAttribute("aria-selected", String(b.dataset.cz === t)));
    $("#cz-site").hidden = t !== "site"; $("#cz-cv").hidden = t !== "cv"; $("#cz-letter").hidden = t !== "letter";
    $(".cz-device").hidden = t !== "site";
    if (t !== "site") renderPapers(); else fitFrame();
  }

  /* ---------------- controls ---------------- */
  const radios = (name, opts, value) => `<div class="cz-opts">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${esc(v)}" ${v === value ? "checked" : ""}>${esc(l)}</label>`).join("")}</div>`;
  const field = (label, html, help = "") => `<div class="cz-field"><span class="cz-label">${esc(label)}</span>${html}${help ? `<p class="help" style="margin:4px 0 0">${help}</p>` : ""}</div>`;
  const themeVar = (v) => U.THEMES[U.resolveTheme(draft.theme)].vars[v];

  function render() {
    const T = U.THEMES;
    const themeCards = [...Object.entries(T), ["auto", { label: "Auto (Ink by day, Slate by night)", vars: null }]].map(([k, t]) => {
      const v = t.vars || T.ink.vars, v2 = T.slate.vars;
      const sw = t.vars ? [v["--paper"], v["--c-role"], v["--c-edu"], v["--c-project"], v["--c-skill"]] : [v["--paper"], v["--c-role"], v2["--paper"], v2["--c-role"], v2["--c-skill"]];
      return `<label><input type="radio" name="theme" value="${k}" ${draft.theme === k ? "checked" : ""}><span class="cz-swatch">${sw.map((c) => `<span style="background:${c}"></span>`).join("")}</span>${esc(t.label)}</label>`;
    }).join("");
    const colorInputs = Object.entries(COLOR_LABELS).map(([k, l]) => {
      const val = draft.colors[k] || themeVar(U.COLOR_VARS[k]);
      return `<label><input type="color" data-color="${k}" value="${esc(val)}">${esc(l)}${draft.colors[k] ? " *" : ""}</label>`;
    }).join("");
    const hasCounter = !!String(G.R.site?.goatcounter || "").trim();
    const feat = (k, label, note = "") => `<label class="cz-check"><input type="checkbox" data-feature="${k}" ${draft.features[k] ? "checked" : ""}><span>${esc(label)}${note ? `<small>${note}</small>` : ""}</span></label>`;
    const order = draft.cv.order.map((s, i) => `<li data-sec="${s}">
        <button type="button" data-move="-1" aria-label="Move ${esc(SECTION_LABELS[s])} up" ${i === 0 ? "disabled" : ""}>↑</button>
        <button type="button" data-move="1" aria-label="Move ${esc(SECTION_LABELS[s])} down" ${i === draft.cv.order.length - 1 ? "disabled" : ""}>↓</button>
        <input type="text" data-title="${s}" value="${esc(draft.cv.titles[s] || "")}" placeholder="${esc(SECTION_LABELS[s])}" aria-label="Title for ${esc(SECTION_LABELS[s])}"></li>`).join("");

    $("#cz-body").innerHTML = `
      <details class="cz-group" open><summary>Look</summary>
        ${field("Theme", `<div class="cz-theme">${themeCards}</div>`)}
        ${field("Fonts", `<select data-key="fonts">${Object.entries(U.FONTS).map(([k, f]) => `<option value="${k}" ${draft.fonts === k ? "selected" : ""}>${esc(f.label)}</option>`).join("")}</select>`)}
        ${field("Colours", `<div class="cz-colors">${colorInputs}</div><p style="margin:8px 0 0"><button type="button" class="btn ghost small" id="cz-reset-colors" ${Object.keys(draft.colors).length ? "" : "disabled"}>Use the theme's colours</button></p>`,
          "Each colour stands for a kind of item, on the graph and in the legend. * = your own colour.")}
        ${field("Label size on the graph", radios("labelSize", [["small", "Small"], ["normal", "Normal"], ["large", "Large"]], draft.labelSize))}
      </details>
      <details class="cz-group"><summary>First impression</summary>
        ${field("Opens on", radios("startView", [["graph", "The graph"], ["text", "The text"]], draft.startView), draft.features.textView ? "" : "The text view is switched off under Features.")}
        ${field("Skills", radios("skills", [["folded", "Skill areas only"], ["shown", "Every skill"]], draft.skills), "Areas only keeps the first view calm; visitors can unfold skills with the Skills button.")}
        ${field("Shown at first", GROUPS.map(([k, l]) => `<label class="cz-check"><input type="checkbox" data-group="${k}" ${draft.startHidden.includes(k) ? "" : "checked"}><span>${esc(l)}</span></label>`).join(""),
          "Visitors can still switch these on in the legend.")}
      </details>
      <details class="cz-group"><summary>Features</summary>
        ${feat("search", "Search box")}
        ${feat("textView", "Read as text", "Also how people using screen readers read your resume; keep it on if you can.")}
        ${feat("download", "Download graph (JSON-LD and Turtle)")}
        ${feat("copyLink", "Copy link button")}
        ${feat("counting", "Visit counting", hasCounter ? "Uses your GoatCounter code." : "Needs a GoatCounter code in resume.js; none is set.")}
      </details>
      <details class="cz-group"><summary>CV and letter</summary>
        ${field("Layout", radios("cvLayout", [["classic", "Classic"], ["modern", "Modern"], ["compact", "Compact"]], draft.cv.layout),
          "Classic: ruled section headings. Modern: name and headings in your accent colour. Compact: tighter, fits more on one page.")}
        ${field("Accent colour", `<div class="cz-colors"><label><input type="color" id="cz-accent" value="${esc(draft.cv.accent || { classic: "#1D2A40", modern: "#2C46C7", compact: "#1D2A40" }[draft.cv.layout])}">Headings${draft.cv.accent ? " *" : ""}</label></div>
          <p style="margin:8px 0 0"><button type="button" class="btn ghost small" id="cz-accent-reset" ${draft.cv.accent ? "" : "disabled"}>Use the layout's colour</button></p>`)}
        ${field("Tailored link in the contact line", `<input type="text" id="cz-link-label" maxlength="30" value="${esc(draft.cv.linkLabel)}" placeholder="Portfolio">`,
          "The clickable text that stands for a tailored link on a CV, next to your email and LinkedIn.")}
        ${field("Sections: order and titles", `<ol class="cz-order">${order}</ol>`, "Leave a title empty to keep the standard one. Your titles are used on English CVs; CVs in other languages use translated titles.")}
      </details>`;
    wire();
  }

  function changed(key) {
    $("#cz-status").textContent = "";
    if (key === "cv") { renderPapers(); return; }
    postPreview(!LOOK_KEYS.includes(key));
    if (czTab !== "site") renderPapers();
  }

  function wire() {
    $$('#cz-body input[name="theme"]').forEach((r) => r.addEventListener("change", () => { draft.theme = r.value; render(); changed("theme"); }));
    $('#cz-body [data-key="fonts"]').addEventListener("change", (e) => { draft.fonts = e.target.value; changed("fonts"); renderPapers(); });
    $$("#cz-body [data-color]").forEach((c) => c.addEventListener("input", () => { draft.colors[c.dataset.color] = c.value; changed("colors"); }));
    $$("#cz-body [data-color]").forEach((c) => c.addEventListener("change", () => render()));
    $("#cz-reset-colors").addEventListener("click", () => { draft.colors = {}; render(); changed("colors"); });
    $$('#cz-body input[name="labelSize"]').forEach((r) => r.addEventListener("change", () => { draft.labelSize = r.value; changed("labelSize"); }));
    $$('#cz-body input[name="startView"]').forEach((r) => r.addEventListener("change", () => { draft.startView = r.value; changed("startView"); }));
    $$('#cz-body input[name="skills"]').forEach((r) => r.addEventListener("change", () => { draft.skills = r.value; changed("skills"); }));
    $$("#cz-body [data-group]").forEach((c) => c.addEventListener("change", () => {
      const k = c.dataset.group;
      draft.startHidden = c.checked ? draft.startHidden.filter((x) => x !== k) : [...draft.startHidden, k];
      changed("startHidden");
    }));
    $$("#cz-body [data-feature]").forEach((c) => c.addEventListener("change", () => {
      draft.features[c.dataset.feature] = c.checked;
      if (c.dataset.feature === "textView") render();
      changed("features");
    }));
    $$('#cz-body input[name="cvLayout"]').forEach((r) => r.addEventListener("change", () => { draft.cv.layout = r.value; render(); openGroup(3); changed("cv"); if (czTab === "site") showTab("cv"); }));
    $("#cz-accent").addEventListener("input", (e) => { draft.cv.accent = e.target.value; changed("cv"); if (czTab === "site") showTab("cv"); });
    $("#cz-accent").addEventListener("change", () => { render(); openGroup(3); });
    $("#cz-accent-reset").addEventListener("click", () => { draft.cv.accent = ""; render(); openGroup(3); changed("cv"); });
    $$("#cz-body [data-move]").forEach((b) => b.addEventListener("click", () => {
      const s = b.closest("li").dataset.sec, o = draft.cv.order, i = o.indexOf(s), j = i + Number(b.dataset.move);
      [o[i], o[j]] = [o[j], o[i]]; render(); openGroup(3); changed("cv");
      if (czTab === "site") showTab("cv");
      $(`#cz-body li[data-sec="${s}"] [data-move="${b.dataset.move}"]`)?.focus();
    }));
    $("#cz-link-label").addEventListener("input", (e) => { draft.cv.linkLabel = e.target.value.trim().slice(0, 30) || "Portfolio"; changed("cv"); });
    $$("#cz-body [data-title]").forEach((t) => t.addEventListener("input", () => {
      const v = t.value.trim();
      if (v) draft.cv.titles[t.dataset.title] = v.slice(0, 40); else delete draft.cv.titles[t.dataset.title];
      changed("cv"); if (czTab === "site") showTab("cv");
    }));
  }
  const openGroup = (i) => { const d = $$("#cz-body details.cz-group")[i]; if (d) d.open = true; };

  /* ---------------- saving ---------------- */
  // JS-aware scan: the index of the "}" that closes the "{" at `open` (skips strings and comments)
  function closeOf(text, open) {
    let depth = 0;
    for (let i = open; i < text.length; i++) {
      const c = text[i], n = text[i + 1];
      if (c === "/" && n === "/") { i = text.indexOf("\n", i); if (i < 0) return -1; continue; }
      if (c === "/" && n === "*") { i = text.indexOf("*/", i + 2) + 1; if (i <= 0) return -1; continue; }
      if (c === '"' || c === "'" || c === "`") { for (i++; i < text.length && text[i] !== c; i++) if (text[i] === "\\") i++; continue; }
      if (c === "{") depth++;
      else if (c === "}" && --depth === 0) return i;
    }
    return -1;
  }
  // write `ui: {…}` into the site object of resume.js, replacing any earlier one
  function setSiteUi(text, ui) {
    const m = /\bsite\s*:\s*\{/.exec(text);
    if (!m) throw new Error("Couldn't find `site: {` in resume.js.");
    const open = m.index + m[0].length - 1, close = closeOf(text, open);
    if (close < 0) throw new Error("Couldn't read the site settings in resume.js.");
    const body = JSON.stringify(ui, null, 2).replace(/\n/g, "\n    ");
    // look for an existing ui property directly inside site
    let depth = 0;
    for (let i = open + 1; i < close; i++) {
      const c = text[i], n = text[i + 1];
      if (c === "/" && n === "/") { i = text.indexOf("\n", i); continue; }
      if (c === "/" && n === "*") { i = text.indexOf("*/", i + 2) + 1; continue; }
      if (c === '"' || c === "'" || c === "`") { for (i++; i < close && text[i] !== c; i++) if (text[i] === "\\") i++; continue; }
      if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") depth--;
      else if (depth === 0 && /[A-Za-z_$]/.test(c) && !/[\w$]/.test(text[i - 1])) {
        const p = /^ui\s*:\s*\{/.exec(text.slice(i, i + 20));
        if (p) {
          const uo = i + p[0].length - 1, uc = closeOf(text, uo);
          if (uc < 0) throw new Error("Couldn't read the existing ui settings in resume.js.");
          return text.slice(0, i) + "ui: " + body + text.slice(uc + 1);
        }
      }
    }
    return text.slice(0, open + 1) + "\n    // look and behaviour; edit in the studio under Customize\n    ui: " + body + "," + text.slice(open + 1);
  }

  async function save() {
    const st = (t) => ($("#cz-status").textContent = t);
    $("#cz-save").disabled = true; st("Saving to your private repository…");
    try {
      const f = await S.ghGet("resume.js");
      if (!f) throw new Error("resume.js wasn't found in your private repository.");
      const text = setSiteUi(f.text, U.diff(draft));
      const w = {}; new Function("window", text)(w);
      if (JSON.stringify(U.merge(w.RESUME.site.ui)) !== JSON.stringify(U.merge(draft))) throw new Error("The saved settings came out differently, so nothing was saved.");
      await S.ghPut("resume.js", text, f.sha, "Customize: update the site's look and settings");
      try { localStorage.setItem("gr.masterCache", text); } catch {}
      st("Saved. Your public site updates in a minute or two. Reloading…");
      setTimeout(() => { location.hash = "studio"; location.reload(); }, 1200);
    } catch (e) { st(e.message); $("#cz-save").disabled = false; }
  }

  function copySettings() {
    const d = U.diff(draft);
    const snippet = Object.keys(d).length ? "ui: " + JSON.stringify(d, null, 2) + "," : "ui: {},";
    G.modal("Your settings", `<p class="help" style="margin-top:0">In <code>resume.js</code>, put this inside <code>site: { … }</code>, for example right after the line <code>site: {</code>. If there's already a <code>ui: …</code> there, replace it. Then commit; the site updates in a minute or two.</p>
      <textarea class="cz-snippet" readonly>${esc(snippet)}</textarea>
      <p style="margin:10px 0 0"><button class="btn ghost small" type="button" id="cz-copy-now">Copy</button></p>`);
    $("#cz-copy-now").addEventListener("click", () => G.copyText(snippet).then(() => toast("Settings copied")));
  }

  /* ---------------- open / close ---------------- */
  function open() {
    ["#gate", "#settings", "#workspace", "#visibility", "#links", "#apps", "#jobs"].forEach((x) => ($(x).hidden = true));
    $("#customize").hidden = false;
    draft = clone(U.ui);
    $("#cz-save").hidden = !S.connected();
    $("#cz-copy").textContent = S.connected() ? "Copy settings" : "Get the settings";
    render();
    postPreview(true);
    showTab("site");
  }
  $("#studio-customize-btn").addEventListener("click", open);
  $("#cz-back").addEventListener("click", () => { $("#customize").hidden = true; S.enterStudio(); });
  $("#cz-reset").addEventListener("click", () => { draft = U.merge({}); render(); postPreview(true); renderPapers(); $("#cz-status").textContent = "Back to the defaults (not saved yet)."; });
  $("#cz-copy").addEventListener("click", copySettings);
  $("#cz-save").addEventListener("click", save);
  $$('#customize [data-cz]').forEach((b) => b.addEventListener("click", () => showTab(b.dataset.cz)));

  // for tests
  G.customize = { setSiteUi, closeOf, getDraft: () => draft };
})();

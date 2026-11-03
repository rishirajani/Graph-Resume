/* Graph resume: public explorer (graph view, text view, sharing, graph export).
   Exposes window.GR for studio.js. No build step, no backend. */
(function () {
  "use strict";
  const R = window.RESUME;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  /* ---------------- vocabulary ---------------- */
  const TYPE = {
    Person:        { color: "--c-person",  size: 58 },
    Role:          { color: "--c-role",    size: 34, kind: "Role" },
    Organization:  { color: "--c-org",     size: 24, kind: "Organization" },
    Education:     { color: "--c-edu",     size: 34, kind: "Education" },
    School:        { color: "--c-edu",     size: 24, kind: "School" },
    Project:       { color: "--c-project", size: 32, kind: "Project" },
    Skill:         { color: "--c-skill",   size: 13, kind: "Skill" },
    SkillGroup:    { color: "--c-skill",   size: 24, kind: "Skill area" },
    Language:      { color: "--c-other",   size: 16, kind: "Language" },
    Certification: { color: "--c-other",   size: 20, kind: "Certification" },
    Award:         { color: "--c-other",   size: 20, kind: "Award" },
    Publication:   { color: "--c-other",   size: 20, kind: "Publication" },
    Break:         { color: "--c-org",     size: 22, kind: "Career break" }
  };
  // Legend filters group types the way a reader thinks about a CV.
  const FILTERS = [
    { key: "exp",   label: "Experience", types: ["Role", "Organization", "Break"], color: "--c-role" },
    { key: "edu",   label: "Education",  types: ["Education", "School"],  color: "--c-edu" },
    { key: "proj",  label: "Projects",   types: ["Project"],              color: "--c-project" },
    { key: "skill", label: "Skills",     types: ["Skill", "SkillGroup"],  color: "--c-skill" },
    { key: "other", label: "More",       types: ["Language", "Certification", "Award", "Publication"], color: "--c-other" }
  ];
  // predicate -> [forward phrase, inverse phrase]
  const { PRED, deriveEdges, isPlaceholder, clean, publicSubset, toJsonLd: coreJsonLd, toTurtle: coreTurtle } = window.GRCORE;

  /* ---------------- build the graph model ---------------- */
  const me = Object.assign({ type: "Person", label: R.person.name }, R.person);
  const allNodes = [me, ...R.nodes];
  const byId = new Map(allNodes.map((n) => [n.id, n]));


  const showDrafts = () => { try { return localStorage.getItem("gr.showDrafts") === "1"; } catch { return false; } };

  // What visitors get: no private nodes, and no organisations, schools or skills that only
  // private nodes used (the same rule tools/publish.mjs applies to the public file).
  const publicNodes = publicSubset(allNodes);
  const publicEdges = deriveEdges(publicNodes);
  const fullEdges = deriveEdges(allNodes);
  // On your own devices (private master loaded) the graph and text view also show hidden
  // items, marked as such. Downloads always use the public set.
  const owner = window.GR_OWNER || { source: "public" };
  const ownerView = owner.source === "master";
  const hiddenCount = allNodes.filter((n) => n.private).length;
  const shownNodes = ownerView ? allNodes : publicNodes;
  // tailored link (#for/<id>.<key>): loader.js has already prepared the data for it
  const forLink = window.GR_FOR || null;
  const forOK = forLink?.status === "ok";
  const forPrefix = forOK ? `for/${forLink.token}` : "";
  // all in-page navigation goes through here, so a tailored link keeps its context
  const go = (h) => { location.hash = forPrefix ? (h ? `${forPrefix}/${h}` : forPrefix) : h; };
  const currentHash = () => {
    let h = decodeURIComponent(location.hash.slice(1));
    if (forPrefix && h.startsWith(forPrefix)) h = h.slice(forPrefix.length).replace(/^\//, "");
    else if (/^for\//.test(h)) h = "";
    return h;
  };
  const shownEdges = ownerView ? fullEdges : publicEdges;

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(d) {
    if (!d) return "";
    const m = String(d).match(/^(\d{4})(?:-(\d{1,2}))?/);
    if (!m) return String(d);
    return m[2] ? `${MONTHS[+m[2] - 1]} ${m[1]}` : m[1];
  }
  function dateRange(n) {
    if (!n.start && !n.end) return "";
    return `${fmtDate(n.start) || "?"} – ${n.end ? fmtDate(n.end) : "present"}`;
  }
  // graph labels: `short` when given (full names stay in the panel, text view and CV)
  function displayLabel(n) {
    return n.short || n.label || n.name;
  }
  function meta(n) {
    const bits = [];
    if (n.org) { const o = byId.get(n.org); if (o) bits.push(o.label); }
    if (n.type === "Education") { const s = byId.get(n.school); if (s) bits.push(s.label); }
    if (n.type === "Skill" && n.group) bits.push(byId.get(n.group)?.label);
    const dr = dateRange(n); if (dr) bits.push(dr);
    if (n.employment) bits.push(n.employment);
    if (n.location) bits.push(n.location);
    if (n.status) bits.push(n.status);
    if (n.level) bits.push(n.level);
    if (n.issuer) bits.push(n.issuer);
    if (n.date) bits.push(fmtDate(n.date));
    return bits.filter(Boolean);
  }
  const colorOf = (n) => css(TYPE[n.type]?.color || "--c-other");

  /* ---------------- runtime: static site vs claude.ai artifact ---------------- */
  const runtime = { inArtifact: false, isOwner: false, sample: null, downloads: null };
  const ready = (async () => {
    await new Promise((r) => (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", r) : r()));
    const c = window.claude;
    if (!c || typeof c.use !== "function") return runtime;
    runtime.inArtifact = true;
    try {
      const [user, sample, downloads] = await Promise.all([c.use("user"), c.use("sample"), c.use("downloads")]);
      runtime.isOwner = !!(user && (await user.isOwner()));
      runtime.sample = sample; runtime.downloads = downloads;
    } catch (e) { console.warn("artifact capabilities unavailable", e); }
    return runtime;
  })();

  function toast(msg, ms = 2600) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), ms);
  }
  function modal(title, html) {
    $("#modal-title").textContent = title; $("#modal-body").innerHTML = html; $("#modal").hidden = false;
    $("#modal-close").focus();
  }
  $("#modal-close").addEventListener("click", () => ($("#modal").hidden = true));
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("#modal").hidden = true; });

  async function saveFile(filename, data, mime) {
    await ready;
    if (runtime.inArtifact) {
      if (!runtime.downloads) { toast("Downloads aren't available in this view."); return false; }
      try { await runtime.downloads.save({ filename, data: data instanceof Blob ? data : new Blob([data], { type: mime }) }); return true; }
      catch (e) { if (e?.code !== "declined") toast(e?.code === "rejected_extension" ? "This file type can't be saved here." : "The file couldn't be saved here."); return false; }
    }
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast("Copied"); return true; }
    catch { modal("Copy this", `<textarea readonly style="width:100%">${esc(text)}</textarea>`); $("#modal-body textarea").select(); return false; }
  }

  /* ---------------- header & legend ---------------- */
  document.title = R.site?.title || `${me.name} · Resume graph`;
  $("#name").textContent = me.name;
  $("#headline").textContent = me.headline || "";

  // look and behaviour settings (ui.js, from site.ui in resume.js)
  const UI = window.GRUI ? window.GRUI.ui : { startView: "graph", skills: "folded", startHidden: [], features: { search: true, textView: true, download: true, copyLink: true, counting: true } };
  const hiddenTypes = new Set(FILTERS.filter((f) => UI.startHidden.includes(f.key)).flatMap((f) => f.types));
  let showSkills = UI.skills === "shown"; // by default individual skills stay folded into their areas until asked for
  function renderLegend() {
    $("#legend").innerHTML = FILTERS.map((f) => {
      const isSkill = f.key === "skill";
      const count = shownNodes.filter((n) => (isSkill ? n.type === "Skill" : f.types.includes(n.type))).length;
      if (!count) return "";
      const pressed = isSkill ? showSkills : !f.types.some((t) => hiddenTypes.has(t));
      const title = isSkill ? ' title="Show every skill, not just skill areas"' : "";
      return `<button type="button" data-filter="${f.key}" aria-pressed="${pressed}"${title} style="--c:var(${f.color})"><span class="dot"></span>${f.label} <span class="count">${count}</span></button>`;
    }).join("");
    $$("#legend button").forEach((b) => b.addEventListener("click", () => {
      const f = FILTERS.find((x) => x.key === b.dataset.filter);
      if (f.key === "skill") { setSkills(!showSkills); return; }
      const on = b.getAttribute("aria-pressed") === "true";
      b.setAttribute("aria-pressed", String(!on));
      f.types.forEach((t) => (on ? hiddenTypes.add(t) : hiddenTypes.delete(t)));
      applyVisibility();
    }));
  }
  function setSkills(v) {
    showSkills = v;
    const b = $('#legend [data-filter="skill"]'); if (b) b.setAttribute("aria-pressed", String(v));
    if (!cy) return;
    const sel = cy.$("node:selected");
    cy.nodes(".peek").removeClass("peek");
    applyVisibility(); runLayout();
    if (sel.nonempty()) { peek(sel); focusNeighbourhood(sel); }
  }

  /* ---------------- cytoscape ---------------- */
  let cy;
  const phoneQuery = window.matchMedia("(max-width: 640px)");
  const isPhone = () => phoneQuery.matches;
  function graphStyle(phone) {
    const ink = css("--ink"), rule = css("--rule"), hl = css("--hl"), paper = css("--paper"), muted = css("--muted");
    const base = [
        { selector: "node", style: {
          "background-color": "data(color)", width: "data(size)", height: "data(size)",
          label: "data(label)", color: ink, "font-family": css("--sans") || "system-ui, sans-serif",
          "font-size": 12, "font-weight": 500, "text-valign": "bottom", "text-margin-y": 5,
          "text-wrap": "wrap", "text-max-width": 130, "text-background-color": paper, "text-background-opacity": 0.85,
          "text-background-padding": 2, "text-background-shape": "roundrectangle",
          "border-width": 0, "underlay-padding": 0, "overlay-opacity": 0,
          "transition-property": "opacity, underlay-opacity, underlay-padding", "transition-duration": 180
        }},
        { selector: 'node[type="Person"]', style: { "font-size": 15, "font-weight": 700, "text-margin-y": 7 } },
        { selector: 'node[type="Role"], node[type="Education"], node[type="Project"]', style: { "font-size": 13.5, "font-weight": 600 } },
        { selector: 'node[type="Skill"]', style: { "font-size": 10.5, color: css("--ink-2"), "min-zoomed-font-size": 9 } },
        { selector: 'node[type="Skill"].faded', style: { "text-opacity": 0 } },
        { selector: 'node[type="SkillGroup"]', style: { "background-color": paper, "border-width": 3, "border-color": "data(color)", "font-size": 11.5, "font-weight": 600 } },
        { selector: 'node[type="Organization"], node[type="School"]', style: { shape: "round-rectangle" } },
        { selector: "node.show-draft[draft = 1]", style: { "border-width": 2, "border-style": "dashed", "border-color": muted } },
        // hidden from visitors: hollow with a dotted ring, so you can tell at a glance
        { selector: "node.hidden-item", style: { "background-opacity": 0.35, "border-width": 2.5, "border-style": "dotted", "border-color": ink } },
        { selector: "edge", style: {
          width: 1.1, "line-color": rule, "curve-style": "bezier", "target-arrow-shape": "triangle",
          "target-arrow-color": rule, "arrow-scale": 0.6, opacity: 0.9,
          label: "", "font-size": 10, "font-family": "Newsreader, Georgia, serif", "font-style": "italic", color: muted,
          "text-rotation": "autorotate", "text-background-color": paper, "text-background-opacity": 1, "text-background-padding": 1
        }},
        { selector: "edge.agg", style: { "line-style": "dashed", "line-dash-pattern": [4, 4], "target-arrow-shape": "none" } },
        { selector: "edge.lit", style: { "line-color": ink, "target-arrow-color": ink, width: 1.6, label: "data(label)" } },
        { selector: ".faded", style: { opacity: 0.14 } },
        { selector: "node:selected", style: { "overlay-color": ink, "overlay-opacity": 0.1, "overlay-padding": 8, "overlay-shape": "ellipse" } },
        { selector: "node.hl", style: { "border-width": 6, "border-style": "solid", "border-color": hl, "border-opacity": 1 } },
        { selector: "node.hl.strong", style: { "border-width": 9 } }
      ];
    // label size setting: scale every font size
    const k = parseFloat(css("--label-scale")) || 1;
    if (k !== 1) base.forEach((r) => { if (typeof r.style["font-size"] === "number") r.style = { ...r.style, "font-size": r.style["font-size"] * k }; });
    if (!phone) return base;
    // phones: the overview labels only you and the skill areas; everything else appears
    // when you pinch to zoom, or when it is part of the selected node's neighbourhood
    return base.concat([
      { selector: "node", style: { "min-zoomed-font-size": 8 } },
      { selector: 'node[type="Person"]', style: { "font-size": 30, "min-zoomed-font-size": 0 } },
      { selector: 'node[type="SkillGroup"]', style: { "font-size": 22, "min-zoomed-font-size": 0 } },
      { selector: "node.focus", style: { "font-size": 14, "min-zoomed-font-size": 0, "text-opacity": 1 } },
      // while a node is open, only its neighbourhood carries labels; edge labels stay off on a small screen
      { selector: "node.faded", style: { "text-opacity": 0 } },
      { selector: "edge", style: { "text-opacity": 0 } }
    ]);
  }
  function areaEdges() {
    const ids = new Set(shownNodes.map((n) => n.id)), out = [];
    for (const n of shownNodes) {
      const areas = new Set((n.skills || []).map((s) => byId.get(s)?.group).filter((g) => g && ids.has(g)));
      areas.forEach((g) => out.push({ id: `${n.id}__area__${g}`, source: n.id, target: g, pred: "area" }));
    }
    return out;
  }
  function initGraph() {
    const deg = {};
    shownEdges.forEach((e) => { deg[e.source] = (deg[e.source] || 0) + 1; deg[e.target] = (deg[e.target] || 0) + 1; });
    const elements = [
      ...shownNodes.map((n) => {
        const base = TYPE[n.type]?.size || 18;
        const size = n.type === "Skill" ? base + Math.min(14, (deg[n.id] || 1) * 2.2) : base;
        return { data: { id: n.id, label: displayLabel(n), type: n.type, color: colorOf(n), size, draft: n.draft ? 1 : 0 }, classes: n.private ? "hidden-item" : "" };
      }),
      ...shownEdges.map((e) => ({ data: { ...e, label: PRED[e.pred][0] } })),
      ...areaEdges().map((e) => ({ data: { ...e, label: "draws on" }, classes: "agg" }))
    ];
    cy = cytoscape({
      container: $("#cy"),
      elements,
      minZoom: 0.15, maxZoom: 2.6, wheelSensitivity: 0.25,
      style: graphStyle(isPhone()),
      layout: { name: "preset" }
    });

    applyVisibility();
    runLayout();
    cy.on("mouseover", "node", (e) => focusNeighbourhood(e.target));
    cy.on("mouseout", "node", () => { if (!cy.$("node:selected").length) clearFocus(); else focusNeighbourhood(cy.$("node:selected")); });
    cy.on("tap", "node", (e) => go(e.target.id()));
    cy.on("tap", (e) => { if (e.target === cy) closeDrawer(true); });
    applyDraftMarks();
  }

  // Folded view: a radial map. You in the centre, skill areas on the inner ring,
  // work/education/projects on the outer ring next to the areas they draw on,
  // organisations and schools beyond them. Deterministic: same picture every visit.
  function radialLayout(vis, withSkills) {
    const TAU = Math.PI * 2;
    const k = isPhone() ? 0.8 : 1;   // tighter rings on phones, so nodes come out larger
    const R1 = 150 * k, RS = [300 * k, 370 * k], R2 = (withSkills ? 540 : 315) * k, R3 = (withSkills ? 690 : 460) * k;
    const visible = new Set(vis.nodes().map((n) => n.id()));
    const pos = { me: { x: 0, y: 0 } };
    const areas = shownNodes.filter((n) => n.type === "SkillGroup" && visible.has(n.id));
    const aAng = {};
    const skillsOf = (a) => shownNodes.filter((s) => s.type === "Skill" && s.group === a.id && visible.has(s.id));
    if (withSkills) {
      // each area gets a sector sized by how many skills it holds; its skills fan out inside it
      const total = areas.reduce((t, a) => t + Math.max(1, skillsOf(a).length), 0);
      let acc = -Math.PI / 2;
      areas.forEach((a) => {
        const sk = skillsOf(a), width = (TAU * Math.max(1, sk.length)) / total;
        aAng[a.id] = acc + width / 2;
        sk.forEach((s, j) => {
          const ang = acc + (width * (j + 0.5)) / sk.length, r = RS[j % 2];
          pos[s.id] = { x: r * Math.cos(ang), y: r * Math.sin(ang) };
        });
        acc += width;
      });
    } else areas.forEach((a, i) => { aAng[a.id] = -Math.PI / 2 + (TAU * i) / areas.length; });
    const norm = (a) => ((a % TAU) + TAU) % TAU;
    const mean = (angles) => {
      if (!angles.length) return null;
      const x = angles.reduce((s, a) => s + Math.cos(a), 0), y = angles.reduce((s, a) => s + Math.sin(a), 0);
      return Math.hypot(x, y) < 1e-6 ? angles[0] : Math.atan2(y, x);
    };
    const ITEM = ["Role", "Break", "Education", "Project", "Award", "Certification", "Publication", "Language"];
    const items = shownNodes.filter((n) => ITEM.includes(n.type) && visible.has(n.id));
    const want = {};
    items.forEach((n) => { want[n.id] = mean((n.skills || []).map((s) => aAng[byId.get(s)?.group]).filter((a) => a != null)); });
    for (let pass = 0; pass < 2; pass++) items.forEach((n) => {
      if (want[n.id] != null) return;
      const kin = items.filter((m) => m.id !== n.id && want[m.id] != null &&
        ((n.org && m.org === n.org) || m.partOf === n.id || n.partOf === m.id || (n.includes || []).includes(m.id)));
      want[n.id] = mean(kin.map((m) => want[m.id]));
    });
    // place everything with a preferred angle, then spread to a minimum separation
    const placed = items.filter((n) => want[n.id] != null).map((n) => ({ id: n.id, a: norm(want[n.id]) }));
    const loose = items.filter((n) => want[n.id] == null);
    const minSep = Math.min(TAU / (items.length + 1), 0.5);
    const spread = (arr) => {
      arr.sort((p, q) => p.a - q.a);
      for (let k = 0; k < 200; k++) {
        let moved = false;
        for (let i = 0; i < arr.length; i++) {
          const p = arr[i], q = arr[(i + 1) % arr.length];
          let d = norm(q.a - p.a); if (arr.length === 1) break;
          if (d < minSep) { const push = (minSep - d) / 2 + 1e-4; p.a = norm(p.a - push); q.a = norm(q.a + push); moved = true; }
        }
        if (!moved) break;
        arr.sort((p, q) => p.a - q.a);
      }
    };
    spread(placed);
    // things with no link to a skill area go into the widest gaps
    loose.forEach((n) => {
      placed.sort((p, q) => p.a - q.a);
      let best = 0, gap = -1;
      placed.forEach((p, i) => { const g = norm(placed[(i + 1) % placed.length].a - p.a) || TAU; if (g > gap) { gap = g; best = i; } });
      placed.push({ id: n.id, a: placed.length ? norm(placed[best].a + gap / 2) : 0 });
    });
    spread(placed);
    const itemAng = {};
    // with many items, alternate between two radii so neighbouring labels don't collide
    const stagger = placed.length > 14 ? 90 * k : 0;
    placed.sort((p, q) => p.a - q.a).forEach((p, i) => {
      const r = R2 + (i % 2 ? stagger : 0);
      itemAng[p.id] = p.a; pos[p.id] = { x: r * Math.cos(p.a), y: r * Math.sin(p.a) };
    });
    areas.forEach((a) => { pos[a.id] = { x: R1 * Math.cos(aAng[a.id]), y: R1 * Math.sin(aAng[a.id]) }; });
    // organisations and schools sit outside the items that point to them
    const outer = shownNodes.filter((n) => (n.type === "Organization" || n.type === "School") && visible.has(n.id)).map((o) => {
      const refs = items.filter((n) => (n.org === o.id || n.school === o.id) && itemAng[n.id] != null);
      return { id: o.id, a: norm(mean(refs.map((n) => itemAng[n.id])) ?? 0) };
    });
    spread(outer);
    outer.forEach((o) => { const r = R3 + stagger; pos[o.id] = { x: r * Math.cos(o.a), y: r * Math.sin(o.a) }; });
    // phones are taller than wide: stretch the rings into an ellipse so the picture fills the screen
    const sy = isPhone() ? Math.min(1.55, Math.max(1, 1.3 * cy.height() / Math.max(1, cy.width()))) : 1;
    vis.nodes().positions((n) => { const q = pos[n.id()] || { x: 0, y: 0 }; return { x: q.x, y: q.y * sy }; });
  }

  function runLayout() {
    const v = cy.elements(":visible");
    radialLayout(v, showSkills);
    return frame(v);
    // 1) deterministic rings by kind (same picture on every visit), 2) a force pass from there to untangle
    const ring = { Person: 4, Role: 3, Education: 3, Project: 3, SkillGroup: 2, Organization: 1.5, School: 1.5, Language: 2, Certification: 2, Award: 2, Publication: 2, Skill: 0 };
    const vis = cy.elements(":visible");
    vis.layout({ name: "concentric", animate: false, fit: false, minNodeSpacing: 34, concentric: (n) => ring[n.data("type")] ?? 0, levelWidth: () => 1, startAngle: -Math.PI / 2 }).run();
    vis.layout({
      name: "cose", animate: false, randomize: false, fit: false,
      nodeRepulsion: (n) => (n.data("type") === "Skill" ? 26000 : showSkills ? 80000 : 140000),
      nodeOverlap: 60,
      idealEdgeLength: (e) => ({ inGroup: 80, used: 190, trainedIn: 190, at: 80, partOf: 130, area: 210 }[e.data("pred")] || 160),
      edgeElasticity: (e) => (e.data("pred") === "inGroup" ? 220 : ["used", "trainedIn", "area"].includes(e.data("pred")) ? 18 : 90),
      gravity: 0.6, numIter: 3000, initialTemp: 400, coolingFactor: 0.97, componentSpacing: 80
    }).run();
    frame(vis);
  }
  function frame(vis) {
    // keep the top-left corner clear for the intro text
    const pad = window.innerWidth > 900 ? 420 : 0;
    if (pad) {
      const bb = vis.boundingBox();
      const w = window.innerWidth - pad - 40, h = window.innerHeight - 120;
      const z = Math.min(w / bb.w, h / bb.h, 1.25);
      cy.zoom(z);
      cy.pan({ x: pad + (w - bb.w * z) / 2 - bb.x1 * z, y: 70 + (h - bb.h * z) / 2 - bb.y1 * z });
    } else cy.fit(vis, isPhone() ? 18 : 40);
  }

  // folded mode: unfold the skills of whatever is selected, in a ring around it
  function peek(node) {
    unpeek(false);
    if (showSkills || !node || node.empty()) { applyVisibility(); return; }
    const type = node.data("type");
    let skills, anchor = node;
    if (type === "Skill") { skills = node; anchor = cy.getElementById(byId.get(node.id())?.group || ""); }
    else skills = node.neighborhood('node[type="Skill"]');
    if (!skills.length) { applyVisibility(); return; }
    const c = anchor.nonempty() ? anchor.position() : node.position();
    const r = 64 + skills.length * 7;
    skills.forEach((sk, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / skills.length;
      sk.position({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
      sk.addClass("peek");
    });
    applyVisibility();
  }
  function unpeek(apply = true) {
    if (!cy) return;
    const p = cy.nodes(".peek");
    if (p.nonempty()) { p.removeClass("peek"); if (apply) applyVisibility(); }
  }

  function focusNeighbourhood(node) {
    const hood = node.closedNeighborhood();
    cy.batch(() => {
      cy.elements().addClass("faded").removeClass("lit focus");
      hood.removeClass("faded");
      hood.nodes().addClass("focus");
      node.connectedEdges().addClass("lit");
    });
  }
  function clearFocus() {
    cy.batch(() => {
      cy.elements().removeClass("lit focus");
      if (!lens.active) { cy.elements().removeClass("faded"); return; }
      cy.nodes().forEach((n) => n.toggleClass("faded", !lens.ids.has(n.id())));
      cy.edges().forEach((e) => e.toggleClass("faded", !(lens.ids.has(e.source().id()) && lens.ids.has(e.target().id()))));
    });
  }
  function applyVisibility() {
    if (!cy) return;
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        const t = n.data("type");
        const hide = hiddenTypes.has(t) || (t === "Skill" && !showSkills && !n.hasClass("peek"));
        n.style("display", hide ? "none" : "element");
      });
      cy.edges(".agg").style("display", showSkills ? "none" : "element");
    });
  }
  function applyDraftMarks() {
    if (!cy) return;
    cy.nodes().toggleClass("show-draft", showDrafts() || runtime.isOwner);
  }

  /* ---------------- drawer ---------------- */
  function triplesFor(id, edges) {
    const out = [];
    for (const e of edges) {
      if (e.source === id) out.push({ pred: PRED[e.pred][0], other: e.target, order: 0 });
      else if (e.target === id) out.push({ pred: PRED[e.pred][1], other: e.source, order: 1 });
    }
    const rank = { Person: 0, Role: 1, Break: 1, Education: 2, Project: 3, Organization: 4, School: 4, SkillGroup: 5, Skill: 6 };
    return out.sort((a, b) => a.order - b.order || (rank[byId.get(a.other)?.type] ?? 9) - (rank[byId.get(b.other)?.type] ?? 9));
  }

  // the same concept in Wikidata / ESCO, as small links under the description
  function matchesHtml(n) {
    const ex = n.exactMatch || [], cl = n.closeMatch || [];
    if (!ex.length && !cl.length) return "";
    const link = (x) => { const m = window.GRCORE.matchLink(x); return `<a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.label)}</a>`; };
    const ids = (xs) => xs.map((x) => window.GRCORE.expand(x).split("/").pop()).map((x) => (x.length > 12 ? "" : ` ${x}`));
    const fmt = (xs) => xs.map((x, i) => link(x) + `<span class="muted">${esc(ids(xs)[i])}</span>`).join(", ");
    return `<p class="matches">${ex.length ? `Same as ${fmt(ex)}` : ""}${ex.length && cl.length ? "; related: " : cl.length ? "Related: " : ""}${cl.length ? fmt(cl) : ""}</p>`;
  }
  function renderDrawer(id) {
    const n = byId.get(id);
    if (!n || (n.private && !ownerView)) return closeDrawer();
    const drafts = showDrafts() || runtime.isOwner;
    const kind = n.type === "Person" ? "Person" : TYPE[n.type]?.kind || n.type;
    const m = meta(n);
    const summary = n.type === "Person" ? n.summary : (isPlaceholder(n.summary) || isPlaceholder(n.description) ? "" : n.summary || n.description);
    const hls = drafts ? n.highlights || [] : clean(n.highlights);
    const triples = triplesFor(id, shownEdges);
    $("#drawer-body").innerHTML = `
      <div class="kind" style="--c:${colorOf(n)}"><span class="dot"></span>${esc(kind)}${n.draft && drafts ? '<span class="draft-tag">draft</span>' : ""}${n.private ? '<span class="draft-tag hidden-tag">hidden from visitors</span>' : ""}</div>
      <h2 id="drawer-title">${esc(n.label || n.name)}</h2>
      ${m.length ? `<p class="meta">${m.map(esc).join(", ")}</p>` : ""}
      ${n.type === "Person" && n.headline ? `<p class="summary">${esc(n.headline)}</p>` : ""}
      ${summary ? `<p class="summary">${esc(summary)}</p>` : ""}
      ${hls.length ? `<ul class="hl-list">${hls.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
      ${n.url ? `<p><a href="${esc(n.url)}" target="_blank" rel="noopener">Open link</a></p>` : ""}
      ${matchesHtml(n)}
      ${triples.length ? `<h3>How it connects</h3><ul class="triples">${triples.map((t) => {
        const o = byId.get(t.other);
        return `<li><button type="button" data-goto="${esc(t.other)}"><span class="pred">${esc(t.pred)}</span><span class="obj" style="--c:${colorOf(o)}"><span class="dot"></span>${esc(o.label || o.name)}${o.type === "Role" && byId.get(o.org) ? `, ${esc(byId.get(o.org).label)}` : ""}</span></button></li>`;
      }).join("")}</ul>` : ""}
    `;
    $$("#drawer-body [data-goto]").forEach((b) => b.addEventListener("click", () => go(b.dataset.goto)));
    $("#drawer").hidden = false;
    $("#hint").hidden = true;
  }
  function closeDrawer(resetHash) {
    $("#drawer").hidden = true;
    $("#drawer").classList.remove("expanded");
    const wasOpen = document.body.classList.contains("sheet-open");
    document.body.classList.remove("sheet-open");
    if (cy) { cy.$("node:selected").unselect(); unpeek(); clearFocus(); if (wasOpen) { cy.resize(); frame(cy.elements(":visible")); } }
    if (resetHash && currentHash() && !["read", "studio"].includes(currentHash())) history.replaceState(null, "", location.pathname + location.search + (forPrefix ? "#" + forPrefix : ""));
  }
  $("#drawer-close").addEventListener("click", () => closeDrawer(true));
  $("#drawer-grab").addEventListener("click", () => {
    const d = $("#drawer"), open = d.classList.toggle("expanded");
    $("#drawer-grab").setAttribute("aria-expanded", String(open));
    $("#drawer-grab").setAttribute("aria-label", open ? "Show less" : "Show more");
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (!$("#modal").hidden) $("#modal").hidden = true; else closeDrawer(true); } });

  function selectNode(id) {
    if (!cy) return;
    const node = cy.getElementById(id);
    if (!node.nonempty()) return;
    cy.$("node:selected").unselect();
    node.select();
    peek(node);
    focusNeighbourhood(node);
    renderDrawer(id);
    if (isPhone()) { document.body.classList.add("sheet-open"); cy.resize(); }   // fold the header away while reading
    // fit the node and its neighbours into the space the intro text and details panel leave free
    const W = window.innerWidth, H = window.innerHeight;
    let rect;
    if (isPhone()) {
      // the graph sits below the header; the bottom sheet covers its lower part
      const sheet = $("#drawer").getBoundingClientRect(), box = $("#cy").getBoundingClientRect();
      const free = Math.max(140, Math.min(box.bottom, sheet.top) - box.top - 16);
      rect = { x: 10, y: 8, w: box.width - 20, h: free };
    } else rect = W > 900
      ? { x: W >= 1240 ? 430 : 24, y: 80, w: Math.max(320, W - (W >= 1240 ? 430 : 24) - 440), h: H - 120 }
      : { x: 12, y: 150, w: W - 24, h: Math.max(160, H * 0.38 - 150) };
    const bb = node.closedNeighborhood().filter(":visible").boundingBox({ includeLabels: true });
    const z = Math.max(cy.minZoom(), Math.min(rect.w / bb.w, rect.h / bb.h, 1.3));
    cy.animate({ zoom: z, pan: { x: rect.x + (rect.w - bb.w * z) / 2 - bb.x1 * z, y: rect.y + (rect.h - bb.h * z) / 2 - bb.y1 * z } },
      { duration: 320, easing: "ease-out-cubic" });
  }

  /* ---------------- search ---------------- */
  const searchInput = $("#search"), results = $("#search-results");
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { results.hidden = true; return; }
    const hits = shownNodes.filter((n) => [n.label, n.name, n.summary, ...(n.highlights || [])].join(" ").toLowerCase().includes(q)).slice(0, 8);
    results.innerHTML = hits.length
      ? hits.map((n) => `<li><button type="button" data-id="${esc(n.id)}" style="--c:${colorOf(n)}"><span class="dot"></span>${esc(n.label || n.name)}</button></li>`).join("")
      : `<li class="muted" style="padding:7px 8px">No match. Try a skill like “SPARQL”.</li>`;
    results.hidden = false;
    $$("button", results).forEach((b) => b.addEventListener("click", () => { go(b.dataset.id); results.hidden = true; searchInput.value = ""; }));
  });
  searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { const b = $("button", results); if (b) b.click(); } });

  /* ---------------- read view ---------------- */
  function chip(id, hlIds) {
    const n = byId.get(id); if (!n || (n.private && !ownerView)) return "";
    return `<button type="button" class="chip${hlIds?.has(id) ? " hl" : ""}" data-goto="${esc(id)}" style="--c:${colorOf(n)}"><span class="dot"></span>${esc(n.label)}</button>`;
  }
  function renderRead() {
    const drafts = showDrafts() || runtime.isOwner;
    const nodesOf = (t) => shownNodes.filter((n) => n.type === t);
    const byDateDesc = (a, b) => String(b.end || "9999").localeCompare(String(a.end || "9999")) || String(b.start || "").localeCompare(String(a.start || ""));
    const item = (n, sub) => {
      const hls = drafts ? n.highlights || [] : clean(n.highlights);
      const summary = isPlaceholder(n.summary) ? "" : n.summary;
      return `<div class="item" id="read-${esc(n.id)}">
        <h3>${esc(n.label)}${n.draft && drafts ? '<span class="draft-tag">draft</span>' : ""}${n.private ? '<span class="draft-tag hidden-tag">hidden from visitors</span>' : ""}</h3>
        ${sub ? `<p class="meta">${esc(sub)}</p>` : ""}
        ${summary ? `<p>${esc(summary)}</p>` : ""}
        ${hls.length ? `<ul>${hls.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
        ${(n.skills || []).length ? `<div class="links">${n.skills.map((s) => chip(s)).join("")}</div>` : ""}
      </div>`;
    };
    const forTop = forOK && (forLink.company || forLink.note) ? `<div class="for-card for-read">${forLink.company ? `<p class="for-kicker">Prepared for ${esc(forLink.company)}</p>` : ""}${forLink.role ? `<p class="for-role">${esc(forLink.role)}</p>` : ""}${forLink.note ? `<p class="for-note">${esc(forLink.note).replace(/\n/g, "<br>")}</p>` : ""}</div>` : "";
    // each section gets an anchor for the side navigation (sec-*, never a node id)
    const navItems = [];
    const section = (key, title, color, html, count) => {
      if (!html) return "";
      navItems.push({ key, title, color, count });
      return `<h2 id="sec-${key}" style="--c:var(${color})"><span class="dot"></span>${title}</h2>${html}`;
    };
    const roles = [...nodesOf("Role"), ...nodesOf("Break")].sort(byDateDesc).map((n) => item(n, meta(n).join(", "))).join("");
    const edu = nodesOf("Education").sort(byDateDesc).map((n) => item(n, meta(n).join(", "))).join("");
    const proj = nodesOf("Project").map((n) => item(n, meta(n).join(", "))).join("");
    const groups = nodesOf("SkillGroup").map((g) => {
      const skills = shownNodes.filter((s) => s.type === "Skill" && s.group === g.id);
      return `<div><h3>${esc(g.label)}</h3><div class="links">${skills.map((s) => chip(s.id)).join("")}</div></div>`;
    }).join("");
    const ungrouped = shownNodes.filter((s) => s.type === "Skill" && !s.group);
    const more = ["Certification", "Award", "Publication", "Language"].flatMap(nodesOf)
      .map((n) => `<div class="item"><h3>${esc(n.label)}${n.draft && drafts ? '<span class="draft-tag">draft</span>' : ""}</h3>${meta(n).length ? `<p class="meta">${esc(meta(n).join(", "))}</p>` : ""}</div>`).join("");

    $("#read-body").innerHTML = `
      <h1 id="sec-top">${esc(me.name)}</h1>
      <p class="lede">${esc(me.headline || "")}</p>
      <p class="contact">${[me.location, me.email].filter(Boolean).map(esc).join(", ")}${(me.links || []).map((l) => `, <a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("")}</p>
      ${me.summary ? `<p class="about">${esc(me.summary)}</p>` : ""}
      ${forTop}
      ${section("experience", "Experience", "--c-role", roles, nodesOf("Role").length + nodesOf("Break").length)}
      ${section("projects", "Projects", "--c-project", proj, nodesOf("Project").length)}
      ${section("education", "Education", "--c-edu", edu, nodesOf("Education").length)}
      ${section("skills", "Skills", "--c-skill", groups || ungrouped.length ? `<div class="skills-grid">${groups}${ungrouped.length ? `<div><h3>Other</h3><div class="links">${ungrouped.map((s) => chip(s.id)).join("")}</div></div>` : ""}</div>` : "", shownNodes.filter((n) => n.type === "Skill").length)}
      ${section("more", "Languages and more", "--c-other", more, ["Certification", "Award", "Publication", "Language"].flatMap(nodesOf).length)}
      ${R.site?.allowPublicGraphExport !== false && UI.features.download ? `<p class="read-foot"><button class="btn ghost small" type="button" id="read-download">Download this graph as JSON-LD or Turtle</button> <a class="read-vocab" href="${esc(window.GRCORE.GR_NS.replace(/#$/, ""))}">How the graph is described: the gr: vocabulary</a></p>` : ""}
    `;
    $("#read-download")?.addEventListener("click", () => $("#export-graph-btn").click());
    $$("#read-body [data-goto]").forEach((b) => b.addEventListener("click", () => go(b.dataset.goto)));
    renderReadNav([{ key: "top", title: me.name, color: "--c-person" }, ...navItems]);
  }

  /* ---------------- text view: section navigation ---------------- */
  // Buttons, not links: the address bar's #… is used for routing, so jumping to a
  // section scrolls without touching it.
  let readNavItems = [];
  function renderReadNav(items) {
    readNavItems = items;
    $("#read-nav").innerHTML = `<ol>${items.map((it) => `<li><button type="button" data-sec="${it.key}" style="--c:var(${it.color})">
        ${it.key === "top" ? "" : '<span class="dot"></span>'}<span class="lbl">${esc(it.key === "top" ? "Overview" : it.title)}</span>${it.count ? `<span class="n">${it.count}</span>` : ""}</button></li>`).join("")}</ol>`;
    $$("#read-nav button").forEach((b) => b.addEventListener("click", () => {
      const target = $("#sec-" + b.dataset.sec);
      if (!target) return;
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      readNavLock = Date.now() + 1800;   // keep the clicked section marked while the page scrolls there
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: true });
      markReadNav(b.dataset.sec);
    }));
    markReadNav("top");
    padReadEnd();
  }
  // room after the last section, so even it can scroll up to the top of the screen
  function padReadEnd() {
    const last = readNavItems[readNavItems.length - 1], h = last && $("#sec-" + last.key);
    if (!h || $("#view-read").hidden) return;
    const body = $("#read-body");
    body.style.paddingBottom = "";
    const below = body.getBoundingClientRect().bottom - h.getBoundingClientRect().top;
    body.style.paddingBottom = Math.max(80, window.innerHeight - below - 40) + "px";
  }
  window.addEventListener("resize", () => { if (!$("#view-read").hidden) padReadEnd(); });
  window.addEventListener("gr:view", (e) => { if (e.detail === "read") requestAnimationFrame(padReadEnd); });
  let readNavLock = 0;
  function markReadNav(key) {
    $$("#read-nav button").forEach((b) => {
      const on = b.dataset.sec === key;
      b.classList.toggle("on", on);
      if (on) { b.setAttribute("aria-current", "true"); b.scrollIntoView?.({ block: "nearest", inline: "nearest" }); } else b.removeAttribute("aria-current");
    });
  }
  // the section whose heading was last passed while scrolling is the current one
  let readNavRaf = 0;
  window.addEventListener("scroll", () => {
    if ($("#view-read").hidden || !readNavItems.length || readNavRaf || Date.now() < readNavLock) return;
    readNavRaf = requestAnimationFrame(() => {
      readNavRaf = 0;
      const offset = window.innerWidth < 1100 ? 120 : 140;
      let cur = "top";
      for (const it of readNavItems) { const h = $("#sec-" + it.key); if (h && h.getBoundingClientRect().top - offset <= 0) cur = it.key; }
      const was = $("#read-nav button.on")?.dataset.sec;
      if (was !== cur) markReadNav(cur);
    });
  }, { passive: true });

  /* ---------------- highlight lens (used by the studio) ---------------- */
  const lens = { active: false, ids: new Set() };
  function setLens(matches, label) {
    // matches: [{id, strength}]
    if (!showSkills) setSkills(true);
    lens.active = true; lens.ids = new Set(["me", ...matches.map((m) => m.id)]);
    // pull in the organisation / school so matched roles keep their context
    matches.forEach((m) => { const n = byId.get(m.id); if (n?.org) lens.ids.add(n.org); if (n?.school) lens.ids.add(n.school); });
    cy.batch(() => {
      cy.nodes().removeClass("hl strong");
      matches.forEach((m) => cy.getElementById(m.id).addClass("hl" + (m.strength === "strong" ? " strong" : "")));
    });
    clearFocus();
    $("#lens-text").textContent = label;
    $("#lens-banner").hidden = false;
    $("#hint").hidden = true;
  }
  function clearLens() {
    lens.active = false; lens.ids = new Set();
    cy.nodes().removeClass("hl strong"); clearFocus();
    $("#lens-banner").hidden = true;
  }
  $("#lens-clear").addEventListener("click", clearLens);

  /* ---------------- graph export (JSON-LD + Turtle) ---------------- */
  function baseIri() { return (R.site?.baseIri || location.href.split("#")[0]).replace(/[?].*$/, "") + "#"; }
  // downloads are always the public part; see core.js
  const toJsonLd = (includePrivate = false) => coreJsonLd(includePrivate ? allNodes : publicNodes, includePrivate ? fullEdges : publicEdges, baseIri());
  const toTurtle = (includePrivate = false) => coreTurtle(toJsonLd(includePrivate));

  $("#export-graph-btn").addEventListener("click", () => {
    modal("Download the graph", `
      <p>The same resume as linked data, ready for a triple store or any RDF tool.</p>
      <div class="row">
        <button class="btn ink small" id="dl-jsonld">JSON-LD</button>
        <button class="btn ghost small" id="dl-ttl">Turtle</button>
      </div>`);
    $("#dl-jsonld").addEventListener("click", () => { gcCount("download-jsonld", "Downloaded graph (JSON-LD)", true); saveFile("resume-graph.json", JSON.stringify(toJsonLd(), null, 2), "application/ld+json"); });
    $("#dl-ttl").addEventListener("click", async () => {
      gcCount("download-turtle", "Downloaded graph (Turtle)", true);
      await ready;
      if (runtime.inArtifact) copyText(toTurtle()); // .ttl isn't a permitted download type here
      else saveFile("resume-graph.ttl", toTurtle(), "text/turtle");
    });
  });

  $("#share-btn").addEventListener("click", async () => {
    await ready;
    if (runtime.inArtifact) { modal("Share this page", "<p>Use Share at the top of this page on claude.ai. The link it copies opens the node you have selected.</p>"); return; }
    gcCount("copy-link", "Copied link", true);
    copyText(location.href);
  });

  /* ---------------- analytics: GoatCounter (optional) ---------------- */
  const gc = { ready: null };
  function gcInit() {
    const code = String(R.site?.goatcounter || "").trim();
    if (!code || runtime.inArtifact) return;            // not configured, or inside claude.ai
    let owner = !!window.GR_OWNER?.configured; try { owner = owner || localStorage.getItem("gr.owner") === "true"; } catch {}
    if (owner) return;                                    // never count the owner's own browser
    if (!UI.features.counting || window.GRUI?.previewMode) return;   // switched off, or a Customize preview
    window.goatcounter = { no_onload: true };
    gc.ready = new Promise((resolve) => {
      const s = document.createElement("script");
      s.async = true; s.src = "https://gc.zgo.at/count.js";
      s.dataset.goatcounter = `https://${encodeURIComponent(code)}.goatcounter.com/count`;
      s.onload = s.onerror = () => resolve();
      document.head.appendChild(s);
    });
    countView(currentHash());
  }
  function gcCount(path, title, event) {
    if (!gc.ready) return;
    gc.ready.then(() => { try { window.goatcounter?.count?.({ path, title, event: !!event }); } catch {} });
  }
  let lastCounted = "";
  function countView(h) {
    if (h === "studio") return;                           // the studio is owner-only; don't count it
    if (/^for\//.test(h)) h = "";                         // never send a link key anywhere
    const n = h && byId.get(h);
    // a tailored link is counted by its code only; the key never leaves the browser
    const path = location.pathname + (forOK ? `#for/${forLink.id}${h ? "/" + h : ""}` : h ? `#${h}` : "");
    if (gc.ready && path === lastCounted) return;         // start-up can route twice; count once
    if (gc.ready) lastCounted = path;
    gcCount(path, (forOK ? "Tailored link: " : "") + (h === "read" ? "Read as text" : n ? (n.label || n.name) : "Graph"));
  }

  /* ---------------- routing ---------------- */
  const views = { graph: $("#view-graph"), read: $("#view-read"), studio: $("#view-studio") };
  function show(view) {
    Object.entries(views).forEach(([k, el]) => (el.hidden = k !== view));
    $$('[role="tab"][data-view]').forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === view)));
    if (view === "graph" && cy) { cy.resize(); }
    window.dispatchEvent(new CustomEvent("gr:view", { detail: view }));
  }
  let firstRoute = true;
  function route() {
    let h = currentHash();
    // the site can open on the text instead of the graph
    if (firstRoute && h === "" && UI.startView === "text" && UI.features.textView) h = "read";
    if (!UI.features.textView && h === "read") h = "";
    firstRoute = false;
    countView(h);
    if (h === "read") { renderRead(); show("read"); window.scrollTo(0, 0); return; }
    if (h === "studio") { show("studio"); return; }
    show("graph");
    if (h && byId.has(h)) selectNode(h); else closeDrawer();
  }
  $$("[data-view]").forEach((b) => b.addEventListener("click", () => {
    const v = b.dataset.view;
    if (v === "graph") { if (currentHash() === "") route(); else go(""); }
    else go(v);
  }));
  window.addEventListener("hashchange", route);
  $("#studio-btn").addEventListener("click", () => (location.hash = "studio"));

  /* ---------------- tailored link ---------------- */
  function renderForCard() {
    const card = $("#for-card");
    if (!forLink) return;
    if (!forOK) {
      card.innerHTML = `<p class="for-gone">${forLink.status === "gone" ? "This link is no longer active." : "This link couldn't be opened."} You're seeing the public version of the resume.</p>`;
      card.hidden = false;
      history.replaceState(null, "", location.pathname + location.search);
      return;
    }
    card.innerHTML = `
      ${forLink.company ? `<p class="for-kicker">Prepared for ${esc(forLink.company)}</p>` : ""}
      ${forLink.role ? `<p class="for-role">${esc(forLink.role)}</p>` : ""}
      ${forLink.note ? `<p class="for-note">${esc(forLink.note).replace(/\n/g, "<br>")}</p>` : ""}
      ${forLink.focus.length ? `<p class="for-hint">${forLink.mode === "only" ? "This link shows the parts of my resume that matter for this role." : "The highlighted parts are the most relevant to this role. Everything else is still there to explore."}</p>` : ""}`;
    card.hidden = false;
    // on a phone the note is clamped to a few lines; tap to read all of it
    card.addEventListener("click", () => card.classList.toggle("open"));
  }
  function applyForLens() {
    if (!forOK || !forLink.focus.length) return;
    const ids = forLink.focus.filter((id) => byId.has(id) && shownNodes.some((n) => n.id === id));
    if (ids.length) setLens(ids.map((id) => ({ id, strength: "strong" })), forLink.company ? `Highlighted for ${forLink.company}` : "Highlighted for this role");
  }

  /* ---------------- owner bar ---------------- */
  function renderOwnerBar() {
    const bar = $("#owner-bar");
    if (!bar || runtime.inArtifact || window.GRUI?.previewMode) return;
    if (!(ownerView || owner.asVisitor || owner.error)) { if (owner.refreshed && !renderOwnerBar.waited) { renderOwnerBar.waited = true; owner.refreshed.then(() => owner.error && renderOwnerBar()); } return; }
    const label = owner.asVisitor ? "You're seeing what visitors see."
      : ownerView ? `Your full view: ${hiddenCount} ${hiddenCount === 1 ? "item" : "items"} hidden from visitors.`
      : "";
    bar.innerHTML = `${esc(label)}${owner.error ? ` <span class="owner-err">Private master: ${esc(owner.error)}</span>` : ""}
      ${owner.configured ? `<button type="button" class="linkish" id="owner-toggle">${owner.asVisitor ? "Back to your view" : "See it as a visitor"}</button>` : ""}`;
    bar.hidden = false;
    if (owner.refreshed && !renderOwnerBar.waited) { renderOwnerBar.waited = true; owner.refreshed.then(() => owner.error && renderOwnerBar()); }
    $("#owner-toggle")?.addEventListener("click", () => {
      try { owner.asVisitor ? sessionStorage.removeItem("gr.asVisitor") : sessionStorage.setItem("gr.asVisitor", "1"); } catch {}
      location.reload();
    });
  }

  /* ---------------- boot ---------------- */
  renderLegend();
  const canDownload = R.site?.allowPublicGraphExport !== false && UI.features.download;
  if (canDownload) $("#export-graph-btn").hidden = false;
  if (!UI.features.search) $(".intro .search").hidden = true;
  if (!UI.features.copyLink) $("#share-btn").hidden = true;
  if (!UI.features.textView) { $$('[data-view="read"]').forEach((b) => (b.hidden = true)); const skip = $(".skip"); if (skip) skip.hidden = true; }
  // a theme change from the Customize panel's preview: recolour without rebuilding
  window.addEventListener("gr:ui", () => {
    if (!cy) return;
    cy.batch(() => cy.nodes().forEach((n) => { const d = byId.get(n.id()); if (d) n.data("color", colorOf(d)); }));
    cy.style(graphStyle(isPhone()));
    renderLegend();
  });
  const boot = () => { renderForCard(); initGraph(); applyForLens(); route(); };
  // wait until every script (including studio.js, which loader.js adds after this one) has run, then for the web fonts
  const afterScripts = new Promise((r) => (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", r) : r()))
    .then(() => window.GR_SCRIPTS);
  afterScripts.then(() => document.fonts?.ready).then(boot, boot);
  ready.then(() => {
    gcInit();
    if (runtime.isOwner) { $("#studio-btn").hidden = false; applyDraftMarks(); }
    if (runtime.inArtifact) $("#share-btn").textContent = "Share";
    renderOwnerBar();
    window.dispatchEvent(new CustomEvent("gr:ready"));
  });
  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => cy && cy.resize(), 150); });
  phoneQuery.addEventListener?.("change", () => {
    if (!cy) return;
    cy.resize(); cy.style(graphStyle(isPhone())); runLayout();
    const sel = cy.$("node:selected"); if (sel.nonempty()) selectNode(sel.id());
  });

  window.GR = {
    R, me, allNodes, publicNodes, byId, fullEdges, PRED, TYPE, ownerView,
    fmtDate, dateRange, meta, isPlaceholder, clean, esc, $, $$,
    runtime, ready, toast, modal, saveFile, copyText, setLens, clearLens,
    toJsonLd, toTurtle, applyDraftMarks, renderRead,
    showDrafts, cy: () => cy
  };
})();

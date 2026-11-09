/* ui.js: how the site looks and behaves, from `site.ui` in resume.js.
   Every setting is optional; anything left out keeps the default. The studio's
   Customize panel edits these settings with a live preview. Runs before app.js. */
(function () {
  "use strict";

  // ---- themes: a full palette each, so text, lines and node colours stay readable together
  const THEMES = {
    ink: { label: "Ink", dark: false, vars: {
      "--paper": "#EEF1F4", "--surface": "#FFFFFF", "--surface-2": "#F6F8FA", "--paper-2": "#DCE1E7",
      "--ink": "#17202D", "--ink-2": "#3A4456", "--muted": "#5F687A", "--rule": "#D3D9E1", "--on-ink": "#FFFFFF",
      "--c-person": "#17202D", "--c-role": "#2C46C7", "--c-org": "#5B6C86", "--c-edu": "#A86A12",
      "--c-project": "#A1275D", "--c-skill": "#0D7776", "--c-other": "#6A4DB8", "--hl": "#F6DE3D", "--hl-soft": "#FBF0A6" } },
    paper: { label: "Paper", dark: false, vars: {
      "--paper": "#F5F0E6", "--surface": "#FFFDF8", "--surface-2": "#F8F3EA", "--paper-2": "#E6DDCC",
      "--ink": "#2A2118", "--ink-2": "#4B4033", "--muted": "#776B5C", "--rule": "#E0D5C2", "--on-ink": "#FFFDF8",
      "--c-person": "#2A2118", "--c-role": "#2F5DA8", "--c-org": "#7A6A55", "--c-edu": "#B0601C",
      "--c-project": "#9B2E4C", "--c-skill": "#2F7A57", "--c-other": "#74509F", "--hl": "#F2C94C", "--hl-soft": "#F8E3A3" } },
    forest: { label: "Forest", dark: false, vars: {
      "--paper": "#EDF2EE", "--surface": "#FFFFFF", "--surface-2": "#F4F8F5", "--paper-2": "#D6E2D9",
      "--ink": "#13241B", "--ink-2": "#33463B", "--muted": "#5A6E62", "--rule": "#CFDCD3", "--on-ink": "#FFFFFF",
      "--c-person": "#13241B", "--c-role": "#1F6F8B", "--c-org": "#5E7366", "--c-edu": "#9A6B17",
      "--c-project": "#9C3D54", "--c-skill": "#2E7D32", "--c-other": "#6B5BA8", "--hl": "#E9D84A", "--hl-soft": "#F4EDA6" } },
    slate: { label: "Slate (dark)", dark: true, vars: {
      "--paper": "#12161D", "--surface": "#1B212B", "--surface-2": "#222A36", "--paper-2": "#0C0F14",
      "--ink": "#E8ECF2", "--ink-2": "#C3CAD5", "--muted": "#8D97A6", "--rule": "#2E3746", "--on-ink": "#12161D",
      "--c-person": "#E8ECF2", "--c-role": "#7D95FF", "--c-org": "#94A4BA", "--c-edu": "#E3A44A",
      "--c-project": "#F06B9F", "--c-skill": "#3CC6B7", "--c-other": "#B79CFF", "--hl": "#F6DE3D", "--hl-soft": "#5C5214" } }
  };
  // "auto" follows the visitor's system setting: Ink by day, Slate by night
  const resolveTheme = (t) => (t === "auto" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "slate" : "ink") : THEMES[t] ? t : "ink");

  // ---- font pairs: a sans for the interface, a serif for longer reading
  const G = "https://fonts.googleapis.com/css2?";
  const FONTS = {
    grotesk: { label: "Schibsted Grotesk + Newsreader", sans: '"Schibsted Grotesk", system-ui, sans-serif', serif: '"Newsreader", Georgia, serif',
      href: G + "family=Schibsted+Grotesk:ital,wght@0,400..800;1,400..600&family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..500&display=swap" },
    inter: { label: "Inter + Source Serif", sans: '"Inter", system-ui, sans-serif', serif: '"Source Serif 4", Georgia, serif',
      href: G + "family=Inter:wght@400..800&family=Source+Serif+4:opsz,wght@8..60,300..600&display=swap" },
    work: { label: "Work Sans + Lora", sans: '"Work Sans", system-ui, sans-serif', serif: '"Lora", Georgia, serif',
      href: G + "family=Work+Sans:wght@400..800&family=Lora:wght@400..600&display=swap" },
    plex: { label: "IBM Plex Sans + Serif", sans: '"IBM Plex Sans", system-ui, sans-serif', serif: '"IBM Plex Serif", Georgia, serif',
      href: G + "family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@400;500;600&display=swap" },
    system: { label: "System fonts (nothing to download)", sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', serif: 'Georgia, "Times New Roman", serif', href: "" }
  };

  const CV_SECTIONS = ["profile", "experience", "projects", "education", "skills", "awards", "certifications", "volunteering", "languages"];
  const DEFAULTS = {
    theme: "ink",                 // ink | paper | forest | slate | auto
    fonts: "grotesk",             // grotesk | inter | work | plex | system
    colors: {},                   // role, org, edu, project, skill, other, highlight: "#rrggbb"
    startView: "graph",           // graph | text
    skills: "folded",             // folded (skill areas only) | shown (every skill)
    startHidden: [],              // legend groups off at first: "exp", "edu", "proj", "other"
    labelSize: "normal",          // small | normal | large
    features: { search: true, textView: true, download: true, copyLink: true, counting: true },
    cv: { layout: "classic", accent: "", order: CV_SECTIONS.slice(), titles: {}, linkLabel: "Portfolio" }   // layout: classic | modern | compact; linkLabel: the tailored link's text in the contact line
  };
  const COLOR_VARS = { person: "--c-person", role: "--c-role", org: "--c-org", edu: "--c-edu", project: "--c-project", skill: "--c-skill", other: "--c-other", highlight: "--hl" };
  const LABEL_SCALE = { small: 0.88, normal: 1, large: 1.16 };
  const hex = (v) => (/^#[0-9a-f]{6}$/i.test(String(v || "")) ? String(v) : "");

  // settings over defaults, ignoring anything unknown or malformed
  function merge(raw) {
    const u = raw && typeof raw === "object" ? raw : {};
    const pick = (v, ok, d) => (ok.includes(v) ? v : d);
    const f = Object.assign({}, DEFAULTS.features);
    Object.keys(f).forEach((k) => { if (typeof u.features?.[k] === "boolean") f[k] = u.features[k]; });
    const colors = {};
    Object.keys(COLOR_VARS).forEach((k) => { if (hex(u.colors?.[k])) colors[k] = u.colors[k]; });
    const order = Array.isArray(u.cv?.order) ? u.cv.order.filter((s) => CV_SECTIONS.includes(s)) : [];
    // a section added in a later version goes where it sits by default, not after everything
    CV_SECTIONS.forEach((s, i) => {
      if (order.includes(s)) return;
      const next = CV_SECTIONS.slice(i + 1).find((x) => order.includes(x));
      next ? order.splice(order.indexOf(next), 0, s) : order.push(s);
    });
    const titles = {};
    CV_SECTIONS.forEach((s) => { const t = u.cv?.titles?.[s]; if (typeof t === "string" && t.trim()) titles[s] = t.trim().slice(0, 40); });
    return {
      theme: pick(u.theme, [...Object.keys(THEMES), "auto"], DEFAULTS.theme),
      fonts: pick(u.fonts, Object.keys(FONTS), DEFAULTS.fonts),
      colors,
      startView: pick(u.startView, ["graph", "text"], DEFAULTS.startView),
      skills: pick(u.skills, ["folded", "shown"], DEFAULTS.skills),
      startHidden: (Array.isArray(u.startHidden) ? u.startHidden : []).filter((k) => ["exp", "edu", "proj", "other"].includes(k)),
      labelSize: pick(u.labelSize, Object.keys(LABEL_SCALE), DEFAULTS.labelSize),
      features: f,
      cv: { layout: pick(u.cv?.layout, ["classic", "modern", "compact"], "classic"), accent: hex(u.cv?.accent), order, titles,
            linkLabel: typeof u.cv?.linkLabel === "string" && u.cv.linkLabel.trim() ? u.cv.linkLabel.trim().slice(0, 30) : DEFAULTS.cv.linkLabel }
    };
  }

  // only what differs from the defaults, for writing back into resume.js
  function diff(ui) {
    const d = {};
    ["theme", "fonts", "startView", "skills", "labelSize"].forEach((k) => { if (ui[k] !== DEFAULTS[k]) d[k] = ui[k]; });
    if (Object.keys(ui.colors).length) d.colors = ui.colors;
    if (ui.startHidden.length) d.startHidden = ui.startHidden;
    const f = {}; Object.keys(DEFAULTS.features).forEach((k) => { if (ui.features[k] !== DEFAULTS.features[k]) f[k] = ui.features[k]; });
    if (Object.keys(f).length) d.features = f;
    const cv = {};
    if (ui.cv.layout !== "classic") cv.layout = ui.cv.layout;
    if (ui.cv.accent) cv.accent = ui.cv.accent;
    if (ui.cv.order.join() !== CV_SECTIONS.join()) cv.order = ui.cv.order;
    if (Object.keys(ui.cv.titles).length) cv.titles = ui.cv.titles;
    if (ui.cv.linkLabel !== DEFAULTS.cv.linkLabel) cv.linkLabel = ui.cv.linkLabel;
    if (Object.keys(cv).length) d.cv = cv;
    return d;
  }

  function applyLook(ui) {
    const root = document.documentElement;
    const name = resolveTheme(ui.theme), theme = THEMES[name];
    Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    Object.entries(ui.colors).forEach(([k, v]) => root.style.setProperty(COLOR_VARS[k], v));
    if (ui.colors.highlight) root.style.setProperty("--hl-soft", `color-mix(in srgb, ${ui.colors.highlight} 45%, var(--surface))`);
    const font = FONTS[ui.fonts];
    root.style.setProperty("--sans", font.sans);
    root.style.setProperty("--serif", font.serif);
    root.style.setProperty("--label-scale", String(LABEL_SCALE[ui.labelSize]));
    root.dataset.theme = name;
    root.style.colorScheme = theme.dark ? "dark" : "light";
    let link = document.getElementById("gr-fonts");
    if (font.href) {
      if (!link) { link = document.createElement("link"); link.id = "gr-fonts"; link.rel = "stylesheet"; document.head.appendChild(link); }
      if (link.href !== font.href) link.href = font.href;
    } else if (link) link.remove();
  }

  // The Customize panel previews settings in a frame of this page (?uipreview):
  // look changes arrive by message and apply at once; the rest reload the frame.
  const previewMode = /[?&]uipreview\b/.test(location.search);
  let raw = window.RESUME?.site?.ui;
  if (previewMode) { try { raw = JSON.parse(sessionStorage.getItem("gr.uiPreview") || "null") || raw; } catch {} }
  const UI = merge(raw);
  applyLook(UI);

  if (previewMode) {
    window.addEventListener("message", (e) => {
      if (e.origin !== location.origin || e.data?.type !== "gr-ui") return;
      try { sessionStorage.setItem("gr.uiPreview", JSON.stringify(e.data.ui)); } catch {}
      if (e.data.reload) { location.reload(); return; }
      Object.assign(UI, merge(e.data.ui));
      applyLook(UI);
      window.dispatchEvent(new CustomEvent("gr:ui"));
    });
  }
  // "auto" keeps following the system setting
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    if (UI.theme === "auto") { applyLook(UI); window.dispatchEvent(new CustomEvent("gr:ui")); }
  });

  window.GRUI = { ui: UI, DEFAULTS, THEMES, FONTS, CV_SECTIONS, COLOR_VARS, merge, diff, applyLook, resolveTheme, previewMode };
})();

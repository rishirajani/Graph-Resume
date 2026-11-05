/* Graph resume: shared core, used by the site (window.GRCORE) and by tools/publish.mjs.
   Turns resume.js into graph edges, decides what visitors may see, and writes RDF
   (JSON-LD and Turtle) with schema.org, SKOS mappings to Wikidata/ESCO, and Weft (weft:) terms. */
(function (root) {
  "use strict";

  const PRED = {
    workedAs:   ["worked as", "held by"],
    worksAs:    ["works as", "held by"],
    at:         ["at", "where"],
    studied:    ["studied", "studied by"],
    built:      ["built", "built by"],
    partOf:     ["part of", "includes"],
    used:       ["used", "used in"],
    trainedIn:  ["trained in", "practised in"],
    inGroup:    ["belongs to", "includes"],
    focusOn:    ["specialises in", "specialism of"],
    speaks:     ["speaks", "spoken by"],
    holds:      ["holds", "held by"],
    received:   ["received", "received by"],
    wrote:      ["wrote", "written by"],
    shows:      ["shows", "shown by"],
    awardedBy:  ["from", "awarded"],
    promotedFrom: ["promoted from", "promoted to"],
    ledTo:      ["led to", "came through"],
    runWith:    ["run with", "co-ran"],
    took:       ["took", "taken by"],
    included:   ["included", "during"]
  };

  const isPlaceholder = (t) => /^replace with/i.test(String(t || "").trim()) || /^add one line/i.test(String(t || "").trim());
  const clean = (arr) => (arr || []).filter((t) => t && !isPlaceholder(t));

  function deriveEdges(nodes) {
    const ids = new Set(nodes.map((n) => n.id));
    const E = [];
    const add = (s, p, o) => { if (ids.has(s) && ids.has(o)) E.push({ id: `${s}__${p}__${o}`, source: s, target: o, pred: p }); };
    for (const n of nodes) {
      switch (n.type) {
        case "Role": add("me", n.end || !n.start ? "workedAs" : "worksAs", n.id); add(n.id, "at", n.org); if (n.promotedFrom) add(n.id, "promotedFrom", n.promotedFrom); if (n.via) add(n.via, "ledTo", n.id); break;
        case "Education": add("me", "studied", n.id); add(n.id, "at", n.school); if (n.partner) add(n.id, "runWith", n.partner); break;
        case "Project": add("me", "built", n.id); if (n.partOf) add(n.id, "partOf", n.partOf); break;
        case "Skill": add(n.id, "inGroup", n.group); break;
        case "SkillGroup": add("me", "focusOn", n.id); break;
        case "Language": add("me", "speaks", n.id); break;
        case "Certification": add("me", "holds", n.id); break;
        case "Award": add("me", "received", n.id); if (n.org) add(n.id, "awardedBy", n.org); break;
        case "Publication": add("me", "wrote", n.id); break;
        case "Break": add("me", "took", n.id); (n.includes || []).forEach((x) => add(n.id, "included", x)); break;
      }
      for (const s of n.skills || []) add(n.id, n.type === "Education" ? "trainedIn" : n.type === "Certification" ? "shows" : "used", s);
    }
    return E;
  }

  // What visitors get: no private nodes, and no organisations, schools or skills that only
  // private nodes used.
  const REF_FIELDS = ["org", "school", "skills", "group", "partOf", "promotedFrom", "via", "partner", "includes"];
  const refsOf = (n) => REF_FIELDS.flatMap((f) => [].concat(n[f] ?? []));
  function publicSubset(nodes) {
    const out = new Set(nodes.filter((n) => n.private).map((n) => n.id));
    for (let changed = true; changed; ) {
      changed = false;
      const kept = nodes.filter((n) => !out.has(n.id)), used = new Set(kept.flatMap(refsOf));
      const cand = new Set(nodes.filter((n) => out.has(n.id)).flatMap(refsOf));
      for (const n of kept) if (["Organization", "School", "Skill"].includes(n.type) && cand.has(n.id) && !used.has(n.id)) { out.add(n.id); changed = true; }
    }
    return nodes.filter((n) => !out.has(n.id));
  }

  const SCHEMA_TYPE = {
    Person: "Person", Role: "OrganizationRole", Organization: "Organization", Education: "EducationalOccupationalCredential",
    School: "CollegeOrUniversity", Project: "CreativeWork", Skill: "DefinedTerm", SkillGroup: "DefinedTermSet",
    Language: "Language", Certification: "EducationalOccupationalCredential", Award: "weft:Award", Publication: "ScholarlyArticle",
    Break: "weft:CareerBreak"
  };

  // version of the shared code; must match release.json (checked when publishing)
  const VERSION = "1.8.0";
  // where released versions are announced (copies of the code check this for updates)
  const UPSTREAM = "https://rishirajani.github.io/Graph-Resume/";
  // relations come from Weft, an open vocabulary with permanent IRIs (https://w3id.org/weft)
  const WEFT_NS = "https://w3id.org/weft#";
  const WEFT_DOCS = "https://rishirajani.github.io/weft/";
  const PREFIXES = {
    schema: "https://schema.org/",
    skos: "http://www.w3.org/2004/02/skos/core#",
    wd: "http://www.wikidata.org/entity/",
    esco: "http://data.europa.eu/esco/skill/"
  };

  // "wd:Q28865" / "esco:<uuid>" in resume.js → full IRIs
  const expand = (x) => String(x).replace(/^wd:/, PREFIXES.wd).replace(/^esco:/, PREFIXES.esco);
  // where a person can look a match up
  const matchLink = (x) => {
    const iri = expand(x);
    if (iri.startsWith(PREFIXES.wd)) return { label: "Wikidata", url: "https://www.wikidata.org/wiki/" + iri.slice(PREFIXES.wd.length) };
    if (iri.startsWith(PREFIXES.esco)) return { label: "ESCO", url: "https://esco.ec.europa.eu/en/classification/skill?uri=" + encodeURIComponent(iri) };
    return { label: "Link", url: iri };
  };

  // base: the site's address ending in "#", e.g. https://example.org/cv/#
  function toJsonLd(nodes, edges, base) {
    const graph = nodes.map((n) => {
      const o = { "@id": "cv:" + n.id, "@type": SCHEMA_TYPE[n.type] || "Thing", name: n.label || n.name, "weft:kind": n.type };
      const summary = n.summary || n.description;
      if (summary && !isPlaceholder(summary)) o.description = summary;
      if (n.headline) o.disambiguatingDescription = n.headline;
      if (n.email) o.email = n.email;
      if (n.start) o.startDate = n.start;
      if (n.end) o.endDate = n.end;
      if (n.location) o["weft:location"] = n.location;
      if (n.status) o.creativeWorkStatus = n.status;
      if (n.level) o["weft:proficiency"] = n.level;
      if (n.url) o.url = n.url;
      const hls = clean(n.highlights);
      if (hls.length) o["weft:highlight"] = hls;
      // the same concept in shared vocabularies (Wikidata, ESCO)
      if ((n.exactMatch || []).length) o["skos:exactMatch"] = n.exactMatch.map((x) => ({ "@id": expand(x) }));
      if ((n.closeMatch || []).length) o["skos:closeMatch"] = n.closeMatch.map((x) => ({ "@id": expand(x) }));
      for (const e of edges.filter((e) => e.source === n.id)) {
        const k = "weft:" + e.pred;
        (o[k] = o[k] || []).push({ "@id": "cv:" + e.target });
      }
      return o;
    });
    return {
      "@context": { "@vocab": PREFIXES.schema, cv: base, weft: WEFT_NS, skos: PREFIXES.skos },
      "@graph": graph
    };
  }

  function toTurtle(doc) {
    const lit = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r")}"`;
    const prefixed = { ...PREFIXES, weft: doc["@context"].weft, cv: doc["@context"].cv };
    const iri = (x) => {
      if (/^(cv|weft|skos|schema):/.test(x)) return x;
      for (const [p, ns] of Object.entries(PREFIXES)) if (x.startsWith(ns) && /^[A-Za-z0-9_-]+$/.test(x.slice(ns.length))) return `${p}:${x.slice(ns.length)}`;
      return `<${x}>`;
    };
    const term = (k) => (/^(weft|skos):/.test(k) ? k : `schema:${k}`);
    const typ = (t) => (t.startsWith("weft:") ? t : `schema:${t}`);
    const lines = [...Object.entries(prefixed).map(([p, ns]) => `@prefix ${p}: <${ns}> .`), ""];
    for (const o of doc["@graph"]) {
      const po = [`a ${typ(o["@type"])}`];
      for (const [k, v] of Object.entries(o)) {
        if (k.startsWith("@")) continue;
        const vals = Array.isArray(v) ? v : [v];
        const objs = vals.map((x) => (x && typeof x === "object" && x["@id"] ? iri(x["@id"]) : lit(x)));
        po.push(`${term(k)} ${objs.join(", ")}`);
      }
      lines.push(`${o["@id"]} ${po.join(" ;\n    ")} .`, "");
    }
    return lines.join("\n");
  }

  // everything the RDF needs, from the raw resume data
  function graphOf(R) {
    const me = Object.assign({ id: "me", type: "Person", label: R.person.name }, R.person);
    return [me, ...R.nodes];
  }

  root.GRCORE = { VERSION, UPSTREAM, WEFT_NS, WEFT_DOCS, expand, matchLink, PRED, SCHEMA_TYPE, PREFIXES, isPlaceholder, clean, deriveEdges, REF_FIELDS, refsOf, publicSubset, toJsonLd, toTurtle, graphOf };
})(typeof window !== "undefined" ? window : globalThis);

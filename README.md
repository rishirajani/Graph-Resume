# Graph resume

> This repository holds the published site. Its `resume.js` is generated from a private master copy.

**Live: [rishirajani.github.io/Graph-Resume](https://rishirajani.github.io/Graph-Resume/)**

Your resume as an explorable knowledge graph, plus a private studio that writes a CV and cover letter for a specific job description using **only** the facts in your graph.

- **Public**: anyone with the link can explore the graph, read it as plain text, open a link to a single node, and download the graph as JSON-LD or Turtle.
- **Owner only**: the studio (`#studio`) turns a job description into a fit analysis, a tailored CV and a cover letter, exported as PDF, Word or Markdown.

It's a static site: no server, no database, no build step. Hosting is free.

## Files

| File | What it is |
| --- | --- |
| `resume.js` | **Your data. The only file you normally edit.** |
| `index.html`, `styles.css` | Page structure and design |
| `core.js` | Shared by the site and the publishing script: edges, what visitors see, RDF export |
| `app.js` | Graph explorer, text view, graph export |
| `studio.js` | Owner studio: prompt, model calls, grounding check, exports |
| `lib/` | Bundled libraries (Cytoscape.js for the graph, docx for Word export), both MIT-licensed |


## The graph as data

The site publishes its graph next to the page as [`resume.ttl`](resume.ttl) (Turtle) and [`resume.jsonld`](resume.jsonld) (JSON-LD), and links both from the page's `<head>`. Items use [schema.org](https://schema.org/) types, relations use a small `gr:` vocabulary (`gr:workedAs`, `gr:used`, `gr:inGroup`, …), and skills and languages point to the same concepts in [Wikidata](https://www.wikidata.org/) and the EU's [ESCO](https://esco.ec.europa.eu/) skills classification with `skos:exactMatch` (the same concept) or `skos:closeMatch` (closely related, or one part of a combined skill such as "HTML / CSS / JavaScript").

Before every publish the graph is checked against light [SHACL](https://www.w3.org/TR/shacl/) shapes (`shapes/resume.shacl.ttl`, run with pySHACL): every item has one name and a known kind, dates are `YYYY` or `YYYY-MM` and never end before they start, roles have a start date and exactly one organisation and are linked from the person, education is at a school, each skill sits in exactly one skill area, matches point to Wikidata items or ESCO skills, and every link points at something in the graph. If a check fails, nothing is published.

## Put it online for free (GitHub Pages)

1. Create a free GitHub account if you don't have one.
2. Create a new **public** repository, e.g. `resume` (or `<your-handle>.github.io` for a root-level address).
3. Upload every file in this folder, keeping the `lib/` folder (Add file, then Upload files, then drag the folder contents in).
4. In the repository go to **Settings → Pages**, set Source to **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
5. After a minute the site is live at `https://<your-handle>.github.io/resume/`.
6. Set `site.baseIri` in `resume.js` to that address so exported RDF has stable identifiers.

Cloudflare Pages and Netlify also work: drag the folder onto their dashboard.

Share links to a specific node by selecting it; the address bar ends in `#node-id` (for example `#p-loom`).

## Use the studio

Go to `https://<your-site>/#studio`. The first time, it asks for model settings:

| Provider | Cost | Notes |
| --- | --- | --- |
| Anthropic Claude | Paid API; Claude Max and Team plans include monthly API credits | Default `claude-sonnet-5-5` (about $0.06 per application); `claude-haiku-5-5` costs well under a cent. Keys from the Claude Console. |
| OpenRouter | Some models free (rate-limited, they rotate), the rest paid | Base URL `https://openrouter.ai/api/v1`. One key reaches hundreds of models, e.g. `moonshotai/kimi-k2.6`. |
| Other OpenAI-compatible services | Varies | Set their base URL. The service must accept requests from a browser. Groq's free tier allows fewer tokens per minute than one request needs. |
| Google Gemini | Paid; free tier restricted in the EU | Google's terms allow only paid services when an app is used from the EEA, UK or Switzerland. |

No key needed on claude.ai: the private copy of this site there writes with Claude through your Claude account.

Your key is stored only in your browser's local storage. It isn't in the site's files, so visitors can't see or use it.

**Optional lock**: in Model settings, type a passphrase and select *Make hash*, then paste the hash into `ownerPassphraseSha256` in `resume.js`. Visitors who open `#studio` then see a passphrase prompt. (A static site can't hide the studio's code, but there's nothing secret in it: without your key it can't do anything.)

**Presets**: Model settings has presets for Claude Sonnet 5.5, Claude Haiku 5.5, free OpenRouter models, Kimi K2.6 via OpenRouter and Gemini 2.5 Flash. The studio keeps one key per provider. Put several models in the Model field, separated by commas, and they are tried in order when one is busy, rate-limited or removed; on OpenRouter the switch happens on their side. Free OpenRouter models change often: if the free preset stops working, replace the model list with current IDs from openrouter.ai/models (filter by free).

### Visit counts (GoatCounter)

1. Sign up at goatcounter.com and pick a code, e.g. `rishirajani` for rishirajani.goatcounter.com.
2. Put that code in `site.goatcounter` in `resume.js`.
3. The site then counts page views (the graph, the text view and each node someone opens, as `#node-id`) plus downloads of the graph and copied links as events. The studio is never counted, and neither is any browser where you have saved studio settings. To exclude another browser of yours, open the site with `#toggle-goatcounter` at the end of the address.

### How tailoring stays truthful

1. The model receives your whole graph (including private nodes) and the job description.
2. It may only **select, order and rephrase** graph facts. It returns node ids, not titles: job titles, companies, schools and dates are filled in from `resume.js` by the site itself.
3. A grounding check runs on every answer. It drops references to nodes that don't exist, flags any number that isn't in your graph, flags "N years" claims your graph doesn't state, and lists draft nodes or roles without dates.
4. The *Fit* tab shows each requirement with the graph evidence behind it, including gaps. *Highlight matches on the graph* lights up those nodes with a highlighter.

Every text in the CV and letter preview is editable before export. **PDF** uses your browser's print dialog (choose "Save as PDF"); **Word** produces a .docx; recent results are kept in this browser under *Recent*.

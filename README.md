# agy-genui

> **🌐 [简体中文](./README_zh.md)**

**Generative UI for Antigravity** — render interactive UI components inline in assistant replies from declarative JSON, via Antigravity's native `<agent-embed>`.

Ask *"show me a sortable token-usage table"* and get a real interactive table — sorting, filtering, charts, forms and quizzes — embedded right in the conversation, not a plain text dump.

Zero external dependencies, CSP-safe, theme-aware.

---

## Why

Antigravity already supports `<agent-embed src="file:///.../widget.html">` for inline widgets. But asking a model to hand-write HTML/JS/CSS is token-expensive and error-prone, and external CDNs are blocked by CSP.

`agy-genui` flips the model's job: **the model only emits a small declarative JSON DSL; the plugin ships the renderer.**

```
Model → ```agy-ui {JSON} ``` → build.mjs → self-contained widget.html → <agent-embed>
```

---

## Features

- **20 ready components** — stat (with sparkline/delta), sortable/filterable/paginated table, SVG charts (bar/line/pie), progress (linear/ring), diff, tabs, accordion, card, row, timeline, tree, form, quiz, button, callout, badge, code, plot, markdown, image
- **Zero dependencies** — no CDN, no npm runtime; everything inlined into one HTML file
- **CSP-safe** — `default-src 'none'`, no `eval`, no external scripts
- **Theme-aware** — CSS variables adapt to Antigravity light/dark themes
- **Bidirectional actions** — form/quiz/button interactions post `action` back to the host via `postMessage`
- **Local-first** — sorting, filtering, paging and grading run entirely client-side

---

## Install

```bash
agy plugin install ./agy-genui
```

Or from GitHub:

```bash
agy plugin install https://github.com/<you>/agy-genui
```

No sidecar or config needed — this plugin works purely through the skill and the `<agent-embed>` mechanism.

---

## Usage

### 1. Model emits a DSL block

````markdown
```agy-ui
{
  "type": "echart",
  "title": "Monthly Token Usage",
  "echart": {
    "preset": "bar",
    "xKey": "month",
    "data": [
      { "month": "Jan", "value": 12000 },
      { "month": "Feb", "value": 15000 }
    ],
    "series": [{ "key": "value", "name": "Tokens", "type": "bar" }]
  }
}
```
````

### 2. Build a self-contained widget

```bash
node skills/agy-genui/src/build.mjs spec.json skills/agy-genui/dist/my-widget.html
```

Or pipe a DSL block directly:

```bash
echo '{"type":"stat","label":"Tokens","value":"1.2M"}' | \
  node skills/agy-genui/src/build.mjs - skills/agy-genui/dist/my-widget.html
```

### 3. Embed in the reply

```html
<agent-embed src="file:///D:/Mygit/agy-genui/skills/agy-genui/dist/my-widget.html"></agent-embed>
```

See [SKILL.md](./skills/agy-genui/SKILL.md) for the full DSL reference and component catalog.

---

## Project Layout

```
agy-genui/
├── plugin.json                  # plugin manifest
├── README.md / README_zh.md     # docs
├── LICENSE                      # MIT
├── assets/logo.svg              # plugin logo
└── skills/agy-genui/
    ├── SKILL.md                 # DSL reference + component catalog
    ├── src/
    │   ├── build.mjs            # DSL JSON → self-contained HTML
    │   ├── shell.html           # HTML shell (CSP + placeholders)
    │   ├── style.css            # theme-aware styles
    │   ├── renderer.js          # whitelist component renderer
    │   └── example*.spec.json   # sample DSLs
    └── dist/                    # generated widgets
```

---

## Security

- Strict component whitelist; unknown types render an error message, never crash
- No `eval`, no script injection, no secret collection
- All scripts/styles inlined; no external CDN
- CSP: `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: https: blob:`

---

## Status

v1.0.0 — base component library implemented. Planned (not yet implemented): `three` (3D), `mermaid`, `video`, `audio`, `carousel`, full ECharts option mode. See SKILL.md for the authoritative whitelist.

## License

MIT

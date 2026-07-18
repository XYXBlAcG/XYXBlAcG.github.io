# Tools Hub and py_software Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified Tools Hub, add two practical standalone tools, and reorganize `work/py_software` without breaking existing public URLs.

**Architecture:** Keep the site as static HTML, CSS, and vanilla JavaScript. Move Python/PyScript apps into `work/py_software/apps/*`, move dependencies into `work/py_software/vendor/*`, preserve old URLs with redirect wrappers, and expose all tools through `work/tools/index.html`.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, existing PyScript/SymPy pages, local Node.js for static link verification.

---

## File Structure

- Create: `.gitignore`
  - Ignore `.DS_Store`, `__pycache__/`, and `*.pyc` going forward.

- Create: `tools/check-static-links.mjs`
  - Local verification script for same-site HTML links and resource references.

- Create: `work/tools/index.html`
  - Unified catalog for all useful site tools.

- Create: `work/tools/shared/tools.css`
  - Shared visual system for Tools Hub and the two new tools.

- Create: `work/tools/shared/tools.js`
  - Shared helper functions for copy status, text download, and filter behavior.

- Create: `work/tools/text-toolkit/index.html`
  - Standalone UI for the text utility.

- Create: `work/tools/text-toolkit/text-toolkit.js`
  - Text operations, JSON formatting, Base64, URL encoding, and stats.

- Create: `work/tools/unit-converter/index.html`
  - Standalone UI for the unit converter.

- Create: `work/tools/unit-converter/unit-converter.js`
  - Conversion data and conversion logic.

- Create: `work/py_software/README.md`
  - Folder map and public URL notes.

- Create: `work/py_software/index.html`
  - Python/PyScript tool catalog for direct access to the reorganized apps.

- Move: `work/py_software/function_solver.html` to `work/py_software/apps/math-solver/index.html`
- Move: `work/py_software/function_solver.py` to `work/py_software/apps/math-solver/function_solver.py`
- Move: `work/py_software/latex2sympy.html` to `work/py_software/apps/latex-converter/index.html`
- Move: `work/py_software/latex2py.py` to `work/py_software/apps/latex-converter/latex2py.py`
- Move: `work/py_software/immediate_latex.html` to `work/py_software/apps/latex-renderer/index.html`
- Move: `work/py_software/bin/chem_solver.html` to `work/py_software/apps/chem-solver/index.html`
- Move: `work/py_software/bin/chem_solver.py` to `work/py_software/apps/chem-solver/chem_solver.py`
- Move: `work/py_software/whl_pack` to `work/py_software/vendor/whl_pack`
- Move: `work/py_software/pyscript-main` to `work/py_software/vendor/pyscript-main`
- Move: old source and experiment files into `work/py_software/src/*`, `work/py_software/playground/*`, and `work/py_software/archive/root-experiments/*` as listed in the design spec.

- Recreate: `work/py_software/function_solver.html`
  - Redirect wrapper to `apps/math-solver/`.

- Recreate: `work/py_software/latex2sympy.html`
  - Redirect wrapper to `apps/latex-converter/`.

- Recreate: `work/py_software/immediate_latex.html`
  - Redirect wrapper to `apps/latex-renderer/`.

- Recreate: `work/py_software/bin/chem_solver.html`
  - Redirect wrapper to `../apps/chem-solver/`.

- Modify: `work/py_software/apps/math-solver/index.html`
  - Update `whl_pack` paths after the move.

- Modify: `work/py_software/apps/latex-converter/index.html`
  - Update `whl_pack` paths after the move.

- Modify: `work/py_software/apps/chem-solver/index.html`
  - Update `whl_pack` paths and Math Solver link after the move.

- Modify: `index.html`
  - Add Tools Hub, Text Toolkit, and Unit Converter entries in `#work`.
  - Update Math Solver links to the new app path.

---

## Task 1: Add Ignore Rules and Static Link Checker

**Files:**
- Create: `.gitignore`
- Create: `tools/check-static-links.mjs`

- [ ] **Step 1: Create `.gitignore`**

Create `.gitignore` with this exact content:

```gitignore
.DS_Store
**/.DS_Store
__pycache__/
**/__pycache__/
*.pyc
```

- [ ] **Step 2: Create `tools/check-static-links.mjs`**

Create `tools/check-static-links.mjs` with this exact content:

```javascript
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const htmlFiles = [];
const ignoredPrefixes = ['http:', 'https:', 'mailto:', 'tel:', 'javascript:', '#'];
const attrs = ['href', 'src', 'data-src'];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      htmlFiles.push(full);
    }
  }
}

function stripQueryAndHash(value) {
  return value.split('#')[0].split('?')[0];
}

function shouldIgnore(value) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return ignoredPrefixes.some((prefix) => trimmed.startsWith(prefix));
}

function resolveTarget(file, rawValue) {
  const clean = stripQueryAndHash(rawValue.trim());
  if (clean.startsWith('/')) {
    return path.join(root, clean.slice(1));
  }
  return path.resolve(path.dirname(file), clean);
}

function targetExists(target) {
  if (fs.existsSync(target)) return true;
  if (fs.existsSync(path.join(target, 'index.html'))) return true;
  return false;
}

function collectLinks(file) {
  const html = fs.readFileSync(file, 'utf8');
  const links = [];
  for (const attr of attrs) {
    const pattern = new RegExp(`${attr}=["']([^"']+)["']`, 'gi');
    let match;
    while ((match = pattern.exec(html)) !== null) {
      links.push({ attr, value: match[1] });
    }
  }
  return links;
}

walk(root);

const missing = [];

for (const file of htmlFiles) {
  for (const link of collectLinks(file)) {
    if (shouldIgnore(link.value)) continue;
    const clean = stripQueryAndHash(link.value.trim());
    if (!clean || clean.startsWith('//')) continue;
    const target = resolveTarget(file, link.value);
    if (!targetExists(target)) {
      missing.push({
        file: path.relative(root, file),
        attr: link.attr,
        value: link.value,
        target: path.relative(root, target),
      });
    }
  }
}

if (missing.length > 0) {
  console.error('Missing local targets:');
  for (const item of missing) {
    console.error(`- ${item.file} ${item.attr}="${item.value}" -> ${item.target}`);
  }
  process.exit(1);
}

console.log(`Checked ${htmlFiles.length} HTML files. No missing local targets found.`);
```

- [ ] **Step 3: Run the checker before changes**

Run:

```bash
node tools/check-static-links.mjs
```

Expected: The command may report existing missing local targets. Record the output in the task notes before continuing so later failures can be compared to the baseline.

- [ ] **Step 4: Commit**

Run:

```bash
git add .gitignore tools/check-static-links.mjs
git commit -m "chore: add static site checks"
```

---

## Task 2: Create Shared Tools Styling and Helpers

**Files:**
- Create: `work/tools/shared/tools.css`
- Create: `work/tools/shared/tools.js`

- [ ] **Step 1: Create `work/tools/shared/tools.css`**

Create `work/tools/shared/tools.css` with this exact content:

```css
:root {
  color-scheme: dark;
  --page: #101418;
  --panel: rgba(255, 255, 255, 0.075);
  --panel-strong: rgba(255, 255, 255, 0.12);
  --line: rgba(255, 255, 255, 0.18);
  --text: #f4f7fb;
  --muted: rgba(244, 247, 251, 0.72);
  --accent: #72d2c8;
  --accent-strong: #f4c95d;
  --danger: #ff8a8a;
  --shadow: rgba(0, 0, 0, 0.26);
  font-family: "Source Sans Pro", Helvetica, sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  color: var(--text);
  background:
    linear-gradient(rgba(16, 20, 24, 0.88), rgba(16, 20, 24, 0.94)),
    url("../../../images/bg-1920.jpg") center / cover fixed;
}

a {
  color: inherit;
}

button,
input,
select,
textarea {
  font: inherit;
}

.tool-shell {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 40px 0 56px;
}

.tool-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 28px;
}

.tool-back {
  color: var(--muted);
  text-decoration: none;
}

.tool-back:hover {
  color: var(--text);
}

.tool-title {
  margin: 0;
  font-size: clamp(2rem, 5vw, 4rem);
  line-height: 1;
  letter-spacing: 0;
}

.tool-subtitle {
  max-width: 720px;
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 1.05rem;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.tool-card,
.tool-panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 18px 42px var(--shadow);
  backdrop-filter: blur(10px);
}

.tool-card {
  display: grid;
  gap: 12px;
  min-height: 190px;
  padding: 18px;
  text-decoration: none;
}

.tool-card:hover {
  border-color: var(--accent);
  background: var(--panel-strong);
}

.tool-card h2,
.tool-panel h2 {
  margin: 0;
  font-size: 1.2rem;
  letter-spacing: 0;
}

.tool-card p,
.tool-panel p {
  margin: 0;
  color: var(--muted);
}

.tool-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-self: end;
}

.tool-tag {
  padding: 3px 8px;
  color: var(--page);
  background: var(--accent);
  border-radius: 999px;
  font-size: 0.78rem;
}

.tool-panel {
  padding: 18px;
}

.tool-stack {
  display: grid;
  gap: 16px;
}

.tool-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.tool-field {
  display: grid;
  gap: 6px;
}

.tool-field span {
  color: var(--muted);
  font-size: 0.9rem;
}

.tool-input,
.tool-select,
.tool-textarea {
  width: 100%;
  color: var(--text);
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid var(--line);
  border-radius: 8px;
  outline: none;
}

.tool-input,
.tool-select {
  min-height: 44px;
  padding: 0 12px;
}

.tool-textarea {
  min-height: 260px;
  padding: 12px;
  resize: vertical;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
}

.tool-input:focus,
.tool-select:focus,
.tool-textarea:focus {
  border-color: var(--accent);
}

.tool-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tool-button {
  min-height: 40px;
  padding: 0 14px;
  color: var(--text);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--line);
  border-radius: 8px;
  cursor: pointer;
}

.tool-button:hover {
  border-color: var(--accent);
}

.tool-button.primary {
  color: #071312;
  background: var(--accent);
  border-color: var(--accent);
}

.tool-status {
  min-height: 1.5rem;
  color: var(--muted);
}

.tool-status.error {
  color: var(--danger);
}

.tool-section-title {
  margin: 24px 0 12px;
  color: var(--muted);
  font-size: 0.85rem;
  letter-spacing: 0.08rem;
  text-transform: uppercase;
}

.tool-results {
  display: grid;
  gap: 8px;
}

.tool-result-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(160px, 2fr);
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tool-result-row strong {
  color: var(--accent-strong);
}

@media (max-width: 640px) {
  .tool-shell {
    width: min(100% - 20px, 1120px);
    padding-top: 24px;
  }

  .tool-topbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .tool-result-row {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Create `work/tools/shared/tools.js`**

Create `work/tools/shared/tools.js` with this exact content:

```javascript
export function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}

export async function copyText(text, statusElement) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(statusElement, 'Copied.');
  } catch (error) {
    setStatus(statusElement, `Copy failed: ${error.message}`, true);
  }
}

export function installCardFilter(input, cards) {
  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    cards.forEach((card) => {
      const haystack = card.dataset.search.toLowerCase();
      card.hidden = query.length > 0 && !haystack.includes(query);
    });
  });
}

export function downloadText(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: Run the link checker**

Run:

```bash
node tools/check-static-links.mjs
```

Expected: Same baseline result as Task 1 because the new shared files are not linked from HTML yet.

- [ ] **Step 4: Commit**

Run:

```bash
git add work/tools/shared/tools.css work/tools/shared/tools.js
git commit -m "feat: add shared tools styling"
```

---

## Task 3: Build Tools Hub

**Files:**
- Create: `work/tools/index.html`

- [ ] **Step 1: Create `work/tools/index.html`**

Create `work/tools/index.html` with this exact content:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tools Hub</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@300;400;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="./shared/tools.css" />
</head>
<body>
  <main class="tool-shell">
    <nav class="tool-topbar" aria-label="Tools navigation">
      <a class="tool-back" href="../../index.html#work">Back to Work</a>
      <a class="tool-back" href="../py_software/">Python Tools</a>
    </nav>

    <header>
      <h1 class="tool-title">Tools Hub</h1>
      <p class="tool-subtitle">A compact catalog for math, text, file, learning, and small utility tools.</p>
    </header>

    <section class="tool-panel tool-stack" aria-label="Tool search">
      <label class="tool-field">
        <span>Filter tools</span>
        <input id="tool-filter" class="tool-input" type="search" placeholder="math, text, latex, unit, pdf, word..." />
      </label>
    </section>

    <h2 class="tool-section-title">Featured</h2>
    <section class="tool-grid" aria-label="Featured tools">
      <a class="tool-card" href="../py_software/apps/math-solver/" data-tool-card data-search="math solver equation matrix sympy calculus latex">
        <h2>Math Solver</h2>
        <p>Equation solving, calculus, matrix operations, transforms, LaTeX input, and plots.</p>
        <span class="tool-tags"><span class="tool-tag">Math</span><span class="tool-tag">PyScript</span></span>
      </a>
      <a class="tool-card" href="./text-toolkit/" data-tool-card data-search="text toolkit json base64 url sort dedupe line">
        <h2>Text Toolkit</h2>
        <p>Clean, sort, dedupe, transform, encode, decode, and format text.</p>
        <span class="tool-tags"><span class="tool-tag">Text</span><span class="tool-tag">JSON</span></span>
      </a>
      <a class="tool-card" href="./unit-converter/" data-tool-card data-search="unit converter length mass temperature speed data angle base">
        <h2>Unit Converter</h2>
        <p>Convert common units, data sizes, angles, temperatures, speeds, and number bases.</p>
        <span class="tool-tags"><span class="tool-tag">Units</span><span class="tool-tag">Everyday</span></span>
      </a>
    </section>

    <h2 class="tool-section-title">Math and Science</h2>
    <section class="tool-grid" aria-label="Math and science tools">
      <a class="tool-card" href="../py_software/apps/latex-converter/" data-tool-card data-search="latex sympy converter formula math">
        <h2>LaTeX to SymPy</h2>
        <p>Convert LaTeX math input into SymPy expression syntax.</p>
        <span class="tool-tags"><span class="tool-tag">LaTeX</span></span>
      </a>
      <a class="tool-card" href="../py_software/apps/latex-renderer/" data-tool-card data-search="latex realtime renderer mathjax preview">
        <h2>Real-time LaTeX</h2>
        <p>Preview LaTeX snippets as rendered math while typing.</p>
        <span class="tool-tags"><span class="tool-tag">Preview</span></span>
      </a>
      <a class="tool-card" href="../py_software/apps/chem-solver/" data-tool-card data-search="chem chemistry solver equation balance chempy">
        <h2>Chem Solver</h2>
        <p>Chemistry experiments and equation balancing utilities.</p>
        <span class="tool-tags"><span class="tool-tag">Chem</span></span>
      </a>
    </section>

    <h2 class="tool-section-title">Productivity and Learning</h2>
    <section class="tool-grid" aria-label="Productivity and learning tools">
      <a class="tool-card" href="../filesorter/preview.html" data-tool-card data-search="filesorter file organize folder extension time">
        <h2>Filesorter</h2>
        <p>Organize files by extension and time rules.</p>
        <span class="tool-tags"><span class="tool-tag">Files</span></span>
      </a>
      <a class="tool-card" href="../zip2pdf/preview.html" data-tool-card data-search="zip pdf convert images archive">
        <h2>Zip2PDF</h2>
        <p>Convert image archives into PDF files.</p>
        <span class="tool-tags"><span class="tool-tag">PDF</span></span>
      </a>
      <a class="tool-card" href="../kana_player/main.html" data-tool-card data-search="kana japanese hiragana katakana learning game">
        <h2>Kana Player</h2>
        <p>A kana flip-card learning game.</p>
        <span class="tool-tags"><span class="tool-tag">Learning</span></span>
      </a>
      <a class="tool-card" href="../wordmemo/preview.html" data-tool-card data-search="wordmemo vocabulary memory word learning">
        <h2>WordMemo</h2>
        <p>A lightweight word memorization tool.</p>
        <span class="tool-tags"><span class="tool-tag">Words</span></span>
      </a>
      <a class="tool-card" href="../../star/index.html" data-tool-card data-search="star visual small demo">
        <h2>Star</h2>
        <p>A small visual page.</p>
        <span class="tool-tags"><span class="tool-tag">Demo</span></span>
      </a>
    </section>
  </main>

  <script type="module">
    import { installCardFilter } from './shared/tools.js';
    installCardFilter(document.getElementById('tool-filter'), document.querySelectorAll('[data-tool-card]'));
  </script>
</body>
</html>
```

- [ ] **Step 2: Run the link checker**

Run:

```bash
node tools/check-static-links.mjs
```

Expected: Any new failure must point to a path typo in `work/tools/index.html`. Fix the path and rerun until the new page does not add missing local targets.

- [ ] **Step 3: Commit**

Run:

```bash
git add work/tools/index.html
git commit -m "feat: add tools hub"
```

---

## Task 4: Build Text Toolkit

**Files:**
- Create: `work/tools/text-toolkit/index.html`
- Create: `work/tools/text-toolkit/text-toolkit.js`

- [ ] **Step 1: Create `work/tools/text-toolkit/index.html`**

Create `work/tools/text-toolkit/index.html` with this exact content:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Text Toolkit</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@300;400;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../shared/tools.css" />
</head>
<body>
  <main class="tool-shell">
    <nav class="tool-topbar" aria-label="Text Toolkit navigation">
      <a class="tool-back" href="../">Back to Tools Hub</a>
      <a class="tool-back" href="../../../index.html#work">Back to Work</a>
    </nav>

    <header>
      <h1 class="tool-title">Text Toolkit</h1>
      <p class="tool-subtitle">Clean, transform, encode, decode, and format text directly in the browser.</p>
    </header>

    <section class="tool-grid" aria-label="Text editor">
      <label class="tool-field">
        <span>Input</span>
        <textarea id="input" class="tool-textarea" spellcheck="false">{"name":"xyx","tools":["math","text","unit"]}</textarea>
      </label>
      <label class="tool-field">
        <span>Output</span>
        <textarea id="output" class="tool-textarea" spellcheck="false" readonly></textarea>
      </label>
    </section>

    <section class="tool-panel tool-stack" aria-label="Text actions">
      <div class="tool-actions">
        <button class="tool-button primary" data-action="json-format">Format JSON</button>
        <button class="tool-button" data-action="json-minify">Minify JSON</button>
        <button class="tool-button" data-action="dedupe">Dedupe Lines</button>
        <button class="tool-button" data-action="remove-empty">Remove Empty Lines</button>
        <button class="tool-button" data-action="trim-lines">Trim Lines</button>
        <button class="tool-button" data-action="sort-asc">Sort A-Z</button>
        <button class="tool-button" data-action="sort-desc">Sort Z-A</button>
        <button class="tool-button" data-action="line-numbers">Add Line Numbers</button>
        <button class="tool-button" data-action="upper">Uppercase</button>
        <button class="tool-button" data-action="lower">Lowercase</button>
        <button class="tool-button" data-action="title">Title Case</button>
        <button class="tool-button" data-action="base64-encode">Base64 Encode</button>
        <button class="tool-button" data-action="base64-decode">Base64 Decode</button>
        <button class="tool-button" data-action="url-encode">URL Encode</button>
        <button class="tool-button" data-action="url-decode">URL Decode</button>
      </div>
      <div class="tool-actions">
        <button id="copy-output" class="tool-button">Copy Output</button>
        <button id="swap-text" class="tool-button">Swap</button>
        <button id="download-output" class="tool-button">Download Output</button>
        <button id="clear-text" class="tool-button">Clear</button>
      </div>
      <div id="stats" class="tool-status"></div>
      <div id="status" class="tool-status"></div>
    </section>
  </main>

  <script type="module" src="./text-toolkit.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `work/tools/text-toolkit/text-toolkit.js`**

Create `work/tools/text-toolkit/text-toolkit.js` with this exact content:

```javascript
import { copyText, downloadText, setStatus } from '../shared/tools.js';

const input = document.getElementById('input');
const output = document.getElementById('output');
const stats = document.getElementById('stats');
const status = document.getElementById('status');

function lines(text) {
  return text.split(/\r?\n/);
}

function titleCase(text) {
  return text.toLowerCase().replace(/\b[\p{L}\p{N}]/gu, (match) => match.toUpperCase());
}

function encodeBase64(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

function decodeBase64(text) {
  return decodeURIComponent(escape(atob(text.trim())));
}

function updateStats() {
  const text = input.value;
  const lineCount = text.length === 0 ? 0 : lines(text).length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  stats.textContent = `${text.length} chars · ${words} words · ${lineCount} lines`;
}

function runAction(action) {
  const text = input.value;
  setStatus(status, '');

  try {
    const transforms = {
      'trim-lines': () => lines(text).map((line) => line.trim()).join('\n'),
      'remove-empty': () => lines(text).filter((line) => line.trim().length > 0).join('\n'),
      dedupe: () => Array.from(new Set(lines(text))).join('\n'),
      'sort-asc': () => lines(text).slice().sort((a, b) => a.localeCompare(b)).join('\n'),
      'sort-desc': () => lines(text).slice().sort((a, b) => b.localeCompare(a)).join('\n'),
      'line-numbers': () => lines(text).map((line, index) => `${index + 1}. ${line}`).join('\n'),
      upper: () => text.toUpperCase(),
      lower: () => text.toLowerCase(),
      title: () => titleCase(text),
      'json-format': () => JSON.stringify(JSON.parse(text), null, 2),
      'json-minify': () => JSON.stringify(JSON.parse(text)),
      'base64-encode': () => encodeBase64(text),
      'base64-decode': () => decodeBase64(text),
      'url-encode': () => encodeURIComponent(text),
      'url-decode': () => decodeURIComponent(text),
    };

    output.value = transforms[action]();
    setStatus(status, 'Done.');
  } catch (error) {
    setStatus(status, error.message, true);
  }
}

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => runAction(button.dataset.action));
});

document.getElementById('copy-output').addEventListener('click', () => {
  copyText(output.value, status);
});

document.getElementById('swap-text').addEventListener('click', () => {
  const currentInput = input.value;
  input.value = output.value;
  output.value = currentInput;
  updateStats();
  setStatus(status, 'Swapped.');
});

document.getElementById('download-output').addEventListener('click', () => {
  downloadText('text-toolkit-output.txt', output.value);
  setStatus(status, 'Downloaded.');
});

document.getElementById('clear-text').addEventListener('click', () => {
  input.value = '';
  output.value = '';
  updateStats();
  setStatus(status, 'Cleared.');
});

input.addEventListener('input', updateStats);
updateStats();
runAction('json-format');
```

- [ ] **Step 3: Run a browser-free smoke check**

Run:

```bash
node tools/check-static-links.mjs
```

Expected: No new missing local target from `work/tools/text-toolkit/index.html`.

- [ ] **Step 4: Commit**

Run:

```bash
git add work/tools/text-toolkit/index.html work/tools/text-toolkit/text-toolkit.js
git commit -m "feat: add text toolkit"
```

---

## Task 5: Build Unit Converter

**Files:**
- Create: `work/tools/unit-converter/index.html`
- Create: `work/tools/unit-converter/unit-converter.js`

- [ ] **Step 1: Create `work/tools/unit-converter/index.html`**

Create `work/tools/unit-converter/index.html` with this exact content:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Unit Converter</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@300;400;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../shared/tools.css" />
</head>
<body>
  <main class="tool-shell">
    <nav class="tool-topbar" aria-label="Unit Converter navigation">
      <a class="tool-back" href="../">Back to Tools Hub</a>
      <a class="tool-back" href="../../../index.html#work">Back to Work</a>
    </nav>

    <header>
      <h1 class="tool-title">Unit Converter</h1>
      <p class="tool-subtitle">Convert practical units, data sizes, angles, temperatures, and number bases.</p>
    </header>

    <section class="tool-panel tool-stack" aria-label="Converter controls">
      <div class="tool-form-grid">
        <label class="tool-field">
          <span>Category</span>
          <select id="category" class="tool-select"></select>
        </label>
        <label class="tool-field">
          <span>From</span>
          <select id="from-unit" class="tool-select"></select>
        </label>
        <label class="tool-field">
          <span>Value</span>
          <input id="value" class="tool-input" type="text" value="1" inputmode="decimal" />
        </label>
      </div>
      <div id="status" class="tool-status"></div>
    </section>

    <section class="tool-panel tool-stack" aria-label="Conversion results">
      <h2>Results</h2>
      <div id="results" class="tool-results"></div>
    </section>
  </main>

  <script type="module" src="./unit-converter.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `work/tools/unit-converter/unit-converter.js`**

Create `work/tools/unit-converter/unit-converter.js` with this exact content:

```javascript
import { setStatus } from '../shared/tools.js';

const categorySelect = document.getElementById('category');
const fromSelect = document.getElementById('from-unit');
const valueInput = document.getElementById('value');
const results = document.getElementById('results');
const status = document.getElementById('status');

const categories = {
  length: {
    label: 'Length',
    base: 'meter',
    units: {
      millimeter: 0.001,
      centimeter: 0.01,
      meter: 1,
      kilometer: 1000,
      inch: 0.0254,
      foot: 0.3048,
      yard: 0.9144,
      mile: 1609.344,
    },
  },
  area: {
    label: 'Area',
    base: 'square meter',
    units: {
      'square meter': 1,
      'square kilometer': 1000000,
      hectare: 10000,
      acre: 4046.8564224,
      'square foot': 0.09290304,
    },
  },
  volume: {
    label: 'Volume',
    base: 'liter',
    units: {
      milliliter: 0.001,
      liter: 1,
      'cubic meter': 1000,
      gallon: 3.785411784,
    },
  },
  mass: {
    label: 'Mass',
    base: 'gram',
    units: {
      milligram: 0.001,
      gram: 1,
      kilogram: 1000,
      tonne: 1000000,
      ounce: 28.349523125,
      pound: 453.59237,
    },
  },
  speed: {
    label: 'Speed',
    base: 'meter per second',
    units: {
      'meter per second': 1,
      'kilometer per hour': 0.2777777777777778,
      'mile per hour': 0.44704,
      knot: 0.5144444444444445,
    },
  },
  time: {
    label: 'Time',
    base: 'second',
    units: {
      millisecond: 0.001,
      second: 1,
      minute: 60,
      hour: 3600,
      day: 86400,
    },
  },
  data: {
    label: 'Data Size',
    base: 'byte',
    units: {
      bit: 0.125,
      byte: 1,
      KB: 1024,
      MB: 1048576,
      GB: 1073741824,
      TB: 1099511627776,
    },
  },
  angle: {
    label: 'Angle',
    base: 'radian',
    units: {
      degree: Math.PI / 180,
      radian: 1,
    },
  },
  temperature: {
    label: 'Temperature',
    units: {
      Celsius: 'celsius',
      Fahrenheit: 'fahrenheit',
      Kelvin: 'kelvin',
    },
  },
  base: {
    label: 'Number Base',
    units: {
      decimal: 10,
      binary: 2,
      octal: 8,
      hexadecimal: 16,
    },
  },
};

function formatNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  if (Math.abs(value) >= 1000000 || (Math.abs(value) > 0 && Math.abs(value) < 0.0001)) {
    return value.toExponential(8).replace(/\.?0+e/, 'e');
  }
  return Number(value.toFixed(10)).toString();
}

function parseNumericValue(text) {
  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw new Error('Enter a valid number.');
  }
  return value;
}

function toCelsius(value, unit) {
  if (unit === 'Celsius') return value;
  if (unit === 'Fahrenheit') return (value - 32) * 5 / 9;
  return value - 273.15;
}

function fromCelsius(value, unit) {
  if (unit === 'Celsius') return value;
  if (unit === 'Fahrenheit') return value * 9 / 5 + 32;
  return value + 273.15;
}

function parseIntegerForBase(text, base) {
  const normalized = text.trim();
  if (!normalized) throw new Error('Enter a value.');
  const pattern = {
    2: /^[01]+$/i,
    8: /^[0-7]+$/i,
    10: /^-?\d+$/i,
    16: /^[0-9a-f]+$/i,
  }[base];
  if (!pattern.test(normalized)) {
    throw new Error(`Value is not valid for base ${base}.`);
  }
  return parseInt(normalized, base);
}

function renderUnitOptions() {
  const category = categories[categorySelect.value];
  fromSelect.innerHTML = '';
  Object.keys(category.units).forEach((unit) => {
    const option = document.createElement('option');
    option.value = unit;
    option.textContent = unit;
    fromSelect.appendChild(option);
  });
}

function renderResults() {
  const categoryKey = categorySelect.value;
  const category = categories[categoryKey];
  const fromUnit = fromSelect.value;
  results.innerHTML = '';
  setStatus(status, '');

  try {
    let values;

    if (categoryKey === 'temperature') {
      const inputValue = parseNumericValue(valueInput.value);
      const celsius = toCelsius(inputValue, fromUnit);
      values = Object.keys(category.units).map((unit) => [unit, fromCelsius(celsius, unit)]);
    } else if (categoryKey === 'base') {
      const base = category.units[fromUnit];
      const decimal = parseIntegerForBase(valueInput.value, base);
      values = Object.entries(category.units).map(([unit, unitBase]) => [unit, decimal.toString(unitBase).toUpperCase()]);
    } else {
      const inputValue = parseNumericValue(valueInput.value);
      const baseValue = inputValue * category.units[fromUnit];
      values = Object.entries(category.units).map(([unit, factor]) => [unit, baseValue / factor]);
    }

    values.forEach(([unit, value]) => {
      const row = document.createElement('div');
      row.className = 'tool-result-row';
      const label = document.createElement('strong');
      label.textContent = unit;
      const result = document.createElement('span');
      result.textContent = typeof value === 'number' ? formatNumber(value) : value;
      row.append(label, result);
      results.appendChild(row);
    });
  } catch (error) {
    setStatus(status, error.message, true);
  }
}

Object.entries(categories).forEach(([key, category]) => {
  const option = document.createElement('option');
  option.value = key;
  option.textContent = category.label;
  categorySelect.appendChild(option);
});

categorySelect.addEventListener('change', () => {
  renderUnitOptions();
  renderResults();
});
fromSelect.addEventListener('change', renderResults);
valueInput.addEventListener('input', renderResults);

renderUnitOptions();
renderResults();
```

- [ ] **Step 3: Run a browser-free smoke check**

Run:

```bash
node tools/check-static-links.mjs
```

Expected: No new missing local target from `work/tools/unit-converter/index.html`.

- [ ] **Step 4: Commit**

Run:

```bash
git add work/tools/unit-converter/index.html work/tools/unit-converter/unit-converter.js
git commit -m "feat: add unit converter"
```

---

## Task 6: Reorganize py_software Without Breaking Public URLs

**Files:**
- Create: `work/py_software/README.md`
- Create: `work/py_software/index.html`
- Move and modify files listed in the File Structure section.

- [ ] **Step 1: Create destination folders**

Run:

```bash
mkdir -p work/py_software/apps/math-solver work/py_software/apps/latex-converter work/py_software/apps/latex-renderer work/py_software/apps/chem-solver work/py_software/src/math-solver work/py_software/src/chem-solver work/py_software/src/physics-engine work/py_software/vendor work/py_software/archive/root-experiments
```

- [ ] **Step 2: Move public app files**

Run:

```bash
git mv work/py_software/function_solver.html work/py_software/apps/math-solver/index.html
git mv work/py_software/function_solver.py work/py_software/apps/math-solver/function_solver.py
git mv work/py_software/latex2sympy.html work/py_software/apps/latex-converter/index.html
git mv work/py_software/latex2py.py work/py_software/apps/latex-converter/latex2py.py
git mv work/py_software/immediate_latex.html work/py_software/apps/latex-renderer/index.html
git mv work/py_software/bin/chem_solver.html work/py_software/apps/chem-solver/index.html
git mv work/py_software/bin/chem_solver.py work/py_software/apps/chem-solver/chem_solver.py
```

- [ ] **Step 3: Move source, experiments, and vendor directories**

Run:

```bash
git mv work/py_software/function_solver_ver_0_build_40.py work/py_software/src/math-solver/function_solver_ver_0_build_40.py
git mv work/py_software/matrix_solve.py work/py_software/src/math-solver/matrix_solve.py
git mv work/py_software/mult_func_solver.py work/py_software/src/math-solver/mult_func_solver.py
git mv work/py_software/mat_playground.py work/py_software/src/math-solver/mat_playground.py
git mv work/py_software/bin/chem_drawer.py work/py_software/src/chem-solver/chem_drawer.py
git mv work/py_software/bin/chem_drawer.txt work/py_software/src/chem-solver/chem_drawer.txt
git mv work/py_software/bin/chem_solver_2.py work/py_software/src/chem-solver/chem_solver_2.py
git mv work/py_software/bin/chem_solver_sympy.py work/py_software/src/chem-solver/chem_solver_sympy.py
git mv work/py_software/physics_engine/pepmpy.py work/py_software/src/physics-engine/pepmpy.py
git mv work/py_software/physics_engine/pepy.py work/py_software/src/physics-engine/pepy.py
git mv work/py_software/physics_engine/playground work/py_software/src/physics-engine/playground
git mv work/py_software/physics_engine/playground.cpp work/py_software/src/physics-engine/playground.cpp
git mv work/py_software/physics_engine/playground.py work/py_software/src/physics-engine/playground.py
git mv work/py_software/physics_engine/pymunk_pg.py work/py_software/src/physics-engine/pymunk_pg.py
git mv work/py_software/whl_pack work/py_software/vendor/whl_pack
git mv work/py_software/pyscript-main work/py_software/vendor/pyscript-main
git mv work/py_software/btn_test.html work/py_software/archive/root-experiments/btn_test.html
git mv work/py_software/click_module.py work/py_software/archive/root-experiments/click_module.py
git mv work/py_software/fs_plugin.html work/py_software/archive/root-experiments/fs_plugin.html
git mv work/py_software/localstorageload_test.html work/py_software/archive/root-experiments/localstorageload_test.html
git mv work/py_software/physic_playground.py work/py_software/archive/root-experiments/physic_playground.py
git mv work/py_software/playground.cpp work/py_software/archive/root-experiments/playground.cpp
git mv work/py_software/playground.py work/py_software/archive/root-experiments/playground.py
git mv work/py_software/sidebar_with_iframe.html work/py_software/archive/root-experiments/sidebar_with_iframe.html
git mv work/py_software/sidebar_with_iframe_in.html work/py_software/archive/root-experiments/sidebar_with_iframe_in.html
```

- [ ] **Step 4: Update moved PyScript relative paths**

Apply these exact replacements:

```text
In work/py_software/apps/math-solver/index.html:
  ./whl_pack/antlr4_python3_runtime-4.7.2-py3-none-any.whl -> ../../vendor/whl_pack/antlr4_python3_runtime-4.7.2-py3-none-any.whl
  ./whl_pack/latex2sympy2-1.9.1-py3-none-any.whl -> ../../vendor/whl_pack/latex2sympy2-1.9.1-py3-none-any.whl

In work/py_software/apps/latex-converter/index.html:
  ./whl_pack/antlr4_python3_runtime-4.7.2-py3-none-any.whl -> ../../vendor/whl_pack/antlr4_python3_runtime-4.7.2-py3-none-any.whl
  ./whl_pack/latex2sympy2-1.9.1-py3-none-any.whl -> ../../vendor/whl_pack/latex2sympy2-1.9.1-py3-none-any.whl

In work/py_software/apps/chem-solver/index.html:
  whl_pack/pyodesys-0.14.2-py2.py3-none-any.whl -> ../../vendor/whl_pack/pyodesys-0.14.2-py2.py3-none-any.whl
  whl_pack/sym-0.3.5-py2.py3-none-any.whl -> ../../vendor/whl_pack/sym-0.3.5-py2.py3-none-any.whl
  whl_pack/pyneqsys-0.5.7-py2.py3-none-any.whl -> ../../vendor/whl_pack/pyneqsys-0.5.7-py2.py3-none-any.whl
  ./function_solver.html -> ../math-solver/
```

- [ ] **Step 5: Recreate root redirect pages**

Create `work/py_software/function_solver.html` with this exact content:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="0; url=apps/math-solver/" />
  <title>Redirecting to Math Solver</title>
</head>
<body>
  <p>Math Solver moved to <a href="apps/math-solver/">apps/math-solver/</a>.</p>
  <script>location.replace('apps/math-solver/' + location.search + location.hash);</script>
</body>
</html>
```

Create `work/py_software/latex2sympy.html` with this exact content:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="0; url=apps/latex-converter/" />
  <title>Redirecting to LaTeX Converter</title>
</head>
<body>
  <p>LaTeX Converter moved to <a href="apps/latex-converter/">apps/latex-converter/</a>.</p>
  <script>location.replace('apps/latex-converter/' + location.search + location.hash);</script>
</body>
</html>
```

Create `work/py_software/immediate_latex.html` with this exact content:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="0; url=apps/latex-renderer/" />
  <title>Redirecting to Real-time LaTeX</title>
</head>
<body>
  <p>Real-time LaTeX moved to <a href="apps/latex-renderer/">apps/latex-renderer/</a>.</p>
  <script>location.replace('apps/latex-renderer/' + location.search + location.hash);</script>
</body>
</html>
```

Create `work/py_software/bin/chem_solver.html` with this exact content:

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="0; url=../apps/chem-solver/" />
  <title>Redirecting to Chem Solver</title>
</head>
<body>
  <p>Chem Solver moved to <a href="../apps/chem-solver/">apps/chem-solver/</a>.</p>
  <script>location.replace('../apps/chem-solver/' + location.search + location.hash);</script>
</body>
</html>
```

- [ ] **Step 6: Create `work/py_software/index.html`**

Create `work/py_software/index.html` with this exact content:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Python Tools</title>
  <link rel="stylesheet" href="../tools/shared/tools.css" />
</head>
<body>
  <main class="tool-shell">
    <nav class="tool-topbar" aria-label="Python tools navigation">
      <a class="tool-back" href="../tools/">Back to Tools Hub</a>
      <a class="tool-back" href="../../index.html#work">Back to Work</a>
    </nav>
    <header>
      <h1 class="tool-title">Python Tools</h1>
      <p class="tool-subtitle">PyScript and Python-backed tools, experiments, and source references.</p>
    </header>
    <section class="tool-grid" aria-label="Python tool list">
      <a class="tool-card" href="./apps/math-solver/"><h2>Math Solver</h2><p>SymPy-powered math workspace.</p><span class="tool-tags"><span class="tool-tag">Math</span></span></a>
      <a class="tool-card" href="./apps/latex-converter/"><h2>LaTeX to SymPy</h2><p>Convert LaTeX expressions into SymPy syntax.</p><span class="tool-tags"><span class="tool-tag">LaTeX</span></span></a>
      <a class="tool-card" href="./apps/latex-renderer/"><h2>Real-time LaTeX</h2><p>Render LaTeX while typing.</p><span class="tool-tags"><span class="tool-tag">MathJax</span></span></a>
      <a class="tool-card" href="./apps/chem-solver/"><h2>Chem Solver</h2><p>Chemistry-related calculation experiments.</p><span class="tool-tags"><span class="tool-tag">Chem</span></span></a>
    </section>
  </main>
</body>
</html>
```

- [ ] **Step 7: Create `work/py_software/README.md`**

Create `work/py_software/README.md` with this exact content:

```markdown
# py_software

This folder contains Python, PyScript, and science-tool experiments for the site.

## Public Apps

- `apps/math-solver/` - Easy Math Solver.
- `apps/latex-converter/` - LaTeX to SymPy converter.
- `apps/latex-renderer/` - Real-time LaTeX renderer.
- `apps/chem-solver/` - chemistry solver experiments.

## Compatibility Redirects

These old URLs remain available:

- `function_solver.html`
- `latex2sympy.html`
- `immediate_latex.html`
- `bin/chem_solver.html`

## Source and Experiments

- `src/` stores Python source and old command-line experiments.
- `playground/` stores browser and Python prototypes.
- `archive/root-experiments/` stores older root-level tests.
- `vendor/` stores local wheels and vendored PyScript files.
```

- [ ] **Step 8: Remove tracked generated cache files inside `py_software`**

Run:

```bash
git rm -f work/py_software/.DS_Store work/py_software/__pycache__/latex2py.cpython-311.pyc work/py_software/physics_engine/.DS_Store work/py_software/physics_engine/__pycache__/pepy.cpython-310.pyc work/py_software/physics_engine/__pycache__/pepy.cpython-311.pyc work/py_software/physics_engine/__pycache__/pepy.cpython-312.pyc work/py_software/vendor/whl_pack/.DS_Store
```

Expected: The command removes only tracked cache/system files under `work/py_software`. If a path has already moved or disappeared, inspect with `git status --short` and remove the corresponding moved tracked path.

- [ ] **Step 9: Run path checks**

Run:

```bash
rg -n "whl_pack|function_solver.html|latex2sympy.html|immediate_latex.html|chem_solver.html" work/py_software
node tools/check-static-links.mjs
```

Expected:

- `whl_pack` references from moved app files point to `../../vendor/whl_pack`.
- Old root redirect pages are the only root `function_solver.html`, `latex2sympy.html`, and `immediate_latex.html` targets.
- The link checker reports no new missing local targets compared with the Task 1 baseline.

- [ ] **Step 10: Commit**

Run:

```bash
git add work/py_software
git commit -m "refactor: organize py software tools"
```

---

## Task 7: Update Main Work Section

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Update Quick Launch inside `article id="work"`**

Replace the current Quick Launch lists with this structure:

```html
<h3 class="major">Quick Launch</h3>
<ul class="actions">
  <li><a href="work/tools/index.html" class="button">Tools Hub</a></li>
  <li><a href="work/py_software/apps/math-solver/" class="button">Math Solver</a></li>
  <li><a href="work/tools/text-toolkit/" class="button">Text Toolkit</a></li>
</ul>
<ul class="actions">
  <li><a href="work/tools/unit-converter/" class="button">Unit Converter</a></li>
  <li><a href="work/filesorter/preview.html" class="button">Filesorter</a></li>
  <li><a href="work/kana_player/main.html" class="button">Kana</a></li>
</ul>
<ul class="actions">
  <li><a href="work/wordmemo/preview.html" class="button">WordMemo</a></li>
  <li><a href="work/zip2pdf/preview.html" class="button">Zip2PDF</a></li>
  <li><a href="/star/index.html" class="button">Star</a></li>
</ul>
```

- [ ] **Step 2: Update work summary paragraphs**

Inside `article id="work"`, keep the existing tone and add these paragraphs near the Math Solver paragraph:

```html
<p>一个工具集合入口, 收录本站比较实用的小工具. <a href="#tools_hub">点击了解</a></p>
<p>一个文本处理工具, 支持 JSON 格式化、去重、排序、编码转换等. <a href="#text_toolkit">点击了解</a></p>
<p>一个单位换算工具, 支持常用单位、温度、数据大小、角度和进制转换. <a href="#unit_converter">点击了解</a></p>
```

- [ ] **Step 3: Update Math Solver detail link**

In `article id="func_solver"`, replace:

```html
<p><a href="work/py_software/function_solver.html">点击进入软件.</a></p>
```

with:

```html
<p><a href="work/py_software/apps/math-solver/">点击进入软件.</a></p>
```

- [ ] **Step 4: Add detail articles for the new hub and tools**

Insert these articles after the Math Solver detail article:

```html
<article id="tools_hub">
  <h2 class="major">Tools Hub</h2>
  <p>一个本站工具集合入口, 可以从这里快速打开数学、文本、文件、学习和小工具页面.</p>
  <p><a href="work/tools/index.html">点击进入软件.</a></p>
</article>

<article id="text_toolkit">
  <h2 class="major">Text Toolkit</h2>
  <p>一个基于 html + css + javascript 的文本处理工具, 支持 JSON 格式化、去重、排序、行号、Base64 和 URL 编码转换.</p>
  <p><a href="work/tools/text-toolkit/">点击进入软件.</a></p>
</article>

<article id="unit_converter">
  <h2 class="major">Unit Converter</h2>
  <p>一个基于 html + css + javascript 的单位换算工具, 支持长度、面积、体积、质量、温度、速度、时间、数据大小、角度和进制转换.</p>
  <p><a href="work/tools/unit-converter/">点击进入软件.</a></p>
</article>
```

- [ ] **Step 5: Run checks**

Run:

```bash
node tools/check-static-links.mjs
rg -n "work/py_software/function_solver.html|work/py_software/latex2sympy.html|work/py_software/immediate_latex.html" index.html
```

Expected:

- Link checker reports no new missing local targets.
- `rg` returns no old `py_software` root links from `index.html`.

- [ ] **Step 6: Commit**

Run:

```bash
git add index.html
git commit -m "feat: surface tools hub on main site"
```

---

## Task 8: Verify Locally

**Files:**
- Verify: `index.html`
- Verify: `work/tools/index.html`
- Verify: `work/tools/text-toolkit/index.html`
- Verify: `work/tools/unit-converter/index.html`
- Verify: `work/py_software/apps/math-solver/index.html`
- Verify: redirect wrapper pages.

- [ ] **Step 1: Start a local server**

Run:

```bash
python3 -m http.server 5174
```

Expected: Server starts at `http://127.0.0.1:5174/`.

- [ ] **Step 2: Check HTTP responses**

Run these in another terminal:

```bash
curl -I http://127.0.0.1:5174/
curl -I http://127.0.0.1:5174/work/tools/
curl -I http://127.0.0.1:5174/work/tools/text-toolkit/
curl -I http://127.0.0.1:5174/work/tools/unit-converter/
curl -I http://127.0.0.1:5174/work/py_software/apps/math-solver/
curl -I http://127.0.0.1:5174/work/py_software/function_solver.html
```

Expected: Each response is `HTTP/1.0 200 OK` or `HTTP/1.1 200 OK`.

- [ ] **Step 3: Browser smoke test**

Open these pages and verify the visible behavior:

```text
http://127.0.0.1:5174/#work
http://127.0.0.1:5174/work/tools/
http://127.0.0.1:5174/work/tools/text-toolkit/
http://127.0.0.1:5174/work/tools/unit-converter/
http://127.0.0.1:5174/work/py_software/function_solver.html
```

Expected:

- `#work` shows Tools Hub, Math Solver, Text Toolkit, and Unit Converter launch buttons.
- Tools Hub filter hides unrelated cards when typing `text`.
- Text Toolkit formats the default JSON into indented JSON.
- Unit Converter converts `1 meter` into centimeter, kilometer, inch, foot, yard, and mile values.
- Old Math Solver URL redirects to the new Math Solver path.

- [ ] **Step 4: Final static checks**

Run:

```bash
node tools/check-static-links.mjs
git status --short
```

Expected:

- Link checker passes or matches the known baseline from Task 1 without new failures.
- `git status --short` shows no uncommitted files from this implementation sequence.

---

## Self-Review

- Spec coverage: The plan creates the Tools Hub, adds Text Toolkit and Unit Converter, reorganizes `py_software`, preserves redirect compatibility, updates main `#work`, and adds verification.
- Placeholder scan: No deferred requirement language is used in implementation steps.
- Type consistency: The shared helper names used by new tools are `setStatus`, `copyText`, `downloadText`, and `installCardFilter`, matching `work/tools/shared/tools.js`.
- Path consistency: New public paths use `work/tools/*` and moved PyScript app paths use `work/py_software/apps/*`; old public app URLs are restored as redirect wrappers.

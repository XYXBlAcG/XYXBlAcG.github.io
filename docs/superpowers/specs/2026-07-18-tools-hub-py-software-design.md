# Tools Hub and py_software Reorganization Design

## Background

The main site currently exposes work items directly inside `index.html`, and the Python-related tools live under `work/py_software`. That folder mixes public app entry files, Python source files, experiments, vendored dependencies, images, cache files, and system files. The most important public entry is `work/py_software/function_solver.html`, which is already linked from the main site's `#work` section.

The chosen direction is option C: create a unified Tools Hub while also doing a medium-risk cleanup of `work/py_software`. The main site should remain recognizable, but the `#work` section can point users toward a more complete tool catalog.

## Goals

- Add a unified `work/tools/index.html` Tools Hub that presents the site's useful tools in one place.
- Keep the main `#work` section simple, with a Tools Hub entry and a few high-value direct launches.
- Reorganize `work/py_software` into clear public apps, source files, vendor files, experiments, and archive areas.
- Preserve existing public URLs with redirect wrapper pages.
- Add useful small tools that are independent from Math Solver:
  - Text Toolkit for text cleanup, transformation, encoding, and JSON formatting.
  - Unit Converter for everyday unit conversion, angle conversion, base conversion, and data size conversion.
- Avoid SEO work.
- Keep the previous main-site font choices.

## Non-Goals

- Do not redesign the full home page.
- Do not rewrite Math Solver internals in this phase.
- Do not introduce a frontend framework or build pipeline.
- Do not remove existing working tools from the site.
- Do not depend on a network connection for the two new lightweight tools.

## Information Architecture

Add a top-level tools area:

```text
work/tools/
  index.html
  shared/
    tools.css
    tools.js
  text-toolkit/
    index.html
    text-toolkit.js
  unit-converter/
    index.html
    unit-converter.js
```

Reorganize `work/py_software`:

```text
work/py_software/
  README.md
  index.html
  function_solver.html
  latex2sympy.html
  immediate_latex.html
  apps/
    math-solver/
      index.html
      function_solver.py
    latex-converter/
      index.html
      latex2py.py
    latex-renderer/
      index.html
    chem-solver/
      index.html
      chem_solver.py
  src/
    math-solver/
      function_solver_ver_0_build_40.py
      matrix_solve.py
      mult_func_solver.py
      mat_playground.py
    chem-solver/
      chem_drawer.py
      chem_drawer.txt
      chem_solver_2.py
      chem_solver_sympy.py
    physics-engine/
      pepmpy.py
      pepy.py
      playground
      playground.cpp
      playground.py
      pymunk_pg.py
  playground/
  vendor/
    pyscript-main/
    whl_pack/
  archive/
    root-experiments/
```

The old root app paths remain as lightweight redirect pages:

- `work/py_software/function_solver.html` redirects to `work/py_software/apps/math-solver/`.
- `work/py_software/latex2sympy.html` redirects to `work/py_software/apps/latex-converter/`.
- `work/py_software/immediate_latex.html` redirects to `work/py_software/apps/latex-renderer/`.
- `work/py_software/bin/chem_solver.html` redirects to `work/py_software/apps/chem-solver/`.

## Tools Hub Experience

The Tools Hub is a dense catalog rather than a landing page. It should open directly to usable navigation:

- Featured: Math Solver, Text Toolkit, Unit Converter.
- Math and Science: Math Solver, LaTeX to SymPy, Real-time LaTeX Renderer, Chem Solver.
- Productivity: Filesorter, Zip2PDF, Text Toolkit.
- Learning: Kana Player, WordMemo.
- Fun and Small Demos: Star and the chemical preview page.

Cards should include short descriptions, tags, and launch links. The page should also include a compact search/filter input so a user can type "text", "math", "latex", "unit", "pdf", or "word" and reduce the visible cards.

## Text Toolkit

Text Toolkit is a pure browser tool. It has one input textarea, one output textarea, stats, and grouped operation buttons.

Supported operations:

- Trim each line.
- Remove empty lines.
- Remove duplicate lines while preserving first occurrence order.
- Sort lines A to Z and Z to A.
- Add line numbers.
- Convert to uppercase, lowercase, and title case.
- Format JSON with two-space indentation.
- Minify JSON.
- Base64 encode and decode.
- URL encode and decode.
- Copy output, swap input/output, and clear.

Error handling is visible in the page and does not use alerts.

## Unit Converter

Unit Converter is a pure browser tool with grouped categories. It converts from one unit to every other unit in the category.

Supported categories:

- Length: mm, cm, m, km, inch, foot, yard, mile.
- Area: square meter, square kilometer, hectare, acre, square foot.
- Volume: milliliter, liter, cubic meter, gallon.
- Mass: milligram, gram, kilogram, tonne, ounce, pound.
- Temperature: Celsius, Fahrenheit, Kelvin.
- Speed: m/s, km/h, mph, knot.
- Time: millisecond, second, minute, hour, day.
- Data: bit, byte, KB, MB, GB, TB using 1024-based byte units.
- Angle: degree, radian.
- Number Base: decimal, binary, octal, hexadecimal.

Invalid numeric input shows an inline error. Temperature and number base use category-specific conversion logic.

## Main Site Changes

Update `index.html` only inside the `#work` article and related work detail articles:

- Add a Tools Hub button to Quick Launch.
- Keep Math Solver as a direct launch.
- Add Text Toolkit and Unit Converter as direct launches.
- Keep existing tools visible, but make the Tools Hub the complete catalog.
- Update the Math Solver detail link to the new app path.
- Add a short Tools Hub detail article if needed.

## Compatibility

Redirect wrappers preserve old URLs and carry `location.search` and `location.hash` into the new location when JavaScript is available. Static meta refresh and normal anchor fallback are included for browsers without JavaScript.

All PyScript app paths must be updated after moving:

- Math Solver package wheels: `../../vendor/whl_pack/...`
- LaTeX converter package wheels: `../../vendor/whl_pack/...`
- Chem Solver package wheels: `../../vendor/whl_pack/...`

## Verification

The implementation should include a small static link checker script that scans local HTML files, resolves same-site links, ignores external URLs, and reports missing local targets. Manual verification should use a local static server and test the main page, Tools Hub, both new tools, the moved Math Solver, and old redirect URLs.

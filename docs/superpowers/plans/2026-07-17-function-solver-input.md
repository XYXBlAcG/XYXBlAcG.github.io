# Function Solver Input System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `work/py_software/function_solver.html` 增加“智能文本输入 + 可视化输入”的混合输入系统，并把主要计算功能迁移到统一解析、计算和输出管线。

**Architecture:** 第一版保留当前静态 HTML + PyScript + SymPy 架构，不引入前端框架。可视化输入面板只负责生成智能输入 DSL 文本，Python 端统一用 `run_solver(raw_input)` 解析、分派、格式化结果，旧模式按钮逐步改成调用同一个入口。

**Tech Stack:** HTML, CSS, 原生 JavaScript, PyScript 2024.6.2, SymPy, MathJax, `latex2sympy2`。

---

## 文件结构

- Modify: `work/py_software/function_solver.html`
  - 新增默认“智能输入”模式。
  - 新增可视化输入面板，包括方程组、矩阵、积分、求和、表达式 tabs。
  - 新增智能输入的模板、预览、可视化生成命令、键盘快捷提交等前端交互。
  - 保留旧模式区域，作为迁移期 fallback。

- Modify: `work/py_software/function_solver.py`
  - 新增 `parse_input(raw_input, mode=None)`、`dispatch_task(task)`、`run_solver(raw_input, mode=None)`。
  - 新增统一结果结构：`ok`、`kind`、`plain`、`latex`、`copyable`、`warnings`。
  - 新增 DOM 输出桥接：`run_smart_solver`、`preview_smart_input`、`set_result_output`。
  - 旧 `runsrc_*` 函数逐步改成构造智能输入命令后调用统一入口。

- Existing spec: `docs/superpowers/specs/2026-07-17-function-solver-input-design.md`
  - 作为需求来源，实施时每个任务完成后对照检查。

---

## Task 1: 新增智能输入 UI 和可视化输入面板骨架

**Files:**
- Modify: `work/py_software/function_solver.html`

- [ ] **Step 1: 在模式选择器中新增默认模式**

把 `#cal-select` 的第一组选项改成：

```html
<select name="cal" id="cal-select">
    <option value="smart_input">智能输入（推荐）</option>
    <option value="func_sol">解单未知数方程</option>
    <option value="mult_func_sol">解多未知数方程</option>
    <option value="chem">化学</option>
    <option value="der">求导</option>
    <option value="matrix">算矩阵</option>
    <option value="simple_sol">化简</option>
    <option value="integrals">积分</option>
    <option value="summation">求和</option>
    <option value="latex_test">Latex输入测试 (beta)</option>
    <option value="develop" disabled>开发中...</option>
</select>
```

- [ ] **Step 2: 在旧 `func_sol` section 前插入智能输入 section**

插入位置：`</header>` 后、`<section id="func_sol"` 前。

```html
<section id="smart_input" class="solver-mode">
    <div class="solver-panel">
        <div class="smart-layout">
            <label class="solver-field-label" for="smart_inputer">智能输入</label>
            <textarea id="smart_inputer" class="smart-textarea" spellcheck="false" placeholder="例如：solve x: x + 1 = 0&#10;solve x y: x + y = 3; x - y = 1&#10;matrix A = [[1, 2], [3, 4]]; calc A.det()"></textarea>
            <div class="solver-actions">
                <button py-click="run_smart_solver">计算</button>
                <button py-click="preview_smart_input">解析预览</button>
                <button type="button" id="smart-template-button">插入模板</button>
                <button type="button" id="visual-toggle-button" aria-expanded="false" aria-controls="visual-builder">可视化输入</button>
                <button py-click="clean_content">清除结果</button>
            </div>
            <div id="parse_preview" class="preview-card">解析预览会显示在这里。</div>
        </div>

        <div id="visual-builder" class="visual-builder hidden" aria-label="可视化输入面板">
            <div class="builder-tabs" role="tablist" aria-label="可视化输入类型">
                <button type="button" class="builder-tab is-active" data-builder-tab="equation">方程组</button>
                <button type="button" class="builder-tab" data-builder-tab="matrix">矩阵</button>
                <button type="button" class="builder-tab" data-builder-tab="integral">积分</button>
                <button type="button" class="builder-tab" data-builder-tab="sum">求和</button>
                <button type="button" class="builder-tab" data-builder-tab="expression">表达式</button>
            </div>

            <div class="builder-pane is-active" data-builder-pane="equation">
                <label class="solver-field-label" for="builder-equation-vars">变量</label>
                <input id="builder-equation-vars" type="text" value="x y" />
                <label class="solver-field-label" for="builder-equations">方程，一行一个</label>
                <textarea id="builder-equations" spellcheck="false">x + y = 3&#10;x - y = 1</textarea>
                <div class="solver-actions">
                    <button type="button" data-build-command="equation">插入到智能输入</button>
                    <button type="button" data-build-command="equation" data-run-after-insert="true">插入并计算</button>
                </div>
            </div>

            <div class="builder-pane hidden" data-builder-pane="matrix">
                <div class="builder-grid builder-grid-3">
                    <label>矩阵名<input id="builder-matrix-name" type="text" value="A" /></label>
                    <label>行数<input id="builder-matrix-rows" type="number" min="1" max="8" value="2" /></label>
                    <label>列数<input id="builder-matrix-cols" type="number" min="1" max="8" value="2" /></label>
                </div>
                <div id="builder-matrix-table" class="matrix-builder" aria-label="矩阵单元格"></div>
                <label class="solver-field-label" for="builder-matrix-expression">矩阵表达式</label>
                <input id="builder-matrix-expression" type="text" value="A.det()" />
                <label class="solver-field-label" for="builder-matrix-paste">快速粘贴矩阵</label>
                <textarea id="builder-matrix-paste" spellcheck="false" placeholder="支持 1 2; 3 4 或 1,2;3,4"></textarea>
                <div class="solver-actions">
                    <button type="button" id="builder-matrix-apply-paste">从粘贴内容填表</button>
                    <button type="button" data-build-command="matrix">插入到智能输入</button>
                    <button type="button" data-build-command="matrix" data-run-after-insert="true">插入并计算</button>
                </div>
            </div>

            <div class="builder-pane hidden" data-builder-pane="integral">
                <div class="builder-grid builder-grid-2">
                    <label>变量<input id="builder-integral-var" type="text" value="x" /></label>
                    <label>类型<select id="builder-integral-type"><option value="indefinite">不定积分</option><option value="definite">定积分</option></select></label>
                    <label>下界<input id="builder-integral-lower" type="text" value="0" /></label>
                    <label>上界<input id="builder-integral-upper" type="text" value="1" /></label>
                </div>
                <label class="solver-field-label" for="builder-integral-expression">被积函数</label>
                <textarea id="builder-integral-expression" spellcheck="false">x**2</textarea>
                <div class="solver-actions">
                    <button type="button" data-build-command="integral">插入到智能输入</button>
                    <button type="button" data-build-command="integral" data-run-after-insert="true">插入并计算</button>
                </div>
            </div>

            <div class="builder-pane hidden" data-builder-pane="sum">
                <div class="builder-grid builder-grid-3">
                    <label>变量<input id="builder-sum-var" type="text" value="n" /></label>
                    <label>下界<input id="builder-sum-lower" type="text" value="1" /></label>
                    <label>上界<input id="builder-sum-upper" type="text" value="10" /></label>
                </div>
                <label class="solver-field-label" for="builder-sum-expression">表达式</label>
                <textarea id="builder-sum-expression" spellcheck="false">n**2</textarea>
                <div class="solver-actions">
                    <button type="button" data-build-command="sum">插入到智能输入</button>
                    <button type="button" data-build-command="sum" data-run-after-insert="true">插入并计算</button>
                </div>
            </div>

            <div class="builder-pane hidden" data-builder-pane="expression">
                <label class="solver-field-label" for="builder-expression-op">操作</label>
                <select id="builder-expression-op">
                    <option value="simplify">化简</option>
                    <option value="expand">展开</option>
                    <option value="factor">因式分解</option>
                    <option value="trigsimp">三角化简</option>
                    <option value="expand_trig">三角展开</option>
                </select>
                <label class="solver-field-label" for="builder-expression-input">表达式</label>
                <textarea id="builder-expression-input" spellcheck="false">x**2 - 1</textarea>
                <div class="solver-actions">
                    <button type="button" data-build-command="expression">插入到智能输入</button>
                    <button type="button" data-build-command="expression" data-run-after-insert="true">插入并计算</button>
                </div>
            </div>
        </div>
    </div>
</section>
```

- [ ] **Step 3: 添加智能输入和可视化面板样式**

把下面 CSS 追加到当前 `<style>` 中 `.solver-hint` 附近，保持和已有视觉系统一致。

```css
.solver-field-label {
    display: block;
    margin: 0 0 0.45rem;
    color: var(--solver-text-muted);
    font-size: 0.78rem;
    letter-spacing: 0.08rem;
    text-transform: uppercase;
}

.smart-layout {
    display: grid;
    gap: 0.9rem;
}

.smart-textarea {
    min-height: 12rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
}

.solver-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
}

.solver-actions button {
    min-height: 2.65rem;
    padding: 0 1rem;
    border-radius: 8px;
}

.preview-card {
    min-height: 3rem;
    padding: 0.9rem 1rem;
    white-space: pre-wrap;
    word-break: break-word;
    background: rgba(0, 0, 0, 0.18);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
}

.visual-builder {
    display: grid;
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--solver-border-soft);
}

.builder-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
}

.builder-tab.is-active {
    color: #061115;
    background: var(--solver-accent);
    border-color: var(--solver-accent);
}

.builder-pane {
    display: grid;
    gap: 0.85rem;
}

.builder-grid {
    display: grid;
    gap: 0.85rem;
}

.builder-grid-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
}

.builder-grid-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
}

.builder-grid label {
    display: grid;
    gap: 0.4rem;
    color: var(--solver-text-muted);
}

.matrix-builder {
    display: grid;
    gap: 0.45rem;
    overflow-x: auto;
}

.matrix-row {
    display: grid;
    gap: 0.45rem;
}

.matrix-cell {
    min-width: 4.5rem;
    text-align: center;
}
```

在当前移动端 media query 里追加：

```css
.builder-grid-2,
.builder-grid-3 {
    grid-template-columns: 1fr;
}

.solver-actions button {
    width: 100%;
}
```

- [ ] **Step 4: 修改默认模式初始化逻辑**

在底部脚本中把默认值设为 `smart_input`：

```js
const savedMode = localStorage.getItem('easy-math-solver-mode');
if (savedMode && contentSelector.querySelector('option[value="' + savedMode + '"]')) {
    contentSelector.value = savedMode;
    showSelectedMode(savedMode);
} else {
    contentSelector.value = 'smart_input';
    showSelectedMode('smart_input');
}
```

- [ ] **Step 5: 验证 HTML 结构未破坏旧模式**

Run:

```bash
tidy -qe --custom-tags yes work/py_software/function_solver.html
```

Expected: 只允许出现 PyScript `py-click` 自定义属性和 iframe vendor fullscreen 相关 warning；不得出现未闭合标签、重复 id、错误嵌套。

- [ ] **Step 6: Commit**

```bash
git add work/py_software/function_solver.html
git commit -m "feat: add smart solver input shell"
```

---

## Task 2: 实现可视化输入的命令生成逻辑

**Files:**
- Modify: `work/py_software/function_solver.html`

- [ ] **Step 1: 在底部脚本中新增智能输入 JS 工具函数**

插入位置：`const savedMode = ...` 逻辑之后，`latex_test_inputer` 监听器之前。

```js
const smartInput = document.getElementById('smart_inputer');
const visualBuilder = document.getElementById('visual-builder');
const visualToggleButton = document.getElementById('visual-toggle-button');

function normalizeBuilderLine(value) {
    return String(value || '').trim();
}

function setSmartInput(command, append) {
    if (!smartInput) return;
    const nextCommand = normalizeBuilderLine(command);
    if (!nextCommand) return;
    if (append && smartInput.value.trim()) {
        smartInput.value = smartInput.value.trim() + '\n' + nextCommand;
    } else {
        smartInput.value = nextCommand;
    }
    smartInput.focus();
}

function clickPyButtonByText(text) {
    const buttons = Array.from(document.querySelectorAll('#smart_input button'));
    const target = buttons.find((button) => button.textContent.trim() === text);
    if (target) target.click();
}
```

- [ ] **Step 2: 实现模板按钮和面板开关**

```js
document.getElementById('smart-template-button')?.addEventListener('click', function () {
    setSmartInput('solve x: x + 1 = 0', false);
});

visualToggleButton?.addEventListener('click', function () {
    const willShow = visualBuilder.classList.contains('hidden');
    visualBuilder.classList.toggle('hidden', !willShow);
    visualToggleButton.setAttribute('aria-expanded', String(willShow));
});
```

- [ ] **Step 3: 实现可视化面板 tab 切换**

```js
document.querySelectorAll('[data-builder-tab]').forEach(function (tabButton) {
    tabButton.addEventListener('click', function () {
        const tabName = tabButton.dataset.builderTab;
        document.querySelectorAll('[data-builder-tab]').forEach(function (button) {
            button.classList.toggle('is-active', button === tabButton);
        });
        document.querySelectorAll('[data-builder-pane]').forEach(function (pane) {
            const isActive = pane.dataset.builderPane === tabName;
            pane.classList.toggle('hidden', !isActive);
            pane.classList.toggle('is-active', isActive);
        });
    });
});
```

- [ ] **Step 4: 实现矩阵表格渲染和粘贴解析**

```js
function renderMatrixGrid() {
    const rowsInput = document.getElementById('builder-matrix-rows');
    const colsInput = document.getElementById('builder-matrix-cols');
    const table = document.getElementById('builder-matrix-table');
    if (!rowsInput || !colsInput || !table) return;

    const rows = Math.max(1, Math.min(8, Number(rowsInput.value) || 1));
    const cols = Math.max(1, Math.min(8, Number(colsInput.value) || 1));
    rowsInput.value = String(rows);
    colsInput.value = String(cols);
    table.innerHTML = '';

    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
        const row = document.createElement('div');
        row.className = 'matrix-row';
        row.style.gridTemplateColumns = `repeat(${cols}, minmax(4.5rem, 1fr))`;
        for (let colIndex = 0; colIndex < cols; colIndex += 1) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'matrix-cell';
            input.value = rowIndex === colIndex ? '1' : '0';
            input.dataset.row = String(rowIndex);
            input.dataset.col = String(colIndex);
            row.appendChild(input);
        }
        table.appendChild(row);
    }
}

function parsePastedMatrix(text) {
    return String(text || '')
        .trim()
        .split(';')
        .map((row) => row.trim().split(/[\s,]+/).filter(Boolean));
}

function fillMatrixGridFromRows(rows) {
    if (!rows.length || !rows[0].length) return;
    document.getElementById('builder-matrix-rows').value = String(rows.length);
    document.getElementById('builder-matrix-cols').value = String(rows[0].length);
    renderMatrixGrid();
    rows.forEach(function (row, rowIndex) {
        row.forEach(function (value, colIndex) {
            const cell = document.querySelector(`.matrix-cell[data-row="${rowIndex}"][data-col="${colIndex}"]`);
            if (cell) cell.value = value;
        });
    });
}

document.getElementById('builder-matrix-rows')?.addEventListener('change', renderMatrixGrid);
document.getElementById('builder-matrix-cols')?.addEventListener('change', renderMatrixGrid);
document.getElementById('builder-matrix-apply-paste')?.addEventListener('click', function () {
    const text = document.getElementById('builder-matrix-paste').value;
    fillMatrixGridFromRows(parsePastedMatrix(text));
});

renderMatrixGrid();
```

- [ ] **Step 5: 实现每个可视化 tab 的 DSL 生成器**

```js
function buildEquationCommand() {
    const vars = normalizeBuilderLine(document.getElementById('builder-equation-vars').value);
    const equations = document.getElementById('builder-equations').value
        .split(/\n+/)
        .map(normalizeBuilderLine)
        .filter(Boolean);
    return `solve ${vars}:\n  ${equations.join('\n  ')}`;
}

function buildMatrixCommand() {
    const name = normalizeBuilderLine(document.getElementById('builder-matrix-name').value) || 'A';
    const expression = normalizeBuilderLine(document.getElementById('builder-matrix-expression').value) || `${name}.det()`;
    const rows = Array.from(document.querySelectorAll('#builder-matrix-table .matrix-row')).map(function (row) {
        return Array.from(row.querySelectorAll('.matrix-cell')).map(function (cell) {
            return normalizeBuilderLine(cell.value) || '0';
        });
    });
    const matrixLiteral = '[' + rows.map((row) => '[' + row.join(', ') + ']').join(', ') + ']';
    return `matrix ${name} = ${matrixLiteral}\ncalc ${expression}`;
}

function buildIntegralCommand() {
    const variable = normalizeBuilderLine(document.getElementById('builder-integral-var').value) || 'x';
    const type = document.getElementById('builder-integral-type').value;
    const expression = normalizeBuilderLine(document.getElementById('builder-integral-expression').value);
    if (type === 'definite') {
        const lower = normalizeBuilderLine(document.getElementById('builder-integral-lower').value) || '0';
        const upper = normalizeBuilderLine(document.getElementById('builder-integral-upper').value) || '1';
        return `integrate ${variable} from ${lower} to ${upper}: ${expression}`;
    }
    return `integrate ${variable}: ${expression}`;
}

function buildSumCommand() {
    const variable = normalizeBuilderLine(document.getElementById('builder-sum-var').value) || 'n';
    const lower = normalizeBuilderLine(document.getElementById('builder-sum-lower').value) || '1';
    const upper = normalizeBuilderLine(document.getElementById('builder-sum-upper').value) || '10';
    const expression = normalizeBuilderLine(document.getElementById('builder-sum-expression').value);
    return `sum ${variable} from ${lower} to ${upper}: ${expression}`;
}

function buildExpressionCommand() {
    const operation = document.getElementById('builder-expression-op').value;
    const expression = normalizeBuilderLine(document.getElementById('builder-expression-input').value);
    return `${operation}: ${expression}`;
}

function buildCommand(kind) {
    const builders = {
        equation: buildEquationCommand,
        matrix: buildMatrixCommand,
        integral: buildIntegralCommand,
        sum: buildSumCommand,
        expression: buildExpressionCommand
    };
    return builders[kind] ? builders[kind]() : '';
}
```

- [ ] **Step 6: 绑定“插入”和“插入并计算”按钮**

```js
document.querySelectorAll('[data-build-command]').forEach(function (button) {
    button.addEventListener('click', function () {
        const command = buildCommand(button.dataset.buildCommand);
        setSmartInput(command, false);
        if (button.dataset.runAfterInsert === 'true') {
            clickPyButtonByText('计算');
        }
    });
});
```

- [ ] **Step 7: 添加键盘效率入口**

```js
smartInput?.addEventListener('keydown', function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        clickPyButtonByText('计算');
    }
});
```

- [ ] **Step 8: 浏览器手动验证可视化生成文本**

Run:

```bash
python3 -m http.server 5176 --bind 127.0.0.1
```

打开 `http://127.0.0.1:5176/work/py_software/function_solver.html`，验证：

- 默认显示“智能输入”。
- 点击“插入模板”得到 `solve x: x + 1 = 0`。
- 方程组面板生成多行 `solve x y:` 命令。
- 矩阵面板默认生成 `matrix A = [[1, 0], [0, 1]]` 和 `calc A.det()`。
- 粘贴 `1 2; 3 4` 后表格变为 2x2，生成 `[[1, 2], [3, 4]]`。
- 移动端 390px 宽度没有横向滚动。

- [ ] **Step 9: Commit**

```bash
git add work/py_software/function_solver.html
git commit -m "feat: add visual command builders"
```

---

## Task 3: 新增 Python 解析器和统一结果结构

**Files:**
- Modify: `work/py_software/function_solver.py`

- [ ] **Step 1: 添加标准库导入**

在文件顶部现有 import 后追加：

```python
import ast
import re
```

- [ ] **Step 2: 新增结果格式函数**

插入位置：`modifier` 函数之后、`helper` 函数之前。

```python
def make_error(kind, message, warning=None):
    return {
        "ok": False,
        "kind": kind,
        "plain": message,
        "latex": "",
        "copyable": message,
        "warnings": [warning] if warning else []
    }


def latex_for_value(value):
    try:
        if isinstance(value, (list, tuple, set)):
            return "$$" + " , ".join([latex(item) for item in value]) + "$$"
        if isinstance(value, dict):
            pairs = []
            for key, item in value.items():
                pairs.append(latex(key) + " = " + latex(item))
            return "$$" + " , ".join(pairs) + "$$"
        return "$$" + latex(value) + "$$"
    except Exception:
        return ""


def make_result(kind, value, warnings=None):
    plain = str(value)
    return {
        "ok": True,
        "kind": kind,
        "plain": plain,
        "latex": latex_for_value(value),
        "copyable": plain,
        "warnings": warnings or []
    }
```

- [ ] **Step 3: 新增解析工具函数**

```python
def split_commands(raw_input):
    commands = []
    current = []
    for line in raw_input.replace(";", "\n").splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if re.match(r"^(solve|diff|integrate|sum|simplify|expand|factor|trigsimp|expand_trig|matrix|calc)\b", stripped):
            if current:
                commands.append("\n".join(current))
                current = []
        current.append(stripped)
    if current:
        commands.append("\n".join(current))
    return commands


def split_header_body(text, command_name):
    prefix = command_name + " "
    if not text.startswith(prefix) and not text.startswith(command_name + ":"):
        raise ValueError("命令格式不正确")
    if ":" not in text:
        raise ValueError("缺少冒号")
    header, body = text.split(":", 1)
    return header.strip(), body.strip()


def parse_equation_text(equation_text):
    if "=" not in equation_text:
        raise ValueError("方程缺少等号")
    left, right = equation_text.split("=", 1)
    return Eq(sympify(left.strip()), sympify(right.strip()))


def parse_matrix_literal(text):
    try:
        data = ast.literal_eval(text)
    except Exception as exc:
        raise ValueError("矩阵必须是 [[1, 2], [3, 4]] 这样的列表格式") from exc
    if not isinstance(data, list) or not data or not all(isinstance(row, list) for row in data):
        raise ValueError("矩阵必须是二维列表")
    row_length = len(data[0])
    if row_length == 0 or any(len(row) != row_length for row in data):
        raise ValueError("矩阵每一行的列数必须一致")
    return [[sympify(item) for item in row] for row in data]
```

- [ ] **Step 4: 新增具体命令解析函数**

```python
def parse_solve(command):
    header, body = split_header_body(command, "solve")
    variables = header.replace("solve", "", 1).strip().split()
    if not variables:
        raise ValueError("solve 命令需要至少一个变量，例如 solve x: x + 1 = 0")
    equations = [line.strip() for line in body.splitlines() if line.strip()]
    if not equations:
        raise ValueError("solve 命令需要至少一个方程")
    return {
        "type": "solve",
        "variables": variables,
        "equations": equations
    }


def parse_diff(command):
    header, body = split_header_body(command, "diff")
    variable = header.replace("diff", "", 1).strip()
    if not variable:
        raise ValueError("diff 命令需要变量，例如 diff x: x**2")
    return {
        "type": "diff",
        "variable": variable,
        "expression": body
    }


def parse_integrate(command):
    header, body = split_header_body(command, "integrate")
    match = re.match(r"integrate\s+(\w+)(?:\s+from\s+(.+?)\s+to\s+(.+))?$", header)
    if not match:
        raise ValueError("integrate 格式应为 integrate x: x**2 或 integrate x from 0 to 1: x**2")
    return {
        "type": "integrate",
        "variable": match.group(1),
        "expression": body,
        "bounds": [match.group(2), match.group(3)] if match.group(2) is not None else None
    }


def parse_sum(command):
    header, body = split_header_body(command, "sum")
    match = re.match(r"sum\s+(\w+)\s+from\s+(.+?)\s+to\s+(.+)$", header)
    if not match:
        raise ValueError("sum 格式应为 sum n from 1 to 10: n**2")
    return {
        "type": "sum",
        "variable": match.group(1),
        "lower": match.group(2),
        "upper": match.group(3),
        "expression": body
    }


def parse_expression(command):
    operation, expression = command.split(":", 1)
    operation = operation.strip()
    if operation not in ["simplify", "expand", "factor", "trigsimp", "expand_trig"]:
        raise ValueError("不支持的表达式操作")
    return {
        "type": "expression",
        "operation": operation,
        "expression": expression.strip()
    }
```

- [ ] **Step 5: 新增矩阵命令和总解析入口**

```python
def parse_matrix_commands(commands):
    matrices = {}
    expression = ""
    for command in commands:
        if command.startswith("matrix "):
            match = re.match(r"matrix\s+([A-Za-z]\w*)\s*=\s*(.+)$", command, re.S)
            if not match:
                raise ValueError("matrix 格式应为 matrix A = [[1, 2], [3, 4]]")
            matrices[match.group(1)] = parse_matrix_literal(match.group(2).strip())
        elif command.startswith("calc "):
            expression = command.replace("calc", "", 1).strip()
    if not matrices:
        raise ValueError("矩阵计算需要至少一个 matrix 定义")
    if not expression:
        raise ValueError("矩阵计算需要 calc 表达式")
    return {
        "type": "matrix",
        "matrices": matrices,
        "expression": expression
    }


def parse_input(raw_input, mode=None):
    text = raw_input.strip()
    if not text:
        raise ValueError("请输入要计算的内容")
    commands = split_commands(text)
    first = commands[0]
    if first.startswith("matrix ") or first.startswith("calc "):
        return parse_matrix_commands(commands)
    if first.startswith("solve "):
        return parse_solve(first)
    if first.startswith("diff "):
        return parse_diff(first)
    if first.startswith("integrate "):
        return parse_integrate(first)
    if first.startswith("sum "):
        return parse_sum(first)
    if any(first.startswith(name + ":") for name in ["simplify", "expand", "factor", "trigsimp", "expand_trig"]):
        return parse_expression(first)
    raise ValueError("无法识别输入。示例：solve x: x + 1 = 0")
```

- [ ] **Step 6: 新增预览格式函数**

```python
def format_task_preview(task):
    lines = ["类型：" + task.get("type", "unknown")]
    if "variables" in task:
        lines.append("变量：" + " ".join(task["variables"]))
    if "variable" in task:
        lines.append("变量：" + task["variable"])
    if "equations" in task:
        lines.append("方程：" + "\n".join(task["equations"]))
    if "expression" in task:
        lines.append("表达式：" + task["expression"])
    if task.get("bounds"):
        lines.append("上下界：" + " 到 ".join(task["bounds"]))
    if task.get("matrices"):
        lines.append("矩阵：" + ", ".join(task["matrices"].keys()))
    return "\n".join(lines)
```

- [ ] **Step 7: 语法检查**

Run:

```bash
python3 -c "import py_compile; py_compile.compile('work/py_software/function_solver.py', cfile='/tmp/function_solver.pyc', doraise=True)"
```

Expected: 无输出，退出码为 0。

- [ ] **Step 8: Commit**

```bash
git add work/py_software/function_solver.py
git commit -m "feat: add solver input parser"
```

---

## Task 4: 实现统一计算分派和智能输入 DOM 桥接

**Files:**
- Modify: `work/py_software/function_solver.py`

- [ ] **Step 1: 添加 Symbol 列表工具函数**

插入到解析函数后：

```python
def symbols_as_list(names):
    parsed = symbols(" ".join(names) if isinstance(names, list) else names)
    if isinstance(parsed, tuple):
        return list(parsed)
    return [parsed]
```

- [ ] **Step 2: 实现 solve/diff/integrate/sum/expression 任务**

```python
def solve_task(task):
    symbol_values = symbols_as_list(task["variables"])
    equations = [parse_equation_text(equation) for equation in task["equations"]]
    if len(symbol_values) == 1 and len(equations) == 1:
        return solve(equations[0], symbol_values[0])
    return solve(equations, symbol_values, dict=True)


def calculus_task(task):
    variable = symbols(task["variable"])
    expression = sympify(task["expression"])
    if task["type"] == "diff":
        return diff(expression, variable)
    if task["type"] == "integrate":
        if task.get("bounds"):
            lower, upper = task["bounds"]
            return integrate(expression, (variable, sympify(lower), sympify(upper)))
        return integrate(expression, variable)
    if task["type"] == "sum":
        return summation(expression, (variable, sympify(task["lower"]), sympify(task["upper"])))
    raise ValueError("不支持的微积分任务")


def expression_task(task):
    expression = sympify(task["expression"])
    operation = task["operation"]
    operations = {
        "simplify": simplify,
        "expand": expand,
        "factor": factor,
        "trigsimp": trigsimp,
        "expand_trig": expand_trig
    }
    return operations[operation](expression)
```

- [ ] **Step 3: 实现矩阵任务**

```python
def matrix_task(task):
    matrix_values = {
        name: Matrix(value)
        for name, value in task["matrices"].items()
    }
    allowed_names = {
        "__builtins__": {},
        "Matrix": Matrix,
        "eye": eye,
        "zeros": zeros,
        "ones": ones
    }
    return eval(task["expression"], allowed_names, matrix_values)
```

- [ ] **Step 4: 实现统一分派和主入口**

```python
def dispatch_task(task):
    task_type = task["type"]
    if task_type == "solve":
        return solve_task(task)
    if task_type in ["diff", "integrate", "sum"]:
        return calculus_task(task)
    if task_type == "expression":
        return expression_task(task)
    if task_type == "matrix":
        return matrix_task(task)
    raise ValueError("不支持的任务类型：" + task_type)


def run_solver(raw_input, mode=None):
    try:
        task = parse_input(raw_input, mode)
        value = dispatch_task(task)
        return make_result(task["type"], value)
    except Exception as exc:
        return make_error("solver_error", str(exc))
```

- [ ] **Step 5: 新增 DOM 输出函数和智能输入按钮函数**

```python
def set_result_output(result):
    output_div = document.querySelector("#output")
    latex_code = document.querySelector("#latexCode")
    latex_div = document.querySelector("#latexDiv")

    output_div.innerText = result["plain"]
    latex_code.innerText = result["latex"]
    if latex_div:
        latex_div.innerText = "点击“显示Latex”查看渲染结果。" if result["latex"] else result["plain"]


def run_smart_solver(content):
    input_text = document.querySelector("#smart_inputer")
    result = run_solver(input_text.value)
    set_result_output(result)


def preview_smart_input(content):
    input_text = document.querySelector("#smart_inputer")
    preview_div = document.querySelector("#parse_preview")
    try:
        task = parse_input(input_text.value)
        preview_div.innerText = format_task_preview(task)
    except Exception as exc:
        preview_div.innerText = "解析失败：" + str(exc)
```

- [ ] **Step 6: 浏览器计算验证**

Run:

```bash
python3 -m http.server 5176 --bind 127.0.0.1
```

打开 `http://127.0.0.1:5176/work/py_software/function_solver.html`，验证这些输入都能计算：

```text
solve x: x + 1 = 0
```

Expected plain result 包含 `[-1]`。

```text
solve x y:
  x + y = 3
  x - y = 1
```

Expected plain result 包含 `{x: 2, y: 1}` 或等价 dict/list 表达。

```text
diff x: x**3
```

Expected plain result: `3*x**2`。

```text
integrate x from 0 to 1: x**2
```

Expected plain result: `1/3`。

```text
sum n from 1 to 10: n
```

Expected plain result: `55`。

```text
factor: x**2 - 1
```

Expected plain result: `(x - 1)*(x + 1)`。

```text
matrix A = [[1, 2], [3, 4]]
calc A.det()
```

Expected plain result: `-2`。

- [ ] **Step 7: Commit**

```bash
git add work/py_software/function_solver.py
git commit -m "feat: add unified solver dispatcher"
```

---

## Task 5: 将旧模式按钮迁移到统一入口

**Files:**
- Modify: `work/py_software/function_solver.py`

- [ ] **Step 1: 新增旧输入转命令的小工具**

插入到 `run_solver` 后：

```python
def run_legacy_command(command):
    result = run_solver(command)
    set_result_output(result)
    return result
```

- [ ] **Step 2: 改造单方程和方程组入口**

替换 `runsrc` 和 `runsrc_mult`：

```python
def runsrc(content):
    input_text = document.querySelector("#inputer")
    run_legacy_command("solve x: " + input_text.value)


def runsrc_mult(content):
    input_var = document.querySelector("#unknown_num")
    input_equ = document.querySelector("#mul_inputer")
    equations = "\n  ".join([item.strip() for item in input_equ.value.replace(",", "\n").splitlines() if item.strip()])
    run_legacy_command("solve " + input_var.value + ":\n  " + equations)
```

- [ ] **Step 3: 改造矩阵入口，并兼容旧格式**

```python
def legacy_matrix_to_command(names_text, matrix_text, expression_text):
    names = names_text.split()
    matrix_inputs = matrix_text.split("#")
    lines = []
    for name, input_data in zip(names, matrix_inputs):
        rows = []
        for row in input_data.split(";"):
            values = [value.strip() for value in row.split(",") if value.strip()]
            rows.append("[" + ", ".join(values) + "]")
        lines.append("matrix " + name + " = [" + ", ".join(rows) + "]")
    lines.append("calc " + expression_text)
    return "\n".join(lines)


def runsrc_mat(content):
    names = document.querySelector("#unknown_mat").value
    matrices = document.querySelector("#mat_inputer").value
    expression = document.querySelector("#mat_cal").value
    run_legacy_command(legacy_matrix_to_command(names, matrices, expression))
```

- [ ] **Step 4: 改造求导、积分、求和入口**

```python
def runsrc_der(content):
    input_a = document.querySelector("#func_inputer")
    run_legacy_command("diff x: " + input_a.value)


def runsrc_inte_ud(content):
    input_var = document.querySelector("#unknown_inte")
    input_domain = document.querySelector("#ud_inte")
    input_equ = document.querySelector("#inte_inputer")
    bounds = [item.strip() for item in input_domain.value.split(",", 1)]
    run_legacy_command("integrate " + input_var.value + " from " + bounds[0] + " to " + bounds[1] + ": " + input_equ.value)


def runsrc_inte(content):
    input_var = document.querySelector("#unknown_inte")
    input_equ = document.querySelector("#inte_inputer")
    run_legacy_command("integrate " + input_var.value + ": " + input_equ.value)


def runsrc_sum(content):
    input_var = document.querySelector("#sum_sub")
    input_equ = document.querySelector("#sum_inputer")
    parts = [item.strip() for item in input_var.value.split(",")]
    run_legacy_command("sum " + parts[0] + " from " + parts[1] + " to " + parts[2] + ": " + input_equ.value)
```

- [ ] **Step 5: 改造化简系列入口**

```python
def runsrc_simplify(content):
    input_equ = document.querySelector("#simple_inputer")
    run_legacy_command("simplify: " + input_equ.value)


def runsrc_factor(content):
    input_equ = document.querySelector("#simple_inputer")
    run_legacy_command("factor: " + input_equ.value)


def runsrc_expand(content):
    input_equ = document.querySelector("#simple_inputer")
    run_legacy_command("expand: " + input_equ.value)


def runsrc_trigsimp(content):
    input_equ = document.querySelector("#simple_inputer")
    run_legacy_command("trigsimp: " + input_equ.value)


def runsrc_expand_trig(content):
    input_equ = document.querySelector("#simple_inputer")
    run_legacy_command("expand_trig: " + input_equ.value)
```

- [ ] **Step 6: 旧模式回归验证**

用浏览器逐个切换旧模式，输入以下旧格式：

- 单方程：`x + 1 = 0`，Expected: `[-1]`。
- 多方程变量：`x y`，方程：`x + y = 3, x - y = 1`，Expected: `x: 2` 和 `y: 1`。
- 矩阵名：`A`，矩阵：`1,2;3,4`，表达式：`A.det()`，Expected: `-2`。
- 求导：`x**3`，Expected: `3*x**2`。
- 定积分变量：`x`，上下界：`0,1`，函数：`x**2`，Expected: `1/3`。
- 化简表达式：`x**2 - 1`，点击因式分解，Expected: `(x - 1)*(x + 1)`。

- [ ] **Step 7: Commit**

```bash
git add work/py_software/function_solver.py
git commit -m "refactor: route legacy solver modes through unified input"
```

---

## Task 6: 输出体验、错误提示和 Latex 渲染收口

**Files:**
- Modify: `work/py_software/function_solver.html`
- Modify: `work/py_software/function_solver.py`

- [ ] **Step 1: 在结果区新增可复制结果**

把结果区改成：

```html
<section class="results-panel" aria-live="polite">
    <h2 class="major">结果</h2>
    <div id="output">请选择一种计算模式并输入内容。</div>
    <div id="latexDiv">Latex 预览会显示在这里。</div>
    <div id="copyable_output" class="copyable-output"></div>
    <div class="solver-actions">
        <button type="button" id="copy-result-button">复制结果</button>
    </div>
    <div id="latexCode"></div>
</section>
```

- [ ] **Step 2: 给可复制区域增加样式**

```css
#copyable_output {
    min-height: 2.75rem;
    padding: 0.8rem 1rem;
    margin-bottom: 0.85rem;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
    color: rgba(255, 255, 255, 0.82);
    background: rgba(255, 255, 255, 0.05);
    border: 1px dashed rgba(255, 255, 255, 0.16);
    border-radius: 8px;
}
```

- [ ] **Step 3: 更新 Python 输出桥接**

替换 `set_result_output`：

```python
def set_result_output(result):
    output_div = document.querySelector("#output")
    latex_code = document.querySelector("#latexCode")
    latex_div = document.querySelector("#latexDiv")
    copyable_div = document.querySelector("#copyable_output")

    output_div.innerText = result["plain"]
    latex_code.innerText = result["latex"]
    if copyable_div:
        copyable_div.innerText = result["copyable"]
    if latex_div:
        if result["latex"]:
            latex_div.innerText = "点击“显示Latex”查看渲染结果。"
        else:
            latex_div.innerText = result["plain"]
```

- [ ] **Step 4: 绑定复制按钮**

在底部 JS 里追加：

```js
document.getElementById('copy-result-button')?.addEventListener('click', async function () {
    const text = document.getElementById('copyable_output')?.textContent || '';
    if (!text.trim()) return;
    await navigator.clipboard.writeText(text);
});
```

- [ ] **Step 5: 验证错误提示**

在智能输入中输入：

```text
solve x x + 1 = 0
```

Expected: 结果区显示“缺少冒号”或“无法识别输入”这类明确错误，不出现空白结果，不在控制台抛未捕获异常。

- [ ] **Step 6: 验证 Latex**

输入：

```text
integrate x from 0 to 1: x**2
```

点击“显示Latex”。

Expected: Latex 区显示 `1/3` 的排版结果，`#latexCode` 内部有 `$$` 包裹文本。

- [ ] **Step 7: Commit**

```bash
git add work/py_software/function_solver.html work/py_software/function_solver.py
git commit -m "feat: improve solver result output"
```

---

## Task 7: 最终浏览器验证和文档回填

**Files:**
- Modify: `docs/superpowers/specs/2026-07-17-function-solver-input-design.md`

- [ ] **Step 1: 运行静态检查**

Run:

```bash
python3 -c "import py_compile; py_compile.compile('work/py_software/function_solver.py', cfile='/tmp/function_solver.pyc', doraise=True)"
tidy -qe --custom-tags yes work/py_software/function_solver.html
```

Expected:

- Python 编译通过。
- Tidy 不出现结构性 HTML error。
- Tidy warning 仅限 PyScript 自定义属性和 iframe vendor fullscreen 属性。

- [ ] **Step 2: 启动本地服务器**

Run:

```bash
python3 -m http.server 5176 --bind 127.0.0.1
```

Expected: 服务器在 `http://127.0.0.1:5176/` 可访问。

- [ ] **Step 3: 桌面端验证**

打开：

```text
http://127.0.0.1:5176/work/py_software/function_solver.html
```

验证清单：

- 页面默认显示智能输入。
- `Ctrl+Enter` 或 `Cmd+Enter` 能触发计算。
- “解析预览”能识别 solve/diff/integrate/sum/matrix/expression。
- 可视化输入五个 tabs 都能生成命令。
- “插入并计算”生成命令后立即输出结果。
- 旧模式仍能计算。
- 浏览器控制台无本地脚本错误。

- [ ] **Step 4: 移动端验证**

在浏览器开发者工具设置 390px 宽度，验证：

- 智能输入 textarea 没有溢出。
- 可视化面板 tabs 可以换行。
- 矩阵表格可以横向滚动，不挤出页面主体。
- 结果区不产生页面级横向滚动。

- [ ] **Step 5: 在规格文档追加实施结果**

在 `docs/superpowers/specs/2026-07-17-function-solver-input-design.md` 末尾追加：

```markdown
## 实施记录

- 已新增智能输入模式，并设置为默认入口。
- 已新增可视化输入面板：方程组、矩阵、积分、求和、表达式。
- 已新增统一 Python 入口 `run_solver(raw_input, mode=None)`。
- 已将主要旧模式按钮迁移到统一入口。
- 已验证桌面端和 390px 移动端布局。
```

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-07-17-function-solver-input-design.md
git commit -m "docs: record function solver input implementation"
```

---

## Self-Review

- Spec coverage:
  - 智能文本输入：Task 1, Task 3, Task 4。
  - 可视化输入：Task 1, Task 2。
  - 解析预览：Task 1, Task 3, Task 4。
  - 统一 Python 入口：Task 3, Task 4。
  - 统一输出：Task 4, Task 6。
  - 旧模式 fallback：Task 5。
  - 移动端和浏览器验证：Task 2, Task 7。

- Placeholder scan:
  - 未发现禁用占位短语。
  - 每个会改代码的步骤都给出了目标位置和具体代码块。

- Type and name consistency:
  - HTML 使用 `smart_inputer`、`parse_preview`、`visual-builder`。
  - Python 使用 `run_smart_solver`、`preview_smart_input`、`run_solver`、`set_result_output`。
  - JS 生成的 DSL 和 Python `parse_input` 支持的命令一致。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-17-function-solver-input.md`. Two execution options:

1. Subagent-Driven (recommended) - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. Inline Execution - execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?

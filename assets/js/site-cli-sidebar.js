import { createExecutor, getCompletions, parseCommand } from '/cli/cli-core.mjs';

const STORAGE_KEY = 'xyx-site-sidebar-cli-history';
const WIDTH_STORAGE_KEY = 'xyx-site-sidebar-cli-width';
const MAX_HISTORY = 60;
const NAVIGATION_DELAY_MS = 150;
const CLOSE_DELAY_MS = 420;
const SIDEBAR_DEFAULT_WIDTH = 456;
const SIDEBAR_MIN_WIDTH = 340;
const SIDEBAR_MAX_WIDTH = 720;
const SIDEBAR_VIEWPORT_GAP = 10;
const SIDEBAR_KEYBOARD_STEP = 24;

const STYLE_ID = 'xyx-site-cli-sidebar-style';
const ROOT_ID = 'xyx-site-cli-sidebar';

const CSS = `
:root {
  --xyx-site-cli-width: min(456px, calc(100vw - 10px));
  --xyx-site-cli-handle: 42px;
  --xyx-site-cli-accent: #7dd3fc;
  --xyx-site-cli-accent-strong: #2dd4bf;
  --xyx-site-cli-bg: rgba(10, 15, 20, 0.94);
  --xyx-site-cli-surface: rgba(255, 255, 255, 0.055);
  --xyx-site-cli-border: rgba(255, 255, 255, 0.16);
  --xyx-site-cli-text: #f8fafc;
  --xyx-site-cli-muted: rgba(248, 250, 252, 0.66);
  --xyx-site-cli-error: #fca5a5;
  --xyx-site-cli-font: Consolas, "SFMono-Regular", "Cascadia Code", "Liberation Mono", Menlo, Monaco, monospace;
}

html.xyx-site-cli-navigating body {
  opacity: 0.72;
  transform: translateX(6px);
  transition: opacity 160ms ease, transform 160ms ease;
}

html.xyx-site-cli-resizing,
html.xyx-site-cli-resizing * {
  cursor: ew-resize !important;
  user-select: none !important;
}

#xyx-site-cli-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 2147483000;
  width: var(--xyx-site-cli-width);
  max-width: calc(100vw - 10px);
  color: var(--xyx-site-cli-text);
  font-family: var(--xyx-site-cli-font);
  transform: translateX(calc(-1 * (var(--xyx-site-cli-width) - var(--xyx-site-cli-handle))));
  transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
  pointer-events: auto;
}

#xyx-site-cli-sidebar:hover,
#xyx-site-cli-sidebar:focus-within,
#xyx-site-cli-sidebar.is-open {
  transform: translateX(0);
}

#xyx-site-cli-sidebar.is-resizing {
  transition: none;
}

#xyx-site-cli-sidebar .xyx-site-cli-panel {
  opacity: 0.28;
  transition: opacity 180ms ease;
}

#xyx-site-cli-sidebar .xyx-site-cli-handle {
  opacity: 0.58;
  transition: opacity 180ms ease;
}

#xyx-site-cli-sidebar:hover .xyx-site-cli-panel,
#xyx-site-cli-sidebar:focus-within .xyx-site-cli-panel,
#xyx-site-cli-sidebar.is-open .xyx-site-cli-panel,
#xyx-site-cli-sidebar:hover .xyx-site-cli-handle,
#xyx-site-cli-sidebar:focus-within .xyx-site-cli-handle,
#xyx-site-cli-sidebar.is-open .xyx-site-cli-handle {
  opacity: 1;
}

#xyx-site-cli-sidebar * {
  box-sizing: border-box;
  letter-spacing: 0;
}

.xyx-site-cli-panel {
  position: absolute;
  inset: 12px var(--xyx-site-cli-handle) 12px 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--xyx-site-cli-border);
  border-left: 0;
  border-radius: 0 12px 12px 0;
  background: var(--xyx-site-cli-bg);
  box-shadow: 1rem 0 3rem rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(14px);
}

.xyx-site-cli-handle {
  position: absolute;
  top: 50%;
  right: 0;
  display: grid;
  place-items: center;
  width: var(--xyx-site-cli-handle);
  min-height: 9.5rem;
  padding: 0.8rem 0.2rem;
  color: #061115;
  background: linear-gradient(180deg, var(--xyx-site-cli-accent), var(--xyx-site-cli-accent-strong));
  border: 0;
  border-radius: 0 12px 12px 0;
  box-shadow: 0.45rem 0 1.4rem rgba(0, 0, 0, 0.28);
  cursor: pointer;
  transform: translateY(-50%);
}

.xyx-site-cli-handle span {
  display: block;
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.xyx-site-cli-resize-grip {
  position: absolute;
  top: 1.3rem;
  right: calc(var(--xyx-site-cli-handle) - 0.35rem);
  bottom: 1.3rem;
  z-index: 10;
  width: 0.7rem;
  padding: 0;
  opacity: 0;
  background: transparent;
  border: 0;
  cursor: ew-resize;
  touch-action: none;
  transition: opacity 160ms ease;
}

#xyx-site-cli-sidebar:hover .xyx-site-cli-resize-grip,
#xyx-site-cli-sidebar:focus-within .xyx-site-cli-resize-grip,
#xyx-site-cli-sidebar.is-open .xyx-site-cli-resize-grip,
#xyx-site-cli-sidebar.is-resizing .xyx-site-cli-resize-grip {
  opacity: 1;
}

.xyx-site-cli-resize-grip::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0.16rem;
  height: min(5.5rem, 34%);
  min-height: 3.6rem;
  border-radius: 99px;
  background: rgba(125, 211, 252, 0.32);
  box-shadow: 0.28rem 0 0 rgba(45, 212, 191, 0.22);
  transform: translate(-50%, -50%);
  transition: background-color 160ms ease, box-shadow 160ms ease;
}

.xyx-site-cli-resize-grip:hover::before,
.xyx-site-cli-resize-grip:focus-visible::before,
#xyx-site-cli-sidebar.is-resizing .xyx-site-cli-resize-grip::before {
  background: rgba(125, 211, 252, 0.82);
  box-shadow: 0.28rem 0 0 rgba(45, 212, 191, 0.62), 0 0 0 0.28rem rgba(125, 211, 252, 0.12);
}

.xyx-site-cli-resize-grip:focus-visible {
  outline: 0;
}

.xyx-site-cli-header,
.xyx-site-cli-footer {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  padding: 0.75rem 0.85rem;
}

.xyx-site-cli-header {
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.xyx-site-cli-brand {
  min-width: 0;
}

.xyx-site-cli-title {
  color: var(--xyx-site-cli-text);
  font-size: 0.86rem;
  font-weight: 700;
}

.xyx-site-cli-path {
  display: block;
  margin-top: 0.15rem;
  overflow: hidden;
  color: var(--xyx-site-cli-muted);
  font-size: 0.7rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.xyx-site-cli-actions {
  display: flex;
  gap: 0.35rem;
}

.xyx-site-cli-icon-button,
.xyx-site-cli-run {
  display: inline-grid;
  place-items: center;
  min-width: 2rem;
  min-height: 2rem;
  color: var(--xyx-site-cli-text);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 7px;
  cursor: pointer;
  font: inherit;
  font-size: 0.75rem;
  transition: background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, color 160ms ease;
}

.xyx-site-cli-icon-button:hover,
.xyx-site-cli-icon-button:focus-visible,
.xyx-site-cli-icon-button.is-active,
.xyx-site-cli-run:hover,
.xyx-site-cli-run:focus-visible {
  background: rgba(125, 211, 252, 0.16);
  border-color: rgba(125, 211, 252, 0.58);
  outline: 0;
}

.xyx-site-cli-icon-button[aria-pressed="true"],
.xyx-site-cli-icon-button[aria-pressed="true"]:hover,
.xyx-site-cli-icon-button[aria-pressed="true"]:focus-visible {
  color: #061115 !important;
  background: linear-gradient(180deg, var(--xyx-site-cli-accent), var(--xyx-site-cli-accent-strong));
  border-color: rgba(125, 211, 252, 0.82);
  box-shadow: 0 0 0 2px rgba(125, 211, 252, 0.16);
}

.xyx-site-cli-icon-button[aria-pressed="true"] .xyx-site-cli-pin-icon path {
  stroke: #061115;
}

.xyx-site-cli-pin-icon {
  display: block;
  width: 1rem;
  height: 1rem;
}

.xyx-site-cli-output {
  min-height: 0;
  padding: 0.85rem;
  overflow: auto;
  color: var(--xyx-site-cli-muted);
  font-size: 0.82rem;
  line-height: 1.55;
  scrollbar-gutter: stable;
  white-space: pre-wrap;
  word-break: break-word;
}

.xyx-site-cli-line {
  margin: 0 0 0.42rem;
}

.xyx-site-cli-line.is-command {
  color: var(--xyx-site-cli-accent);
}

.xyx-site-cli-line.is-error {
  color: var(--xyx-site-cli-error);
}

.xyx-site-cli-line.is-system {
  color: var(--xyx-site-cli-muted);
}

.xyx-site-cli-form {
  position: relative;
  display: grid;
  grid-template-columns: max-content max-content minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.42rem;
  margin: 0 0.75rem 0.65rem;
  padding: 0.45rem;
  background: var(--xyx-site-cli-surface);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9px;
}

.xyx-site-cli-form:focus-within {
  border-color: rgba(125, 211, 252, 0.64);
  box-shadow: 0 0 0 2px rgba(125, 211, 252, 0.14);
}

.xyx-site-cli-prompt {
  color: var(--xyx-site-cli-accent-strong);
}

.xyx-site-cli-symbol {
  color: var(--xyx-site-cli-muted);
}

.xyx-site-cli-input {
  width: 100%;
  min-width: 0;
  height: 2rem;
  color: var(--xyx-site-cli-text);
  background: transparent;
  border: 0;
  outline: 0;
  font: inherit;
  font-size: 0.88rem;
}

.xyx-site-cli-autocomplete {
  position: absolute;
  z-index: 8;
  display: none;
  max-height: 14rem;
  overflow: auto;
  color: var(--xyx-site-cli-text);
  background: rgba(5, 10, 15, 0.98);
  border: 1px solid rgba(125, 211, 252, 0.42);
  border-radius: 8px;
  box-shadow: 0 1rem 2rem rgba(0, 0, 0, 0.38);
}

.xyx-site-cli-autocomplete[data-placement="top"] {
  box-shadow: 0 -1rem 2rem rgba(0, 0, 0, 0.32);
}

.xyx-site-cli-autocomplete.is-open {
  display: block;
}

.xyx-site-cli-completion {
  display: grid;
  grid-template-columns: minmax(5.5rem, max-content) 1fr;
  gap: 0.65rem;
  padding: 0.52rem 0.65rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  cursor: pointer;
}

.xyx-site-cli-completion.is-active {
  color: #061115;
  background: var(--xyx-site-cli-accent);
}

.xyx-site-cli-completion span {
  min-width: 0;
  color: inherit;
  opacity: 0.78;
}

.xyx-site-cli-footer {
  padding-top: 0;
  color: var(--xyx-site-cli-muted);
  font-size: 0.68rem;
  line-height: 1.45;
}

#xyx-site-cli-sidebar[data-theme-strength="bright"] {
  --xyx-site-cli-bg: rgba(17, 24, 31, 0.97);
  --xyx-site-cli-accent: #93c5fd;
  --xyx-site-cli-accent-strong: #5eead4;
}

@media screen and (max-width: 640px) {
  :root {
    --xyx-site-cli-handle: 40px;
  }

  .xyx-site-cli-panel {
    top: 8px;
    bottom: 8px;
  }

  .xyx-site-cli-form {
    grid-template-columns: max-content max-content minmax(0, 1fr);
  }

  .xyx-site-cli-run {
    display: none;
  }

  .xyx-site-cli-completion {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  #xyx-site-cli-sidebar,
  #xyx-site-cli-sidebar .xyx-site-cli-panel,
  #xyx-site-cli-sidebar .xyx-site-cli-handle,
  .xyx-site-cli-resize-grip,
  .xyx-site-cli-resize-grip::before,
  .xyx-site-cli-icon-button,
  .xyx-site-cli-run,
  html.xyx-site-cli-navigating body {
    transition-duration: 0.001ms !important;
  }
}
`;

if (!window.__xyxSiteCliSidebarLoaded && !document.documentElement.dataset.siteCliSidebarOff && !window.XYX_LAN_TRANSFER_AUTH_BLOCKED) {
  window.__xyxSiteCliSidebarLoaded = true;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSidebar, { once: true });
  } else {
    initializeSidebar();
  }
}

function initializeSidebar() {
  if (window.XYX_LAN_TRANSFER_AUTH_BLOCKED) return;
  if (document.getElementById(ROOT_ID) || location.pathname.replace(/\/+$/, '') === '/cli') return;
  injectStyle();

  const state = {
    history: readHistory(),
    historyIndex: 0,
    completions: [],
    completionIndex: 0,
    closeTimer: 0,
    resizeState: null,
    sidebarWidth: readSidebarWidth(),
    pinned: false,
    submitting: false
  };
  state.historyIndex = state.history.length;

  const root = document.createElement('aside');
  root.id = ROOT_ID;
  root.setAttribute('aria-label', '站点 CLI 侧边栏');
  root.innerHTML = `
    <section class="xyx-site-cli-panel" role="dialog" aria-label="站点 CLI">
      <header class="xyx-site-cli-header">
        <div class="xyx-site-cli-brand">
          <div class="xyx-site-cli-title">XYX Site CLI</div>
          <span class="xyx-site-cli-path"></span>
        </div>
        <div class="xyx-site-cli-actions">
          <button class="xyx-site-cli-icon-button" type="button" data-action="pin" aria-label="固定侧边栏" title="固定" aria-pressed="false">
            <svg class="xyx-site-cli-pin-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M14 4l6 6-3 1-4 4v4l-2 2-2-6-6-2 2-2h4l4-4 1-3z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </button>
          <button class="xyx-site-cli-icon-button" type="button" data-action="close" aria-label="隐藏侧边栏" title="隐藏">×</button>
        </div>
      </header>
      <div class="xyx-site-cli-output" role="log" aria-live="polite"></div>
      <form class="xyx-site-cli-form" autocomplete="off">
        <span class="xyx-site-cli-prompt">xyx@site</span>
        <span class="xyx-site-cli-symbol">$</span>
        <input class="xyx-site-cli-input" type="text" spellcheck="false" role="combobox" aria-label="侧边 CLI 输入" aria-controls="xyx-site-cli-autocomplete" aria-expanded="false" aria-autocomplete="list" />
        <button class="xyx-site-cli-run" type="submit">运行</button>
      </form>
      <div id="xyx-site-cli-autocomplete" class="xyx-site-cli-autocomplete" role="listbox" aria-label="侧边 CLI 补全"></div>
      <footer class="xyx-site-cli-footer">输入 help 查看命令；Tab 补全；open work / open tools 快速跳转；Ctrl+K 打开。</footer>
    </section>
    <div class="xyx-site-cli-resize-grip" role="separator" aria-label="调整侧边栏宽度" aria-orientation="vertical" aria-valuemin="340" aria-valuemax="720" aria-valuenow="456" tabindex="0" title="拖动调整宽度"></div>
    <button class="xyx-site-cli-handle" type="button" aria-label="打开站点 CLI" aria-expanded="false"><span>CLI</span></button>
  `;

  document.body.appendChild(root);

  const panel = root.querySelector('.xyx-site-cli-panel');
  const handle = root.querySelector('.xyx-site-cli-handle');
  const output = root.querySelector('.xyx-site-cli-output');
  const form = root.querySelector('.xyx-site-cli-form');
  const input = root.querySelector('.xyx-site-cli-input');
  const autocomplete = root.querySelector('.xyx-site-cli-autocomplete');
  const pathLabel = root.querySelector('.xyx-site-cli-path');
  const pinButton = root.querySelector('[data-action="pin"]');
  const closeButton = root.querySelector('[data-action="close"]');
  const resizeGrip = root.querySelector('.xyx-site-cli-resize-grip');

  const executor = createExecutor({
    navigate: navigateSmooth,
    reload: reloadSmooth,
    copy: copyText,
    runPython() {
      return Promise.resolve({
        ok: false,
        stdout: '',
        stderr: '侧边栏不加载 Python。请输入 open cli 打开全屏 CLI。',
        result: ''
      });
    },
    getCurrentUrl() {
      return window.location.href;
    },
    setTheme() {
      root.dataset.themeStrength = root.dataset.themeStrength === 'bright' ? 'normal' : 'bright';
    },
    getHistory() {
      return state.history.slice(-20);
    }
  });

  function getSidebarWidthBounds() {
    const viewportWidth = Math.max(0, window.innerWidth || document.documentElement.clientWidth || SIDEBAR_DEFAULT_WIDTH);
    const maximumWidth = Math.max(260, Math.min(SIDEBAR_MAX_WIDTH, viewportWidth - SIDEBAR_VIEWPORT_GAP));
    return {
      min: Math.round(Math.min(SIDEBAR_MIN_WIDTH, maximumWidth)),
      max: Math.round(maximumWidth)
    };
  }

  function clampSidebarWidth(width) {
    const bounds = getSidebarWidthBounds();
    const numericWidth = Number.isFinite(width) ? width : SIDEBAR_DEFAULT_WIDTH;
    return Math.round(Math.min(Math.max(numericWidth, bounds.min), bounds.max));
  }

  function updateResizeGripValue(width) {
    const bounds = getSidebarWidthBounds();
    resizeGrip.setAttribute('aria-valuemin', String(bounds.min));
    resizeGrip.setAttribute('aria-valuemax', String(bounds.max));
    resizeGrip.setAttribute('aria-valuenow', String(width));
    resizeGrip.setAttribute('aria-valuetext', `${width}px`);
  }

  function applySidebarWidth(width, options = {}) {
    const nextWidth = clampSidebarWidth(width);
    root.style.setProperty('--xyx-site-cli-width', `${nextWidth}px`);
    updateResizeGripValue(nextWidth);
    if (options.remember) state.sidebarWidth = nextWidth;
    if (options.persist) writeSidebarWidth(nextWidth);
    positionAutocomplete();
    return nextWidth;
  }

  function getRenderedSidebarWidth() {
    return root.getBoundingClientRect().width || clampSidebarWidth(state.sidebarWidth);
  }

  function beginResize(event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    setOpen(true);
    state.resizeState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: getRenderedSidebarWidth(),
      didResize: false
    };
    root.classList.add('is-resizing');
    document.documentElement.classList.add('xyx-site-cli-resizing');
    try {
      resizeGrip.setPointerCapture(event.pointerId);
    } catch {
      // Some older pointer implementations do not expose capture for div nodes.
    }
    window.addEventListener('pointermove', handleResizeMove);
    window.addEventListener('pointerup', endResize);
    window.addEventListener('pointercancel', endResize);
  }

  function handleResizeMove(event) {
    if (!state.resizeState) return;
    const nextWidth = state.resizeState.startWidth + event.clientX - state.resizeState.startX;
    state.resizeState.didResize = true;
    applySidebarWidth(nextWidth, { remember: true });
  }

  function endResize(event) {
    if (!state.resizeState) return;
    const didResize = state.resizeState.didResize;
    try {
      if (event?.pointerId !== undefined && resizeGrip.hasPointerCapture(event.pointerId)) {
        resizeGrip.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore pointer capture cleanup when unsupported.
    }
    state.resizeState = null;
    root.classList.remove('is-resizing');
    document.documentElement.classList.remove('xyx-site-cli-resizing');
    window.removeEventListener('pointermove', handleResizeMove);
    window.removeEventListener('pointerup', endResize);
    window.removeEventListener('pointercancel', endResize);
    if (didResize) applySidebarWidth(state.sidebarWidth, { persist: true });
  }

  function resizeByKeyboard(event) {
    const multiplier = event.shiftKey ? 2 : 1;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setOpen(true);
      applySidebarWidth(getRenderedSidebarWidth() - SIDEBAR_KEYBOARD_STEP * multiplier, { remember: true, persist: true });
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setOpen(true);
      applySidebarWidth(getRenderedSidebarWidth() + SIDEBAR_KEYBOARD_STEP * multiplier, { remember: true, persist: true });
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setOpen(true);
      applySidebarWidth(getSidebarWidthBounds().min, { remember: true, persist: true });
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setOpen(true);
      applySidebarWidth(getSidebarWidthBounds().max, { remember: true, persist: true });
    }
  }

  function setOpen(nextOpen, focusInput = false) {
    window.clearTimeout(state.closeTimer);
    root.classList.toggle('is-open', nextOpen);
    handle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
    if (nextOpen) updatePathLabel();
    if (focusInput) window.setTimeout(() => input.focus(), 30);
  }

  function scheduleClose() {
    window.clearTimeout(state.closeTimer);
    if (state.resizeState || state.pinned || root.matches(':hover') || root.contains(document.activeElement)) return;
    state.closeTimer = window.setTimeout(() => {
      if (!state.resizeState && !state.pinned && !root.matches(':hover') && !root.contains(document.activeElement)) {
        closeAutocomplete();
        setOpen(false);
      }
    }, CLOSE_DELAY_MS);
  }

  function updatePathLabel() {
    pathLabel.textContent = `${location.pathname}${location.hash || ''}`;
  }

  function writeHistory(nextHistory) {
    state.history = nextHistory.slice(-MAX_HISTORY);
    state.historyIndex = state.history.length;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
    } catch (error) {
      console.warn('Site sidebar CLI 历史记录无法写入本地存储。', error);
    }
  }

  function addHistory(command) {
    const trimmed = command.trim();
    if (!trimmed) return;
    writeHistory(state.history.filter((item) => item !== trimmed).concat(trimmed));
  }

  function appendLine(text, className = 'is-system') {
    const line = document.createElement('div');
    line.className = `xyx-site-cli-line ${className}`;
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }

  function renderResult(result, parsed) {
    if (!result) return;
    if (result.type === 'empty' && !result.message) return;
    if (result.type === 'clear') {
      output.innerHTML = '';
      return;
    }

    let message = result.message;
    if (parsed?.name === 'help' && !parsed.rest) {
      message += '\n\n侧边栏命令：open cli 打开全屏 CLI；close 隐藏侧边栏；pin 固定侧边栏。';
    }
    appendLine(message, result.type === 'error' ? 'is-error' : 'is-system');
  }

  function closeAutocomplete() {
    state.completions = [];
    state.completionIndex = 0;
    autocomplete.innerHTML = '';
    autocomplete.classList.remove('is-open');
    autocomplete.removeAttribute('data-placement');
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function acceptCompletion() {
    const completion = state.completions[state.completionIndex];
    if (!completion) return false;
    input.value = completion.insert;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    closeAutocomplete();
    return true;
  }

  function positionAutocomplete() {
    if (!autocomplete.classList.contains('is-open')) return;
    const panelRect = panel.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    const gap = 6;
    const edge = 12;
    const minimumHeight = 96;
    const maximumHeight = 224;
    const left = Math.max(edge, inputRect.left - panelRect.left);
    const availableWidth = Math.max(0, panelRect.width - left - edge);
    const minimumWidth = Math.min(220, Math.max(140, availableWidth));
    const width = Math.min(Math.max(inputRect.width, minimumWidth), availableWidth);
    const availableBelow = panelRect.bottom - inputRect.bottom - edge;
    const availableAbove = inputRect.top - panelRect.top - edge;
    const placeAbove = availableBelow < minimumHeight && availableAbove > availableBelow;
    const availableHeight = Math.max(
      minimumHeight,
      Math.min(maximumHeight, (placeAbove ? availableAbove : availableBelow) - gap)
    );
    const rawTop = placeAbove
      ? inputRect.top - panelRect.top - gap - availableHeight
      : inputRect.bottom - panelRect.top + gap;
    const top = Math.min(
      Math.max(edge, rawTop),
      Math.max(edge, panelRect.height - edge - availableHeight)
    );
    autocomplete.style.left = `${left}px`;
    autocomplete.style.top = `${top}px`;
    autocomplete.style.maxHeight = `${availableHeight}px`;
    autocomplete.style.width = `${width}px`;
    autocomplete.dataset.placement = placeAbove ? 'top' : 'bottom';
  }

  function renderAutocomplete(matches) {
    autocomplete.innerHTML = '';
    matches.forEach((match, index) => {
      const item = document.createElement('div');
      item.className = `xyx-site-cli-completion${index === state.completionIndex ? ' is-active' : ''}`;
      item.id = `xyx-site-cli-completion-${index}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', index === state.completionIndex ? 'true' : 'false');
      item.innerHTML = '<strong></strong><span></span>';
      item.querySelector('strong').textContent = match.value;
      item.querySelector('span').textContent = match.detail;
      item.addEventListener('mousedown', (event) => {
        event.preventDefault();
        state.completionIndex = index;
        acceptCompletion();
      });
      autocomplete.appendChild(item);
    });

    const isOpen = matches.length > 0;
    autocomplete.classList.toggle('is-open', isOpen);
    input.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (isOpen) {
      input.setAttribute('aria-activedescendant', `xyx-site-cli-completion-${state.completionIndex}`);
      window.requestAnimationFrame(positionAutocomplete);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function updateAutocomplete() {
    state.completions = getCompletions(input.value);
    state.completionIndex = Math.min(state.completionIndex, Math.max(state.completions.length - 1, 0));
    renderAutocomplete(state.completions);
  }

  async function submitCommand() {
    if (state.submitting) return;
    const command = input.value.trim();
    closeAutocomplete();
    if (!command) return;
    state.submitting = true;
    appendLine(`$ ${command}`, 'is-command');
    addHistory(command);
    input.value = '';

    try {
      const parsed = parseCommand(command);
      if (parsed.name === 'close' || parsed.name === 'hide') {
        appendLine('已隐藏侧边栏。', 'is-system');
        setOpen(false);
        return;
      }
      if (parsed.name === 'pin') {
        togglePinned();
        appendLine(state.pinned ? '侧边栏已固定。' : '侧边栏已取消固定。', 'is-system');
        return;
      }
      if (parsed.name === 'python' && !parsed.rest) {
        appendLine('正在打开全屏 CLI 以运行 Python。', 'is-system');
        await navigateSmooth('/cli/');
        return;
      }
      if (parsed.name === 'py' || parsed.name === 'python') {
        appendLine('侧边栏不加载 Python。请输入 open cli 打开全屏 CLI。', 'is-error');
        return;
      }

      const result = await executor.run(command);
      renderResult(result, parsed);
    } finally {
      state.submitting = false;
    }
  }

  function togglePinned() {
    state.pinned = !state.pinned;
    root.classList.toggle('is-open', state.pinned);
    pinButton.classList.toggle('is-active', state.pinned);
    pinButton.setAttribute('aria-pressed', state.pinned ? 'true' : 'false');
  }

  root.addEventListener('mouseenter', () => setOpen(true));
  root.addEventListener('mouseleave', scheduleClose);
  root.addEventListener('focusin', () => setOpen(true));
  root.addEventListener('focusout', scheduleClose);
  handle.addEventListener('click', () => setOpen(true, true));
  closeButton.addEventListener('click', () => {
    state.pinned = false;
    pinButton.classList.remove('is-active');
    pinButton.setAttribute('aria-pressed', 'false');
    closeAutocomplete();
    setOpen(false);
  });
  pinButton.addEventListener('click', togglePinned);
  resizeGrip.addEventListener('pointerdown', beginResize);
  resizeGrip.addEventListener('keydown', resizeByKeyboard);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitCommand();
  });

  input.addEventListener('input', updateAutocomplete);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void submitCommand();
      return;
    }
    if (event.key === 'Tab') {
      updateAutocomplete();
      if (state.completions.length) {
        event.preventDefault();
        acceptCompletion();
      }
      return;
    }
    if (state.completions.length && event.key === 'ArrowDown') {
      event.preventDefault();
      state.completionIndex = (state.completionIndex + 1) % state.completions.length;
      renderAutocomplete(state.completions);
      return;
    }
    if (state.completions.length && event.key === 'ArrowUp') {
      event.preventDefault();
      state.completionIndex = (state.completionIndex - 1 + state.completions.length) % state.completions.length;
      renderAutocomplete(state.completions);
      return;
    }
    if (!state.completions.length && event.key === 'ArrowUp') {
      event.preventDefault();
      state.historyIndex = Math.max(0, state.historyIndex - 1);
      input.value = state.history[state.historyIndex] || '';
      return;
    }
    if (!state.completions.length && event.key === 'ArrowDown') {
      event.preventDefault();
      state.historyIndex = Math.min(state.history.length, state.historyIndex + 1);
      input.value = state.history[state.historyIndex] || '';
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAutocomplete();
      if (!state.pinned) setOpen(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      setOpen(true, true);
    }
  });

  window.addEventListener('resize', () => {
    applySidebarWidth(state.sidebarWidth);
  });
  window.addEventListener('hashchange', updatePathLabel);
  window.addEventListener('popstate', updatePathLabel);

  applySidebarWidth(state.sidebarWidth);
  updatePathLabel();
  appendLine('站点 CLI 已就绪。输入 help 查看命令。', 'is-system');
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function readSidebarWidth() {
  try {
    const value = Number(localStorage.getItem(WIDTH_STORAGE_KEY));
    return Number.isFinite(value) ? value : SIDEBAR_DEFAULT_WIDTH;
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

function writeSidebarWidth(width) {
  try {
    localStorage.setItem(WIDTH_STORAGE_KEY, String(Math.round(width)));
  } catch (error) {
    console.warn('Site sidebar CLI 宽度无法写入本地存储。', error);
  }
}

async function copyText(text) {
  if (!navigator.clipboard) return false;
  await navigator.clipboard.writeText(text);
  return true;
}

function normalizePathname(pathname) {
  return pathname.replace(/\/index\.html$/i, '/').replace(/\/+$/, '/') || '/';
}

function urlForPath(path) {
  return new URL(path, window.location.href);
}

async function navigateSmooth(path) {
  const target = urlForPath(path);
  if (target.origin === location.origin && normalizePathname(target.pathname) === normalizePathname(location.pathname)) {
    if (target.hash) {
      const previousHref = location.href;
      location.hash = target.hash;
      if (location.href === previousHref) {
        const event = typeof HashChangeEvent === 'function'
          ? new HashChangeEvent('hashchange', { oldURL: previousHref, newURL: location.href })
          : new Event('hashchange');
        window.dispatchEvent(event);
      }
    } else {
      history.pushState(null, '', target.pathname || '/');
      window.dispatchEvent(new Event('popstate'));
    }
    return;
  }

  document.documentElement.classList.add('xyx-site-cli-navigating');
  window.setTimeout(() => {
    window.location.href = `${target.pathname}${target.search}${target.hash}`;
  }, NAVIGATION_DELAY_MS);
}

async function reloadSmooth() {
  document.documentElement.classList.add('xyx-site-cli-navigating');
  window.setTimeout(() => window.location.reload(), NAVIGATION_DELAY_MS);
}

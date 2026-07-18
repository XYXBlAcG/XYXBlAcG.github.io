import { createExecutor, getCompletions } from './cli-core.mjs';

const STORAGE_KEY = 'xyx-site-cli-history';
const MAX_HISTORY = 80;

const REQUIRED_ELEMENTS = [
  ['screen', '.cli-screen', () => document.querySelector('.cli-screen')],
  ['form', '#cli-form', () => document.getElementById('cli-form')],
  ['input', '#cli-input', () => document.getElementById('cli-input')],
  ['output', '#cli-output', () => document.getElementById('cli-output')],
  ['clock', '#cli-clock', () => document.getElementById('cli-clock')],
  ['pythonStatus', '#cli-python-status', () => document.getElementById('cli-python-status')],
  ['autocomplete', '#cli-autocomplete', () => document.getElementById('cli-autocomplete')]
];

function queryRequiredElements() {
  const entries = REQUIRED_ELEMENTS.map(([name, selector, query]) => ({
    name,
    selector,
    element: query()
  }));
  const missingSelectors = entries
    .filter(({ element }) => !element)
    .map(({ selector }) => selector);

  if (missingSelectors.length) {
    console.error(`Site CLI 初始化失败，缺少必要元素：${missingSelectors.join(', ')}`);
    return null;
  }

  return Object.fromEntries(entries.map(({ name, element }) => [name, element]));
}

function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function getPythonMalformedResult() {
  return { ok: false, stdout: '', stderr: 'Python 运行时返回了无法解析的数据。', result: '' };
}

function getPythonCallFailure() {
  return { ok: false, stdout: '', stderr: 'Python 运行时调用失败。', result: '' };
}

function isPythonBridgeResult(value) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof value.ok === 'boolean'
    && typeof value.stdout === 'string'
    && typeof value.stderr === 'string'
    && typeof value.result === 'string';
}

function initializeCli({
  screen,
  form,
  input,
  output,
  clock,
  pythonStatus,
  autocomplete
}) {
  let history = readHistory();
  let historyIndex = history.length;
  let completionMatches = [];
  let completionIndex = 0;

  function writeHistory(nextHistory) {
    history = nextHistory.slice(-MAX_HISTORY);
    historyIndex = history.length;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.warn('Site CLI 历史记录无法写入本地存储。', error);
    }
  }

  function addHistory(command) {
    const trimmed = command.trim();
    if (!trimmed) return;
    writeHistory(history.filter((item) => item !== trimmed).concat(trimmed));
  }

  function appendLine(text, className = 'is-system') {
    const line = document.createElement('div');
    line.className = `cli-line ${className}`;
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }

  function renderResult(result) {
    if (!result) return;
    if (result.type === 'empty' && !result.message) return;
    if (result.type === 'clear') {
      output.innerHTML = '';
      return;
    }
    appendLine(result.message, result.type === 'error' ? 'is-error' : 'is-system');
  }

  function closeAutocomplete() {
    completionMatches = [];
    completionIndex = 0;
    autocomplete.innerHTML = '';
    autocomplete.classList.remove('is-open');
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function acceptCompletion() {
    const completion = completionMatches[completionIndex];
    if (!completion) return false;
    input.value = completion.insert;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    closeAutocomplete();
    return true;
  }

  function renderAutocomplete(matches) {
    autocomplete.innerHTML = '';
    matches.forEach((match, index) => {
      const item = document.createElement('div');
      item.className = `cli-completion${index === completionIndex ? ' is-active' : ''}`;
      item.id = `cli-completion-${index}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', index === completionIndex ? 'true' : 'false');
      item.innerHTML = '<strong></strong><span></span>';
      item.querySelector('strong').textContent = match.value;
      item.querySelector('span').textContent = match.detail;
      item.addEventListener('mousedown', (event) => {
        event.preventDefault();
        completionIndex = index;
        acceptCompletion();
      });
      autocomplete.appendChild(item);
    });

    const isOpen = matches.length > 0;
    autocomplete.classList.toggle('is-open', isOpen);
    input.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (isOpen) {
      input.setAttribute('aria-activedescendant', `cli-completion-${completionIndex}`);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function updateAutocomplete() {
    completionMatches = getCompletions(input.value);
    completionIndex = Math.min(completionIndex, Math.max(completionMatches.length - 1, 0));
    renderAutocomplete(completionMatches);
  }

  async function copyText(text) {
    if (!navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  }

  async function runPython(code) {
    if (typeof window.siteCliRunPython !== 'function') {
      return { ok: false, stdout: '', stderr: 'Python 运行时尚未加载完成。', result: '' };
    }

    let raw;
    try {
      raw = await window.siteCliRunPython(code);
    } catch (error) {
      console.warn('Site CLI Python bridge call failed.', error);
      return getPythonCallFailure();
    }

    try {
      const result = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return isPythonBridgeResult(result) ? result : getPythonMalformedResult();
    } catch (error) {
      console.warn('Site CLI Python bridge returned malformed data.', error);
      return getPythonMalformedResult();
    }
  }

  const executor = createExecutor({
    async navigate(path) {
      window.location.href = path;
    },
    async reload() {
      window.location.reload();
    },
    copy: copyText,
    runPython,
    getCurrentUrl() {
      return window.location.href;
    },
    async setTheme() {
      const next = screen.dataset.themeStrength === 'bright' ? 'normal' : 'bright';
      screen.dataset.themeStrength = next;
    },
    getHistory() {
      return history.slice(-20);
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const command = input.value.trim();
    closeAutocomplete();
    if (!command) return;
    appendLine(`$ ${command}`, 'is-command');
    addHistory(command);
    input.value = '';
    const result = await executor.run(command);
    renderResult(result);
  });

  input.addEventListener('input', updateAutocomplete);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      updateAutocomplete();
      if (completionMatches.length) {
        event.preventDefault();
        acceptCompletion();
      }
      return;
    }

    if (completionMatches.length && event.key === 'ArrowDown') {
      event.preventDefault();
      completionIndex = (completionIndex + 1) % completionMatches.length;
      renderAutocomplete(completionMatches);
      return;
    }

    if (completionMatches.length && event.key === 'ArrowUp') {
      event.preventDefault();
      completionIndex = (completionIndex - 1 + completionMatches.length) % completionMatches.length;
      renderAutocomplete(completionMatches);
      return;
    }

    if (!completionMatches.length && event.key === 'ArrowUp') {
      event.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex] || '';
      return;
    }

    if (!completionMatches.length && event.key === 'ArrowDown') {
      event.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] || '';
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      output.innerHTML = '';
      closeAutocomplete();
    }

    if (event.key === 'Escape') closeAutocomplete();
  });

  function updateClock() {
    clock.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  }

  function setPythonReady() {
    if (pythonStatus.dataset.state === 'ready') return;
    pythonStatus.textContent = 'Python 就绪';
    pythonStatus.dataset.state = 'ready';
  }

  function setPythonError() {
    if (pythonStatus.dataset.state === 'error') return;
    pythonStatus.textContent = 'Python 不可用';
    pythonStatus.dataset.state = 'error';
  }

  window.addEventListener('site-cli-python-ready', setPythonReady);
  window.addEventListener('site-cli-python-error', setPythonError);

  if (typeof window.siteCliRunPython === 'function') {
    setPythonReady();
  }

  window.setInterval(updateClock, 1000);
  updateClock();
  appendLine('欢迎使用 Site CLI。输入 help 查看命令。', 'is-system');

  window.setTimeout(() => {
    if (typeof window.siteCliRunPython !== 'function') {
      setPythonError();
      window.dispatchEvent(new Event('site-cli-python-error'));
    }
  }, 15000);

  input.focus();
}

const elements = queryRequiredElements();
if (elements) initializeCli(elements);

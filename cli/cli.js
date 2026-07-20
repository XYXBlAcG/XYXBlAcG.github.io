import { createExecutor, getCompletions } from './cli-core.mjs';

const STORAGE_KEY = 'xyx-site-cli-history';
const MAX_HISTORY = 80;

const REQUIRED_ELEMENTS = [
  ['screen', '.cli-screen', () => document.querySelector('.cli-screen')],
  ['terminal', '.cli-terminal', () => document.querySelector('.cli-terminal')],
  ['form', '#cli-form', () => document.getElementById('cli-form')],
  ['input', '#cli-input', () => document.getElementById('cli-input')],
  ['output', '#cli-output', () => document.getElementById('cli-output')],
  ['promptLabel', '#cli-prompt-label', () => document.getElementById('cli-prompt-label')],
  ['promptPath', '#cli-path', () => document.getElementById('cli-path')],
  ['promptSymbol', '#cli-symbol', () => document.getElementById('cli-symbol')],
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
  terminal,
  form,
  input,
  output,
  promptLabel,
  promptPath,
  promptSymbol,
  clock,
  pythonStatus,
  autocomplete
}) {
  let history = readHistory();
  let historyIndex = history.length;
  let completionMatches = [];
  let completionIndex = 0;
  let pythonMode = false;
  let cliMode = 'shell';
  let pythonContinuation = null;
  let isSubmitting = false;

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

  function scrollToPrompt() {
    output.scrollTop = output.scrollHeight;
  }

  function appendLine(text, className = 'is-system') {
    const line = document.createElement('div');
    line.className = `cli-line ${className}`;
    line.textContent = text;
    if (form.parentElement === output) {
      output.insertBefore(line, form);
    } else {
      output.appendChild(line);
    }
    scrollToPrompt();
  }

  function clearOutput() {
    output.querySelectorAll('.cli-line').forEach((line) => line.remove());
    scrollToPrompt();
  }

  function setPromptMode(isPythonMode) {
    cliMode = isPythonMode ? 'python' : 'shell';
    pythonMode = isPythonMode;
    pythonContinuation = null;
    screen.dataset.cliMode = pythonMode ? 'python' : 'shell';
    promptLabel.textContent = pythonMode ? 'python@site' : 'xyx@site';
    promptPath.textContent = pythonMode ? '/python' : '/cli';
    promptSymbol.textContent = pythonMode ? '>>>' : '$';
    input.placeholder = pythonMode
      ? '输入 Python 代码，quit/exit 退出，%reset 清空记忆'
      : '输入 help 查看命令';
    closeAutocomplete();
    positionAutocomplete();
    window.requestAnimationFrame(scrollToPrompt);
  }

  function setPythonContinuationMode(returnMode = pythonMode ? 'python' : 'shell', options = {}) {
    cliMode = 'python-block';
    pythonMode = true;
    pythonContinuation = {
      lines: [],
      returnMode: returnMode === 'python' ? 'python' : 'shell',
      explicit: Boolean(options.explicit),
      requiresBlankLine: Boolean(options.requiresBlankLine)
    };
    screen.dataset.cliMode = 'python-block';
    promptLabel.textContent = 'python@site';
    promptPath.textContent = '/python';
    promptSymbol.textContent = '...';
    input.placeholder = '继续输入 Python；空行或 Ctrl/Command+Enter 执行，Esc 取消';
    closeAutocomplete();
    positionAutocomplete();
    window.requestAnimationFrame(scrollToPrompt);
  }

  function renderResult(result) {
    if (!result) return;
    if (result.type === 'empty' && !result.message) return;
    if (result.type === 'clear') {
      clearOutput();
      return;
    }
    if (result.type === 'python-mode') setPromptMode(true);
    if (result.type === 'python-block-mode') setPythonContinuationMode('shell', { explicit: true });
    appendLine(result.message, result.type === 'error' ? 'is-error' : 'is-system');
  }

  function closeAutocomplete() {
    completionMatches = [];
    completionIndex = 0;
    autocomplete.innerHTML = '';
    autocomplete.classList.remove('is-open');
    autocomplete.removeAttribute('data-placement');
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function getPythonCompletions(value) {
    const token = String(value || '').trim().toLowerCase();
    if (!token) return [];
    return [
      { value: 'exit', detail: '退出 Python 模式' },
      { value: 'quit', detail: '退出 Python 模式' },
      { value: '%reset', detail: '清空 Python 记忆' },
      { value: 'reset', detail: '清空 Python 记忆' },
      { value: '%block', detail: '进入多行 Python 输入' },
      { value: '%%python', detail: '进入多行 Python 输入' }
    ]
      .filter((command) => command.value.startsWith(token) && command.value !== token)
      .map((command) => ({
        type: 'python-control',
        value: command.value,
        insert: command.value,
        detail: command.detail
      }));
  }

  function positionAutocomplete() {
    if (!autocomplete.classList.contains('is-open')) return;

    const terminalRect = terminal.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    const gap = 6;
    const inset = 16;
    const left = Math.max(inset, inputRect.left - terminalRect.left);
    const maxWidth = Math.max(220, terminalRect.width - left - inset);
    const width = Math.min(Math.max(inputRect.width, 220), maxWidth);
    const availableBelow = terminalRect.bottom - inputRect.bottom - inset;
    const availableAbove = inputRect.top - terminalRect.top - inset;
    const placeAbove = availableBelow < 108 && availableAbove > availableBelow;
    const availableHeight = Math.max(96, Math.min(240, (placeAbove ? availableAbove : availableBelow) - gap));
    const rawTop = placeAbove
      ? inputRect.top - terminalRect.top - gap - availableHeight
      : inputRect.bottom - terminalRect.top + gap;
    const top = Math.min(
      Math.max(inset, rawTop),
      Math.max(inset, terminalRect.height - inset - availableHeight)
    );

    autocomplete.style.left = `${left}px`;
    autocomplete.style.top = `${top}px`;
    autocomplete.style.width = `${width}px`;
    autocomplete.style.maxHeight = `${availableHeight}px`;
    autocomplete.dataset.placement = placeAbove ? 'top' : 'bottom';
  }

  function acceptCompletion() {
    const completion = completionMatches[completionIndex];
    if (!completion) return false;
    input.value = completion.insert;
    positionAutocomplete();
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
      window.requestAnimationFrame(positionAutocomplete);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function updateAutocomplete() {
    if (cliMode === 'python-block') {
      closeAutocomplete();
      return;
    }
    completionMatches = pythonMode ? getPythonCompletions(input.value) : getCompletions(input.value);
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

  async function resetPythonSession() {
    if (typeof window.siteCliResetPythonSession !== 'function') {
      return { ok: false, stdout: '', stderr: 'Python 记忆清空功能尚未加载完成。', result: '' };
    }

    let raw;
    try {
      raw = await window.siteCliResetPythonSession();
    } catch (error) {
      console.warn('Site CLI Python reset bridge call failed.', error);
      return getPythonCallFailure();
    }

    try {
      const result = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return isPythonBridgeResult(result) ? result : getPythonMalformedResult();
    } catch (error) {
      console.warn('Site CLI Python reset bridge returned malformed data.', error);
      return getPythonMalformedResult();
    }
  }

  function pythonOutputMessage(result) {
    return [result?.stdout, result?.result, result?.stderr].filter(Boolean).join('\n');
  }

  async function runPythonReplCommand(code) {
    const normalized = code.trim().toLowerCase();
    if (normalized === 'quit' || normalized === 'exit') {
      setPromptMode(false);
      appendLine('已退出 Python 模式。', 'is-system');
      return;
    }

    if (normalized === '%reset' || normalized === 'reset') {
      const result = await resetPythonSession();
      const message = pythonOutputMessage(result);
      appendLine(
        message || 'Python 记忆已清空。',
        result?.ok === false ? 'is-error' : 'is-system'
      );
      return;
    }

    if (normalized === '%block' || normalized === '%multi' || normalized === '%%python') {
      setPythonContinuationMode('python', { explicit: true });
      appendLine('已进入 Python 续行输入。空行或 Ctrl/Command+Enter 执行，Esc 取消。', 'is-system');
      return;
    }

    if (shouldStartPythonContinuation(code)) {
      beginPythonContinuation(code, 'python', { alreadyEchoed: true });
      return;
    }

    try {
      const result = await runPython(code);
      const message = pythonOutputMessage(result);
      appendLine(
        message || 'Python 执行完成。',
        result?.ok === false ? 'is-error' : 'is-system'
      );
    } catch (error) {
      const detail = error?.message || String(error);
      appendLine(detail ? `Python 执行失败：${detail}` : 'Python 执行失败。', 'is-error');
    }
  }

  function appendPythonContinuationLine(line) {
    if (!pythonContinuation) return;
    pythonContinuation.lines.push(line);
    if (isPythonBlockHeader(line)) {
      pythonContinuation.requiresBlankLine = true;
    }
  }

  function beginPythonContinuation(firstLine, returnMode = 'python', options = {}) {
    if (!options.alreadyEchoed) {
      appendLine(`>>> ${firstLine}`, 'is-command');
    }
    setPythonContinuationMode(returnMode, {
      explicit: Boolean(options.explicit),
      requiresBlankLine: isPythonBlockHeader(firstLine)
    });
    if (firstLine) appendPythonContinuationLine(firstLine);
    prepareNextPythonInput(firstLine);
  }

  async function executePythonContinuation(extraLine = '', options = {}) {
    if (!pythonContinuation) return;
    const line = String(extraLine || '').trimEnd();
    if (line || options.echoBlank) {
      appendLine(`... ${line}`, 'is-command');
    }
    if (line) appendPythonContinuationLine(line);

    const code = pythonContinuation.lines.join('\n');
    const returnToPython = pythonContinuation.returnMode === 'python';
    pythonContinuation = null;
    input.value = '';

    if (!code.trim()) {
      setPromptMode(returnToPython);
      appendLine('已取消 Python 续行输入。', 'is-system');
      return;
    }

    try {
      const result = await runPython(code);
      const message = pythonOutputMessage(result);
      setPromptMode(returnToPython);
      addHistory(code);
      appendLine(
        message || 'Python 执行完成。',
        result?.ok === false ? 'is-error' : 'is-system'
      );
    } catch (error) {
      setPromptMode(returnToPython);
      const detail = error?.message || String(error);
      appendLine(detail ? `Python 执行失败：${detail}` : 'Python 执行失败。', 'is-error');
    }
  }

  function formatCommandEcho(command) {
    const lines = String(command || '').split('\n');
    const firstPrompt = promptSymbol.textContent;
    const continuationPrompt = cliMode === 'shell' ? '>' : '...';
    return lines.map((line, index) => `${index === 0 ? firstPrompt : continuationPrompt} ${line}`).join('\n');
  }

  function hasOpenPythonDelimiter(code) {
    const stack = [];
    let quote = '';
    let tripleQuote = '';
    let escaping = false;
    const pairs = { '(': ')', '[': ']', '{': '}' };

    for (let index = 0; index < code.length; index += 1) {
      const char = code[index];
      const nextThree = code.slice(index, index + 3);

      if (tripleQuote) {
        if (nextThree === tripleQuote) {
          tripleQuote = '';
          index += 2;
        }
        continue;
      }

      if (quote) {
        if (escaping) {
          escaping = false;
        } else if (char === '\\') {
          escaping = true;
        } else if (char === quote) {
          quote = '';
        }
        continue;
      }

      if (nextThree === '"""' || nextThree === "'''") {
        tripleQuote = nextThree;
        index += 2;
        continue;
      }

      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }

      if (pairs[char]) {
        stack.push(pairs[char]);
        continue;
      }

      if ((char === ')' || char === ']' || char === '}') && stack[stack.length - 1] === char) {
        stack.pop();
      }
    }

    return stack.length > 0 || Boolean(quote || tripleQuote);
  }

  function isPythonBlockHeader(line) {
    const trimmed = String(line || '').trim();
    if (!trimmed.endsWith(':')) return false;
    return /^(async\s+)?(def|for|with)\b/.test(trimmed)
      || /^(if|elif|else|try|except|finally|while|class|match|case)\b/.test(trimmed);
  }

  function shouldStartPythonContinuation(line) {
    const code = String(line || '').trimEnd();
    if (!code.trim()) return false;
    return isPythonBlockHeader(code) || hasOpenPythonDelimiter(code) || code.endsWith('\\');
  }

  function getNextPythonIndent(line) {
    const currentLine = String(line || '');
    const currentIndent = currentLine.match(/^\s*/)?.[0] || '';
    const trimmedLine = currentLine.trim();
    let nextIndent = currentIndent;
    if (isPythonBlockHeader(trimmedLine)) nextIndent += '    ';
    if (/^(return|pass|break|continue|raise)\b/.test(trimmedLine) && nextIndent.length >= 4) {
      nextIndent = nextIndent.slice(0, -4);
    }
    return nextIndent;
  }

  function prepareNextPythonInput(previousLine) {
    input.value = getNextPythonIndent(previousLine);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    closeAutocomplete();
  }

  async function handlePythonContinuationLine(forceExecute = false) {
    if (!pythonContinuation) return;
    const line = input.value.trimEnd();
    const isBlank = !line.trim();
    input.value = '';
    closeAutocomplete();

    if (isBlank) {
      await executePythonContinuation('', { echoBlank: true });
      return;
    }

    appendLine(`... ${line}`, 'is-command');
    appendPythonContinuationLine(line);

    const code = pythonContinuation.lines.join('\n');
    const shouldAutoRun = !pythonContinuation.requiresBlankLine
      && !pythonContinuation.explicit
      && !shouldStartPythonContinuation(code);
    if (forceExecute || shouldAutoRun) {
      await executePythonContinuation();
      return;
    }

    prepareNextPythonInput(line);
  }

  async function submitPythonContinuationLine(forceExecute = false) {
    if (isSubmitting) return;
    isSubmitting = true;
    try {
      await handlePythonContinuationLine(forceExecute);
    } finally {
      isSubmitting = false;
    }
  }

  function cancelPythonContinuation() {
    if (!pythonContinuation) return;
    const returnToPython = pythonContinuation.returnMode === 'python';
    pythonContinuation = null;
    input.value = '';
    setPromptMode(returnToPython);
    appendLine('已取消 Python 续行输入。', 'is-system');
  }

  function shouldUseHistoryNavigation() {
    return cliMode !== 'python-block';
  }

  const executor = createExecutor({
    async navigate(path) {
      window.location.href = path;
    },
    async open(url) {
      const opened = window.open(url, '_blank');
      if (opened) opened.opener = null;
      return Boolean(opened);
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

  async function submitCommand() {
    if (isSubmitting) return;
    closeAutocomplete();
    isSubmitting = true;

    try {
      if (cliMode === 'python-block') {
        await handlePythonContinuationLine(true);
        return;
      }

      const command = pythonMode ? input.value.trimEnd() : input.value.trim();
      if (!command.trim()) return;
      appendLine(formatCommandEcho(command), 'is-command');
      addHistory(command);
      input.value = '';
      positionAutocomplete();

      if (pythonMode) {
        await runPythonReplCommand(command);
        return;
      }

      const result = await executor.run(command);
      renderResult(result);
    } finally {
      isSubmitting = false;
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitCommand();
  });

  input.addEventListener('input', updateAutocomplete);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        void submitCommand();
        return;
      }
      if (cliMode === 'python-block') {
        void submitPythonContinuationLine(false);
        return;
      }
      void submitCommand();
      return;
    }

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

    if (!completionMatches.length && event.key === 'ArrowUp' && shouldUseHistoryNavigation()) {
      event.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex] || '';
      positionAutocomplete();
      return;
    }

    if (!completionMatches.length && event.key === 'ArrowDown' && shouldUseHistoryNavigation()) {
      event.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] || '';
      positionAutocomplete();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      clearOutput();
      closeAutocomplete();
    }

    if (event.key === 'Escape') {
      if (cliMode === 'python-block') {
        event.preventDefault();
        cancelPythonContinuation();
        return;
      }
      closeAutocomplete();
    }
  });

  window.addEventListener('resize', positionAutocomplete);
  output.addEventListener('scroll', positionAutocomplete);

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
  setPromptMode(false);
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

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

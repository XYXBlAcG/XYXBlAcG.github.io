import { setStatus } from '../shared/tools.js';

const patternInput = document.getElementById('pattern');
const flagsInput = document.getElementById('flags');
const sampleInput = document.getElementById('sample');
const status = document.getElementById('status');
const highlight = document.getElementById('highlight');
const matches = document.getElementById('matches');

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function normalizedFlags() {
  const flags = flagsInput.value.trim();
  if (/[^dgimsuvy]/.test(flags)) {
    throw new Error('标志只能包含 d、g、i、m、s、u、v、y。');
  }
  const unique = Array.from(new Set(flags.split(''))).join('');
  return unique.includes('g') ? unique : `${unique}g`;
}

function render() {
  setStatus(status, '');
  matches.innerHTML = '';
  const text = sampleInput.value;

  try {
    const regex = new RegExp(patternInput.value, normalizedFlags());
    const found = [];
    let html = '';
    let cursor = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      found.push(match);
      html += escapeHtml(text.slice(cursor, match.index));
      html += `<mark class="tool-match">${escapeHtml(match[0])}</mark>`;
      cursor = match.index + match[0].length;
      if (match[0].length === 0) {
        regex.lastIndex += 1;
      }
    }

    html += escapeHtml(text.slice(cursor));
    highlight.innerHTML = html || '<span class="tool-status">没有文本。</span>';

    if (found.length === 0) {
      setStatus(status, '没有匹配结果。');
      return;
    }

    found.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'tool-result-row';
      const label = document.createElement('strong');
      label.textContent = `第 ${index + 1} 个`;
      const value = document.createElement('span');
      value.textContent = item.length > 1
        ? `${item[0]}；捕获组：${item.slice(1).map((group) => group ?? '未匹配').join('，')}`
        : item[0];
      row.append(label, value);
      matches.appendChild(row);
    });
    setStatus(status, `找到 ${found.length} 个匹配。`);
  } catch (error) {
    highlight.textContent = text;
    setStatus(status, error.message, true);
  }
}

[patternInput, flagsInput, sampleInput].forEach((element) => element.addEventListener('input', render));
render();

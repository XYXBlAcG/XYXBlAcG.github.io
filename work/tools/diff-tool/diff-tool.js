import { setStatus } from '../shared/tools.js';

const left = document.getElementById('left');
const right = document.getElementById('right');
const normalizeJson = document.getElementById('normalize-json');
const status = document.getElementById('status');
const summary = document.getElementById('summary');
const diffContainer = document.getElementById('diff');

function normalize(text) {
  if (!normalizeJson.checked) {
    return text;
  }
  return JSON.stringify(JSON.parse(text), null, 2);
}

function splitLines(text) {
  return text.length === 0 ? [] : text.split(/\r?\n/);
}

function lineDiff(a, b) {
  const rows = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      rows[i][j] = a[i] === b[j] ? rows[i + 1][j + 1] + 1 : Math.max(rows[i + 1][j], rows[i][j + 1]);
    }
  }

  const result = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      result.push(['same', a[i]]);
      i += 1;
      j += 1;
    } else if (rows[i + 1][j] >= rows[i][j + 1]) {
      result.push(['remove', a[i]]);
      i += 1;
    } else {
      result.push(['add', b[j]]);
      j += 1;
    }
  }
  while (i < a.length) result.push(['remove', a[i++]]);
  while (j < b.length) result.push(['add', b[j++]]);
  return result;
}

function render() {
  setStatus(status, '');
  diffContainer.innerHTML = '';

  try {
    const leftLines = splitLines(normalize(left.value));
    const rightLines = splitLines(normalize(right.value));
    const diff = lineDiff(leftLines, rightLines);
    const additions = diff.filter(([type]) => type === 'add').length;
    const removals = diff.filter(([type]) => type === 'remove').length;

    diff.forEach(([type, text]) => {
      const line = document.createElement('div');
      line.className = `tool-diff-line ${type}`;
      const marker = document.createElement('span');
      marker.textContent = type === 'add' ? '+' : type === 'remove' ? '-' : ' ';
      const value = document.createElement('span');
      value.textContent = text || ' ';
      line.append(marker, value);
      diffContainer.appendChild(line);
    });

    summary.textContent = `新增 ${additions} 行，删除 ${removals} 行，共 ${diff.length} 行。`;
  } catch (error) {
    summary.textContent = '';
    setStatus(status, `格式化失败：${error.message}`, true);
  }
}

[left, right, normalizeJson].forEach((element) => element.addEventListener('input', render));
normalizeJson.addEventListener('change', render);
render();

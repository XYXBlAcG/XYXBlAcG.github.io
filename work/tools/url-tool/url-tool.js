import { copyText, setStatus } from '../shared/tools.js';

const input = document.getElementById('url-input');
const parts = document.getElementById('parts');
const paramsBody = document.getElementById('params');
const generated = document.getElementById('generated-url');
const status = document.getElementById('status');

let currentUrl;

function row(label, value) {
  const element = document.createElement('div');
  element.className = 'tool-result-row';
  const strong = document.createElement('strong');
  strong.textContent = label;
  const span = document.createElement('span');
  span.textContent = value || '无';
  element.append(strong, span);
  parts.appendChild(element);
}

function parseUrl() {
  const raw = input.value.trim();
  if (!raw) {
    throw new Error('请输入链接。');
  }
  return new URL(raw, window.location.href);
}

function renderParts(url) {
  parts.innerHTML = '';
  row('协议', url.protocol);
  row('主机', url.host);
  row('路径', url.pathname);
  row('查询文本', url.search || '无');
  row('片段', url.hash || '无');
}

function renderParams(url) {
  paramsBody.innerHTML = '';
  const entries = Array.from(url.searchParams.entries());
  if (entries.length === 0) {
    entries.push(['', '']);
  }

  entries.forEach(([key, value]) => {
    const tr = document.createElement('tr');
    const keyCell = document.createElement('td');
    const valueCell = document.createElement('td');
    const actionCell = document.createElement('td');
    const keyInput = document.createElement('input');
    const valueInput = document.createElement('input');
    const removeButton = document.createElement('button');

    keyInput.className = 'tool-input';
    valueInput.className = 'tool-input';
    keyInput.value = key;
    valueInput.value = value;
    removeButton.className = 'tool-button';
    removeButton.textContent = '删除';

    keyInput.addEventListener('input', rebuildUrl);
    valueInput.addEventListener('input', rebuildUrl);
    removeButton.addEventListener('click', () => {
      tr.remove();
      rebuildUrl();
    });

    keyCell.appendChild(keyInput);
    valueCell.appendChild(valueInput);
    actionCell.appendChild(removeButton);
    tr.append(keyCell, valueCell, actionCell);
    paramsBody.appendChild(tr);
  });
}

function rebuildUrl() {
  if (!currentUrl) return;
  currentUrl.search = '';
  Array.from(paramsBody.querySelectorAll('tr')).forEach((tr) => {
    const [keyInput, valueInput] = tr.querySelectorAll('input');
    const key = keyInput.value.trim();
    if (key) {
      currentUrl.searchParams.append(key, valueInput.value);
    }
  });
  generated.value = currentUrl.href;
  renderParts(currentUrl);
}

function render() {
  setStatus(status, '');
  try {
    currentUrl = parseUrl();
    renderParts(currentUrl);
    renderParams(currentUrl);
    generated.value = currentUrl.href;
    setStatus(status, '已解析。');
  } catch (error) {
    currentUrl = null;
    parts.innerHTML = '';
    paramsBody.innerHTML = '';
    generated.value = '';
    setStatus(status, error.message, true);
  }
}

document.getElementById('add-param').addEventListener('click', () => {
  if (!currentUrl) return;
  const tr = document.createElement('tr');
  tr.innerHTML = '<td><input class="tool-input" value="new"></td><td><input class="tool-input" value=""></td><td><button class="tool-button">删除</button></td>';
  const [keyInput, valueInput] = tr.querySelectorAll('input');
  const button = tr.querySelector('button');
  keyInput.addEventListener('input', rebuildUrl);
  valueInput.addEventListener('input', rebuildUrl);
  button.addEventListener('click', () => {
    tr.remove();
    rebuildUrl();
  });
  paramsBody.appendChild(tr);
  rebuildUrl();
});

document.getElementById('copy-url').addEventListener('click', () => copyText(generated.value, status));
input.addEventListener('input', render);
render();

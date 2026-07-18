import { copyText, setStatus } from '../shared/tools.js';

const source = document.getElementById('time-source');
const unitSelect = document.getElementById('time-unit');
const zoneSelect = document.getElementById('time-zone');
const results = document.getElementById('results');
const status = document.getElementById('status');

function formatDate(date, timeZone) {
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };

  if (timeZone !== 'local') {
    options.timeZone = timeZone;
  }

  return new Intl.DateTimeFormat('zh-CN', options).format(date);
}

function parseDate() {
  const raw = source.value.trim();
  if (!raw) {
    throw new Error('请输入时间戳或时间文本。');
  }

  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    const numeric = Number(raw);
    const milliseconds = unitSelect.value === 'seconds' ? numeric * 1000 : numeric;
    const date = new Date(milliseconds);
    if (Number.isNaN(date.getTime())) {
      throw new Error('时间戳超出可解析范围。');
    }
    return date;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('无法解析这个时间文本。');
  }
  return parsed;
}

function renderRow(label, value) {
  const row = document.createElement('div');
  row.className = 'tool-result-row';
  const strong = document.createElement('strong');
  strong.textContent = label;
  const span = document.createElement('span');
  span.textContent = value;
  row.append(strong, span);
  results.appendChild(row);
}

function render() {
  results.innerHTML = '';
  setStatus(status, '');

  try {
    const date = parseDate();
    const timestamp = date.getTime();
    const diff = timestamp - Date.now();
    const diffMinutes = Math.round(diff / 60000);
    const selectedZone = zoneSelect.value;

    renderRow('秒级时间戳', Math.floor(timestamp / 1000).toString());
    renderRow('毫秒级时间戳', timestamp.toString());
    renderRow('标准时间文本', date.toISOString());
    renderRow('浏览器本地时间', formatDate(date, 'local'));
    renderRow('协调世界时', formatDate(date, 'UTC'));
    renderRow('重点时区时间', formatDate(date, selectedZone));
    renderRow('相对现在', diffMinutes === 0 ? '接近当前时间' : `${Math.abs(diffMinutes)} 分钟${diffMinutes > 0 ? '后' : '前'}`);
    setStatus(status, '已更新。');
  } catch (error) {
    setStatus(status, error.message, true);
  }
}

document.getElementById('use-now').addEventListener('click', () => {
  source.value = Math.floor(Date.now() / 1000).toString();
  unitSelect.value = 'seconds';
  render();
});

document.getElementById('copy-iso').addEventListener('click', () => {
  try {
    copyText(parseDate().toISOString(), status);
  } catch (error) {
    setStatus(status, error.message, true);
  }
});

source.addEventListener('input', render);
unitSelect.addEventListener('change', render);
zoneSelect.addEventListener('change', render);

source.value = Math.floor(Date.now() / 1000).toString();
render();

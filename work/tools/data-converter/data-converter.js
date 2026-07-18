import { copyText, setStatus } from '../shared/tools.js';

const input = document.getElementById('input');
const output = document.getElementById('output');
const status = document.getElementById('status');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  row.push(field);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

function escapeCsv(value) {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function jsonToCsv(text) {
  const parsed = JSON.parse(text);
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const headers = Array.from(rows.reduce((set, item) => {
    Object.keys(item || {}).forEach((key) => set.add(key));
    return set;
  }, new Set()));
  return [
    headers.map(escapeCsv).join(','),
    ...rows.map((item) => headers.map((key) => escapeCsv(item?.[key])).join(',')),
  ].join('\n');
}

function csvToJson(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return '[]';
  }
  const headers = rows[0];
  const values = rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
  return JSON.stringify(values, null, 2);
}

function run(action) {
  setStatus(status, '');
  try {
    const actions = {
      'format-json': () => JSON.stringify(JSON.parse(input.value), null, 2),
      'minify-json': () => JSON.stringify(JSON.parse(input.value)),
      'json-to-csv': () => jsonToCsv(input.value),
      'csv-to-json': () => csvToJson(input.value),
    };
    output.value = actions[action]();
    setStatus(status, '已转换。');
  } catch (error) {
    output.value = '';
    setStatus(status, `转换失败：${error.message}`, true);
  }
}

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => run(button.dataset.action));
});
document.getElementById('copy-output').addEventListener('click', () => copyText(output.value, status));
run('format-json');

import { copyText, setStatus } from '../shared/tools.js';

const textInput = document.getElementById('text-input');
const fileInput = document.getElementById('file-input');
const results = document.getElementById('results');
const status = document.getElementById('status');

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function rotateLeft(value, amount) {
  return ((value << amount) | (value >>> (32 - amount))) >>> 0;
}

function md5(buffer) {
  const input = new Uint8Array(buffer);
  const bitLength = BigInt(input.length) * 8n;
  const paddedLength = (((input.length + 9 + 63) >> 6) << 6);
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Number(bitLength & 0xffffffffn), true);
  view.setUint32(paddedLength - 4, Number((bitLength >> 32n) & 0xffffffffn), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const shifts = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const constants = Array.from({ length: 64 }, (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 2 ** 32) >>> 0);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    const words = Array.from({ length: 16 }, (_, index) => view.getUint32(offset + index * 4, true));
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let index = 0; index < 64; index += 1) {
      let f;
      let g;
      if (index < 16) {
        f = (b & c) | (~b & d);
        g = index;
      } else if (index < 32) {
        f = (d & b) | (~d & c);
        g = (5 * index + 1) % 16;
      } else if (index < 48) {
        f = b ^ c ^ d;
        g = (3 * index + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * index) % 16;
      }
      const temp = d;
      d = c;
      c = b;
      b = (b + rotateLeft((a + f + constants[index] + words[g]) >>> 0, shifts[index])) >>> 0;
      a = temp;
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  return [a0, b0, c0, d0].map((word) => {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, word, true);
    return bufferToHex(bytes.buffer);
  }).join('');
}

function renderRow(label, value) {
  const row = document.createElement('div');
  row.className = 'tool-result-row';
  const strong = document.createElement('strong');
  strong.textContent = label;
  const span = document.createElement('span');
  span.className = 'tool-code';
  span.textContent = value;
  row.append(strong, span);
  results.appendChild(row);
}

async function getBuffer() {
  if (fileInput.files.length > 0) {
    return fileInput.files[0].arrayBuffer();
  }
  return new TextEncoder().encode(textInput.value).buffer;
}

async function compute() {
  setStatus(status, '');
  results.innerHTML = '';
  try {
    const buffer = await getBuffer();
    renderRow('文件或文本大小', `${buffer.byteLength} 字节`);
    renderRow('MD5', md5(buffer));
    for (const algorithm of ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']) {
      renderRow(algorithm, bufferToHex(await crypto.subtle.digest(algorithm, buffer.slice(0))));
    }
    setStatus(status, fileInput.files.length > 0 ? `已计算文件：${fileInput.files[0].name}` : '已计算文本。');
  } catch (error) {
    setStatus(status, `计算失败：${error.message}`, true);
  }
}

document.getElementById('clear-file').addEventListener('click', () => {
  fileInput.value = '';
  compute();
});
document.getElementById('copy-results').addEventListener('click', () => {
  const text = Array.from(results.querySelectorAll('.tool-result-row'))
    .map((row) => `${row.querySelector('strong').textContent}: ${row.querySelector('span').textContent}`)
    .join('\n');
  copyText(text, status);
});
textInput.addEventListener('input', compute);
fileInput.addEventListener('change', compute);
compute();

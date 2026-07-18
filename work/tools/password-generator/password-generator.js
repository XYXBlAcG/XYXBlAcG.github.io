import { copyText, setStatus } from '../shared/tools.js';

const mode = document.getElementById('mode');
const lengthInput = document.getElementById('length');
const lengthValue = document.getElementById('length-value');
const result = document.getElementById('result');
const status = document.getElementById('status');
const strength = document.getElementById('strength');

const groups = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/|~',
};

const words = ['山川', '星火', '清风', '松影', '晨光', '远航', '竹林', '云层', '海盐', '月色', '青石', '夏雨', '冬雪', '南桥', '北岸', '书页'];

function randomIndex(max) {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

function randomFrom(text) {
  return text[randomIndex(text.length)];
}

function selectedPool() {
  return Object.entries(groups)
    .filter(([key]) => document.getElementById(key).checked)
    .map(([, chars]) => chars)
    .join('');
}

function generatePassword() {
  const pool = selectedPool();
  if (!pool) {
    throw new Error('请至少选择一种字符。');
  }

  let value = '';
  for (let index = 0; index < Number(lengthInput.value); index += 1) {
    value += randomFrom(pool);
  }

  const entropy = Math.log2(pool.length) * Number(lengthInput.value);
  strength.textContent = `估算强度：约 ${Math.round(entropy)} 位熵。`;
  return value;
}

function generatePhrase() {
  const count = Math.max(3, Math.round(Number(lengthInput.value) / 6));
  const value = Array.from({ length: count }, () => words[randomIndex(words.length)]).join('-');
  const entropy = Math.log2(words.length) * count;
  strength.textContent = `估算强度：约 ${Math.round(entropy)} 位熵。`;
  return value;
}

function updateLengthLabel() {
  if (mode.value === 'phrase') {
    lengthValue.textContent = `${Math.max(3, Math.round(Number(lengthInput.value) / 6))} 个词`;
  } else {
    lengthValue.textContent = `${lengthInput.value} 位`;
  }
}

function generate() {
  setStatus(status, '');
  try {
    result.value = mode.value === 'phrase' ? generatePhrase() : generatePassword();
    setStatus(status, '已生成。');
  } catch (error) {
    result.value = '';
    strength.textContent = '';
    setStatus(status, error.message, true);
  }
}

document.getElementById('generate').addEventListener('click', generate);
document.getElementById('copy').addEventListener('click', () => copyText(result.value, status));
mode.addEventListener('change', () => {
  updateLengthLabel();
  generate();
});
lengthInput.addEventListener('input', () => {
  updateLengthLabel();
  generate();
});
document.querySelectorAll('input[type="checkbox"]').forEach((input) => input.addEventListener('change', generate));

updateLengthLabel();
generate();

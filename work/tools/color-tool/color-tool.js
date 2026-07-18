import { setStatus } from '../shared/tools.js';

const colorText = document.getElementById('color-text');
const colorPicker = document.getElementById('color-picker');
const foreground = document.getElementById('foreground');
const background = document.getElementById('background');
const swatch = document.getElementById('swatch');
const demo = document.getElementById('contrast-demo');
const results = document.getElementById('results');
const status = document.getElementById('status');

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
  const normalized = hex.trim().replace(/^#/, '');
  const full = normalized.length === 3 ? normalized.split('').map((char) => char + char).join('') : normalized;
  if (!/^[0-9a-f]{6}$/i.test(full)) {
    throw new Error('请输入有效的十六进制颜色，例如 #72d2c8。');
  }
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => clamp(value, 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl({ r, g, b }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
    if (max === green) hue = (blue - red) / delta + 2;
    if (max === blue) hue = (red - green) / delta + 4;
    hue *= 60;
  }

  return {
    h: Math.round(hue),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  };
}

function luminance({ r, g, b }) {
  return [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrastRatio(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function row(label, value) {
  const element = document.createElement('div');
  element.className = 'tool-result-row';
  const strong = document.createElement('strong');
  strong.textContent = label;
  const span = document.createElement('span');
  span.textContent = value;
  element.append(strong, span);
  results.appendChild(element);
}

function render() {
  results.innerHTML = '';
  setStatus(status, '');
  try {
    const rgb = hexToRgb(colorText.value);
    const hex = rgbToHex(rgb);
    const hsl = rgbToHsl(rgb);
    colorPicker.value = hex;
    swatch.style.background = hex;
    row('十六进制', hex);
    row('红绿蓝', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    row('色相饱和亮度', `${hsl.h}°, ${hsl.s}%, ${hsl.l}%`);

    const fg = hexToRgb(foreground.value);
    const bg = hexToRgb(background.value);
    const ratio = contrastRatio(fg, bg);
    demo.style.color = foreground.value;
    demo.style.background = background.value;
    row('对比度', `${ratio.toFixed(2)}:1`);
    row('正文标准', ratio >= 4.5 ? '通过' : '不足');
    row('大号文字标准', ratio >= 3 ? '通过' : '不足');
  } catch (error) {
    setStatus(status, error.message, true);
  }
}

colorText.addEventListener('input', render);
colorPicker.addEventListener('input', () => {
  colorText.value = colorPicker.value;
  render();
});
foreground.addEventListener('input', render);
background.addEventListener('input', render);
render();

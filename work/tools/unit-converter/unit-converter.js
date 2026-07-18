import { setStatus } from '../shared/tools.js';

const categorySelect = document.getElementById('category');
const fromSelect = document.getElementById('from-unit');
const valueInput = document.getElementById('value');
const results = document.getElementById('results');
const status = document.getElementById('status');

const categories = {
  length: {
    label: '长度',
    base: 'meter',
    units: {
      millimeter: { label: '毫米', factor: 0.001 },
      centimeter: { label: '厘米', factor: 0.01 },
      meter: { label: '米', factor: 1 },
      kilometer: { label: '千米', factor: 1000 },
      inch: { label: '英寸', factor: 0.0254 },
      foot: { label: '英尺', factor: 0.3048 },
      yard: { label: '码', factor: 0.9144 },
      mile: { label: '英里', factor: 1609.344 },
    },
  },
  area: {
    label: '面积',
    base: 'square meter',
    units: {
      'square meter': { label: '平方米', factor: 1 },
      'square kilometer': { label: '平方千米', factor: 1000000 },
      hectare: { label: '公顷', factor: 10000 },
      acre: { label: '英亩', factor: 4046.8564224 },
      'square foot': { label: '平方英尺', factor: 0.09290304 },
    },
  },
  volume: {
    label: '体积',
    base: 'liter',
    units: {
      milliliter: { label: '毫升', factor: 0.001 },
      liter: { label: '升', factor: 1 },
      'cubic meter': { label: '立方米', factor: 1000 },
      gallon: { label: '加仑', factor: 3.785411784 },
    },
  },
  mass: {
    label: '质量',
    base: 'gram',
    units: {
      milligram: { label: '毫克', factor: 0.001 },
      gram: { label: '克', factor: 1 },
      kilogram: { label: '千克', factor: 1000 },
      tonne: { label: '吨', factor: 1000000 },
      ounce: { label: '盎司', factor: 28.349523125 },
      pound: { label: '磅', factor: 453.59237 },
    },
  },
  speed: {
    label: '速度',
    base: 'meter per second',
    units: {
      'meter per second': { label: '米每秒', factor: 1 },
      'kilometer per hour': { label: '千米每小时', factor: 0.2777777777777778 },
      'mile per hour': { label: '英里每小时', factor: 0.44704 },
      knot: { label: '节', factor: 0.5144444444444445 },
    },
  },
  time: {
    label: '时间',
    base: 'second',
    units: {
      millisecond: { label: '毫秒', factor: 0.001 },
      second: { label: '秒', factor: 1 },
      minute: { label: '分钟', factor: 60 },
      hour: { label: '小时', factor: 3600 },
      day: { label: '天', factor: 86400 },
    },
  },
  data: {
    label: '数据大小',
    base: 'byte',
    units: {
      bit: { label: '位', factor: 0.125 },
      byte: { label: '字节', factor: 1 },
      KB: { label: '千字节', factor: 1024 },
      MB: { label: '兆字节', factor: 1048576 },
      GB: { label: '吉字节', factor: 1073741824 },
      TB: { label: '太字节', factor: 1099511627776 },
    },
  },
  angle: {
    label: '角度',
    base: 'radian',
    units: {
      degree: { label: '度', factor: Math.PI / 180 },
      radian: { label: '弧度', factor: 1 },
    },
  },
  temperature: {
    label: '温度',
    units: {
      Celsius: { label: '摄氏度', mode: 'celsius' },
      Fahrenheit: { label: '华氏度', mode: 'fahrenheit' },
      Kelvin: { label: '开尔文', mode: 'kelvin' },
    },
  },
  base: {
    label: '数字进制',
    units: {
      decimal: { label: '十进制', radix: 10 },
      binary: { label: '二进制', radix: 2 },
      octal: { label: '八进制', radix: 8 },
      hexadecimal: { label: '十六进制', radix: 16 },
    },
  },
};

function formatNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  if (Math.abs(value) >= 1000000 || (Math.abs(value) > 0 && Math.abs(value) < 0.0001)) {
    return value.toExponential(8).replace(/\.?0+e/, 'e');
  }
  return Number(value.toFixed(10)).toString();
}

function parseNumericValue(text) {
  const normalized = text.trim();
  if (!normalized) {
    throw new Error('请输入数值。');
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error('请输入有效数字。');
  }
  return value;
}

function toCelsius(value, unit) {
  if (unit === 'Celsius') return value;
  if (unit === 'Fahrenheit') return (value - 32) * 5 / 9;
  return value - 273.15;
}

function fromCelsius(value, unit) {
  if (unit === 'Celsius') return value;
  if (unit === 'Fahrenheit') return value * 9 / 5 + 32;
  return value + 273.15;
}

function parseIntegerForBase(text, base) {
  const normalized = text.trim().toUpperCase();
  if (!normalized) {
    throw new Error('请输入数值。');
  }

  const isNegative = normalized.startsWith('-');
  const digits = isNegative ? normalized.slice(1) : normalized;
  if (!digits) {
    throw new Error('负号后需要输入数字。');
  }

  let value = 0n;
  const bigintBase = BigInt(base);
  for (const digit of digits) {
    const digitValue = Number.parseInt(digit, 16);
    if (!Number.isInteger(digitValue) || digitValue >= base) {
      throw new Error(`当前数值不符合 ${base} 进制。`);
    }
    value = value * bigintBase + BigInt(digitValue);
  }

  return isNegative ? -value : value;
}

function renderUnitOptions() {
  const category = categories[categorySelect.value];
  if (!category) {
    return;
  }
  fromSelect.innerHTML = '';
  Object.entries(category.units).forEach(([unit, config]) => {
    const option = document.createElement('option');
    option.value = unit;
    option.textContent = config.label;
    fromSelect.appendChild(option);
  });

  if (category.base && category.units[category.base] !== undefined) {
    fromSelect.value = category.base;
  }
}

function renderResults() {
  const categoryKey = categorySelect.value;
  const category = categories[categoryKey];
  const fromUnit = fromSelect.value;
  results.innerHTML = '';
  setStatus(status, '');

  try {
    let values;

    if (categoryKey === 'temperature') {
      const inputValue = parseNumericValue(valueInput.value);
      const celsius = toCelsius(inputValue, fromUnit);
      values = Object.entries(category.units).map(([unit, config]) => [config.label, fromCelsius(celsius, unit)]);
    } else if (categoryKey === 'base') {
      const base = category.units[fromUnit].radix;
      const decimal = parseIntegerForBase(valueInput.value, base);
      values = Object.entries(category.units).map(([, config]) => [config.label, decimal.toString(config.radix).toUpperCase()]);
    } else {
      const inputValue = parseNumericValue(valueInput.value);
      const baseValue = inputValue * category.units[fromUnit].factor;
      values = Object.entries(category.units).map(([, config]) => [config.label, baseValue / config.factor]);
    }

    values.forEach(([unit, value]) => {
      const row = document.createElement('div');
      row.className = 'tool-result-row';
      const label = document.createElement('strong');
      label.textContent = unit;
      const result = document.createElement('span');
      result.textContent = typeof value === 'number' ? formatNumber(value) : value;
      row.append(label, result);
      results.appendChild(row);
    });
    setStatus(status, '已更新换算结果。');
  } catch (error) {
    setStatus(status, error.message, true);
  }
}

Object.entries(categories).forEach(([key, category]) => {
  const option = document.createElement('option');
  option.value = key;
  option.textContent = category.label;
  categorySelect.appendChild(option);
});
categorySelect.value = categorySelect.value || Object.keys(categories)[0];

categorySelect.addEventListener('change', () => {
  renderUnitOptions();
  renderResults();
});
fromSelect.addEventListener('change', renderResults);
valueInput.addEventListener('input', renderResults);

renderUnitOptions();
renderResults();

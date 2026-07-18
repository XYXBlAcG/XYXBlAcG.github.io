import { setStatus } from '../shared/tools.js';

const categorySelect = document.getElementById('category');
const fromSelect = document.getElementById('from-unit');
const valueInput = document.getElementById('value');
const results = document.getElementById('results');
const status = document.getElementById('status');

const categories = {
  length: {
    label: 'Length',
    base: 'meter',
    units: {
      millimeter: 0.001,
      centimeter: 0.01,
      meter: 1,
      kilometer: 1000,
      inch: 0.0254,
      foot: 0.3048,
      yard: 0.9144,
      mile: 1609.344,
    },
  },
  area: {
    label: 'Area',
    base: 'square meter',
    units: {
      'square meter': 1,
      'square kilometer': 1000000,
      hectare: 10000,
      acre: 4046.8564224,
      'square foot': 0.09290304,
    },
  },
  volume: {
    label: 'Volume',
    base: 'liter',
    units: {
      milliliter: 0.001,
      liter: 1,
      'cubic meter': 1000,
      gallon: 3.785411784,
    },
  },
  mass: {
    label: 'Mass',
    base: 'gram',
    units: {
      milligram: 0.001,
      gram: 1,
      kilogram: 1000,
      tonne: 1000000,
      ounce: 28.349523125,
      pound: 453.59237,
    },
  },
  speed: {
    label: 'Speed',
    base: 'meter per second',
    units: {
      'meter per second': 1,
      'kilometer per hour': 0.2777777777777778,
      'mile per hour': 0.44704,
      knot: 0.5144444444444445,
    },
  },
  time: {
    label: 'Time',
    base: 'second',
    units: {
      millisecond: 0.001,
      second: 1,
      minute: 60,
      hour: 3600,
      day: 86400,
    },
  },
  data: {
    label: 'Data Size',
    base: 'byte',
    units: {
      bit: 0.125,
      byte: 1,
      KB: 1024,
      MB: 1048576,
      GB: 1073741824,
      TB: 1099511627776,
    },
  },
  angle: {
    label: 'Angle',
    base: 'radian',
    units: {
      degree: Math.PI / 180,
      radian: 1,
    },
  },
  temperature: {
    label: 'Temperature',
    units: {
      Celsius: 'celsius',
      Fahrenheit: 'fahrenheit',
      Kelvin: 'kelvin',
    },
  },
  base: {
    label: 'Number Base',
    units: {
      decimal: 10,
      binary: 2,
      octal: 8,
      hexadecimal: 16,
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
    throw new Error('Enter a value.');
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error('Enter a valid number.');
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
    throw new Error('Enter a value.');
  }

  const isNegative = normalized.startsWith('-');
  const digits = isNegative ? normalized.slice(1) : normalized;
  if (!digits) {
    throw new Error('Enter digits after the minus sign.');
  }

  let value = 0n;
  const bigintBase = BigInt(base);
  for (const digit of digits) {
    const digitValue = Number.parseInt(digit, 16);
    if (!Number.isInteger(digitValue) || digitValue >= base) {
      throw new Error(`Value is not valid for base ${base}.`);
    }
    value = value * bigintBase + BigInt(digitValue);
  }

  return isNegative ? -value : value;
}

function renderUnitOptions() {
  const category = categories[categorySelect.value];
  fromSelect.innerHTML = '';
  Object.keys(category.units).forEach((unit) => {
    const option = document.createElement('option');
    option.value = unit;
    option.textContent = unit;
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
      values = Object.keys(category.units).map((unit) => [unit, fromCelsius(celsius, unit)]);
    } else if (categoryKey === 'base') {
      const base = category.units[fromUnit];
      const decimal = parseIntegerForBase(valueInput.value, base);
      values = Object.entries(category.units).map(([unit, unitBase]) => [unit, decimal.toString(unitBase).toUpperCase()]);
    } else {
      const inputValue = parseNumericValue(valueInput.value);
      const baseValue = inputValue * category.units[fromUnit];
      values = Object.entries(category.units).map(([unit, factor]) => [unit, baseValue / factor]);
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

categorySelect.addEventListener('change', () => {
  renderUnitOptions();
  renderResults();
});
fromSelect.addEventListener('change', renderResults);
valueInput.addEventListener('input', renderResults);

renderUnitOptions();
renderResults();

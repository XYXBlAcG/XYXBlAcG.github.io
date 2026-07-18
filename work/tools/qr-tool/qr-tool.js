import { copyText, setStatus } from '../shared/tools.js';

const typeSelect = document.getElementById('qr-type');
const textInput = document.getElementById('qr-text');
const wifiSsid = document.getElementById('wifi-ssid');
const wifiPassword = document.getElementById('wifi-password');
const wifiAuth = document.getElementById('wifi-auth');
const sizeInput = document.getElementById('qr-size');
const levelInput = document.getElementById('qr-level');
const canvas = document.getElementById('qr-canvas');
const generateStatus = document.getElementById('generate-status');
const decodeFile = document.getElementById('decode-file');
const decodeFileName = document.getElementById('decode-file-name');
const decodedText = document.getElementById('decoded-text');
const decodeStatus = document.getElementById('decode-status');

const ERROR_LEVELS = {
  L: { format: 1 },
  M: { format: 0 },
  Q: { format: 3 },
  H: { format: 2 },
};

const VERSION_DATA = {
  1: {
    L: { ecc: 7, blocks: [19] },
    M: { ecc: 10, blocks: [16] },
    Q: { ecc: 13, blocks: [13] },
    H: { ecc: 17, blocks: [9] },
    align: [],
  },
  2: {
    L: { ecc: 10, blocks: [34] },
    M: { ecc: 16, blocks: [28] },
    Q: { ecc: 22, blocks: [22] },
    H: { ecc: 28, blocks: [16] },
    align: [6, 18],
  },
  3: {
    L: { ecc: 15, blocks: [55] },
    M: { ecc: 26, blocks: [44] },
    Q: { ecc: 18, blocks: [17, 17] },
    H: { ecc: 22, blocks: [13, 13] },
    align: [6, 22],
  },
  4: {
    L: { ecc: 20, blocks: [80] },
    M: { ecc: 18, blocks: [32, 32] },
    Q: { ecc: 26, blocks: [24, 24] },
    H: { ecc: 16, blocks: [9, 9, 9, 9] },
    align: [6, 26],
  },
  5: {
    L: { ecc: 26, blocks: [108] },
    M: { ecc: 24, blocks: [43, 43] },
    Q: { ecc: 18, blocks: [15, 15, 16, 16] },
    H: { ecc: 22, blocks: [11, 11, 12, 12] },
    align: [6, 30],
  },
  6: {
    L: { ecc: 18, blocks: [68, 68] },
    M: { ecc: 16, blocks: [27, 27, 27, 27] },
    Q: { ecc: 24, blocks: [19, 19, 19, 19] },
    H: { ecc: 28, blocks: [15, 15, 15, 15] },
    align: [6, 34],
  },
};

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

const GF_EXP = new Array(512);
const GF_LOG = new Array(256);
let gfValue = 1;
for (let index = 0; index < 255; index += 1) {
  GF_EXP[index] = gfValue;
  GF_LOG[gfValue] = index;
  gfValue <<= 1;
  if (gfValue & 0x100) {
    gfValue ^= 0x11d;
  }
}
for (let index = 255; index < GF_EXP.length; index += 1) {
  GF_EXP[index] = GF_EXP[index - 255];
}

function gfMultiply(a, b) {
  if (a === 0 || b === 0) {
    return 0;
  }
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function polynomialMultiply(a, b) {
  const result = Array(a.length + b.length - 1).fill(0);
  a.forEach((left, leftIndex) => {
    b.forEach((right, rightIndex) => {
      result[leftIndex + rightIndex] ^= gfMultiply(left, right);
    });
  });
  return result;
}

function reedSolomonGenerator(degree) {
  let result = [1];
  for (let index = 0; index < degree; index += 1) {
    result = polynomialMultiply(result, [1, GF_EXP[index]]);
  }
  return result;
}

function reedSolomonCompute(data, degree) {
  const generator = reedSolomonGenerator(degree);
  const result = Array(degree).fill(0);
  data.forEach((byte) => {
    const factor = byte ^ result[0];
    result.shift();
    result.push(0);
    for (let index = 0; index < degree; index += 1) {
      result[index] ^= gfMultiply(generator[index + 1], factor);
    }
  });
  return result;
}

function appendBits(buffer, value, length) {
  for (let index = length - 1; index >= 0; index -= 1) {
    buffer.push(((value >>> index) & 1) === 1);
  }
}

function bitsToCodewords(bits) {
  const codewords = [];
  for (let offset = 0; offset < bits.length; offset += 8) {
    let value = 0;
    for (let index = 0; index < 8; index += 1) {
      value = (value << 1) | (bits[offset + index] ? 1 : 0);
    }
    codewords.push(value);
  }
  return codewords;
}

function chooseVersion(bytes, level) {
  for (const versionText of Object.keys(VERSION_DATA)) {
    const version = Number(versionText);
    const config = VERSION_DATA[version][level];
    const dataCodewords = config.blocks.reduce((sum, count) => sum + count, 0);
    const countBits = version < 10 ? 8 : 16;
    const requiredBits = 4 + countBits + bytes.length * 8;
    if (requiredBits <= dataCodewords * 8) {
      return version;
    }
  }
  throw new Error('内容太长，请减少文字或降低纠错等级。');
}

function makeDataCodewords(bytes, version, level) {
  const config = VERSION_DATA[version][level];
  const dataCodewords = config.blocks.reduce((sum, count) => sum + count, 0);
  const capacityBits = dataCodewords * 8;
  const bits = [];

  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) {
    bits.push(false);
  }

  const codewords = bitsToCodewords(bits);
  const pads = [0xec, 0x11];
  for (let index = 0; codewords.length < dataCodewords; index += 1) {
    codewords.push(pads[index % 2]);
  }
  return codewords;
}

function interleaveCodewords(dataCodewords, version, level) {
  const config = VERSION_DATA[version][level];
  const blocks = [];
  let offset = 0;

  config.blocks.forEach((length) => {
    const data = dataCodewords.slice(offset, offset + length);
    blocks.push({
      data,
      ecc: reedSolomonCompute(data, config.ecc),
    });
    offset += length;
  });

  const result = [];
  const maxDataLength = Math.max(...blocks.map((block) => block.data.length));
  for (let index = 0; index < maxDataLength; index += 1) {
    blocks.forEach((block) => {
      if (index < block.data.length) {
        result.push(block.data[index]);
      }
    });
  }
  for (let index = 0; index < config.ecc; index += 1) {
    blocks.forEach((block) => result.push(block.ecc[index]));
  }
  return result;
}

function getFormatBits(level, mask) {
  const data = (ERROR_LEVELS[level].format << 3) | mask;
  let bits = data << 10;
  for (let index = 14; index >= 10; index -= 1) {
    if (((bits >>> index) & 1) !== 0) {
      bits ^= 0x537 << (index - 10);
    }
  }
  return (((data << 10) | (bits & 0x3ff)) ^ 0x5412) & 0x7fff;
}

function createBaseMatrix(version) {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));

  function setFunction(x, y, dark) {
    if (x < 0 || y < 0 || x >= size || y >= size) {
      return;
    }
    modules[y][x] = dark;
    reserved[y][x] = true;
  }

  function drawFinder(x, y) {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) {
        const xx = x + dx;
        const yy = y + dy;
        const inFinder = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
        const dark = inFinder && (
          dx === 0 ||
          dx === 6 ||
          dy === 0 ||
          dy === 6 ||
          (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)
        );
        setFunction(xx, yy, dark);
      }
    }
  }

  function drawAlignment(cx, cy) {
    if (reserved[cy][cx]) {
      return;
    }
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  for (let index = 0; index < size; index += 1) {
    if (!reserved[6][index]) {
      setFunction(index, 6, index % 2 === 0);
    }
    if (!reserved[index][6]) {
      setFunction(6, index, index % 2 === 0);
    }
  }

  VERSION_DATA[version].align.forEach((x) => {
    VERSION_DATA[version].align.forEach((y) => drawAlignment(x, y));
  });

  drawFormatBits(modules, reserved, version, 'M', 0);
  return { modules, reserved, size };
}

function drawFormatBits(modules, reserved, version, level, mask) {
  const size = version * 4 + 17;
  const bits = getFormatBits(level, mask);

  function setFormat(x, y, index) {
    modules[y][x] = ((bits >>> index) & 1) !== 0;
    reserved[y][x] = true;
  }

  for (let index = 0; index <= 5; index += 1) setFormat(8, index, index);
  setFormat(8, 7, 6);
  setFormat(8, 8, 7);
  setFormat(7, 8, 8);
  for (let index = 9; index < 15; index += 1) setFormat(14 - index, 8, index);
  for (let index = 0; index < 8; index += 1) setFormat(size - 1 - index, 8, index);
  for (let index = 8; index < 15; index += 1) setFormat(8, size - 15 + index, index);
  modules[size - 8][8] = true;
  reserved[size - 8][8] = true;
}

function placeCodewords(base, codewords, mask) {
  const modules = base.modules.map((row) => row.slice());
  const bits = [];
  codewords.forEach((codeword) => appendBits(bits, codeword, 8));

  let bitIndex = 0;
  let direction = -1;
  for (let right = base.size - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right -= 1;
    }
    for (let vertical = 0; vertical < base.size; vertical += 1) {
      const y = direction === 1 ? vertical : base.size - 1 - vertical;
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        if (!base.reserved[y][x]) {
          let dark = bitIndex < bits.length ? bits[bitIndex] : false;
          if (MASKS[mask](x, y)) {
            dark = !dark;
          }
          modules[y][x] = dark;
          bitIndex += 1;
        }
      }
    }
    direction *= -1;
  }

  return modules;
}

function penaltyScore(modules) {
  const size = modules.length;
  let penalty = 0;

  function scoreLine(values) {
    let runColor = values[0];
    let runLength = 1;
    for (let index = 1; index < values.length; index += 1) {
      if (values[index] === runColor) {
        runLength += 1;
      } else {
        if (runLength >= 5) {
          penalty += 3 + runLength - 5;
        }
        runColor = values[index];
        runLength = 1;
      }
    }
    if (runLength >= 5) {
      penalty += 3 + runLength - 5;
    }
  }

  for (let y = 0; y < size; y += 1) {
    scoreLine(modules[y]);
  }
  for (let x = 0; x < size; x += 1) {
    scoreLine(Array.from({ length: size }, (_, y) => modules[y][x]));
  }

  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const color = modules[y][x];
      if (modules[y][x + 1] === color && modules[y + 1][x] === color && modules[y + 1][x + 1] === color) {
        penalty += 3;
      }
    }
  }

  const pattern = [true, false, true, true, true, false, true];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x <= size - 7; x += 1) {
      if (pattern.every((value, index) => modules[y][x + index] === value)) {
        const before = x >= 4 && [0, 1, 2, 3].every((offset) => !modules[y][x - 1 - offset]);
        const after = x + 11 <= size && [0, 1, 2, 3].every((offset) => !modules[y][x + 7 + offset]);
        if (before || after) penalty += 40;
      }
    }
  }
  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y <= size - 7; y += 1) {
      if (pattern.every((value, index) => modules[y + index][x] === value)) {
        const before = y >= 4 && [0, 1, 2, 3].every((offset) => !modules[y - 1 - offset][x]);
        const after = y + 11 <= size && [0, 1, 2, 3].every((offset) => !modules[y + 7 + offset][x]);
        if (before || after) penalty += 40;
      }
    }
  }

  const dark = modules.flat().filter(Boolean).length;
  const percent = dark * 100 / (size * size);
  penalty += Math.floor(Math.abs(percent - 50) / 5) * 10;
  return penalty;
}

export function encodeQr(text, level) {
  const bytes = new TextEncoder().encode(text);
  const version = chooseVersion(bytes, level);
  const dataCodewords = makeDataCodewords(bytes, version, level);
  const codewords = interleaveCodewords(dataCodewords, version, level);
  const base = createBaseMatrix(version);

  let bestMatrix = null;
  let bestMask = 0;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < MASKS.length; mask += 1) {
    const modules = placeCodewords(base, codewords, mask);
    const reserved = base.reserved.map((row) => row.slice());
    drawFormatBits(modules, reserved, version, level, mask);
    const score = penaltyScore(modules);
    if (score < bestPenalty) {
      bestPenalty = score;
      bestMask = mask;
      bestMatrix = modules;
    }
  }

  return {
    modules: bestMatrix,
    version,
    mask: bestMask,
  };
}

function drawQr(matrix, targetSize) {
  const context = canvas.getContext('2d');
  const quietZone = 4;
  const size = Math.min(800, Math.max(160, targetSize || 280));
  const modules = matrix.length;
  const cell = size / (modules + quietZone * 2);

  canvas.width = size;
  canvas.height = size;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.fillStyle = '#101418';
  for (let y = 0; y < modules; y += 1) {
    for (let x = 0; x < modules; x += 1) {
      if (matrix[y][x]) {
        context.fillRect((x + quietZone) * cell, (y + quietZone) * cell, cell, cell);
      }
    }
  }
}

function escapeWifi(value) {
  return value.replace(/([\\;,":])/g, '\\$1');
}

function qrContent() {
  if (typeSelect.value === 'wifi') {
    const ssid = wifiSsid.value.trim();
    if (!ssid) {
      throw new Error('请输入网络名称。');
    }
    return `WIFI:T:${wifiAuth.value};S:${escapeWifi(ssid)};P:${escapeWifi(wifiPassword.value)};;`;
  }

  const text = textInput.value.trim();
  if (!text) {
    throw new Error('请输入二维码内容。');
  }
  return text;
}

function generateQr() {
  setStatus(generateStatus, '');
  try {
    const level = levelInput.value in ERROR_LEVELS ? levelInput.value : 'M';
    const result = encodeQr(qrContent(), level);
    drawQr(result.modules, Number(sizeInput.value));
    setStatus(generateStatus, `二维码已生成：版本 ${result.version}，掩码 ${result.mask}。`);
  } catch (error) {
    setStatus(generateStatus, error.message, true);
  }
}

function updatePanels() {
  document.querySelectorAll('[data-panel="wifi"]').forEach((panel) => panel.classList.toggle('is-hidden', typeSelect.value !== 'wifi'));
  document.querySelectorAll('[data-panel="text"]').forEach((panel) => panel.classList.toggle('is-hidden', typeSelect.value === 'wifi'));
  generateQr();
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法读取图片。'));
    };
    image.src = url;
  });
}

async function decodeQr() {
  const file = decodeFile.files[0];
  decodeFileName.textContent = file?.name || '未选择图片';
  decodedText.value = '';
  if (!file) return;
  setStatus(decodeStatus, '');

  try {
    const image = await loadImage(file);
    const decodeCanvas = document.createElement('canvas');
    decodeCanvas.width = image.naturalWidth;
    decodeCanvas.height = image.naturalHeight;
    const context = decodeCanvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);

    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const codes = await detector.detect(decodeCanvas);
      if (codes.length > 0) {
        decodedText.value = codes[0].rawValue;
        setStatus(decodeStatus, '已解码。');
        return;
      }
    }

    if (window.jsQR) {
      const imageData = context.getImageData(0, 0, decodeCanvas.width, decodeCanvas.height);
      const result = window.jsQR(imageData.data, imageData.width, imageData.height);
      if (result) {
        decodedText.value = result.data;
        setStatus(decodeStatus, '已解码。');
        return;
      }
    }

    throw new Error('没有识别到二维码。');
  } catch (error) {
    setStatus(decodeStatus, error.message, true);
  }
}

document.getElementById('generate-qr').addEventListener('click', generateQr);
document.getElementById('download-qr').addEventListener('click', () => {
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = 'qrcode.png';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setStatus(generateStatus, '已开始下载。');
});
document.getElementById('copy-decoded').addEventListener('click', () => copyText(decodedText.value, decodeStatus));
[typeSelect, textInput, wifiSsid, wifiPassword, wifiAuth, sizeInput, levelInput].forEach((element) => {
  element.addEventListener('input', generateQr);
  element.addEventListener('change', generateQr);
});
typeSelect.addEventListener('change', updatePanels);
decodeFile.addEventListener('change', decodeQr);
updatePanels();

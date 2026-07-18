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
const decodedText = document.getElementById('decoded-text');
const decodeStatus = document.getElementById('decode-status');

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

async function generateQr() {
  setStatus(generateStatus, '');
  try {
    if (!window.QRCode || typeof window.QRCode.toCanvas !== 'function') {
      throw new Error('二维码生成库尚未加载完成，请稍后重试。');
    }
    const size = Math.min(800, Math.max(160, Number(sizeInput.value) || 280));
    canvas.width = size;
    canvas.height = size;
    await window.QRCode.toCanvas(canvas, qrContent(), {
      width: size,
      margin: 2,
      errorCorrectionLevel: levelInput.value,
      color: {
        dark: '#101418',
        light: '#ffffff',
      },
    });
    setStatus(generateStatus, '二维码已生成。');
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
window.addEventListener('load', generateQr);
updatePanels();

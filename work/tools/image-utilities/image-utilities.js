import { setStatus } from '../shared/tools.js';

const fileInput = document.getElementById('image-file');
const widthInput = document.getElementById('width');
const heightInput = document.getElementById('height');
const formatInput = document.getElementById('format');
const qualityInput = document.getElementById('quality');
const qualityValue = document.getElementById('quality-value');
const keepRatio = document.getElementById('keep-ratio');
const preview = document.getElementById('preview');
const meta = document.getElementById('meta');
const status = document.getElementById('status');

let sourceImage;
let sourceName = 'image';
let outputUrl;
let lastBlob;
let ratio = 1;
let syncing = false;

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

function extensionForType(type) {
  return type === 'image/png' ? 'png' : type === 'image/jpeg' ? 'jpg' : 'webp';
}

async function processImage() {
  setStatus(status, '');
  if (!sourceImage) {
    setStatus(status, '请先选择图片。', true);
    return;
  }

  const width = Number(widthInput.value);
  const height = Number(heightInput.value);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    setStatus(status, '请输入有效尺寸。', true);
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const context = canvas.getContext('2d');
  context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
  lastBlob = await new Promise((resolve) => canvas.toBlob(resolve, formatInput.value, Number(qualityInput.value)));
  if (!lastBlob) {
    setStatus(status, '当前浏览器无法输出这个格式。', true);
    return;
  }

  if (outputUrl) URL.revokeObjectURL(outputUrl);
  outputUrl = URL.createObjectURL(lastBlob);
  preview.src = outputUrl;
  preview.hidden = false;
  meta.textContent = `${canvas.width} x ${canvas.height}，${Math.round(lastBlob.size / 1024)} KB`;
  setStatus(status, '图片已生成。');
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  try {
    sourceImage = await loadImage(file);
    sourceName = file.name.replace(/\.[^.]+$/, '');
    ratio = sourceImage.width / sourceImage.height;
    widthInput.value = sourceImage.width;
    heightInput.value = sourceImage.height;
    await processImage();
  } catch (error) {
    setStatus(status, error.message, true);
  }
});

widthInput.addEventListener('input', () => {
  if (syncing || !keepRatio.checked || !ratio) return;
  syncing = true;
  heightInput.value = Math.round(Number(widthInput.value) / ratio) || '';
  syncing = false;
});

heightInput.addEventListener('input', () => {
  if (syncing || !keepRatio.checked || !ratio) return;
  syncing = true;
  widthInput.value = Math.round(Number(heightInput.value) * ratio) || '';
  syncing = false;
});

qualityInput.addEventListener('input', () => {
  qualityValue.textContent = qualityInput.value;
});
document.getElementById('process').addEventListener('click', processImage);
document.getElementById('download').addEventListener('click', () => {
  if (!lastBlob || !outputUrl) {
    setStatus(status, '请先生成图片。', true);
    return;
  }
  const link = document.createElement('a');
  link.href = outputUrl;
  link.download = `${sourceName}-processed.${extensionForType(formatInput.value)}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setStatus(status, '已开始下载。');
});

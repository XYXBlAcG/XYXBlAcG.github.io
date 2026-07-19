import { copyText, setStatus } from '../tools/shared/tools.js';
import {
  decodeSignal,
  encodeSignal,
  formatBytes,
  getDefaultDeviceName,
  normalizeDeviceName,
} from './lan-transfer-core.mjs';
import { renderFilePreview } from './file-preview.js';
import { LanTransferSession } from './webrtc-transfer.js';

const nicknameKey = 'xyx-lan-transfer-nickname';
const recentPeerKey = 'xyx-lan-transfer-recent-peer';
const connectionStateLabels = {
  new: '新建',
  connecting: '连接中',
  connected: '已连接',
  disconnected: '连接中断',
  failed: '连接失败',
  closed: '已关闭',
};

const state = {
  mode: '',
  session: null,
  selectedFiles: [],
  manifest: null,
  receivedFiles: [],
};

const elements = {
  deviceName: document.getElementById('device-name'),
  usePublicStun: document.getElementById('use-public-stun'),
  fileInput: document.getElementById('file-input'),
  fileInputName: document.getElementById('file-input-name'),
  signalCode: document.getElementById('signal-code'),
  signalQr: document.getElementById('signal-qr'),
  signalStatus: document.getElementById('signal-status'),
  transferStatus: document.getElementById('transfer-status'),
  fileList: document.getElementById('file-list'),
  previewList: document.getElementById('preview-list'),
  progress: document.getElementById('transfer-progress'),
  createOffer: document.getElementById('create-offer'),
  importOffer: document.getElementById('import-offer'),
  importAnswer: document.getElementById('import-answer'),
  createAnswer: document.getElementById('create-answer'),
  acceptTransfer: document.getElementById('accept-transfer'),
  sendFiles: document.getElementById('send-files'),
  copyCode: document.getElementById('copy-code'),
  pasteCode: document.getElementById('paste-code'),
  resetSession: document.getElementById('reset-session'),
  clearTransfer: document.getElementById('clear-transfer'),
  downloadZip: document.getElementById('download-zip'),
};

function getStoredValue(key) {
  try {
    return globalThis.localStorage?.getItem(key) || '';
  } catch {
    return '';
  }
}

function setStoredValue(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Storage can be unavailable in private browsing or locked-down contexts.
  }
}

function describeConnectionState(value) {
  return connectionStateLabels[value] || '未知状态';
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('[data-panel]').forEach((panel) => {
    const active = panel.dataset.panel === mode;
    panel.hidden = !active;
  });
  document.querySelectorAll('.lan-mode-button').forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('primary', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function getNickname() {
  const normalized = normalizeDeviceName(elements.deviceName.value) || getDefaultDeviceName();
  setStoredValue(nicknameKey, normalized);
  return normalized;
}

function clearSignalCanvas() {
  const context = elements.signalQr.getContext('2d');
  context?.clearRect(0, 0, elements.signalQr.width, elements.signalQr.height);
}

function renderSignalCode(code, successMessage = '已生成二维码和连接码。') {
  elements.signalCode.value = code;

  if (globalThis.QRCode?.toCanvas) {
    globalThis.QRCode.toCanvas(elements.signalQr, code, { width: 240, margin: 1 }, (error) => {
      setStatus(
        elements.signalStatus,
        error ? `二维码生成失败：${error.message}` : successMessage,
        !!error,
      );
    });
  } else {
    setStatus(elements.signalStatus, '二维码库尚未加载，请复制连接码。', true);
  }
}

function disposePreviewList() {
  Array.from(elements.previewList.children).forEach((child) => {
    child.dispatchEvent(new Event('lan-preview-dispose'));
  });
  elements.previewList.replaceChildren();
}

function renderPreviewError(file, error) {
  const card = document.createElement('article');
  const title = document.createElement('strong');
  const message = document.createElement('p');

  card.className = 'lan-preview-card';
  title.textContent = `${file.name}（${formatBytes(file.size)}）`;
  message.textContent = `预览失败：${error.message}`;
  card.append(title, message);
  return card;
}

async function renderPreviews(files) {
  disposePreviewList();

  for (const file of files) {
    try {
      elements.previewList.appendChild(await renderFilePreview(file));
    } catch (error) {
      elements.previewList.appendChild(renderPreviewError(file, error));
    }
  }
}

async function readClipboardCode() {
  try {
    if (!globalThis.navigator?.clipboard?.readText) {
      throw new Error('当前浏览器不支持读取剪贴板');
    }
    elements.signalCode.value = await globalThis.navigator.clipboard.readText();
    setStatus(elements.signalStatus, '已从剪贴板读取连接码。', false);
  } catch (error) {
    setStatus(elements.signalStatus, `读取剪贴板失败：${error.message}。请手动粘贴。`, true);
  }
}

async function zipReceivedFiles(files) {
  if (!files.length) throw new Error('暂无可打包的文件');
  if (!globalThis.JSZip) throw new Error('ZIP 库尚未加载');

  const zip = new globalThis.JSZip();
  files.forEach((file) => {
    zip.file(file.name, file.blob);
  });

  return zip.generateAsync({ type: 'blob' }, (metadata) => {
    const percent = Math.round(metadata.percent || 0);
    elements.progress.value = percent;
    setStatus(elements.transferStatus, `正在打包 ZIP：${percent}%`, false);
  });
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function bindSession(session) {
  session.addEventListener('connection', (event) => {
    setStatus(elements.transferStatus, `连接状态：${describeConnectionState(event.detail.state)}`, false);
  });
  session.addEventListener('channel-open', () => {
    const message = state.mode === 'receive'
      ? '连接已建立，可以确认接收文件。'
      : '连接已建立，等待接收方确认。';
    setStatus(elements.transferStatus, message, false);
  });
  session.addEventListener('channel-close', () => {
    setStatus(elements.transferStatus, '连接已关闭。', false);
  });
  session.addEventListener('manifest', (event) => {
    state.manifest = event.detail.manifest;
    state.receivedFiles = [];
    elements.downloadZip.disabled = true;
    disposePreviewList();
    if (event.detail.peerName) setStoredValue(recentPeerKey, event.detail.peerName);
    renderFileList(state.manifest.files);
  });
  session.addEventListener('send-progress', (event) => {
    updateProgress(event.detail.sentBytes, event.detail.totalBytes);
  });
  session.addEventListener('receive-progress', (event) => {
    updateProgress(event.detail.receivedBytes, event.detail.totalBytes);
  });
  session.addEventListener('accepted', () => {
    setStatus(elements.transferStatus, '对方已确认接收，可以开始发送。', false);
    elements.sendFiles.disabled = false;
  });
  session.addEventListener('file-received', (event) => {
    state.receivedFiles.push(event.detail.file);
    setStatus(elements.transferStatus, `已接收：${event.detail.file.name}`, false);
  });
  session.addEventListener('transfer-complete', async (event) => {
    state.receivedFiles = event.detail.files;
    elements.downloadZip.disabled = state.receivedFiles.length === 0;
    await renderPreviews(state.receivedFiles);
    setStatus(elements.transferStatus, `接收完成，共 ${state.receivedFiles.length} 个文件。`, false);
  });
  session.addEventListener('error', (event) => {
    setStatus(elements.transferStatus, `发生错误：${event.detail.message || '未知错误'}`, true);
  });
}

function renderFileList(files = []) {
  elements.fileList.replaceChildren();

  files.forEach((file) => {
    const row = document.createElement('div');
    const name = document.createElement('strong');
    const size = document.createElement('span');

    row.className = 'lan-file-row';
    name.textContent = file.name;
    size.textContent = formatBytes(file.size);
    row.append(name, size);
    elements.fileList.append(row);
  });
}

function updateProgress(done, total) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  elements.progress.value = percent;
  setStatus(
    elements.transferStatus,
    `传输进度：${percent}%（${formatBytes(done)} / ${formatBytes(total)}）`,
    false,
  );
}

function resetSession({ clearCode = true, clearSelectedFiles = false } = {}) {
  state.session?.close();
  state.session = null;
  state.manifest = null;
  state.receivedFiles = [];
  elements.sendFiles.disabled = true;
  elements.acceptTransfer.disabled = true;
  elements.createAnswer.disabled = true;
  elements.downloadZip.disabled = true;
  elements.progress.value = 0;
  renderFileList([]);
  disposePreviewList();

  if (clearSelectedFiles) {
    state.selectedFiles = [];
    elements.fileInput.value = '';
    elements.fileInputName.textContent = '未选择文件';
  }

  if (clearCode) {
    elements.signalCode.value = '';
    clearSignalCanvas();
  }
}

document.querySelectorAll('.lan-mode-button').forEach((button) => {
  button.addEventListener('click', () => setMode(button.dataset.mode));
});

elements.deviceName.value = getStoredValue(nicknameKey) || getDefaultDeviceName();
elements.deviceName.addEventListener('change', () => {
  elements.deviceName.value = getNickname();
});

elements.fileInput.addEventListener('change', () => {
  state.selectedFiles = Array.from(elements.fileInput.files || []);
  elements.fileInputName.textContent = state.selectedFiles.length
    ? `已选择 ${state.selectedFiles.length} 个文件`
    : '未选择文件';
  state.manifest = null;
  state.receivedFiles = [];
  elements.sendFiles.disabled = true;
  elements.downloadZip.disabled = true;
  elements.progress.value = 0;
  disposePreviewList();
  renderFileList(state.selectedFiles);
});

elements.createOffer.addEventListener('click', async () => {
  if (!state.selectedFiles.length) {
    setStatus(elements.signalStatus, '请先选择要发送的文件。', true);
    return;
  }

  try {
    resetSession({ clearCode: true });
    state.session = new LanTransferSession({
      nickname: getNickname(),
      usePublicStun: elements.usePublicStun.checked,
    });
    bindSession(state.session);
    const offer = await state.session.createOffer(state.selectedFiles);
    state.manifest = offer.manifest;
    renderFileList(state.manifest.files);
    renderSignalCode(encodeSignal(offer), '已生成发起码，请将连接码发给接收方。');
  } catch (error) {
    state.session?.close();
    state.session = null;
    setStatus(elements.signalStatus, `生成发起码失败：${error.message}`, true);
  }
});

elements.sendFiles.addEventListener('click', async () => {
  if (!state.session) {
    setStatus(elements.transferStatus, '连接尚未建立，无法发送文件。', true);
    return;
  }

  elements.sendFiles.disabled = true;
  setStatus(elements.transferStatus, '正在发送文件...', false);

  try {
    await state.session.sendFiles();
    setStatus(elements.transferStatus, '文件发送完成。', false);
  } catch (error) {
    setStatus(elements.transferStatus, `发送失败：${error.message}`, true);
    elements.sendFiles.disabled = state.session?.channel?.readyState !== 'open';
  }
});

elements.copyCode.addEventListener('click', () => {
  if (!elements.signalCode.value.trim()) {
    setStatus(elements.signalStatus, '暂无连接码可复制。', true);
    return;
  }
  copyText(elements.signalCode.value, elements.signalStatus);
});

elements.pasteCode.addEventListener('click', readClipboardCode);

elements.importOffer.addEventListener('click', async () => {
  const code = elements.signalCode.value.trim();
  if (!code) {
    setStatus(elements.signalStatus, '请先粘贴发起码。', true);
    return;
  }

  try {
    resetSession({ clearCode: false });
    setMode('receive');
    state.session = new LanTransferSession({
      nickname: getNickname(),
      usePublicStun: elements.usePublicStun.checked,
    });
    bindSession(state.session);

    const offer = decodeSignal(code);
    if (offer.type !== 'offer') throw new Error('请导入发起码，而不是回应码');
    const answer = await state.session.acceptOffer(offer);
    renderSignalCode(encodeSignal(answer), '已生成回应码，请复制给发送方。');
    elements.createAnswer.disabled = true;
    elements.acceptTransfer.disabled = false;
    elements.sendFiles.disabled = true;
    setStatus(elements.transferStatus, '已读取文件清单，请确认是否接收。', false);
  } catch (error) {
    state.session?.close();
    state.session = null;
    elements.acceptTransfer.disabled = true;
    setStatus(elements.signalStatus, `导入发起码失败：${error.message}`, true);
  }
});

elements.importAnswer.addEventListener('click', async () => {
  if (!state.session) {
    setStatus(elements.signalStatus, '请先生成发起码。', true);
    return;
  }

  try {
    const answer = decodeSignal(elements.signalCode.value);
    if (answer.type !== 'answer') throw new Error('请导入回应码，而不是发起码');
    await state.session.acceptAnswer(answer);
    setMode('send');
    setStatus(elements.signalStatus, '回应码已导入，正在建立连接。', false);
    setStatus(elements.transferStatus, '等待接收方确认文件。', false);
  } catch (error) {
    setStatus(elements.signalStatus, `导入回应码失败：${error.message}`, true);
  }
});

elements.acceptTransfer.addEventListener('click', () => {
  if (!state.session) {
    setStatus(elements.transferStatus, '连接尚未建立，无法确认接收。', true);
    return;
  }

  try {
    state.session.acceptTransfer();
    elements.acceptTransfer.disabled = true;
    setStatus(elements.transferStatus, '已确认接收，等待对方发送文件。', false);
  } catch (error) {
    setStatus(elements.transferStatus, `确认接收失败：${error.message}`, true);
  }
});

elements.downloadZip.addEventListener('click', async () => {
  elements.downloadZip.disabled = true;
  setStatus(elements.transferStatus, '正在打包 ZIP...', false);

  try {
    const blob = await zipReceivedFiles(state.receivedFiles);
    downloadBlob('lan-transfer-files.zip', blob);
    setStatus(elements.transferStatus, 'ZIP 已开始下载。', false);
  } catch (error) {
    setStatus(elements.transferStatus, `下载 ZIP 失败：${error.message}`, true);
  } finally {
    elements.downloadZip.disabled = state.receivedFiles.length === 0;
  }
});

elements.clearTransfer.addEventListener('click', () => {
  state.manifest = null;
  state.receivedFiles = [];
  renderFileList([]);
  disposePreviewList();
  elements.progress.value = 0;
  elements.downloadZip.disabled = true;
  setStatus(elements.transferStatus, '已清空本次传输。', false);
});

elements.resetSession.addEventListener('click', () => {
  resetSession({ clearCode: true, clearSelectedFiles: true });
  setStatus(elements.signalStatus, '已重置连接，请重新生成连接码。', false);
  setStatus(elements.transferStatus, '已重置传输状态。', false);
});

setMode('send');

import { copyText, setStatus } from '../tools/shared/tools.js';
import {
  decodeSignal,
  encodeSignal,
  formatBytes,
  getDefaultDeviceName,
  normalizeDeviceName,
  safeFilename,
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
  sessionToken: 0,
  previewToken: 0,
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
  connectionHint: document.getElementById('connection-hint'),
  fileList: document.getElementById('file-list'),
  previewList: document.getElementById('preview-list'),
  progress: document.getElementById('transfer-progress'),
  createOffer: document.getElementById('create-offer'),
  importOffer: document.getElementById('import-offer'),
  importAnswer: document.getElementById('import-answer'),
  acceptTransfer: document.getElementById('accept-transfer'),
  sendFiles: document.getElementById('send-files'),
  copyCode: document.getElementById('copy-code'),
  pasteCode: document.getElementById('paste-code'),
  resetSession: document.getElementById('reset-session'),
  clearTransfer: document.getElementById('clear-transfer'),
  downloadZip: document.getElementById('download-zip'),
  steps: document.querySelectorAll('.lan-step'),
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

function isCurrentSession(session, sessionToken) {
  return state.session === session && state.sessionToken === sessionToken;
}

function closeActiveSession() {
  const session = state.session;
  state.sessionToken += 1;
  state.session = null;
  session?.close();
}

function createTransferSession() {
  state.sessionToken += 1;
  state.session = new LanTransferSession({
    nickname: getNickname(),
    usePublicStun: elements.usePublicStun.checked,
  });
  bindSession(state.session, state.sessionToken);
  return state.session;
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

function setActiveStep(step) {
  elements.steps.forEach((item) => {
    item.classList.toggle('is-active', Number(item.dataset.step) === step);
  });
}

function buildSignalStatus(signal, message) {
  if (signal.iceGatheringComplete === false) {
    return `${message} 网络候选可能尚未完整收集，若连接失败请重新生成连接码或开启增强连接成功率。`;
  }
  return message;
}

function updateConnectionHint() {
  if (!elements.connectionHint) return;
  const recentPeer = getStoredValue(recentPeerKey);
  elements.connectionHint.textContent = recentPeer
    ? `默认只使用局域网直连；连接失败时可开启增强连接成功率。最近连接：${recentPeer}。`
    : '默认只使用局域网直连；连接失败时可开启增强连接成功率。';
}

function switchMode(mode) {
  if (mode === state.mode) return;
  const hadActiveState = Boolean(
    state.session
    || elements.signalCode.value.trim()
    || state.selectedFiles.length
    || state.receivedFiles.length,
  );
  resetSession({ clearCode: true, clearSelectedFiles: mode === 'receive' });
  setMode(mode);
  setActiveStep(1);
  if (hadActiveState) {
    setStatus(elements.signalStatus, '已切换模式，旧连接已失效。', false);
    setStatus(elements.transferStatus, '请重新交换连接码。', false);
  }
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

function disposePreviewCard(card) {
  card.dispatchEvent(new Event('lan-preview-dispose'));
}

function disposePreviewList() {
  Array.from(elements.previewList.children).forEach((child) => {
    disposePreviewCard(child);
  });
  elements.previewList.replaceChildren();
}

function cancelPreviews() {
  state.previewToken += 1;
  disposePreviewList();
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
  const previewToken = state.previewToken + 1;
  state.previewToken = previewToken;
  disposePreviewList();

  for (const file of files) {
    let card = null;
    try {
      card = await renderFilePreview(file);
    } catch (error) {
      if (previewToken !== state.previewToken) return;
      card = renderPreviewError(file, error);
    }

    if (previewToken !== state.previewToken) {
      if (card) disposePreviewCard(card);
      return;
    }

    elements.previewList.appendChild(card);
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

async function zipReceivedFiles(files, sessionToken) {
  if (!files.length) throw new Error('暂无可打包的文件');
  if (!globalThis.JSZip) throw new Error('ZIP 库尚未加载');

  const zip = new globalThis.JSZip();
  const entryNames = buildZipEntryNames(files);
  files.forEach((file, index) => {
    zip.file(entryNames[index], file.blob);
  });

  return zip.generateAsync({ type: 'blob' }, (metadata) => {
    if (sessionToken !== state.sessionToken) return;
    const percent = Math.round(metadata.percent || 0);
    elements.progress.value = percent;
    setStatus(elements.transferStatus, `正在打包 ZIP：${percent}%`, false);
  });
}

function getLastPathComponent(name) {
  const parts = String(name || '').split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] || '';
}

function splitExtension(name) {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex <= 0) return { stem: name, extension: '' };
  return {
    stem: name.slice(0, dotIndex),
    extension: name.slice(dotIndex),
  };
}

function sanitizeZipEntryName(name) {
  const basename = getLastPathComponent(name);
  const cleaned = safeFilename(basename).replace(/[\x00-\x1f\x7f]/g, '_').trim();
  if (cleaned === '.' || cleaned === '..') return 'received-file';
  return cleaned || 'received-file';
}

function buildZipEntryNames(files) {
  const used = new Set();

  return files.map((file) => {
    const original = sanitizeZipEntryName(file.name);
    const { stem, extension } = splitExtension(original);
    let candidate = original;
    let suffix = 2;

    while (used.has(candidate.toLowerCase())) {
      candidate = `${stem} (${suffix})${extension}`;
      suffix += 1;
    }

    used.add(candidate.toLowerCase());
    return candidate;
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

function bindSession(session, sessionToken) {
  session.addEventListener('connection', (event) => {
    if (!isCurrentSession(session, sessionToken)) return;
    setStatus(elements.transferStatus, `连接状态：${describeConnectionState(event.detail.state)}`, false);
  });
  session.addEventListener('channel-open', () => {
    if (!isCurrentSession(session, sessionToken)) return;
    const message = state.mode === 'receive'
      ? '连接已建立，可以确认接收文件。'
      : '连接已建立，等待接收方确认。';
    setStatus(elements.transferStatus, message, false);
  });
  session.addEventListener('channel-close', () => {
    if (!isCurrentSession(session, sessionToken)) return;
    setStatus(elements.transferStatus, '连接已关闭。', false);
  });
  session.addEventListener('manifest', (event) => {
    if (!isCurrentSession(session, sessionToken)) return;
    state.manifest = event.detail.manifest;
    state.receivedFiles = [];
    elements.downloadZip.disabled = true;
    cancelPreviews();
    if (event.detail.peerName) {
      setStoredValue(recentPeerKey, event.detail.peerName);
      updateConnectionHint();
    }
    renderFileList(state.manifest.files);
    setActiveStep(3);
  });
  session.addEventListener('send-progress', (event) => {
    if (!isCurrentSession(session, sessionToken)) return;
    updateProgress(event.detail.sentBytes, event.detail.totalBytes);
  });
  session.addEventListener('receive-progress', (event) => {
    if (!isCurrentSession(session, sessionToken)) return;
    updateProgress(event.detail.receivedBytes, event.detail.totalBytes);
  });
  session.addEventListener('accepted', () => {
    if (!isCurrentSession(session, sessionToken)) return;
    setStatus(elements.transferStatus, '对方已确认接收，可以开始发送。', false);
    elements.sendFiles.disabled = false;
    setActiveStep(3);
  });
  session.addEventListener('file-received', (event) => {
    if (!isCurrentSession(session, sessionToken)) return;
    state.receivedFiles.push(event.detail.file);
    setStatus(elements.transferStatus, `已接收：${event.detail.file.name}`, false);
  });
  session.addEventListener('transfer-complete', async (event) => {
    if (!isCurrentSession(session, sessionToken)) return;
    state.receivedFiles = event.detail.files;
    elements.downloadZip.disabled = state.receivedFiles.length === 0;
    await renderPreviews(state.receivedFiles);
    if (!isCurrentSession(session, sessionToken)) return;
    setActiveStep(4);
    setStatus(elements.transferStatus, `接收完成，共 ${state.receivedFiles.length} 个文件。`, false);
  });
  session.addEventListener('error', (event) => {
    if (!isCurrentSession(session, sessionToken)) return;
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
  closeActiveSession();
  state.manifest = null;
  state.receivedFiles = [];
  elements.sendFiles.disabled = true;
  elements.acceptTransfer.disabled = true;
  elements.downloadZip.disabled = true;
  elements.progress.value = 0;
  setActiveStep(1);
  renderFileList([]);
  cancelPreviews();

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
  button.addEventListener('click', () => switchMode(button.dataset.mode));
});

elements.deviceName.value = getStoredValue(nicknameKey) || getDefaultDeviceName();
updateConnectionHint();
elements.deviceName.addEventListener('change', () => {
  elements.deviceName.value = getNickname();
});

elements.fileInput.addEventListener('change', () => {
  const hadActiveConnection = Boolean(state.session || elements.signalCode.value.trim());
  resetSession({ clearCode: true });
  state.selectedFiles = Array.from(elements.fileInput.files || []);
  elements.fileInputName.textContent = state.selectedFiles.length
    ? `已选择 ${state.selectedFiles.length} 个文件`
    : '未选择文件';
  renderFileList(state.selectedFiles);
  if (hadActiveConnection) {
    setStatus(elements.signalStatus, '文件列表已变化，旧连接已失效，请重新生成发起码。', false);
    setStatus(elements.transferStatus, '等待重新生成连接。', false);
  }
});

elements.createOffer.addEventListener('click', async () => {
  if (!state.selectedFiles.length) {
    setStatus(elements.signalStatus, '请先选择要发送的文件。', true);
    return;
  }

  let session = null;
  let sessionToken = 0;

  try {
    resetSession({ clearCode: true });
    session = createTransferSession();
    sessionToken = state.sessionToken;
    const offer = await session.createOffer(state.selectedFiles);
    if (!isCurrentSession(session, sessionToken)) return;
    state.manifest = offer.manifest;
    renderFileList(state.manifest.files);
    renderSignalCode(encodeSignal(offer), buildSignalStatus(offer, '已生成发起码，请将连接码发给接收方。'));
    setActiveStep(2);
  } catch (error) {
    if (!session || isCurrentSession(session, sessionToken)) {
      closeActiveSession();
      setStatus(elements.signalStatus, `生成发起码失败：${error.message}`, true);
    }
  }
});

elements.sendFiles.addEventListener('click', async () => {
  if (!state.session) {
    setStatus(elements.transferStatus, '连接尚未建立，无法发送文件。', true);
    return;
  }

  const session = state.session;
  const sessionToken = state.sessionToken;
  elements.sendFiles.disabled = true;
  setActiveStep(4);
  setStatus(elements.transferStatus, '正在发送文件...', false);

  try {
    await session.sendFiles();
    if (!isCurrentSession(session, sessionToken)) return;
    setStatus(elements.transferStatus, '文件发送完成。', false);
  } catch (error) {
    if (!isCurrentSession(session, sessionToken)) return;
    setStatus(elements.transferStatus, `发送失败：${error.message}`, true);
    elements.sendFiles.disabled = session.channel?.readyState !== 'open';
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

  let session = null;
  let sessionToken = 0;

  try {
    resetSession({ clearCode: false });
    setMode('receive');
    session = createTransferSession();
    sessionToken = state.sessionToken;

    const offer = decodeSignal(code);
    if (offer.type !== 'offer') throw new Error('请导入发起码，而不是回应码');
    const answer = await session.acceptOffer(offer);
    if (!isCurrentSession(session, sessionToken)) return;
    renderSignalCode(encodeSignal(answer), buildSignalStatus(answer, '已生成回应码，请复制给发送方。'));
    elements.acceptTransfer.disabled = false;
    elements.sendFiles.disabled = true;
    setActiveStep(3);
    setStatus(elements.transferStatus, '已读取文件清单，请确认是否接收。', false);
  } catch (error) {
    if (!session || isCurrentSession(session, sessionToken)) {
      closeActiveSession();
      elements.acceptTransfer.disabled = true;
      setStatus(elements.signalStatus, `导入发起码失败：${error.message}`, true);
    }
  }
});

elements.importAnswer.addEventListener('click', async () => {
  if (!state.session) {
    setStatus(elements.signalStatus, '请先生成发起码。', true);
    return;
  }

  const session = state.session;
  const sessionToken = state.sessionToken;

  try {
    const answer = decodeSignal(elements.signalCode.value);
    if (answer.type !== 'answer') throw new Error('请导入回应码，而不是发起码');
    await session.acceptAnswer(answer);
    if (!isCurrentSession(session, sessionToken)) return;
    setMode('send');
    setActiveStep(3);
    setStatus(elements.signalStatus, '回应码已导入，正在建立连接。', false);
    setStatus(elements.transferStatus, '等待接收方确认文件。', false);
  } catch (error) {
    if (!isCurrentSession(session, sessionToken)) return;
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
    setActiveStep(4);
    setStatus(elements.transferStatus, '已确认接收，等待对方发送文件。', false);
  } catch (error) {
    setStatus(elements.transferStatus, `确认接收失败：${error.message}`, true);
  }
});

elements.downloadZip.addEventListener('click', async () => {
  const sessionToken = state.sessionToken;
  const files = state.receivedFiles.slice();
  elements.downloadZip.disabled = true;
  setStatus(elements.transferStatus, '正在打包 ZIP...', false);

  try {
    const blob = await zipReceivedFiles(files, sessionToken);
    if (sessionToken !== state.sessionToken) return;
    downloadBlob('lan-transfer-files.zip', blob);
    setStatus(elements.transferStatus, 'ZIP 已开始下载。', false);
  } catch (error) {
    if (sessionToken !== state.sessionToken) return;
    setStatus(elements.transferStatus, `下载 ZIP 失败：${error.message}`, true);
  } finally {
    if (sessionToken === state.sessionToken) {
      elements.downloadZip.disabled = state.receivedFiles.length === 0;
    }
  }
});

elements.clearTransfer.addEventListener('click', () => {
  resetSession({ clearCode: true, clearSelectedFiles: true });
  setMode('send');
  setStatus(elements.transferStatus, '已清空本次传输。', false);
});

elements.resetSession.addEventListener('click', () => {
  resetSession({ clearCode: true, clearSelectedFiles: true });
  setStatus(elements.signalStatus, '已重置连接，请重新生成连接码。', false);
  setStatus(elements.transferStatus, '已重置传输状态。', false);
});

setMode('send');
setActiveStep(1);

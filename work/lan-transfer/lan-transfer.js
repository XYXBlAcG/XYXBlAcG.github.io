import { copyText, setStatus } from '../tools/shared/tools.js';
import {
  encodeSignal,
  formatBytes,
  getDefaultDeviceName,
  normalizeDeviceName,
} from './lan-transfer-core.mjs';
import { LanTransferSession } from './webrtc-transfer.js';

const nicknameKey = 'xyx-lan-transfer-nickname';
const recentPeerKey = 'xyx-lan-transfer-recent-peer';
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
  progress: document.getElementById('transfer-progress'),
  sendFiles: document.getElementById('send-files'),
  copyCode: document.getElementById('copy-code'),
  resetSession: document.getElementById('reset-session'),
  clearTransfer: document.getElementById('clear-transfer'),
  downloadZip: document.getElementById('download-zip'),
};

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
  localStorage.setItem(nicknameKey, normalized);
  return normalized;
}

function renderSignalCode(code) {
  elements.signalCode.value = code;

  if (globalThis.QRCode?.toCanvas) {
    globalThis.QRCode.toCanvas(elements.signalQr, code, { width: 240, margin: 1 }, (error) => {
      setStatus(
        elements.signalStatus,
        error ? `二维码生成失败：${error.message}` : '已生成二维码和连接码。',
        !!error,
      );
    });
  } else {
    setStatus(elements.signalStatus, '二维码库尚未加载，请复制连接码。', true);
  }
}

function bindSession(session) {
  session.addEventListener('connection', (event) => {
    setStatus(elements.transferStatus, `连接状态：${event.detail.state}`, false);
  });
  session.addEventListener('channel-open', () => {
    setStatus(elements.transferStatus, '连接已建立，等待接收方确认。', false);
  });
  session.addEventListener('channel-close', () => {
    setStatus(elements.transferStatus, '连接已关闭。', false);
  });
  session.addEventListener('manifest', (event) => {
    state.manifest = event.detail.manifest;
    if (event.detail.peerName) localStorage.setItem(recentPeerKey, event.detail.peerName);
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
  });
  session.addEventListener('transfer-complete', (event) => {
    state.receivedFiles = event.detail.files;
    setStatus(elements.transferStatus, `传输完成，已收到 ${event.detail.files.length} 个文件。`, false);
  });
  session.addEventListener('error', (event) => {
    setStatus(elements.transferStatus, event.detail.message, true);
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
    `传输进度：${percent}% (${formatBytes(done)} / ${formatBytes(total)})`,
    false,
  );
}

function resetSession({ clearCode = true } = {}) {
  state.session?.close();
  state.session = null;
  state.manifest = null;
  state.receivedFiles = [];
  elements.sendFiles.disabled = true;
  elements.downloadZip.disabled = true;
  elements.progress.value = 0;
  renderFileList([]);

  if (clearCode) {
    elements.signalCode.value = '';
    const context = elements.signalQr.getContext('2d');
    context?.clearRect(0, 0, elements.signalQr.width, elements.signalQr.height);
  }
}

document.querySelectorAll('.lan-mode-button').forEach((button) => {
  button.addEventListener('click', () => setMode(button.dataset.mode));
});

elements.deviceName.value = localStorage.getItem(nicknameKey) || getDefaultDeviceName();
elements.deviceName.addEventListener('change', () => {
  elements.deviceName.value = getNickname();
});

elements.fileInput.addEventListener('change', () => {
  state.selectedFiles = Array.from(elements.fileInput.files || []);
  elements.fileInputName.textContent = state.selectedFiles.length
    ? `已选择 ${state.selectedFiles.length} 个文件`
    : '未选择文件';
  renderFileList(state.selectedFiles);
  elements.progress.value = 0;
});

document.getElementById('create-offer').addEventListener('click', async () => {
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
    renderSignalCode(encodeSignal(offer));
  } catch (error) {
    state.session?.close();
    state.session = null;
    setStatus(elements.signalStatus, `生成发起码失败：${error.message}`, true);
  }
});

elements.copyCode.addEventListener('click', () => {
  if (!elements.signalCode.value.trim()) {
    setStatus(elements.signalStatus, '暂无连接码可复制。', true);
    return;
  }
  copyText(elements.signalCode.value, elements.signalStatus);
});

elements.resetSession.addEventListener('click', () => {
  resetSession({ clearCode: true });
  setStatus(elements.signalStatus, '已重置连接。', false);
  setStatus(elements.transferStatus, '', false);
});

elements.clearTransfer.addEventListener('click', () => {
  resetSession({ clearCode: false });
  setStatus(elements.transferStatus, '已清空本次传输状态。', false);
});

setMode('send');

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

if (globalThis.XYX_LAN_TRANSFER_AUTH_READY) {
  await globalThis.XYX_LAN_TRANSFER_AUTH_READY;
}

const nicknameKey = 'xyx-lan-transfer-nickname';
const recentPeerKey = 'xyx-lan-transfer-recent-peer';
const cloudflareSignalingApiBase = 'https://lan-signaling.xech.workers.dev/api';
const answerPollIntervalMs = 1000;
const connectionStateLabels = {
  new: '新建',
  connecting: '连接中',
  connected: '已连接',
  disconnected: '连接中断',
  failed: '连接失败',
  closed: '已关闭',
};

function isPrivateIpv4(hostname) {
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;

  const match = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function getSignalingApiBase() {
  if (globalThis.XYX_LAN_TRANSFER_CONFIG?.signalingApiBase) {
    return globalThis.XYX_LAN_TRANSFER_CONFIG.signalingApiBase;
  }

  const hostname = location.hostname;
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
  return localHosts.has(hostname) || isPrivateIpv4(hostname)
    ? './api'
    : cloudflareSignalingApiBase;
}

const signalingApiBase = getSignalingApiBase();

const state = {
  mode: '',
  session: null,
  sessionToken: 0,
  previewToken: 0,
  selectedFiles: [],
  manifest: null,
  receivedFiles: [],
  sending: false,
  signalingAvailable: false,
  shortCode: '',
  answerPollTimer: 0,
  scanStream: null,
  scanFrame: 0,
  shareBaseUrl: '',
  autoAccepted: false,
  transferStarted: false,
};

const elements = {
  deviceName: document.getElementById('device-name'),
  usePublicStun: document.getElementById('use-public-stun'),
  fileInput: document.getElementById('file-input'),
  fileInputName: document.getElementById('file-input-name'),
  filePickStatus: document.getElementById('file-pick-status'),
  dropZone: document.getElementById('drop-zone'),
  networkInfo: document.getElementById('network-info'),
  signalingStatus: document.getElementById('signaling-status'),
  signalCode: document.getElementById('signal-code'),
  signalQr: document.getElementById('signal-qr'),
  signalStatus: document.getElementById('signal-status'),
  signalPanel: document.getElementById('signal-panel'),
  shortCodeWrap: document.getElementById('short-code-wrap'),
  shortCodeDisplay: document.getElementById('short-code'),
  shortCodeInput: document.getElementById('short-code-input'),
  connectShortCode: document.getElementById('connect-short-code'),
  scanQr: document.getElementById('scan-qr'),
  scanner: document.getElementById('scanner'),
  scannerVideo: document.getElementById('scanner-video'),
  scannerStatus: document.getElementById('scanner-status'),
  receiveStatus: document.getElementById('receive-status'),
  manualCodeDetails: document.getElementById('manual-code-details'),
  transferStatus: document.getElementById('transfer-status'),
  connectionHint: document.getElementById('connection-hint'),
  fileList: document.getElementById('file-list'),
  previewList: document.getElementById('preview-list'),
  progress: document.getElementById('transfer-progress'),
  createOffer: document.getElementById('create-offer'),
  importOffer: document.getElementById('import-offer'),
  importAnswer: document.getElementById('import-answer'),
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

async function fetchJson(path, options = {}) {
  const response = await fetch(`${signalingApiBase}${path}`, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function postJson(path, data) {
  return fetchJson(path, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

function describeConnectionState(value) {
  return connectionStateLabels[value] || '未知状态';
}

function isCurrentSession(session, sessionToken) {
  return state.session === session && state.sessionToken === sessionToken;
}

function closeActiveSession() {
  const session = state.session;
  stopAnswerPolling();
  state.sessionToken += 1;
  state.session = null;
  session?.close();
}

function stopAnswerPolling() {
  if (!state.answerPollTimer) return;
  clearInterval(state.answerPollTimer);
  state.answerPollTimer = 0;
}

function stopScanner() {
  if (state.scanFrame) {
    cancelAnimationFrame(state.scanFrame);
    state.scanFrame = 0;
  }
  if (state.scanStream) {
    state.scanStream.getTracks().forEach((track) => track.stop());
    state.scanStream = null;
  }
  if (elements.scannerVideo) {
    elements.scannerVideo.srcObject = null;
  }
  if (elements.scanner) {
    elements.scanner.hidden = true;
  }
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
  updateModeControls();
}

function setActiveStep(step) {
  elements.steps.forEach((item) => {
    item.classList.toggle('is-active', Number(item.dataset.step) === step);
  });
}

function updateModeControls() {
  const receiveMode = state.mode === 'receive';
  elements.signalPanel.hidden = receiveMode && state.signalingAvailable;
  elements.importAnswer.hidden = state.signalingAvailable;
  elements.pasteCode.hidden = state.signalingAvailable && !receiveMode;
  elements.manualCodeDetails.open = !state.signalingAvailable;
  elements.connectShortCode.disabled = !state.signalingAvailable;
  elements.scanQr.disabled = !state.signalingAvailable;
  elements.importOffer.hidden = state.signalingAvailable;
  elements.shortCodeWrap.hidden = !state.shortCode;
}

function setSignalStatus(message, isError = false) {
  setStatus(elements.signalStatus, message, isError);
  setStatus(elements.receiveStatus, message, isError);
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

function getBrowserConnectionInfo() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) return '浏览器未提供';
  const parts = [
    connection.effectiveType ? `类型 ${connection.effectiveType}` : '',
    connection.downlink ? `下行 ${connection.downlink} Mbps` : '',
    connection.rtt ? `延迟 ${connection.rtt} ms` : '',
  ].filter(Boolean);
  return parts.join('，') || '浏览器未提供';
}

function renderNetworkInfo(serverInfo = null) {
  const items = [
    ['当前页面', location.href],
    ['推荐手机访问', state.shareBaseUrl || location.href],
    ['访问主机', location.host],
    ['页面协议', location.protocol.replace(':', '').toUpperCase()],
    ['浏览器网络', getBrowserConnectionInfo()],
    ['WebRTC', globalThis.RTCPeerConnection ? '支持' : '不支持'],
    ['短码服务', state.signalingAvailable ? '可用' : '不可用'],
    ['信令接口', signalingApiBase],
  ];

  if (serverInfo?.interfaces?.length) {
    items.push(['局域网地址', serverInfo.interfaces.map((item) => item.url).join('  ')]);
  }

  elements.networkInfo.replaceChildren(...items.map(([label, value]) => {
    const item = document.createElement('div');
    const labelNode = document.createElement('span');
    const valueNode = document.createElement('strong');

    item.className = 'lan-info-item';
    labelNode.textContent = label;
    valueNode.textContent = value;
    item.append(labelNode, valueNode);
    return item;
  }));
}

async function initSignaling() {
  let serverInfo = null;

  try {
    await fetchJson('/health');
    state.signalingAvailable = true;
    try {
      serverInfo = await fetchJson('/network');
    } catch {
      serverInfo = null;
    }
    state.shareBaseUrl = chooseShareBaseUrl(serverInfo);
    setStatus(elements.signalingStatus, '短码服务已连接：可以使用 4 位数字发起码。', false);
  } catch {
    state.signalingAvailable = false;
    state.shareBaseUrl = location.href;
    setStatus(elements.signalingStatus, '短码服务不可用：当前为静态兜底模式，需要手动交换高级连接码。', true);
  }

  renderNetworkInfo(serverInfo);
  updateModeControls();
}

function chooseShareBaseUrl(serverInfo) {
  const currentUrl = new URL(location.href);
  currentUrl.search = '';
  currentUrl.hash = '';
  const hostname = currentUrl.hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return currentUrl.href;
  }

  const interfaces = serverInfo?.interfaces || [];
  const preferred = interfaces.find((item) => !item.name.toLowerCase().startsWith('bridge'))
    || interfaces[0];
  return preferred?.url || currentUrl.href;
}

function getShortCodeUrl(code) {
  const url = new URL(state.shareBaseUrl || location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('mode', 'receive');
  url.searchParams.set('code', code);
  return url.href;
}

function normalizeShortCode(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 4);
}

async function publishOffer(offer) {
  const result = await postJson('/offers', { offer });
  if (!result?.code) throw new Error('短码服务没有返回发起码');
  return result;
}

async function postAnswer(code, answer) {
  await postJson(`/answers/${encodeURIComponent(code)}`, { answer });
}

async function fetchOfferByCode(code) {
  const result = await fetchJson(`/offers/${encodeURIComponent(code)}`);
  if (!result?.offer) throw new Error('没有找到这个发起码');
  return result.offer;
}

function startAnswerPolling(code, session, sessionToken) {
  stopAnswerPolling();
  state.answerPollTimer = setInterval(async () => {
    try {
      const result = await fetchJson(`/answers/${encodeURIComponent(code)}`);
      if (!result?.ready) return;
      stopAnswerPolling();
      await session.acceptAnswer(result.answer);
      if (!isCurrentSession(session, sessionToken)) return;
      if (result.answer?.nickname) {
        setStoredValue(recentPeerKey, result.answer.nickname);
        updateConnectionHint();
      }
      setActiveStep(3);
      setSignalStatus('接收方已回应，正在建立连接。', false);
      setStatus(elements.transferStatus, '接收方已连接，准备自动发送。', false);
    } catch (error) {
      if (!isCurrentSession(session, sessionToken)) return;
      stopAnswerPolling();
      setSignalStatus(`等待回应失败：${error.message}`, true);
    }
  }, answerPollIntervalMs);
}

async function connectWithShortCode(rawCode) {
  const code = normalizeShortCode(rawCode);
  if (code.length < 2) {
    setSignalStatus('请输入 2 到 4 位发起码。', true);
    return;
  }

  let session = null;
  let sessionToken = 0;

  try {
    resetSession({ clearCode: true, clearSelectedFiles: true });
    setMode('receive');
    session = createTransferSession();
    sessionToken = state.sessionToken;
    const offer = await fetchOfferByCode(code);
    const answer = await session.acceptOffer(offer);
    if (!isCurrentSession(session, sessionToken)) return;
    await postAnswer(code, answer);
    elements.sendFiles.disabled = true;
    setActiveStep(3);
    setSignalStatus(`已连接发起码 ${code}，回应已发送。`, false);
    setStatus(elements.transferStatus, '已读取文件清单，连接建立后会自动接收。', false);
    tryAutoAcceptTransfer();
  } catch (error) {
    if (!session || isCurrentSession(session, sessionToken)) {
      closeActiveSession();
      setSignalStatus(`连接发起码失败：${error.message}`, true);
    }
  }
}

function parseCodeFromQrValue(value) {
  const text = String(value || '').trim();
  const shortCode = normalizeShortCode(text);
  if (/^\d{2,4}$/.test(text) && shortCode) return shortCode;

  try {
    const url = new URL(text);
    return normalizeShortCode(url.searchParams.get('code'));
  } catch {
    return '';
  }
}

async function scanQrCode() {
  if (!state.signalingAvailable) {
    setStatus(elements.scannerStatus, '当前没有短码服务，无法扫码连接。', true);
    return;
  }
  if (!globalThis.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    elements.scanner.hidden = false;
    setStatus(elements.scannerStatus, '当前浏览器可能要求 HTTPS 才能调用相机。可以直接用手机系统相机扫描发送端二维码打开页面。', true);
    return;
  }
  if (!globalThis.BarcodeDetector) {
    elements.scanner.hidden = false;
    setStatus(elements.scannerStatus, '当前浏览器不支持网页内扫码。可以直接用手机系统相机扫描发送端二维码打开页面。', true);
    return;
  }

  stopScanner();
  elements.scanner.hidden = false;

  try {
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    state.scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    elements.scannerVideo.srcObject = state.scanStream;
    await elements.scannerVideo.play();
    setStatus(elements.scannerStatus, '正在扫描二维码...', false);

    const tick = async () => {
      if (!state.scanStream) return;
      try {
        const codes = await detector.detect(elements.scannerVideo);
        const code = parseCodeFromQrValue(codes[0]?.rawValue);
        if (code) {
          stopScanner();
          elements.shortCodeInput.value = code;
          setSignalStatus(`已识别发起码 ${code}。`, false);
          await connectWithShortCode(code);
          return;
        }
      } catch (error) {
        setStatus(elements.scannerStatus, `扫码失败：${error.message}`, true);
      }
      state.scanFrame = requestAnimationFrame(tick);
    };

    state.scanFrame = requestAnimationFrame(tick);
  } catch (error) {
    stopScanner();
    elements.scanner.hidden = false;
    setStatus(elements.scannerStatus, `无法打开相机：${error.message}。可以直接用手机系统相机扫描发送端二维码打开页面。`, true);
  }
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
  stopScanner();
  setMode(mode);
  setActiveStep(1);
  if (hadActiveState) {
    setSignalStatus('已切换模式，旧连接已失效。', false);
    setStatus(elements.transferStatus, '请重新交换短码或高级连接码。', false);
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

function waitForQrCodeLibrary(timeoutMs = 2000) {
  if (globalThis.QRCode?.toCanvas) return Promise.resolve(globalThis.QRCode);

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const tick = () => {
      if (globalThis.QRCode?.toCanvas) {
        resolve(globalThis.QRCode);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error('二维码库尚未加载完成'));
        return;
      }
      requestAnimationFrame(tick);
    };

    tick();
  });
}

async function renderQrCode(value, successMessage) {
  try {
    const qrCode = await waitForQrCodeLibrary();
    await new Promise((resolve) => {
      qrCode.toCanvas(elements.signalQr, value, { width: 240, margin: 1 }, (error) => {
        setSignalStatus(error ? `二维码生成失败：${error.message}` : successMessage, !!error);
        resolve();
      });
    });
  } catch (error) {
    setSignalStatus(`${error.message}，请复制当前代码。`, true);
  }
}

async function renderSignalCode(code, successMessage = '已生成二维码和连接码。') {
  state.shortCode = '';
  elements.shortCodeDisplay.textContent = '----';
  elements.shortCodeWrap.hidden = true;
  elements.signalCode.value = code;
  elements.manualCodeDetails.open = true;
  await renderQrCode(code, successMessage);
}

async function renderShortCode(code, url, successMessage = '已生成发起码。') {
  state.shortCode = code;
  elements.shortCodeDisplay.textContent = code;
  elements.shortCodeWrap.hidden = false;
  elements.signalCode.value = code;
  elements.manualCodeDetails.open = false;
  await renderQrCode(url, successMessage);
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

function appendPreviewDownload(card, file) {
  if (!getDownloadBlob(file)) return;
  const actions = document.createElement('div');
  const button = document.createElement('button');

  actions.className = 'tool-actions lan-preview-actions';
  button.className = 'tool-button';
  button.type = 'button';
  button.textContent = '下载此文件';
  button.addEventListener('click', () => downloadTransferFile(file));
  actions.appendChild(button);
  card.appendChild(actions);
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

    appendPreviewDownload(card, file);
    elements.previewList.appendChild(card);
  }
}

async function readClipboardCode() {
  try {
    if (!globalThis.navigator?.clipboard?.readText) {
      throw new Error('当前浏览器不支持读取剪贴板');
    }
    const text = await globalThis.navigator.clipboard.readText();
    const shortCode = normalizeShortCode(text);
    if (state.mode === 'receive' && state.signalingAvailable && shortCode) {
      elements.shortCodeInput.value = shortCode;
      setSignalStatus('已从剪贴板读取发起码。', false);
      return;
    }
    elements.signalCode.value = text;
    setSignalStatus('已从剪贴板读取高级连接码。', false);
  } catch (error) {
    setSignalStatus(`读取剪贴板失败：${error.message}。请手动粘贴。`, true);
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

function getDownloadBlob(file) {
  if (file?.blob instanceof Blob) return file.blob;
  if (file instanceof Blob) return file;
  return null;
}

function downloadTransferFile(file) {
  const blob = getDownloadBlob(file);
  if (!blob) {
    setStatus(elements.transferStatus, '这个文件暂时不能单独下载。', true);
    return;
  }
  downloadBlob(safeFilename(file.name), blob);
  setStatus(elements.transferStatus, `已开始下载：${file.name}`, false);
}

function tryAutoAcceptTransfer() {
  if (state.mode !== 'receive' || !state.session || !state.manifest) return false;
  if (state.autoAccepted) return true;

  try {
    state.session.acceptTransfer();
    state.autoAccepted = true;
    setActiveStep(4);
    setStatus(elements.transferStatus, '已准备接收，等待发送端传输文件。', false);
    return true;
  } catch {
    return false;
  }
}

async function startSendingFiles() {
  if (!state.session) {
    setStatus(elements.transferStatus, '连接尚未建立，无法发送文件。', true);
    return;
  }
  if (state.sending || state.transferStarted) return;

  const session = state.session;
  const sessionToken = state.sessionToken;
  state.sending = true;
  state.transferStarted = true;
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
    state.transferStarted = false;
    elements.sendFiles.disabled = session.channel?.readyState !== 'open';
  } finally {
    if (isCurrentSession(session, sessionToken)) {
      state.sending = false;
    }
  }
}

function bindSession(session, sessionToken) {
  session.addEventListener('connection', (event) => {
    if (!isCurrentSession(session, sessionToken)) return;
    setStatus(elements.transferStatus, `连接状态：${describeConnectionState(event.detail.state)}`, false);
  });
  session.addEventListener('channel-open', () => {
    if (!isCurrentSession(session, sessionToken)) return;
    if (state.mode === 'receive' && tryAutoAcceptTransfer()) return;
    setStatus(elements.transferStatus, '连接已建立，等待接收端准备完成。', false);
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
    tryAutoAcceptTransfer();
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
    setStatus(elements.transferStatus, '接收端已准备好，开始发送。', false);
    elements.sendFiles.disabled = true;
    setActiveStep(3);
    startSendingFiles();
  });
  session.addEventListener('file-received', (event) => {
    if (!isCurrentSession(session, sessionToken)) return;
    state.receivedFiles.push(event.detail.file);
    setStatus(elements.transferStatus, `已接收：${event.detail.file.name}`, false);
    renderFileList(state.receivedFiles);
  });
  session.addEventListener('transfer-complete', async (event) => {
    if (!isCurrentSession(session, sessionToken)) return;
    state.receivedFiles = event.detail.files;
    elements.downloadZip.disabled = state.receivedFiles.length === 0;
    renderFileList(state.receivedFiles);
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
    const meta = document.createElement('div');
    const name = document.createElement('strong');
    const size = document.createElement('span');

    row.className = 'lan-file-row';
    meta.className = 'lan-file-meta';
    name.textContent = file.name;
    size.textContent = formatBytes(file.size);
    meta.append(name, size);
    row.appendChild(meta);

    if (getDownloadBlob(file)) {
      const button = document.createElement('button');
      button.className = 'tool-button lan-file-download';
      button.type = 'button';
      button.textContent = '下载';
      button.addEventListener('click', () => downloadTransferFile(file));
      row.appendChild(button);
    }

    elements.fileList.append(row);
  });
}

function updateSelectedFiles(files, sourceMessage = '') {
  const fileList = Array.from(files || []).filter((file) => file instanceof File);
  const hadActiveConnection = Boolean(state.session || elements.signalCode.value.trim() || state.shortCode);

  resetSession({ clearCode: true });
  state.selectedFiles = fileList;
  elements.fileInputName.textContent = state.selectedFiles.length
    ? `已选择 ${state.selectedFiles.length} 个文件`
    : '未选择文件；也可以拖拽文件到这里，或按 Ctrl/Command+V 粘贴';
  renderFileList(state.selectedFiles);

  if (sourceMessage) {
    setStatus(elements.filePickStatus, sourceMessage, false);
  }

  if (hadActiveConnection) {
    setSignalStatus('文件列表已变化，旧连接已失效，请重新生成发起码。', false);
    setStatus(elements.transferStatus, '等待重新生成连接。', false);
  }
}

function getClipboardFiles(event) {
  const files = Array.from(event.clipboardData?.files || []);
  if (files.length) return files;
  return Array.from(event.clipboardData?.items || [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter(Boolean);
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
  state.shortCode = '';
  state.sending = false;
  state.autoAccepted = false;
  state.transferStarted = false;
  elements.sendFiles.disabled = true;
  elements.downloadZip.disabled = true;
  elements.progress.value = 0;
  setActiveStep(1);
  renderFileList([]);
  cancelPreviews();

  if (clearSelectedFiles) {
    state.selectedFiles = [];
    elements.fileInput.value = '';
    elements.fileInputName.textContent = '未选择文件；也可以拖拽文件到这里，或按 Ctrl/Command+V 粘贴';
  }

  if (clearCode) {
    elements.signalCode.value = '';
    elements.shortCodeDisplay.textContent = '----';
    elements.shortCodeWrap.hidden = true;
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
  updateSelectedFiles(elements.fileInput.files, '文件已加入发送列表。');
});

elements.dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  elements.dropZone.classList.add('is-dragging');
});

elements.dropZone.addEventListener('dragleave', () => {
  elements.dropZone.classList.remove('is-dragging');
});

elements.dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  elements.dropZone.classList.remove('is-dragging');
  if (state.mode !== 'send') {
    setStatus(elements.filePickStatus, '请先切换到发送文件模式。', true);
    return;
  }
  updateSelectedFiles(event.dataTransfer?.files, '已从拖拽加入文件。');
});

document.addEventListener('paste', (event) => {
  if (state.mode !== 'send') return;
  const files = getClipboardFiles(event);
  if (!files.length) return;
  event.preventDefault();
  updateSelectedFiles(files, '已从剪贴板加入文件。');
});

elements.createOffer.addEventListener('click', async () => {
  if (!state.selectedFiles.length) {
    setSignalStatus('请先选择要发送的文件。', true);
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

    if (state.signalingAvailable) {
      const { code } = await publishOffer(offer);
      if (!isCurrentSession(session, sessionToken)) return;
      const shortUrl = getShortCodeUrl(code);
      await renderShortCode(code, shortUrl, `已生成 ${code}，接收方可输入发起码或扫码打开。`);
      startAnswerPolling(code, session, sessionToken);
      setStatus(elements.transferStatus, '等待接收方输入发起码。', false);
    } else {
      await renderSignalCode(encodeSignal(offer), buildSignalStatus(offer, '已生成高级连接码，请复制给接收方。'));
    }
    setActiveStep(2);
  } catch (error) {
    if (!session || isCurrentSession(session, sessionToken)) {
      closeActiveSession();
      setSignalStatus(`生成发起码失败：${error.message}`, true);
    }
  }
});

elements.sendFiles.addEventListener('click', startSendingFiles);

elements.copyCode.addEventListener('click', () => {
  const value = state.shortCode || elements.signalCode.value.trim();
  if (!value) {
    setSignalStatus('暂无发起码可复制。', true);
    return;
  }
  copyText(value, elements.signalStatus);
});

elements.pasteCode.addEventListener('click', readClipboardCode);

elements.shortCodeInput.addEventListener('input', () => {
  elements.shortCodeInput.value = normalizeShortCode(elements.shortCodeInput.value);
});

elements.connectShortCode.addEventListener('click', () => {
  connectWithShortCode(elements.shortCodeInput.value);
});

elements.scanQr.addEventListener('click', scanQrCode);

elements.importOffer.addEventListener('click', async () => {
  const code = elements.signalCode.value.trim();
  if (!code) {
    setSignalStatus('请先粘贴发起码。', true);
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
    await renderSignalCode(encodeSignal(answer), buildSignalStatus(answer, '已生成回应码，请复制给发送方。'));
    elements.sendFiles.disabled = true;
    setActiveStep(3);
    setStatus(elements.transferStatus, '已读取文件清单，连接建立后会自动接收。', false);
    tryAutoAcceptTransfer();
  } catch (error) {
    if (!session || isCurrentSession(session, sessionToken)) {
      closeActiveSession();
      setSignalStatus(`导入发起码失败：${error.message}`, true);
    }
  }
});

elements.importAnswer.addEventListener('click', async () => {
  if (!state.session) {
    setSignalStatus('请先生成发起码。', true);
    return;
  }

  const session = state.session;
  const sessionToken = state.sessionToken;

  try {
    const answer = decodeSignal(elements.signalCode.value);
    if (answer.type !== 'answer') throw new Error('请导入回应码，而不是发起码');
    await session.acceptAnswer(answer);
    if (!isCurrentSession(session, sessionToken)) return;
    if (answer.nickname) {
      setStoredValue(recentPeerKey, answer.nickname);
      updateConnectionHint();
    }
    setMode('send');
    setActiveStep(3);
    setSignalStatus('回应码已导入，正在建立连接。', false);
    setStatus(elements.transferStatus, '接收方已连接，准备自动发送。', false);
  } catch (error) {
    if (!isCurrentSession(session, sessionToken)) return;
    setSignalStatus(`导入回应码失败：${error.message}`, true);
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
  setSignalStatus('已重置连接，请重新生成连接码。', false);
  setStatus(elements.transferStatus, '已重置传输状态。', false);
});

setMode('send');
setActiveStep(1);
renderNetworkInfo();

await initSignaling();

const initialParams = new URLSearchParams(location.search);
const initialMode = initialParams.get('mode');
const initialCode = normalizeShortCode(initialParams.get('code'));
if (initialMode === 'receive' || initialCode) {
  switchMode('receive');
  if (initialCode) {
    elements.shortCodeInput.value = initialCode;
    await connectWithShortCode(initialCode);
  }
}

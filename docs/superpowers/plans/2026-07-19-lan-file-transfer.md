# LAN File Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, Chinese-language WebRTC file transfer web app for quick same-LAN device-to-device file sharing from `work/lan-transfer/`.

**Architecture:** The app is a GitHub Pages-compatible static page. Devices exchange compressed WebRTC offer/answer codes manually by QR code or copy/paste; files then move peer-to-peer through an ordered WebRTC DataChannel. The receiver stores received files in memory for preview and JSZip download, with clear warnings for large files.

**Tech Stack:** Plain HTML/CSS/ES modules, WebRTC DataChannel, File/Blob APIs, Clipboard API, QRCode/LZString/JSZip browser builds, existing `work/tools/shared/tools.css` and `work/tools/shared/tools.js`.

**Implementation note:** Rendered QA replaced external CDN script tags with local vendored browser builds under `work/lan-transfer/vendor/` so GitHub Pages deployment does not depend on third-party script availability for the core pairing and ZIP flows.

---

## Confirmed Requirements

- Pure static app; no backend, no local relay service.
- Manual two-step WebRTC pairing: sender offer code, receiver answer code.
- QR code first, copy/paste second; connection code should be compressed and not designed for manual typing.
- Landing screen asks user to choose "发送文件" or "接收文件".
- Compatible with desktop and mobile browsers where WebRTC DataChannel is available.
- Any file size can be attempted, but v1 uses memory-first receive and must warn that large files may consume memory.
- Folder transfer is deferred.
- Receiver previews supported file types when possible.
- Multi-file transfers generate one ZIP download.
- Save only the most recent device nickname, not transfer history.
- Add entries in both `work/tools/index.html` and main site `#work`.
- Add CLI route aliases: `open transfer` and `open lan`.
- Default connection uses no public STUN. Advanced setting can enable public STUN to improve connection success.

## File Structure

- Create `work/lan-transfer/index.html`
  - App shell, Chinese labels, mode selection, pairing panels, file picker, transfer queue, preview area, ZIP download area.
- Create `work/lan-transfer/lan-transfer.css`
  - App-specific styles layered on top of `../tools/shared/tools.css`.
- Create `work/lan-transfer/lan-transfer-core.mjs`
  - Pure utilities: constants, device nickname, byte formatting, connection-code encode/decode wrappers, file kind detection, manifest building, progress formatting.
- Create `work/lan-transfer/webrtc-transfer.js`
  - Browser-only WebRTC session class: offer/answer creation, data channel lifecycle, file manifest handshake, chunk send/receive, progress events.
- Create `work/lan-transfer/file-preview.js`
  - Browser-only preview generation for image, text, PDF, audio, video, and unknown files.
- Create `work/lan-transfer/lan-transfer.js`
  - UI controller: mode state, form wiring, QR rendering, clipboard, WebRTC controller integration, JSZip download, reset.
- Create `tools/test-lan-transfer-core.mjs`
  - Node tests for pure core behavior.
- Modify `work/tools/index.html`
  - Add card under "图像与文件".
- Modify `index.html`
  - Add work item / quick launch entry for the app.
- Modify `cli/cli-core.mjs`
  - Add `transfer` route with `lan`, `lan-transfer`, `file-transfer`, `send` aliases.

---

## Task 1: Core Module and Tests

**Files:**
- Create: `work/lan-transfer/lan-transfer-core.mjs`
- Create: `tools/test-lan-transfer-core.mjs`

- [ ] **Step 1: Write the failing core tests**

Create `tools/test-lan-transfer-core.mjs`:

```js
import assert from 'node:assert/strict';
import {
  CODE_PREFIX,
  CHUNK_SIZE,
  buildManifest,
  classifyFile,
  formatBytes,
  formatEta,
  formatTransferSpeed,
  getDefaultDeviceName,
  normalizeDeviceName,
  safeFilename,
} from '../work/lan-transfer/lan-transfer-core.mjs';

assert.equal(CODE_PREFIX, 'XYX-LAN1:');
assert.equal(CHUNK_SIZE, 256 * 1024);

assert.equal(formatBytes(0), '0 B');
assert.equal(formatBytes(1024), '1.0 KB');
assert.equal(formatBytes(1024 * 1024 * 5.25), '5.3 MB');
assert.equal(formatTransferSpeed(1024 * 1024), '1.0 MB/s');
assert.equal(formatEta(0), '计算中');
assert.equal(formatEta(65), '1 分 5 秒');

assert.equal(normalizeDeviceName('  我的手机  '), '我的手机');
assert.match(getDefaultDeviceName(), /^设备-\d{4}$/);
assert.equal(safeFilename('a/b:c*.txt'), 'a_b_c_.txt');
assert.equal(safeFilename('   '), 'received-file');

assert.equal(classifyFile({ type: 'image/png', name: 'x.png' }), 'image');
assert.equal(classifyFile({ type: 'text/plain', name: 'x.txt' }), 'text');
assert.equal(classifyFile({ type: 'application/pdf', name: 'x.pdf' }), 'pdf');
assert.equal(classifyFile({ type: 'audio/mpeg', name: 'x.mp3' }), 'audio');
assert.equal(classifyFile({ type: 'video/mp4', name: 'x.mp4' }), 'video');
assert.equal(classifyFile({ type: '', name: 'script.py' }), 'text');
assert.equal(classifyFile({ type: '', name: 'archive.zip' }), 'unknown');

const manifest = buildManifest([
  new File(['abc'], 'a.txt', { type: 'text/plain', lastModified: 1000 }),
  new File(['1234'], 'b.bin', { type: '', lastModified: 2000 }),
]);
assert.equal(manifest.type, 'manifest');
assert.equal(manifest.files.length, 2);
assert.equal(manifest.files[0].id, 'file-1');
assert.equal(manifest.files[0].name, 'a.txt');
assert.equal(manifest.files[0].size, 3);
assert.equal(manifest.totalBytes, 7);

console.log('LAN transfer core tests passed');
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
node tools/test-lan-transfer-core.mjs
```

Expected: fails because `work/lan-transfer/lan-transfer-core.mjs` does not exist yet.

- [ ] **Step 3: Implement the core module**

Create `work/lan-transfer/lan-transfer-core.mjs` with these exports:

```js
export const CODE_PREFIX = 'XYX-LAN1:';
export const CHUNK_SIZE = 256 * 1024;
export const PUBLIC_STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
export const TEXT_PREVIEW_LIMIT = 240 * 1024;

export function getDefaultDeviceName() {
  return `设备-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
}

export function normalizeDeviceName(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  return name.slice(0, 24);
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(1)} ${units[index]}`;
}

export function formatTransferSpeed(bytesPerSecond) {
  return `${formatBytes(Math.max(0, bytesPerSecond))}/s`;
}

export function formatEta(seconds) {
  const value = Math.ceil(Number(seconds) || 0);
  if (value <= 0 || !Number.isFinite(value)) return '计算中';
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  return minutes > 0 ? `${minutes} 分 ${rest} 秒` : `${rest} 秒`;
}

export function safeFilename(name) {
  const cleaned = String(name || '').trim().replace(/[\\/:*?"<>|]/g, '_');
  return cleaned || 'received-file';
}

export function classifyFile(file) {
  const type = String(file?.type || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('text/')) return 'text';
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('video/')) return 'video';
  if (/\.(txt|md|json|csv|html|css|js|mjs|ts|py|xml|yaml|yml|log)$/i.test(name)) return 'text';
  return 'unknown';
}

export function buildManifest(files) {
  const entries = Array.from(files).map((file, index) => ({
    id: `file-${index + 1}`,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    lastModified: file.lastModified || 0,
    kind: classifyFile(file),
  }));
  return {
    type: 'manifest',
    version: 1,
    transferId: `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    files: entries,
    totalBytes: entries.reduce((sum, file) => sum + file.size, 0),
  };
}

export function encodeSignal(payload, lzString = globalThis.LZString) {
  if (!lzString?.compressToEncodedURIComponent) {
    throw new Error('连接码压缩库尚未加载');
  }
  return CODE_PREFIX + lzString.compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodeSignal(code, lzString = globalThis.LZString) {
  const value = String(code || '').trim();
  if (!value.startsWith(CODE_PREFIX)) throw new Error('连接码格式不正确');
  if (!lzString?.decompressFromEncodedURIComponent) {
    throw new Error('连接码解压库尚未加载');
  }
  const text = lzString.decompressFromEncodedURIComponent(value.slice(CODE_PREFIX.length));
  if (!text) throw new Error('连接码内容无法解码');
  return JSON.parse(text);
}
```

- [ ] **Step 4: Run tests and commit**

Run:

```bash
node tools/test-lan-transfer-core.mjs
```

Expected: `LAN transfer core tests passed`.

Commit:

```bash
git add work/lan-transfer/lan-transfer-core.mjs tools/test-lan-transfer-core.mjs
git commit -m "test: add lan transfer core utilities"
```

---

## Task 2: App Shell and Styling

**Files:**
- Create: `work/lan-transfer/index.html`
- Create: `work/lan-transfer/lan-transfer.css`

- [ ] **Step 1: Create the static HTML shell**

Create `work/lan-transfer/index.html` with:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>局域网快传</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@300;400;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../tools/shared/tools.css" />
  <link rel="stylesheet" href="./lan-transfer.css" />
  <script src="https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js" defer></script>
</head>
<body>
  <main class="tool-shell lan-shell">
    <nav class="tool-topbar" aria-label="局域网快传导航">
      <a class="tool-back" href="../tools/">返回工具中心</a>
      <a class="tool-back" href="../../index.html#work">返回作品区</a>
    </nav>

    <header>
      <h1 class="tool-title">局域网快传</h1>
      <p class="tool-subtitle">在同一局域网或可直连的设备之间快速传文件。文件通过浏览器点对点传输，不经过本站服务器。</p>
    </header>

    <section class="tool-panel lan-mode-panel" aria-label="选择模式">
      <button class="tool-button primary lan-mode-button" type="button" data-mode="send">发送文件</button>
      <button class="tool-button lan-mode-button" type="button" data-mode="receive">接收文件</button>
    </section>

    <section class="tool-panel tool-stack" aria-label="设备设置">
      <div class="tool-form-grid">
        <label class="tool-field">
          <span>我的设备昵称</span>
          <input id="device-name" class="tool-input" type="text" maxlength="24" />
        </label>
        <label class="tool-check lan-advanced-toggle">
          <input id="use-public-stun" class="tool-input" type="checkbox" />
          <span>高级设置：增强连接成功率</span>
        </label>
      </div>
      <p class="tool-status">默认只使用局域网直连；连接失败时可开启增强连接成功率。</p>
    </section>

    <section class="lan-steps" aria-label="连接步骤">
      <div class="lan-step is-active" data-step="1">1. 选择模式</div>
      <div class="lan-step" data-step="2">2. 交换连接码</div>
      <div class="lan-step" data-step="3">3. 确认文件</div>
      <div class="lan-step" data-step="4">4. 传输与下载</div>
    </section>

    <section class="tool-split even lan-workspace">
      <section class="tool-panel tool-stack" data-panel="send" hidden>
        <h2>发送文件</h2>
        <label class="tool-upload">
          <input id="file-input" class="tool-file" type="file" multiple />
          <span class="tool-upload-button">选择文件</span>
          <span id="file-input-name" class="tool-upload-name">未选择文件</span>
        </label>
        <div class="tool-actions">
          <button id="create-offer" class="tool-button primary" type="button">生成发起码</button>
          <button id="import-answer" class="tool-button" type="button">导入回应码</button>
          <button id="send-files" class="tool-button primary" type="button" disabled>开始发送</button>
        </div>
      </section>

      <section class="tool-panel tool-stack" data-panel="receive" hidden>
        <h2>接收文件</h2>
        <div class="tool-actions">
          <button id="import-offer" class="tool-button primary" type="button">导入发起码</button>
          <button id="create-answer" class="tool-button" type="button" disabled>生成回应码</button>
          <button id="accept-transfer" class="tool-button primary" type="button" disabled>确认接收全部文件</button>
        </div>
      </section>
    </section>

    <section class="tool-panel tool-stack" aria-label="连接码">
      <h2>连接码</h2>
      <div class="lan-code-grid">
        <div class="lan-qr-box"><canvas id="signal-qr" width="240" height="240" aria-label="连接码二维码"></canvas></div>
        <label class="tool-field">
          <span>连接码文本</span>
          <textarea id="signal-code" class="tool-textarea lan-code-textarea" spellcheck="false"></textarea>
        </label>
      </div>
      <div class="tool-actions">
        <button id="copy-code" class="tool-button" type="button">复制连接码</button>
        <button id="paste-code" class="tool-button" type="button">从剪贴板读取</button>
        <button id="reset-session" class="tool-button" type="button">重新生成连接</button>
      </div>
      <div id="signal-status" class="tool-status" role="status" aria-live="polite"></div>
    </section>

    <section class="tool-panel tool-stack" aria-label="文件与传输">
      <h2>文件列表</h2>
      <div id="file-list" class="lan-file-list"></div>
      <progress id="transfer-progress" class="lan-progress" value="0" max="100"></progress>
      <div id="transfer-status" class="tool-status" role="status" aria-live="polite"></div>
      <div class="tool-actions">
        <button id="download-zip" class="tool-button primary" type="button" disabled>下载 ZIP</button>
        <button id="clear-transfer" class="tool-button" type="button">清空本次传输</button>
      </div>
    </section>

    <section class="tool-panel tool-stack" aria-label="文件预览">
      <h2>预览</h2>
      <div id="preview-list" class="lan-preview-list"></div>
    </section>
  </main>

  <script type="module" src="./lan-transfer.js"></script>
  <script type="module" src="/assets/js/site-cli-sidebar.js"></script>
</body>
</html>
```

- [ ] **Step 2: Add app-specific CSS**

Create `work/lan-transfer/lan-transfer.css`:

```css
.lan-shell {
  max-width: 1180px;
}

.lan-mode-panel,
.lan-steps,
.lan-code-grid,
.lan-file-list,
.lan-preview-list {
  display: grid;
  gap: 14px;
}

.lan-mode-panel {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.lan-mode-button {
  min-height: 56px;
  font-size: 1.05rem;
}

.lan-steps {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 24px 0;
}

.lan-step {
  min-height: 44px;
  padding: 10px 12px;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--line);
  border-radius: 8px;
}

.lan-step.is-active {
  color: #071312;
  background: var(--accent);
  border-color: var(--accent);
  font-weight: 600;
}

.lan-code-grid {
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  align-items: stretch;
}

.lan-qr-box {
  display: grid;
  place-items: center;
  min-height: 280px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--line);
  border-radius: 8px;
}

.lan-code-textarea {
  min-height: 280px;
  font-size: 0.78rem;
}

.lan-file-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.18);
}

.lan-file-row strong,
.lan-file-row span {
  overflow-wrap: anywhere;
}

.lan-progress {
  width: 100%;
  height: 12px;
  accent-color: var(--accent);
}

.lan-preview-card {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.18);
}

.lan-preview-card img,
.lan-preview-card video,
.lan-preview-card audio,
.lan-preview-card iframe {
  max-width: 100%;
  border: 0;
  border-radius: 8px;
}

.lan-preview-card iframe {
  width: 100%;
  min-height: 460px;
  background: #fff;
}

.lan-preview-text {
  max-height: 360px;
  overflow: auto;
}

@media screen and (max-width: 760px) {
  .lan-mode-panel,
  .lan-steps,
  .lan-code-grid {
    grid-template-columns: 1fr;
  }

  .lan-step {
    min-height: 38px;
  }

  .lan-code-textarea {
    min-height: 180px;
  }
}
```

- [ ] **Step 3: Static validation and commit**

Run:

```bash
python3 -m http.server 5181 --bind 127.0.0.1
```

Open `http://127.0.0.1:5181/work/lan-transfer/` and verify the page renders, has Chinese text, no horizontal overflow at 390px width.

Commit:

```bash
git add work/lan-transfer/index.html work/lan-transfer/lan-transfer.css
git commit -m "feat: add lan transfer app shell"
```

---

## Task 3: WebRTC Pairing and DataChannel

**Files:**
- Create: `work/lan-transfer/webrtc-transfer.js`
- Modify: `work/lan-transfer/lan-transfer.js`

- [ ] **Step 1: Implement WebRTC session class**

Create `work/lan-transfer/webrtc-transfer.js` with these public methods:

```js
import { CHUNK_SIZE, PUBLIC_STUN_SERVERS, buildManifest } from './lan-transfer-core.mjs';

function waitForIceGathering(peer) {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      if (peer.iceGatheringState === 'complete') {
        peer.removeEventListener('icegatheringstatechange', done);
        resolve();
      }
    };
    peer.addEventListener('icegatheringstatechange', done);
    setTimeout(resolve, 3000);
  });
}

function waitForBufferedAmount(channel) {
  if (channel.bufferedAmount < 8 * CHUNK_SIZE) return Promise.resolve();
  return new Promise((resolve) => {
    channel.bufferedAmountLowThreshold = 4 * CHUNK_SIZE;
    channel.addEventListener('bufferedamountlow', resolve, { once: true });
  });
}

export class LanTransferSession extends EventTarget {
  constructor({ nickname, usePublicStun = false } = {}) {
    super();
    this.nickname = nickname || '设备';
    this.peer = new RTCPeerConnection({
      iceServers: usePublicStun ? PUBLIC_STUN_SERVERS : [],
    });
    this.channel = null;
    this.files = [];
    this.manifest = null;
    this.received = new Map();
    this.currentReceive = null;
    this.totalReceivedBytes = 0;
    this.totalSentBytes = 0;
    this.peer.onconnectionstatechange = () => {
      this.emit('connection', { state: this.peer.connectionState });
    };
    this.peer.ondatachannel = (event) => {
      this.attachChannel(event.channel);
    };
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  attachChannel(channel) {
    this.channel = channel;
    channel.binaryType = 'arraybuffer';
    channel.onopen = () => this.emit('channel-open', {});
    channel.onclose = () => this.emit('channel-close', {});
    channel.onerror = () => this.emit('error', { message: '数据通道发生错误' });
    channel.onmessage = (event) => this.handleMessage(event.data);
  }

  async createOffer(files) {
    this.files = Array.from(files || []);
    this.manifest = buildManifest(this.files);
    this.attachChannel(this.peer.createDataChannel('xyx-lan-transfer', { ordered: true }));
    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(offer);
    await waitForIceGathering(this.peer);
    return {
      version: 1,
      type: 'offer',
      nickname: this.nickname,
      manifest: this.manifest,
      sdp: this.peer.localDescription,
    };
  }

  async acceptOffer(signal) {
    await this.peer.setRemoteDescription(signal.sdp);
    this.manifest = signal.manifest;
    this.emit('manifest', { manifest: this.manifest, peerName: signal.nickname || '对方设备' });
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);
    await waitForIceGathering(this.peer);
    return {
      version: 1,
      type: 'answer',
      nickname: this.nickname,
      sdp: this.peer.localDescription,
    };
  }

  async acceptAnswer(signal) {
    await this.peer.setRemoteDescription(signal.sdp);
  }

  sendControl(message) {
    if (!this.channel || this.channel.readyState !== 'open') {
      throw new Error('连接尚未建立');
    }
    this.channel.send(JSON.stringify(message));
  }

  acceptTransfer() {
    this.sendControl({ type: 'accept', transferId: this.manifest.transferId });
  }

  async sendFiles() {
    this.sendControl(this.manifest);
    for (let index = 0; index < this.files.length; index += 1) {
      const file = this.files[index];
      const info = this.manifest.files[index];
      this.sendControl({ type: 'file-start', fileId: info.id });
      for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
        await waitForBufferedAmount(this.channel);
        const chunk = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
        this.channel.send(chunk);
        this.totalSentBytes += chunk.byteLength;
        this.emit('send-progress', { sentBytes: this.totalSentBytes, totalBytes: this.manifest.totalBytes });
      }
      this.sendControl({ type: 'file-end', fileId: info.id });
    }
    this.sendControl({ type: 'transfer-complete', transferId: this.manifest.transferId });
  }

  handleMessage(data) {
    if (typeof data === 'string') {
      const message = JSON.parse(data);
      this.handleControl(message);
      return;
    }
    if (!this.currentReceive) return;
    this.currentReceive.chunks.push(data);
    this.currentReceive.receivedBytes += data.byteLength;
    this.totalReceivedBytes += data.byteLength;
    this.emit('receive-progress', { receivedBytes: this.totalReceivedBytes, totalBytes: this.manifest.totalBytes });
  }

  handleControl(message) {
    if (message.type === 'manifest') {
      this.manifest = message;
      this.emit('manifest', { manifest: message });
    }
    if (message.type === 'accept') {
      this.emit('accepted', {});
    }
    if (message.type === 'file-start') {
      const info = this.manifest.files.find((file) => file.id === message.fileId);
      this.currentReceive = { info, chunks: [], receivedBytes: 0 };
    }
    if (message.type === 'file-end' && this.currentReceive) {
      const blob = new Blob(this.currentReceive.chunks, { type: this.currentReceive.info.type });
      this.received.set(this.currentReceive.info.id, { ...this.currentReceive.info, blob });
      this.emit('file-received', { file: { ...this.currentReceive.info, blob } });
      this.currentReceive = null;
    }
    if (message.type === 'transfer-complete') {
      this.emit('transfer-complete', { files: Array.from(this.received.values()) });
    }
  }

  close() {
    if (this.channel) this.channel.close();
    this.peer.close();
  }
}
```

- [ ] **Step 2: Add minimal UI controller connection hooks**

Create the first `work/lan-transfer/lan-transfer.js` version:

```js
import { copyText, setStatus } from '../tools/shared/tools.js';
import { decodeSignal, encodeSignal, formatBytes, getDefaultDeviceName, normalizeDeviceName } from './lan-transfer-core.mjs';
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
};

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('[data-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== mode;
  });
  document.querySelectorAll('.lan-mode-button').forEach((button) => {
    button.classList.toggle('primary', button.dataset.mode === mode);
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
      setStatus(elements.signalStatus, error ? `二维码生成失败：${error.message}` : '已生成二维码和连接码。', !!error);
    });
  } else {
    setStatus(elements.signalStatus, '二维码库尚未加载，请复制连接码。', true);
  }
}

function bindSession(session) {
  session.addEventListener('connection', (event) => setStatus(elements.transferStatus, `连接状态：${event.detail.state}`));
  session.addEventListener('manifest', (event) => {
    state.manifest = event.detail.manifest;
    if (event.detail.peerName) localStorage.setItem(recentPeerKey, event.detail.peerName);
    renderFileList(state.manifest.files);
  });
  session.addEventListener('send-progress', (event) => updateProgress(event.detail.sentBytes, event.detail.totalBytes));
  session.addEventListener('receive-progress', (event) => updateProgress(event.detail.receivedBytes, event.detail.totalBytes));
  session.addEventListener('accepted', () => {
    setStatus(elements.transferStatus, '对方已确认接收，可以开始发送。');
    document.getElementById('send-files').disabled = false;
  });
}

function renderFileList(files) {
  elements.fileList.innerHTML = files.map((file) => `
    <div class="lan-file-row">
      <strong>${file.name}</strong>
      <span>${formatBytes(file.size)}</span>
    </div>
  `).join('');
}

function updateProgress(done, total) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  elements.progress.value = percent;
  setStatus(elements.transferStatus, `传输进度：${percent}% (${formatBytes(done)} / ${formatBytes(total)})`);
}

document.querySelectorAll('.lan-mode-button').forEach((button) => {
  button.addEventListener('click', () => setMode(button.dataset.mode));
});

elements.deviceName.value = localStorage.getItem(nicknameKey) || getDefaultDeviceName();
elements.deviceName.addEventListener('change', () => localStorage.setItem(nicknameKey, getNickname()));

elements.fileInput.addEventListener('change', () => {
  state.selectedFiles = Array.from(elements.fileInput.files || []);
  elements.fileInputName.textContent = state.selectedFiles.length ? `已选择 ${state.selectedFiles.length} 个文件` : '未选择文件';
});

document.getElementById('create-offer').addEventListener('click', async () => {
  if (!state.selectedFiles.length) {
    setStatus(elements.signalStatus, '请先选择要发送的文件。', true);
    return;
  }
  state.session?.close();
  state.session = new LanTransferSession({ nickname: getNickname(), usePublicStun: elements.usePublicStun.checked });
  bindSession(state.session);
  const offer = await state.session.createOffer(state.selectedFiles);
  renderSignalCode(encodeSignal(offer));
});
```

- [ ] **Step 3: Run browser smoke test and commit**

Run local server and verify:

```bash
python3 -m http.server 5181 --bind 127.0.0.1
```

Manual expected behavior:
- Page opens.
- Mode buttons switch panels.
- Selecting files updates selected file count.
- "生成发起码" produces a QR code or a clear CDN-not-loaded status.

Commit:

```bash
git add work/lan-transfer/webrtc-transfer.js work/lan-transfer/lan-transfer.js
git commit -m "feat: add lan transfer webrtc pairing"
```

---

## Task 4: Complete UI Flows, Clipboard, ZIP, and Preview

**Files:**
- Create: `work/lan-transfer/file-preview.js`
- Modify: `work/lan-transfer/lan-transfer.js`

- [ ] **Step 1: Implement file preview helpers**

Create `work/lan-transfer/file-preview.js`:

```js
import { TEXT_PREVIEW_LIMIT, classifyFile, formatBytes } from './lan-transfer-core.mjs';

function createTitle(file) {
  const title = document.createElement('strong');
  title.textContent = `${file.name} (${formatBytes(file.size)})`;
  return title;
}

export async function renderFilePreview(file) {
  const card = document.createElement('article');
  card.className = 'lan-preview-card';
  card.appendChild(createTitle(file));
  const kind = classifyFile(file);
  const url = URL.createObjectURL(file.blob);

  if (kind === 'image') {
    const image = document.createElement('img');
    image.src = url;
    image.alt = file.name;
    card.appendChild(image);
    return card;
  }
  if (kind === 'pdf') {
    const frame = document.createElement('iframe');
    frame.src = url;
    frame.title = `${file.name} 预览`;
    card.appendChild(frame);
    return card;
  }
  if (kind === 'audio' || kind === 'video') {
    const media = document.createElement(kind);
    media.controls = true;
    media.src = url;
    card.appendChild(media);
    return card;
  }
  if (kind === 'text') {
    const pre = document.createElement('pre');
    pre.className = 'lan-preview-text tool-code';
    const textBlob = file.blob.slice(0, TEXT_PREVIEW_LIMIT);
    pre.textContent = await textBlob.text();
    if (file.blob.size > TEXT_PREVIEW_LIMIT) {
      pre.textContent += '\n\n... 文本较长，仅预览前一部分。';
    }
    card.appendChild(pre);
    return card;
  }

  const fallback = document.createElement('p');
  fallback.textContent = '此格式暂不支持预览，可以下载 ZIP 后查看。';
  card.appendChild(fallback);
  return card;
}
```

- [ ] **Step 2: Complete controller actions**

Extend `work/lan-transfer/lan-transfer.js` with:

```js
import { renderFilePreview } from './file-preview.js';

async function readClipboardCode() {
  try {
    if (!navigator.clipboard?.readText) throw new Error('当前浏览器不支持读取剪贴板');
    elements.signalCode.value = await navigator.clipboard.readText();
    setStatus(elements.signalStatus, '已从剪贴板读取连接码。');
  } catch (error) {
    setStatus(elements.signalStatus, `读取剪贴板失败：${error.message}。请手动粘贴。`, true);
  }
}

async function zipReceivedFiles(files) {
  if (!globalThis.JSZip) throw new Error('ZIP 库尚未加载');
  const zip = new globalThis.JSZip();
  files.forEach((file) => zip.file(file.name, file.blob));
  return zip.generateAsync({ type: 'blob' }, (metadata) => {
    elements.progress.value = Math.round(metadata.percent);
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

async function renderPreviews(files) {
  const previewList = document.getElementById('preview-list');
  previewList.innerHTML = '';
  for (const file of files) {
    previewList.appendChild(await renderFilePreview(file));
  }
}

document.getElementById('copy-code').addEventListener('click', () => copyText(elements.signalCode.value, elements.signalStatus));
document.getElementById('paste-code').addEventListener('click', readClipboardCode);

document.getElementById('import-offer').addEventListener('click', async () => {
  state.session?.close();
  state.session = new LanTransferSession({ nickname: getNickname(), usePublicStun: elements.usePublicStun.checked });
  bindSession(state.session);
  const offer = decodeSignal(elements.signalCode.value);
  const answer = await state.session.acceptOffer(offer);
  renderSignalCode(encodeSignal(answer));
  document.getElementById('create-answer').disabled = true;
  document.getElementById('accept-transfer').disabled = false;
});

document.getElementById('import-answer').addEventListener('click', async () => {
  if (!state.session) {
    setStatus(elements.signalStatus, '请先生成发起码。', true);
    return;
  }
  const answer = decodeSignal(elements.signalCode.value);
  await state.session.acceptAnswer(answer);
  setStatus(elements.signalStatus, '回应码已导入，等待连接建立。');
});

document.getElementById('accept-transfer').addEventListener('click', () => {
  state.session.acceptTransfer();
  setStatus(elements.transferStatus, '已确认接收，等待对方发送文件。');
});

document.getElementById('send-files').addEventListener('click', async () => {
  await state.session.sendFiles();
});

document.getElementById('download-zip').addEventListener('click', async () => {
  const blob = await zipReceivedFiles(state.receivedFiles);
  downloadBlob('lan-transfer-files.zip', blob);
});

document.getElementById('clear-transfer').addEventListener('click', () => {
  state.receivedFiles = [];
  elements.fileList.innerHTML = '';
  document.getElementById('preview-list').innerHTML = '';
  elements.progress.value = 0;
  document.getElementById('download-zip').disabled = true;
  setStatus(elements.transferStatus, '已清空本次传输。');
});

document.getElementById('reset-session').addEventListener('click', () => {
  state.session?.close();
  state.session = null;
  state.manifest = null;
  elements.signalCode.value = '';
  elements.fileList.innerHTML = '';
  setStatus(elements.signalStatus, '已重置连接，请重新生成连接码。');
});
```

Also add to `bindSession()`:

```js
session.addEventListener('transfer-complete', async (event) => {
  state.receivedFiles = event.detail.files;
  await renderPreviews(state.receivedFiles);
  document.getElementById('download-zip').disabled = state.receivedFiles.length === 0;
  setStatus(elements.transferStatus, `接收完成，共 ${state.receivedFiles.length} 个文件。`);
});
session.addEventListener('file-received', (event) => {
  setStatus(elements.transferStatus, `已接收：${event.detail.file.name}`);
});
session.addEventListener('error', (event) => setStatus(elements.transferStatus, event.detail.message, true));
```

- [ ] **Step 3: Manual two-browser transfer test**

Run:

```bash
python3 -m http.server 5181 --bind 127.0.0.1
```

Open two browser tabs:
- Sender: `http://127.0.0.1:5181/work/lan-transfer/`
- Receiver: `http://127.0.0.1:5181/work/lan-transfer/`

Expected:
- Sender creates offer with selected sample files.
- Receiver imports offer and creates answer.
- Sender imports answer.
- Receiver confirms file list.
- Sender sends files.
- Receiver shows previews and enables ZIP download.

Commit:

```bash
git add work/lan-transfer/file-preview.js work/lan-transfer/lan-transfer.js
git commit -m "feat: complete lan transfer file flow"
```

---

## Task 5: Site Integration

**Files:**
- Modify: `work/tools/index.html`
- Modify: `index.html`
- Modify: `cli/cli-core.mjs`

- [ ] **Step 1: Add Tools Hub card**

In `work/tools/index.html`, under "图像与文件", add before "图片处理器":

```html
<a class="tool-card" href="../lan-transfer/" data-tool-card data-search="局域网 快传 文件 互传 传输 p2p webrtc lan transfer air drop">
  <h3>局域网快传</h3>
  <p>通过二维码或连接码配对，在同一局域网设备之间点对点传文件。</p>
  <span class="tool-tags"><span class="tool-tag">文件</span><span class="tool-tag">局域网</span></span>
</a>
```

- [ ] **Step 2: Add main site work entry**

In `index.html`, add a work item near other tools:

```html
<article>
  <h2 class="major">局域网快传</h2>
  <p>一个纯网页的同局域网多设备文件互传工具。通过二维码或连接码配对后，文件直接在设备之间传输。</p>
  <ul class="actions">
    <li><a href="work/lan-transfer/" class="button">打开局域网快传</a></li>
  </ul>
</article>
```

Use the existing local structure around `#work`; do not restructure the whole page.

- [ ] **Step 3: Add CLI route**

In `cli/cli-core.mjs`, add to `ROUTES`:

```js
{ key: 'transfer', label: '局域网快传', path: '/work/lan-transfer/', aliases: ['lan', 'lan-transfer', 'file-transfer', 'send'] },
```

- [ ] **Step 4: Run integration checks and commit**

Run:

```bash
node tools/test-cli-core.mjs
node tools/check-static-links.mjs
```

Expected:
- CLI tests pass.
- Static link checker reports no missing local targets.

Commit:

```bash
git add work/tools/index.html index.html cli/cli-core.mjs
git commit -m "feat: link lan transfer across site"
```

---

## Task 6: Rendered QA and Deployment Readiness

**Files:**
- No new source files unless fixing bugs found in QA.

- [ ] **Step 1: Static checks**

Run:

```bash
node --check work/lan-transfer/lan-transfer.js
node --check work/lan-transfer/webrtc-transfer.js
node --check work/lan-transfer/file-preview.js
node tools/test-lan-transfer-core.mjs
node tools/test-cli-core.mjs
node tools/check-static-links.mjs
```

Expected:
- All commands pass.

- [ ] **Step 2: Browser QA**

Run:

```bash
python3 -m http.server 5181 --bind 127.0.0.1
```

Browser checks:
- `http://127.0.0.1:5181/work/lan-transfer/` loads with title `局域网快传`.
- Desktop 1440x920: mode selection, pairing code, file list, preview panels are visible and not overlapping.
- Mobile 390x844: no horizontal overflow, QR/text pairing area stacks vertically.
- Two-tab transfer with a `.txt` file and a small image completes.
- Receiver previews text and image.
- ZIP download button becomes enabled.
- Tools Hub card filters with query `局域网`.
- CLI route resolves through `open transfer` and `open lan`.
- Console has no relevant errors.

- [ ] **Step 3: Commit QA fixes**

If any bugs were fixed:

```bash
git add work/lan-transfer work/tools/index.html index.html cli/cli-core.mjs tools/test-lan-transfer-core.mjs
git commit -m "fix: polish lan transfer app"
```

If no source changes were needed, do not create an empty commit.

---

## Self-Review

- Spec coverage:
  - Pure static GitHub Pages app: Tasks 2-4.
  - WebRTC manual offer/answer pairing: Task 3.
  - QR first and copy/paste fallback: Tasks 2 and 4.
  - Send/receive mode choice: Task 2.
  - Multi-file, ZIP download: Task 4.
  - Preview best-effort file types: Task 4.
  - Save nickname/recent peer only: Tasks 3 and 4.
  - STUN advanced toggle: Tasks 2 and 3.
  - Tools Hub, work entry, CLI route: Task 5.
  - Rendered QA and link tests: Task 6.
- Placeholder scan:
  - No TBD/TODO/fill-in placeholders remain.
- Type consistency:
  - `LanTransferSession`, `buildManifest`, `encodeSignal`, `decodeSignal`, `renderFilePreview`, and route keys are named consistently across tasks.

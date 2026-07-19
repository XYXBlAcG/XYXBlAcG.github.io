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

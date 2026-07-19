import assert from 'node:assert/strict';
import {
  CODE_PREFIX,
  CHUNK_SIZE,
  buildManifest,
  classifyFile,
  decodeSignal,
  encodeSignal,
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

const lzStringStub = {
  compressToEncodedURIComponent(value) {
    return encodeURIComponent(Buffer.from(value, 'utf8').toString('base64url'));
  },
  decompressFromEncodedURIComponent(value) {
    return Buffer.from(decodeURIComponent(value), 'base64url').toString('utf8');
  },
};
const signalPayload = {
  type: 'offer',
  deviceName: '我的电脑',
  sdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1',
};
const encodedSignal = encodeSignal(signalPayload, lzStringStub);
assert.ok(encodedSignal.startsWith(CODE_PREFIX));
assert.deepEqual(decodeSignal(encodedSignal, lzStringStub), signalPayload);
assert.throws(
  () => decodeSignal('BAD:' + encodedSignal.slice(CODE_PREFIX.length), lzStringStub),
  /连接码格式不正确/,
);
assert.throws(() => encodeSignal(signalPayload, {}), /连接码压缩库尚未加载/);
assert.throws(() => decodeSignal(encodedSignal, {}), /连接码解压库尚未加载/);
assert.throws(
  () => decodeSignal(CODE_PREFIX + 'broken', { decompressFromEncodedURIComponent: () => '' }),
  /连接码内容无法解码/,
);

console.log('LAN transfer core tests passed');

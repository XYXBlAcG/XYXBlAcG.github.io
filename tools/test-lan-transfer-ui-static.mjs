import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile('work/lan-transfer/index.html', 'utf8');
const js = await readFile('work/lan-transfer/lan-transfer.js', 'utf8');
const css = await readFile('work/lan-transfer/lan-transfer.css', 'utf8');
const authJs = await readFile('work/lan-transfer/lan-transfer-auth.js', 'utf8');

assert.match(html, /id="download-all"[\s\S]*?>下载全部文件<\/button>/);
assert.match(html, /lan-transfer\.css\?v=20260720-ui-2/);
assert.match(html, /lan-transfer-auth\.js\?v=20260720-local-1/);
assert.match(html, /lan-transfer\.js\?v=20260720-local-1/);
assert.match(css, /\.lan-shell \[hidden\]\s*\{\s*display: none !important;\s*\}/);
assert.match(authJs, /config\.localBypass === true/);
assert.match(authJs, /window\.XYX_LAN_TRANSFER_AUTH_READY = Promise\.resolve\(\);/);
assert.match(js, /const text = response\.status === 204 \? '' : await response\.text\(\);/);
assert.match(js, /payload\?\.error \|\| payload\?\.message/);
assert.match(js, /alert\(error\?\.message \? `\$\{message\}\\n\\n错误详情：\$\{error\.message\}` : message\);/);
assert.match(js, /elements\.signalPanel\.hidden = receiveMode;/);
assert.match(js, /function canUseInlineQrScanner\(\)/);
assert.match(js, /elements\.scanQr\.hidden = !inlineScannerAvailable;/);
assert.match(js, /downloadButton\.disabled = !isDownloadable;/);
assert.match(js, /previewButton\.disabled = !isDownloadable;/);
assert.match(js, /openButton\.disabled = !isDownloadable;/);
assert.match(js, /function downloadAllTransferFiles\(\)/);
assert.match(js, /function openFilePreviewInNewTab\(file\)/);
assert.match(js, /receiveComplete: false/);
assert.match(js, /state\.receiveComplete && getDownloadableFiles\(\)\.length > 0/);
assert.match(js, /state\.receiveComplete = true;/);
assert.doesNotMatch(js, /await renderPreviews\(state\.receivedFiles\)/);

console.log('LAN transfer UI static tests passed');

import { TEXT_PREVIEW_LIMIT, classifyFile, formatBytes } from './lan-transfer-core.mjs';

function createTitle(file) {
  const title = document.createElement('strong');
  title.textContent = `${file.name}（${formatBytes(file.size)}）`;
  return title;
}

function createFallback(message) {
  const fallback = document.createElement('p');
  fallback.textContent = message;
  return fallback;
}

function getFileBlob(file) {
  if (file?.blob instanceof Blob) return file.blob;
  if (file instanceof Blob) return file;
  return new Blob([], { type: file?.type || 'application/octet-stream' });
}

function attachObjectUrlCleanup(card, url) {
  let revoked = false;
  card.addEventListener('lan-preview-dispose', () => {
    if (revoked) return;
    revoked = true;
    URL.revokeObjectURL(url);
  }, { once: true });
}

export async function renderFilePreview(file) {
  const card = document.createElement('article');
  card.className = 'lan-preview-card';
  card.appendChild(createTitle(file));

  const kind = classifyFile(file);
  const blob = getFileBlob(file);

  if (kind === 'text') {
    const pre = document.createElement('pre');
    pre.className = 'lan-preview-text tool-code';
    pre.textContent = await blob.slice(0, TEXT_PREVIEW_LIMIT).text();
    if (blob.size > TEXT_PREVIEW_LIMIT) {
      pre.textContent += '\n\n... 文本较长，仅预览前一部分。';
    }
    card.appendChild(pre);
    return card;
  }

  if (kind === 'unknown') {
    card.appendChild(createFallback('此格式暂不支持预览，可以下载 ZIP 后查看。'));
    return card;
  }

  const url = URL.createObjectURL(blob);
  attachObjectUrlCleanup(card, url);

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

  card.dispatchEvent(new Event('lan-preview-dispose'));
  card.appendChild(createFallback('此格式暂不支持预览，可以下载 ZIP 后查看。'));
  return card;
}

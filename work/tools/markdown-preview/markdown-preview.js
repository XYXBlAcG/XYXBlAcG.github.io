import { copyText, downloadText, setStatus } from '../shared/tools.js';

const source = document.getElementById('source');
const preview = document.getElementById('preview');
const status = document.getElementById('status');

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderMarkdown(text) {
  const lines = text.split(/\r?\n/);
  let html = '';
  let inList = false;
  let inCode = false;
  let code = [];

  function closeList() {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  }

  lines.forEach((line) => {
    if (line.startsWith('```')) {
      if (inCode) {
        html += `<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`;
        code = [];
      } else {
        closeList();
      }
      inCode = !inCode;
      return;
    }

    if (inCode) {
      code.push(line);
      return;
    }

    if (/^###\s+/.test(line)) {
      closeList();
      html += `<h3>${inline(line.replace(/^###\s+/, ''))}</h3>`;
    } else if (/^##\s+/.test(line)) {
      closeList();
      html += `<h2>${inline(line.replace(/^##\s+/, ''))}</h2>`;
    } else if (/^#\s+/.test(line)) {
      closeList();
      html += `<h1>${inline(line.replace(/^#\s+/, ''))}</h1>`;
    } else if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`;
    } else if (/^>\s?/.test(line)) {
      closeList();
      html += `<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`;
    } else if (line.trim()) {
      closeList();
      html += `<p>${inline(line)}</p>`;
    } else {
      closeList();
    }
  });

  closeList();
  if (inCode) {
    html += `<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`;
  }
  return html;
}

function render() {
  preview.innerHTML = renderMarkdown(source.value);
  setStatus(status, '预览已更新。');
}

document.getElementById('copy-html').addEventListener('click', () => copyText(preview.innerHTML, status));
document.getElementById('download-html').addEventListener('click', () => {
  downloadText('markdown-preview.html', preview.innerHTML);
  setStatus(status, '已下载网页片段。');
});
source.addEventListener('input', render);
render();

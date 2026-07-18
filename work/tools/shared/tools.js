export function setStatus(element, message, isError = false) {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.toggle('error', isError);
}

function copyTextFallback(text) {
  if (
    typeof document === 'undefined' ||
    !document.body ||
    typeof document.execCommand !== 'function'
  ) {
    throw new Error('Clipboard API unavailable');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand('copy');
  textarea.remove();

  if (!copied) {
    throw new Error('Clipboard copy was not accepted');
  }
}

export async function copyText(text, statusElement) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      copyTextFallback(text);
    }
    setStatus(statusElement, 'Copied.');
  } catch (error) {
    setStatus(statusElement, `Copy failed: ${error.message}`, true);
  }
}

export function installCardFilter(input, cards) {
  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    cards.forEach((card) => {
      const haystack = `${card.dataset.search || ''} ${card.textContent || ''}`.toLowerCase();
      card.hidden = query.length > 0 && !haystack.includes(query);
    });
  });
}

export function downloadText(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

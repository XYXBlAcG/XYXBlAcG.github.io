export function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}

export async function copyText(text, statusElement) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(statusElement, 'Copied.');
  } catch (error) {
    setStatus(statusElement, `Copy failed: ${error.message}`, true);
  }
}

export function installCardFilter(input, cards) {
  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    cards.forEach((card) => {
      const haystack = card.dataset.search.toLowerCase();
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
  URL.revokeObjectURL(url);
}

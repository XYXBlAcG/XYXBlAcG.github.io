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

function findSectionTitle(section) {
  let current = section.previousElementSibling;
  while (current) {
    if (current.classList.contains('tool-section-title')) {
      return current;
    }
    current = current.previousElementSibling;
  }
  return null;
}

function updateFilterSections(cards) {
  const sections = new Set(Array.from(cards).map((card) => card.closest('.tool-grid')).filter(Boolean));
  sections.forEach((section) => {
    const visibleCount = Array.from(section.querySelectorAll('[data-tool-card]')).filter((card) => !card.hidden).length;
    const isVisible = visibleCount > 0;
    section.hidden = !isVisible;
    section.style.display = isVisible ? '' : 'none';

    const title = findSectionTitle(section);
    if (title) {
      title.hidden = !isVisible;
      title.style.display = isVisible ? '' : 'none';
    }
  });
}

export function installCardFilter(input, cards, options = {}) {
  if (!input) {
    return;
  }

  const cardList = Array.from(cards);
  const labels = {
    all: 'Showing all tools.',
    results: (count) => `${count} tool${count === 1 ? '' : 's'} found.`,
    empty: 'No matching tools.',
    ...options.labels,
  };

  function applyFilter() {
    const query = input.value.trim().toLowerCase();
    let visibleCount = 0;

    cardList.forEach((card) => {
      const haystack = `${card.dataset.search || ''} ${card.textContent || ''}`.toLowerCase();
      const isVisible = query.length === 0 || haystack.includes(query);
      card.hidden = !isVisible;
      card.style.display = isVisible ? '' : 'none';
      if (isVisible) {
        visibleCount += 1;
      }
    });

    updateFilterSections(cardList);

    if (options.status) {
      if (!query) {
        setStatus(options.status, labels.all);
      } else if (visibleCount === 0) {
        setStatus(options.status, labels.empty);
      } else {
        setStatus(options.status, labels.results(visibleCount));
      }
    }
  }

  input.addEventListener('input', applyFilter);
  applyFilter();
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

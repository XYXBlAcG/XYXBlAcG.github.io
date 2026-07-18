const output = document.getElementById('cli-output');
if (output) {
  const line = document.createElement('div');
  line.className = 'cli-line is-system';
  line.textContent = 'CLI 外壳已就绪。';
  output.appendChild(line);
}

const form = document.getElementById('cli-form');
if (form && output) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const line = document.createElement('div');
    line.className = 'cli-line is-system';
    line.textContent = '交互命令将在下一步启用。';
    output.appendChild(line);
  });
}

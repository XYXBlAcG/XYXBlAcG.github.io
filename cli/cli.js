const output = document.getElementById('cli-output');
if (output) {
  const line = document.createElement('div');
  line.className = 'cli-line is-system';
  line.textContent = 'Site CLI shell loaded. Interactive commands will be enabled next.';
  output.appendChild(line);
}

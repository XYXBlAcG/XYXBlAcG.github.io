import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const htmlFiles = [];
const ignoredPrefixes = ['http:', 'https:', 'mailto:', 'tel:', 'javascript:', '#'];
const attrs = ['href', 'src', 'data-src'];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      htmlFiles.push(full);
    }
  }
}

function stripQueryAndHash(value) {
  return value.split('#')[0].split('?')[0];
}

function shouldIgnore(value) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return ignoredPrefixes.some((prefix) => trimmed.startsWith(prefix));
}

function resolveTarget(file, rawValue) {
  const clean = stripQueryAndHash(rawValue.trim());
  if (clean.startsWith('/')) {
    return path.join(root, clean.slice(1));
  }
  return path.resolve(path.dirname(file), clean);
}

function targetExists(target) {
  if (fs.existsSync(target)) return true;
  if (fs.existsSync(path.join(target, 'index.html'))) return true;
  return false;
}

function collectLinks(file) {
  const html = fs.readFileSync(file, 'utf8');
  const links = [];
  for (const attr of attrs) {
    const pattern = new RegExp(`${attr}=["']([^"']+)["']`, 'gi');
    let match;
    while ((match = pattern.exec(html)) !== null) {
      links.push({ attr, value: match[1] });
    }
  }
  return links;
}

walk(root);

const missing = [];

for (const file of htmlFiles) {
  for (const link of collectLinks(file)) {
    if (shouldIgnore(link.value)) continue;
    const clean = stripQueryAndHash(link.value.trim());
    if (!clean || clean.startsWith('//')) continue;
    const target = resolveTarget(file, link.value);
    if (!targetExists(target)) {
      missing.push({
        file: path.relative(root, file),
        attr: link.attr,
        value: link.value,
        target: path.relative(root, target),
      });
    }
  }
}

if (missing.length > 0) {
  console.error('Missing local targets:');
  for (const item of missing) {
    console.error(`- ${item.file} ${item.attr}="${item.value}" -> ${item.target}`);
  }
  process.exit(1);
}

console.log(`Checked ${htmlFiles.length} HTML files. No missing local targets found.`);

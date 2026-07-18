export const ROUTES = [
  { key: 'home', label: '首页', path: '/', aliases: ['index', 'root'] },
  { key: 'cli', label: '站点命令行', path: '/cli/', aliases: ['site-cli', 'terminal', 'shell'] },
  { key: 'work', label: '作品', path: '/#work', aliases: ['works', 'project', 'projects'] },
  { key: 'blog', label: '博客', path: '/#blog', aliases: ['posts'] },
  { key: 'link', label: '链接', path: '/#link', aliases: ['links', 'contact'] },
  { key: 'tools', label: '工具中心', path: '/work/tools/', aliases: ['tool', 'hub', 'tools-hub', 'tools hub'] },
  { key: 'math', label: '数学求解器', path: '/work/py_software/apps/math-solver/', aliases: ['solver', 'math-solver', 'math solver'] },
  { key: 'latex', label: 'LaTeX 渲染器', path: '/work/py_software/apps/latex-renderer/', aliases: ['tex', 'latex-renderer', 'latex renderer'] },
  { key: 'text', label: '文本工具', path: '/work/tools/text-toolkit/', aliases: ['text-toolkit'] },
  { key: 'unit', label: '单位换算', path: '/work/tools/unit-converter/', aliases: ['unit-converter'] },
  { key: 'qr', label: '二维码工具', path: '/work/tools/qr-tool/', aliases: ['qrcode', 'qr-tool'] },
  { key: 'hash', label: '哈希工具', path: '/work/tools/hash-tool/', aliases: ['hash-tool'] },
  { key: 'regex', label: '正则测试', path: '/work/tools/regex-tester/', aliases: ['regexp', 'regex-tester'] },
  { key: 'markdown', label: 'Markdown 预览', path: '/work/tools/markdown-preview/', aliases: ['md', 'markdown-preview'] },
  { key: 'data', label: '数据转换器', path: '/work/tools/data-converter/', aliases: ['data-converter', 'converter'] },
  { key: 'diff', label: '文本对比器', path: '/work/tools/diff-tool/', aliases: ['diff-tool', 'compare'] },
  { key: 'timestamp', label: '时间转换器', path: '/work/tools/timestamp-converter/', aliases: ['time-converter', 'timestamp-converter'] },
  { key: 'color', label: '配色检查器', path: '/work/tools/color-tool/', aliases: ['color-tool', 'palette'] },
  { key: 'password', label: '密码生成器', path: '/work/tools/password-generator/', aliases: ['password-generator', 'passphrase'] },
  { key: 'url', label: '链接解析器', path: '/work/tools/url-tool/', aliases: ['url-tool', 'link-parser'] },
  { key: 'image', label: '图片处理器', path: '/work/tools/image-utilities/', aliases: ['image-utilities', 'image-tool'] },
  { key: 'filesorter', label: '文件整理器', path: '/work/filesorter/preview.html', aliases: ['file-sorter', 'filesorter'] },
  { key: 'kana', label: '假名练习', path: '/work/kana_player/main.html', aliases: ['kana-player', 'hiragana', 'katakana'] },
  { key: 'wordmemo', label: '单词记忆', path: '/work/wordmemo/preview.html', aliases: ['word-memo', 'vocabulary'] },
  { key: 'zip2pdf', label: '压缩包转文档', path: '/work/zip2pdf/preview.html', aliases: ['zip'] },
  { key: 'star', label: '星星', path: '/star/', aliases: ['stars'] }
];

export const COMMANDS = [
  { name: 'help', usage: 'help 或 help <command>', detail: '查看命令用法' },
  { name: 'ls', usage: 'ls', detail: '列出站内主要入口' },
  { name: 'open', usage: 'open <route>', detail: '打开站内路径或别名' },
  { name: 'go', usage: 'go <route>', detail: 'open 的别名' },
  { name: 'cd', usage: 'cd <route>', detail: 'open 的别名' },
  { name: 'search', usage: 'search <keyword>', detail: '搜索站内入口' },
  { name: 'reload', usage: 'reload', detail: '刷新当前页面' },
  { name: 'refresh', usage: 'refresh', detail: 'reload 的别名' },
  { name: 'clear', usage: 'clear', detail: '清空终端输出' },
  { name: 'history', usage: 'history', detail: '查看最近命令' },
  { name: 'copy', usage: 'copy url 或 copy <route>', detail: '复制当前 URL 或站内路径' },
  { name: 'py', usage: 'py <python code>', detail: '运行一行 Python' },
  { name: 'python', usage: 'python 或 python <code>', detail: '进入有记忆的 Python 模式，或运行一行 Python' },
  { name: 'about', usage: 'about', detail: '查看站点说明' },
  { name: 'theme', usage: 'theme', detail: '切换 CLI 视觉强度' }
];

export function parseCommand(input) {
  const raw = String(input || '').trim();
  if (!raw) return { name: '', args: [], raw: '', rest: '' };
  const firstSpace = raw.search(/\s/);
  if (firstSpace === -1) return { name: raw.toLowerCase(), args: [], raw, rest: '' };
  const name = raw.slice(0, firstSpace).toLowerCase();
  const rest = raw.slice(firstSpace).trim();
  return { name, args: rest ? [rest] : [], raw, rest };
}

export function resolveRoute(value) {
  const query = String(value || '').trim();
  if (!query) return null;
  if (query.startsWith('#') || (/^\/(?![\\/])/.test(query) && !query.includes('\\'))) {
    return { key: query, label: query, path: query, aliases: [] };
  }
  const normalized = query.toLowerCase();
  return ROUTES.find((route) => {
    return route.key === normalized
      || route.path.toLowerCase() === normalized
      || route.label.toLowerCase() === normalized
      || route.aliases.some((alias) => alias.toLowerCase() === normalized);
  }) || null;
}

function commandByName(name) {
  return COMMANDS.find((command) => command.name === name);
}

function searchRoutes(keyword) {
  const token = String(keyword || '').trim().toLowerCase();
  if (!token) return [];
  return ROUTES.filter((route) => {
    return [route.key, route.label, route.path, ...route.aliases]
      .some((value) => value.toLowerCase().includes(token));
  });
}

export function getCompletions(input) {
  const parsed = parseCommand(input);
  const raw = String(input || '');
  const trailingSpace = /\s$/.test(raw);

  if (!parsed.name || (!parsed.rest && !trailingSpace)) {
    const token = parsed.name || raw.trim().toLowerCase();
    return COMMANDS
      .filter((command) => command.name.startsWith(token) && command.name !== token)
      .map((command) => ({ type: 'command', value: command.name, insert: command.name + ' ', detail: command.detail }));
  }

  if (['open', 'go', 'cd', 'copy'].includes(parsed.name)) {
    const token = trailingSpace ? '' : parsed.rest.toLowerCase();
    const completions = ROUTES
      .filter((route) => route.key.startsWith(token) || route.aliases.some((alias) => alias.startsWith(token)))
      .map((route) => ({ type: 'route', value: route.key, insert: parsed.name + ' ' + route.key, detail: route.label + ' -> ' + route.path }));
    if (parsed.name === 'copy' && 'url'.startsWith(token) && token !== 'url') {
      completions.unshift({ type: 'value', value: 'url', insert: 'copy url', detail: '当前页面 URL' });
    }
    return completions;
  }

  if (parsed.name === 'help') {
    const token = trailingSpace ? '' : parsed.rest.toLowerCase();
    return COMMANDS
      .filter((command) => command.name.startsWith(token) && command.name !== token)
      .map((command) => ({ type: 'command', value: command.name, insert: 'help ' + command.name, detail: command.usage }));
  }

  return [];
}

function lines(items) {
  return items.join('\n');
}

function outputMessage(result) {
  return [result?.stdout, result?.result, result?.stderr].filter(Boolean).join('\n');
}

function failureMessage(prefix, error) {
  const detail = error?.message || (error ? String(error) : '');
  return detail ? `${prefix}：${detail}` : prefix;
}

export function createExecutor(adapter) {
  async function run(input) {
    const parsed = parseCommand(input);
    if (!parsed.name) return { type: 'empty', message: '' };

    if (['open', 'go', 'cd'].includes(parsed.name)) {
      const route = resolveRoute(parsed.rest);
      if (!route) return { type: 'error', message: `找不到路径：${parsed.rest}` };
      try {
        await adapter.navigate(route.path);
        return { type: 'navigation', message: `正在打开 ${route.label} -> ${route.path}`, route };
      } catch (error) {
        return { type: 'error', message: failureMessage('打开失败', error) };
      }
    }

    if (parsed.name === 'help') {
      if (parsed.rest) {
        const command = commandByName(parsed.rest.toLowerCase());
        if (!command) return { type: 'error', message: `没有这个帮助条目：${parsed.rest}` };
        return { type: 'help', message: `${command.name}\n用法：${command.usage}\n说明：${command.detail}` };
      }
      return { type: 'help', message: lines(COMMANDS.map((command) => `${command.usage.padEnd(22)} ${command.detail}`)) };
    }

    if (parsed.name === 'ls') {
      return { type: 'list', message: lines(ROUTES.map((route) => `${route.key.padEnd(12)} ${route.path}  ${route.label}`)) };
    }

    if (parsed.name === 'search') {
      const matches = searchRoutes(parsed.rest);
      if (!matches.length) return { type: 'empty', message: `没有找到：${parsed.rest}` };
      return { type: 'list', message: lines(matches.map((route) => `${route.key.padEnd(12)} ${route.path}  ${route.label}`)) };
    }

    if (parsed.name === 'reload' || parsed.name === 'refresh') {
      try {
        await adapter.reload();
        return { type: 'reload', message: '正在刷新当前页面。' };
      } catch (error) {
        return { type: 'error', message: failureMessage('刷新失败', error) };
      }
    }

    if (parsed.name === 'clear') return { type: 'clear', message: '' };

    if (parsed.name === 'history') {
      try {
        const history = await adapter.getHistory();
        return { type: 'history', message: history.length ? history.map((item, index) => `${index + 1}. ${item}`).join('\n') : '暂无历史命令。' };
      } catch (error) {
        return { type: 'error', message: failureMessage('读取历史失败', error) };
      }
    }

    if (parsed.name === 'copy') {
      try {
        let text;
        if (parsed.rest.toLowerCase() === 'url') {
          text = await adapter.getCurrentUrl();
        } else {
          const route = resolveRoute(parsed.rest);
          if (!route) return { type: 'error', message: `找不到路径：${parsed.rest || '请使用 copy url 或 copy <route>'}` };
          text = route.path;
        }

        const ok = await adapter.copy(text);
        return { type: ok ? 'copy' : 'error', message: ok ? `已复制：${text}` : '复制失败，请检查浏览器权限。' };
      } catch (error) {
        return { type: 'error', message: failureMessage('复制失败', error) };
      }
    }

    if (parsed.name === 'python' && !parsed.rest) {
      return { type: 'python-mode', message: '已进入 Python 模式。输入 quit 或 exit 退出，%reset 清空记忆。' };
    }

    if (parsed.name === 'py' || parsed.name === 'python') {
      if (!parsed.rest) return { type: 'error', message: '请输入 Python 代码，例如：py 1 + 2' };
      try {
        const result = await adapter.runPython(parsed.rest);
        const message = outputMessage(result);
        if (result?.ok === false) {
          return { type: 'error', message: message || 'Python 执行失败。', result };
        }
        return { type: 'python', message: message || 'Python 执行完成。', result };
      } catch (error) {
        return { type: 'error', message: failureMessage('Python 执行失败', error) };
      }
    }

    if (parsed.name === 'about') {
      return { type: 'about', message: '这是 XYX 网站的全屏 CLI，可以用命令跳转站内页面、执行浏览器操作，并通过 PyScript 运行轻量 Python。' };
    }

    if (parsed.name === 'theme') {
      try {
        await adapter.setTheme();
        return { type: 'theme', message: '已切换 CLI 显示强度。' };
      } catch (error) {
        return { type: 'error', message: failureMessage('切换主题失败', error) };
      }
    }

    return { type: 'error', message: `未知命令：${parsed.name}。输入 help 查看可用命令。` };
  }

  return { run };
}

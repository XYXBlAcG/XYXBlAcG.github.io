export const ROUTES = [
  { key: 'home', label: '首页', path: '/', aliases: ['index', 'root'] },
  { key: 'cli', label: '站点命令行', path: '/cli/', aliases: ['site-cli', 'terminal', 'shell'] },
  { key: 'work', label: '作品', path: '/#work', aliases: ['works', 'project', 'projects'] },
  { key: 'blog', label: '博客', path: '/#blog', aliases: ['posts'] },
  { key: 'link', label: '链接', path: '/#link', aliases: ['links', 'contact'] },
  { key: 'tools', label: '工具中心', path: '/work/tools/', aliases: ['tool', 'hub', 'tools-hub', 'tools hub'] },
  { key: 'transfer', label: '局域网快传', path: '/work/lan-transfer/', aliases: ['lan', 'lan-transfer', 'file-transfer', 'send'] },
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

export const SEARCH_PROVIDERS = [
  {
    key: 'bing',
    label: 'Bing',
    baseUrl: 'https://www.bing.com/search',
    queryParam: 'q',
    aliases: ['b']
  },
  {
    key: 'google',
    label: 'Google',
    baseUrl: 'https://www.google.com/search',
    queryParam: 'q',
    aliases: ['g']
  },
  {
    key: 'bilibili',
    label: '哔哩哔哩',
    baseUrl: 'https://search.bilibili.com/all',
    queryParam: 'keyword',
    aliases: ['bili', 'b站', 'b站搜索']
  },
  {
    key: 'baidu',
    label: '百度',
    baseUrl: 'https://www.baidu.com/s',
    queryParam: 'wd',
    aliases: ['bd']
  },
  {
    key: 'github',
    label: 'GitHub',
    baseUrl: 'https://github.com/search',
    queryParam: 'q',
    aliases: ['gh']
  },
  {
    key: 'zhihu',
    label: '知乎',
    baseUrl: 'https://www.zhihu.com/search',
    queryParam: 'q',
    aliases: ['zh']
  },
  {
    key: 'youtube',
    label: 'YouTube',
    baseUrl: 'https://www.youtube.com/results',
    queryParam: 'search_query',
    aliases: ['yt']
  },
  {
    key: 'duckduckgo',
    label: 'DuckDuckGo',
    baseUrl: 'https://duckduckgo.com/',
    queryParam: 'q',
    aliases: ['ddg']
  },
  {
    key: 'mdn',
    label: 'MDN',
    baseUrl: 'https://developer.mozilla.org/search',
    queryParam: 'q',
    aliases: ['mozilla']
  },
  {
    key: 'npm',
    label: 'npm',
    baseUrl: 'https://www.npmjs.com/search',
    queryParam: 'q',
    aliases: []
  },
  {
    key: 'douban',
    label: '豆瓣',
    baseUrl: 'https://www.douban.com/search',
    queryParam: 'q',
    aliases: ['db']
  },
  {
    key: 'sogou',
    label: '搜狗',
    baseUrl: 'https://www.sogou.com/web',
    queryParam: 'query',
    aliases: ['sg']
  }
];

const OPTION_DEFINITIONS = {
  self: {
    key: 'self',
    alias: ['s'],
    type: 'boolean',
    detail: '在当前页面打开，默认打开新标签页',
    defaultValue: false
  },
  from: {
    key: 'from',
    alias: ['f'],
    type: 'string',
    detail: '搜索引擎',
    defaultValue: 'bing'
  }
};

const baseSearchOptions = [OPTION_DEFINITIONS.self];
const unifiedSearchOptions = [OPTION_DEFINITIONS.from, OPTION_DEFINITIONS.self];

export function parseCommand(input) {
  const raw = String(input || '').trim();
  if (!raw) return { name: '', args: [], raw: '', rest: '' };
  const firstSpace = raw.search(/\s/);
  if (firstSpace === -1) return { name: raw.toLowerCase(), args: [], raw, rest: '' };
  const name = raw.slice(0, firstSpace).toLowerCase();
  const rest = raw.slice(firstSpace).trim();
  return { name, args: rest ? [rest] : [], raw, rest };
}

export function tokenizeCommand(value) {
  const input = String(value || '');
  const tokens = [];
  let token = '';
  let quote = '';
  let escaping = false;

  for (const char of input) {
    if (escaping) {
      token += char;
      escaping = false;
      continue;
    }

    if (char === '\\') {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = '';
      } else {
        token += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (token) {
        tokens.push(token);
        token = '';
      }
      continue;
    }

    token += char;
  }

  if (escaping) token += '\\';
  if (token) tokens.push(token);
  return tokens;
}

export function parseCommandOptions(rest, optionDefinitions = []) {
  const definitions = optionDefinitions || [];
  const lookup = new Map();
  const options = {};
  const values = [];
  const errors = [];
  const tokens = tokenizeCommand(rest);

  definitions.forEach((definition) => {
    options[definition.key] = definition.defaultValue ?? (definition.type === 'boolean' ? false : '');
    lookup.set(`--${definition.key}`, definition);
    (definition.alias || []).forEach((alias) => lookup.set(`-${alias}`, definition));
  });

  function readValue(index, definition, inlineValue) {
    if (definition.type === 'boolean') {
      options[definition.key] = inlineValue === undefined ? true : !['false', '0', 'no'].includes(String(inlineValue).toLowerCase());
      return index;
    }

    const nextValue = inlineValue ?? tokens[index + 1];
    if (nextValue === undefined || /^-{1,2}\S+/.test(nextValue)) {
      errors.push(`选项 ${definition.key} 缺少参数`);
      return index;
    }
    options[definition.key] = nextValue;
    return inlineValue === undefined ? index + 1 : index;
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--') {
      values.push(...tokens.slice(index + 1));
      break;
    }

    if (token.startsWith('--')) {
      const [optionName, inlineValue] = token.split(/=(.*)/s).filter((item) => item !== undefined);
      const definition = lookup.get(optionName);
      if (!definition) {
        errors.push(`未知选项：${optionName}`);
        continue;
      }
      index = readValue(index, definition, inlineValue);
      continue;
    }

    if (/^-[^-]\S*$/.test(token)) {
      const optionName = token.slice(0, 2);
      const definition = lookup.get(optionName);
      if (!definition) {
        errors.push(`未知选项：${optionName}`);
        continue;
      }
      const inlineValue = token.length > 2 ? token.slice(2) : undefined;
      index = readValue(index, definition, inlineValue);
      continue;
    }

    values.push(token);
  }

  return { values, options, errors };
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

export function resolveSearchProvider(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  return SEARCH_PROVIDERS.find((provider) => {
    return provider.key === normalized
      || provider.label.toLowerCase() === normalized
      || provider.aliases.some((alias) => alias.toLowerCase() === normalized);
  }) || null;
}

export function buildSearchUrl(provider, query) {
  const url = new URL(provider.baseUrl);
  url.searchParams.set(provider.queryParam, query);
  return url.href;
}

function searchRoutes(keyword) {
  const token = String(keyword || '').trim().toLowerCase();
  if (!token) return [];
  return ROUTES.filter((route) => {
    return [route.key, route.label, route.path, ...route.aliases]
      .some((value) => value.toLowerCase().includes(token));
  });
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

function formatAliases(command) {
  return command.aliases?.length ? `别名：${command.aliases.join(', ')}` : '';
}

function formatOptions(command) {
  if (!command.options?.length) return '';
  return lines(command.options.map((option) => {
    const aliases = option.alias?.length ? `-${option.alias.join(', -')}, ` : '';
    return `  ${aliases}--${option.key}  ${option.detail || ''}`.trimEnd();
  }));
}

function formatCommandHelp(command) {
  return [
    command.name,
    `用法：${command.usage}`,
    `说明：${command.detail}`,
    formatAliases(command),
    formatOptions(command) ? `选项：\n${formatOptions(command)}` : ''
  ].filter(Boolean).join('\n');
}

async function openUrl(adapter, url, self) {
  if (!self && typeof adapter.open === 'function') {
    const opened = await adapter.open(url);
    if (opened !== false) return '新标签页';
  }
  await adapter.navigate(url);
  return '当前页面';
}

function getQueryFromOptions(rest, optionDefinitions) {
  const parsedOptions = parseCommandOptions(rest, optionDefinitions);
  if (parsedOptions.errors.length) {
    return { error: parsedOptions.errors.join('；') };
  }
  return {
    query: parsedOptions.values.join(' ').trim(),
    options: parsedOptions.options
  };
}

function routeCompletions(commandName, token) {
  const completions = ROUTES
    .filter((route) => route.key.startsWith(token) || route.aliases.some((alias) => alias.toLowerCase().startsWith(token)))
    .map((route) => ({ type: 'route', value: route.key, insert: `${commandName} ${route.key}`, detail: `${route.label} -> ${route.path}` }));
  if (commandName === 'copy' && 'url'.startsWith(token) && token !== 'url') {
    completions.unshift({ type: 'value', value: 'url', insert: 'copy url', detail: '当前页面 URL' });
  }
  return completions;
}

function searchProviderCompletions(commandName, prefix) {
  return SEARCH_PROVIDERS
    .filter((provider) => {
      return provider.key.startsWith(prefix)
        || provider.aliases.some((alias) => alias.toLowerCase().startsWith(prefix));
    })
    .map((provider) => ({
      type: 'search-engine',
      value: provider.key,
      insert: `${commandName} ${provider.key} `,
      detail: `用 ${provider.label} 搜索`
    }));
}

function completeSearchInput(input, parsed) {
  const raw = String(input || '');
  const providerOptionMatch = raw.match(/^(\S+\s+.*(?:^|\s)(?:-f|--from)\s+)(\S*)$/);
  if (providerOptionMatch) {
    const [, prefix, token] = providerOptionMatch;
    return SEARCH_PROVIDERS
      .filter((provider) => {
        const normalizedToken = token.toLowerCase();
        return provider.key.startsWith(normalizedToken)
          || provider.aliases.some((alias) => alias.toLowerCase().startsWith(normalizedToken));
      })
      .map((provider) => ({
        type: 'search-engine',
        value: provider.key,
        insert: prefix + provider.key,
        detail: provider.label
      }));
  }

  if (!parsed.rest || /\s$/.test(raw)) {
    return [
      { type: 'search-query', value: '<搜索词>', insert: `${parsed.name} `, detail: '输入关键词后搜索' },
      { type: 'option', value: '-f', insert: `${parsed.name} -f `, detail: '选择搜索引擎' },
      { type: 'option', value: '-s', insert: `${parsed.name} -s `, detail: '当前页面打开' }
    ];
  }
  return [];
}

function commandSummary(command) {
  return {
    name: command.name,
    usage: command.usage,
    detail: command.detail,
    aliases: command.aliases || []
  };
}

function createSearchProviderCommand(provider) {
  return {
    name: provider.key,
    usage: `${provider.key} <keyword> [-s]`,
    detail: `用 ${provider.label} 搜索`,
    aliases: provider.aliases,
    category: 'search',
    options: baseSearchOptions,
    complete(input, parsed) {
      return completeSearchInput(input, parsed);
    },
    async action({ parsed, adapter }) {
      const { query, options, error } = getQueryFromOptions(parsed.rest, baseSearchOptions);
      if (error) return { type: 'error', message: error };
      if (!query) return { type: 'error', message: `请输入搜索词，例如：${provider.key} 数学求解器` };
      const url = buildSearchUrl(provider, query);
      try {
        const target = await openUrl(adapter, url, options.self);
        return { type: 'search', message: `正在用 ${provider.label} 搜索：${query}（${target}）`, provider, url };
      } catch (err) {
        return { type: 'error', message: failureMessage('搜索跳转失败', err) };
      }
    }
  };
}

const BASE_COMMAND_DEFINITIONS = [
  {
    name: 'help',
    usage: 'help 或 help <command>',
    detail: '查看命令用法',
    aliases: ['man'],
    category: 'terminal',
    action({ parsed }) {
      if (parsed.rest) {
        const command = getCommandDefinition(parsed.rest.toLowerCase());
        if (!command) return { type: 'error', message: `没有这个帮助条目：${parsed.rest}` };
        return { type: 'help', message: formatCommandHelp(command) };
      }
      return { type: 'help', message: lines(COMMANDS.map((command) => `${command.usage.padEnd(30)} ${command.detail}`)) };
    }
  },
  {
    name: 'ls',
    usage: 'ls',
    detail: '列出站内主要入口',
    aliases: ['routes'],
    category: 'site',
    action() {
      return { type: 'list', message: lines(ROUTES.map((route) => `${route.key.padEnd(12)} ${route.path}  ${route.label}`)) };
    }
  },
  {
    name: 'open',
    usage: 'open <route>',
    detail: '打开站内路径或别名',
    aliases: ['go', 'cd'],
    category: 'site',
    async action({ parsed, adapter }) {
      const route = resolveRoute(parsed.rest);
      if (!route) return { type: 'error', message: `找不到路径：${parsed.rest}` };
      try {
        await adapter.navigate(route.path);
        return { type: 'navigation', message: `正在打开 ${route.label} -> ${route.path}`, route };
      } catch (err) {
        return { type: 'error', message: failureMessage('打开失败', err) };
      }
    }
  },
  {
    name: 'site',
    usage: 'site <keyword>',
    detail: '搜索站内入口',
    aliases: ['find', 'where'],
    category: 'site',
    action({ parsed }) {
      const matches = searchRoutes(parsed.rest);
      if (!matches.length) return { type: 'empty', message: `没有找到：${parsed.rest}` };
      return { type: 'list', message: lines(matches.map((route) => `${route.key.padEnd(12)} ${route.path}  ${route.label}`)) };
    }
  },
  {
    name: 'search',
    usage: 'search <keyword> [-f engine] [-s]',
    detail: '用指定搜索引擎搜索网页，默认 Bing',
    aliases: ['s', 'sou', 'sousuo', 'query'],
    category: 'search',
    options: unifiedSearchOptions,
    complete(input, parsed) {
      return completeSearchInput(input, parsed);
    },
    async action({ parsed, adapter }) {
      const { query, options, error } = getQueryFromOptions(parsed.rest, unifiedSearchOptions);
      if (error) return { type: 'error', message: error };
      if (!query) return { type: 'error', message: '请输入搜索词，例如：search 数学求解器 -f bing' };
      const provider = resolveSearchProvider(options.from);
      if (!provider) return { type: 'error', message: `找不到搜索引擎：${options.from}` };
      const url = buildSearchUrl(provider, query);
      try {
        const target = await openUrl(adapter, url, options.self);
        return { type: 'search', message: `正在用 ${provider.label} 搜索：${query}（${target}）`, provider, url };
      } catch (err) {
        return { type: 'error', message: failureMessage('搜索跳转失败', err) };
      }
    }
  },
  {
    name: 'engines',
    usage: 'engines',
    detail: '列出可用外部搜索引擎',
    aliases: ['engine'],
    category: 'search',
    action() {
      return {
        type: 'list',
        message: lines(SEARCH_PROVIDERS.map((provider) => {
          const aliases = provider.aliases.length ? `；别名：${provider.aliases.join(', ')}` : '';
          return `${provider.key.padEnd(12)} ${provider.label}${aliases}`;
        }))
      };
    }
  },
  {
    name: 'reload',
    usage: 'reload',
    detail: '刷新当前页面',
    aliases: ['refresh'],
    category: 'browser',
    async action({ adapter }) {
      try {
        await adapter.reload();
        return { type: 'reload', message: '正在刷新当前页面。' };
      } catch (err) {
        return { type: 'error', message: failureMessage('刷新失败', err) };
      }
    }
  },
  {
    name: 'clear',
    usage: 'clear',
    detail: '清空终端输出',
    aliases: ['cl'],
    category: 'terminal',
    action() {
      return { type: 'clear', message: '' };
    }
  },
  {
    name: 'history',
    usage: 'history',
    detail: '查看最近命令',
    aliases: ['h'],
    category: 'terminal',
    async action({ adapter }) {
      try {
        const history = await adapter.getHistory();
        return { type: 'history', message: history.length ? history.map((item, index) => `${index + 1}. ${item}`).join('\n') : '暂无历史命令。' };
      } catch (err) {
        return { type: 'error', message: failureMessage('读取历史失败', err) };
      }
    }
  },
  {
    name: 'copy',
    usage: 'copy url 或 copy <route>',
    detail: '复制当前 URL 或站内路径',
    aliases: ['cp'],
    category: 'site',
    async action({ parsed, adapter }) {
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
      } catch (err) {
        return { type: 'error', message: failureMessage('复制失败', err) };
      }
    }
  },
  {
    name: 'python',
    usage: 'python 或 python <code>',
    detail: '进入有记忆的 Python 模式，或运行 Python 代码',
    aliases: ['py'],
    category: 'runtime',
    async action({ parsed, adapter }) {
      if (parsed.name === 'python' && !parsed.rest) {
        return { type: 'python-mode', message: '已进入 Python 模式。输入 quit 或 exit 退出，%reset 清空记忆，%block 输入多行代码。' };
      }
      if (!parsed.rest) return { type: 'error', message: '请输入 Python 代码，例如：py 1 + 2' };
      try {
        const result = await adapter.runPython(parsed.rest);
        const message = outputMessage(result);
        if (result?.ok === false) {
          return { type: 'error', message: message || 'Python 执行失败。', result };
        }
        return { type: 'python', message: message || 'Python 执行完成。', result };
      } catch (err) {
        return { type: 'error', message: failureMessage('Python 执行失败', err) };
      }
    }
  },
  {
    name: '%%python',
    usage: '%%python 或 %%python <code>',
    detail: '进入多行 Python 块输入，或直接运行多行代码',
    aliases: ['pyblock', 'python-block'],
    category: 'runtime',
    async action({ parsed, adapter }) {
      if (!parsed.rest) {
        return {
          type: 'python-block-mode',
          message: '已进入 Python 多行输入。Ctrl/Command+Enter 或点击“运行”执行，Esc 取消。'
        };
      }
      try {
        const result = await adapter.runPython(parsed.rest);
        const message = outputMessage(result);
        if (result?.ok === false) {
          return { type: 'error', message: message || 'Python 执行失败。', result };
        }
        return { type: 'python', message: message || 'Python 执行完成。', result };
      } catch (err) {
        return { type: 'error', message: failureMessage('Python 执行失败', err) };
      }
    }
  },
  {
    name: 'about',
    usage: 'about',
    detail: '查看站点说明',
    aliases: ['info'],
    category: 'terminal',
    action() {
      return { type: 'about', message: '这是 XYX 网站的全屏 CLI，可以用命令跳转站内页面、执行浏览器操作，并通过 PyScript 运行轻量 Python。' };
    }
  },
  {
    name: 'theme',
    usage: 'theme',
    detail: '切换 CLI 视觉强度',
    aliases: [],
    category: 'terminal',
    async action({ adapter }) {
      try {
        await adapter.setTheme();
        return { type: 'theme', message: '已切换 CLI 显示强度。' };
      } catch (err) {
        return { type: 'error', message: failureMessage('切换主题失败', err) };
      }
    }
  }
];

export const COMMAND_DEFINITIONS = [
  ...BASE_COMMAND_DEFINITIONS,
  ...SEARCH_PROVIDERS.map(createSearchProviderCommand)
];

export const COMMAND_REGISTRY = new Map();

COMMAND_DEFINITIONS.forEach((command) => {
  COMMAND_REGISTRY.set(command.name, command);
  (command.aliases || []).forEach((alias) => {
    COMMAND_REGISTRY.set(alias.toLowerCase(), command);
  });
});

export const COMMANDS = COMMAND_DEFINITIONS.map(commandSummary);

function getCommandDefinition(name) {
  return COMMAND_REGISTRY.get(String(name || '').toLowerCase()) || null;
}

function commandCompletions(token) {
  const seen = new Set();
  const completions = [];

  COMMAND_DEFINITIONS.forEach((command) => {
    const candidates = [command.name, ...(command.aliases || [])];
    const match = candidates.find((value) => value.toLowerCase().startsWith(token));
    if (!match || seen.has(command.name)) return;
    seen.add(command.name);
    completions.push({
      type: command.category === 'search' ? 'search-engine' : 'command',
      value: command.name,
      insert: `${match} `,
      detail: match === command.name ? command.detail : `${command.detail}（${command.name} 的别名）`
    });
  });

  return completions;
}

export function getCompletions(input) {
  const parsed = parseCommand(input);
  const raw = String(input || '');
  const trailingSpace = /\s$/.test(raw);

  if (!parsed.name || (!parsed.rest && !trailingSpace)) {
    const token = parsed.name || raw.trim().toLowerCase();
    return commandCompletions(token);
  }

  const command = getCommandDefinition(parsed.name);
  if (!command) return [];

  if (command.name === 'open' || command.name === 'copy') {
    const token = trailingSpace ? '' : parsed.rest.toLowerCase();
    return routeCompletions(parsed.name, token);
  }

  if (command.name === 'site') {
    const token = trailingSpace ? '' : parsed.rest.toLowerCase();
    return routeCompletions(parsed.name, token);
  }

  if (command.name === 'help') {
    const token = trailingSpace ? '' : parsed.rest.toLowerCase();
    return commandCompletions(token).map((completion) => ({
      ...completion,
      insert: `help ${completion.value}`,
      detail: getCommandDefinition(completion.value)?.usage || completion.detail
    }));
  }

  if (command.name === 'engines') {
    const token = trailingSpace ? '' : parsed.rest.toLowerCase();
    return searchProviderCompletions(parsed.name, token);
  }

  if (typeof command.complete === 'function') {
    return command.complete(input, parsed);
  }

  return [];
}

export function createExecutor(adapter) {
  async function run(input) {
    const parsed = parseCommand(input);
    if (!parsed.name) return { type: 'empty', message: '' };

    const command = getCommandDefinition(parsed.name);
    if (!command) {
      return { type: 'error', message: `未知命令：${parsed.name}。输入 help 查看可用命令。` };
    }

    return await command.action({ parsed, adapter, command });
  }

  return { run };
}

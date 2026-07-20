import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COMMAND_REGISTRY,
  ROUTES,
  SEARCH_PROVIDERS,
  buildSearchUrl,
  parseCommand,
  parseCommandOptions,
  resolveSearchProvider,
  resolveRoute,
  getCompletions,
  createExecutor
} from '../cli/cli-core.mjs';

function testParseCommand() {
  assert.deepEqual(parseCommand(''), { name: '', args: [], raw: '', rest: '' });
  assert.deepEqual(parseCommand('open math'), {
    name: 'open',
    args: ['math'],
    raw: 'open math',
    rest: 'math'
  });
  assert.deepEqual(parseCommand('py print("你好")'), {
    name: 'py',
    args: ['print("你好")'],
    raw: 'py print("你好")',
    rest: 'print("你好")'
  });
  assert.deepEqual(parseCommand('%%python\nfor i in range(2):\n    print(i)'), {
    name: '%%python',
    args: ['for i in range(2):\n    print(i)'],
    raw: '%%python\nfor i in range(2):\n    print(i)',
    rest: 'for i in range(2):\n    print(i)'
  });
}

function testCliInputMarkup() {
  const html = readFileSync(new URL('../cli/index.html', import.meta.url), 'utf8');
  assert.match(html, /<input id="cli-input" type="text"/);
  assert.doesNotMatch(html, /<textarea id="cli-input"/);
}

function testResolveRoute() {
  assert.equal(resolveRoute('math').path, '/work/py_software/apps/math-solver/');
  assert.equal(resolveRoute('transfer').path, '/work/lan-transfer/');
  assert.equal(resolveRoute('lan').path, '/work/lan-transfer/');
  assert.equal(resolveRoute('lan-transfer').path, '/work/lan-transfer/');
  assert.equal(resolveRoute('file-transfer').path, '/work/lan-transfer/');
  assert.equal(resolveRoute('send').path, '/work/lan-transfer/');
  assert.equal(resolveRoute('/work/tools/').path, '/work/tools/');
  assert.equal(resolveRoute('//example.com'), null);
  assert.equal(resolveRoute('/\\example.com'), null);
  assert.equal(resolveRoute('missing-route'), null);
}

function testResolveSearchProvider() {
  assert.equal(resolveSearchProvider('bing').label, 'Bing');
  assert.equal(resolveSearchProvider('bili').key, 'bilibili');
  assert.equal(resolveSearchProvider('B站').key, 'bilibili');
  assert.equal(resolveSearchProvider('ddg').key, 'duckduckgo');
  assert.equal(resolveSearchProvider('missing-engine'), null);
  assert.equal(
    buildSearchUrl(resolveSearchProvider('bing'), 'math solver'),
    'https://www.bing.com/search?q=math+solver'
  );
  assert.equal(
    buildSearchUrl(resolveSearchProvider('bilibili'), '数学 求解'),
    'https://search.bilibili.com/all?keyword=%E6%95%B0%E5%AD%A6+%E6%B1%82%E8%A7%A3'
  );
}

function testParseCommandOptions() {
  assert.deepEqual(
    parseCommandOptions('math solver -f bilibili -s', [
      { key: 'from', alias: ['f'], type: 'string', defaultValue: 'bing' },
      { key: 'self', alias: ['s'], type: 'boolean', defaultValue: false }
    ]),
    {
      values: ['math', 'solver'],
      options: { from: 'bilibili', self: true },
      errors: []
    }
  );
  assert.deepEqual(
    parseCommandOptions('"math solver" --from=google', [
      { key: 'from', alias: ['f'], type: 'string', defaultValue: 'bing' }
    ]),
    {
      values: ['math solver'],
      options: { from: 'google' },
      errors: []
    }
  );
}

function testCompletion() {
  assert.deepEqual(
    getCompletions('op').map((item) => item.value),
    ['open']
  );
  assert.ok(getCompletions('open ma').some((item) => item.value === 'math'));
  assert.ok(getCompletions('open la').some((item) => item.value === 'transfer'));
  assert.ok(getCompletions('help re').some((item) => item.value === 'reload'));
  assert.ok(getCompletions('copy u').some((item) => item.value === 'url'));
  assert.ok(getCompletions('bi').some((item) => item.value === 'bing'));
  assert.ok(getCompletions('bili').some((item) => item.value === 'bilibili'));
  assert.ok(getCompletions('dd').some((item) => item.value === 'duckduckgo'));
  assert.ok(getCompletions('%%').some((item) => item.value === '%%python'));
  assert.ok(getCompletions('bing ').some((item) => item.value === '<搜索词>'));
  assert.ok(getCompletions('search math -f g').some((item) => item.value === 'google'));
  assert.ok(getCompletions('site ma').some((item) => item.value === 'math'));
}

async function testExecutor() {
  const calls = [];
  const executor = createExecutor({
    navigate(path) {
      calls.push(['navigate', path]);
    },
    open(url) {
      calls.push(['open', url]);
      return Promise.resolve(true);
    },
    reload() {
      calls.push(['reload']);
    },
    copy(text) {
      calls.push(['copy', text]);
      return Promise.resolve(true);
    },
    runPython(code) {
      calls.push(['python', code]);
      return Promise.resolve({ ok: true, stdout: '3\n', stderr: '', result: '' });
    },
    getCurrentUrl() {
      return 'http://127.0.0.1:5173/cli/';
    },
    setTheme() {
      calls.push(['theme']);
    },
    getHistory() {
      return ['help', 'open math'];
    }
  });

  const openResult = await executor.run('open math');
  assert.equal(openResult.type, 'navigation');
  assert.deepEqual(calls.shift(), ['navigate', '/work/py_software/apps/math-solver/']);

  const openLanResult = await executor.run('open lan');
  assert.equal(openLanResult.type, 'navigation');
  assert.deepEqual(calls.shift(), ['navigate', '/work/lan-transfer/']);

  const goAliasResult = await executor.run('go tools');
  assert.equal(goAliasResult.type, 'navigation');
  assert.deepEqual(calls.shift(), ['navigate', '/work/tools/']);

  const pythonModeResult = await executor.run('python');
  assert.equal(pythonModeResult.type, 'python-mode');
  assert.equal(calls.length, 0);

  const pyResult = await executor.run('py 1 + 2');
  assert.equal(pyResult.type, 'python');
  assert.deepEqual(calls.shift(), ['python', '1 + 2']);

  const pythonBlockModeResult = await executor.run('%%python');
  assert.equal(pythonBlockModeResult.type, 'python-block-mode');
  assert.equal(calls.length, 0);

  const pythonBlockResult = await executor.run('%%python\nfor i in range(2):\n    print(i)');
  assert.equal(pythonBlockResult.type, 'python');
  assert.deepEqual(calls.shift(), ['python', 'for i in range(2):\n    print(i)']);

  const copyUrlResult = await executor.run('copy url');
  assert.equal(copyUrlResult.type, 'copy');
  assert.deepEqual(calls.shift(), ['copy', 'http://127.0.0.1:5173/cli/']);

  const copyMathResult = await executor.run('copy math');
  assert.equal(copyMathResult.type, 'copy');
  assert.deepEqual(calls.shift(), ['copy', '/work/py_software/apps/math-solver/']);

  const bingResult = await executor.run('bing math solver');
  assert.equal(bingResult.type, 'search');
  assert.equal(bingResult.url, 'https://www.bing.com/search?q=math+solver');
  assert.deepEqual(calls.shift(), ['open', 'https://www.bing.com/search?q=math+solver']);

  const bilibiliAliasResult = await executor.run('bili 数学 求解');
  assert.equal(bilibiliAliasResult.type, 'search');
  assert.equal(
    bilibiliAliasResult.url,
    'https://search.bilibili.com/all?keyword=%E6%95%B0%E5%AD%A6+%E6%B1%82%E8%A7%A3'
  );
  assert.deepEqual(calls.shift(), [
    'open',
    'https://search.bilibili.com/all?keyword=%E6%95%B0%E5%AD%A6+%E6%B1%82%E8%A7%A3'
  ]);

  const searchFromResult = await executor.run('search 数学 求解 -f bilibili');
  assert.equal(searchFromResult.type, 'search');
  assert.equal(
    searchFromResult.url,
    'https://search.bilibili.com/all?keyword=%E6%95%B0%E5%AD%A6+%E6%B1%82%E8%A7%A3'
  );
  assert.deepEqual(calls.shift(), [
    'open',
    'https://search.bilibili.com/all?keyword=%E6%95%B0%E5%AD%A6+%E6%B1%82%E8%A7%A3'
  ]);

  const currentPageSearchResult = await executor.run('google math solver -s');
  assert.equal(currentPageSearchResult.type, 'search');
  assert.deepEqual(calls.shift(), ['navigate', 'https://www.google.com/search?q=math+solver']);

  const siteResult = await executor.run('site math');
  assert.equal(siteResult.type, 'list');
  assert.match(siteResult.message, /数学求解器/);

  const missingQueryResult = await executor.run('google');
  assert.equal(missingQueryResult.type, 'error');
  assert.match(missingQueryResult.message, /请输入搜索词/);

  const enginesResult = await executor.run('engines');
  assert.equal(enginesResult.type, 'list');
  assert.match(enginesResult.message, /bing/);
  assert.match(enginesResult.message, /bilibili/);

  const unknownResult = await executor.run('unknown');
  assert.equal(unknownResult.type, 'error');
  assert.match(unknownResult.message, /未知命令/);
}

function testAdapter(overrides = {}) {
  return {
    navigate() {},
    reload() {},
    copy() {
      return Promise.resolve(true);
    },
    runPython() {
      return Promise.resolve({ ok: true, stdout: '', stderr: '', result: '' });
    },
    getCurrentUrl() {
      return 'http://127.0.0.1:5173/cli/';
    },
    setTheme() {},
    getHistory() {
      return [];
    },
    ...overrides
  };
}

async function testExecutorReviewFixes() {
  const calls = [];
  const executor = createExecutor({
    navigate(path) {
      calls.push(['navigate', path]);
    },
    open(url) {
      calls.push(['open', url]);
      return Promise.resolve(true);
    },
    reload() {
      calls.push(['reload']);
    },
    copy(text) {
      calls.push(['copy', text]);
      return Promise.resolve(true);
    },
    runPython(code) {
      calls.push(['python', code]);
      return Promise.resolve({ ok: false, stdout: 'out', stderr: 'err', result: 'result' });
    },
    getCurrentUrl() {
      return 'http://127.0.0.1:5173/cli/';
    },
    setTheme() {
      calls.push(['theme']);
    },
    getHistory() {
      return [];
    }
  });

  const externalPathResult = await executor.run('open //example.com');
  assert.equal(externalPathResult.type, 'error');
  assert.equal(calls.some((call) => call[0] === 'navigate'), false);

  const backslashPathResult = await executor.run('open /\\example.com');
  assert.equal(backslashPathResult.type, 'error');
  assert.equal(calls.some((call) => call[0] === 'navigate'), false);

  const copyUnknownResult = await executor.run('copy maths');
  assert.equal(copyUnknownResult.type, 'error');
  assert.equal(calls.some((call) => call[0] === 'copy'), false);

  const pythonFailureResult = await executor.run('py 1 / 0');
  assert.equal(pythonFailureResult.type, 'error');
  assert.match(pythonFailureResult.message, /out/);
  assert.match(pythonFailureResult.message, /result/);
  assert.match(pythonFailureResult.message, /err/);

  const copyRejectExecutor = createExecutor({
    navigate() {},
    reload() {},
    copy() {
      return Promise.reject(new Error('clipboard denied'));
    },
    runPython() {
      return Promise.resolve({ ok: true, stdout: '', stderr: '', result: '' });
    },
    getCurrentUrl() {
      return 'http://127.0.0.1:5173/cli/';
    },
    setTheme() {},
    getHistory() {
      return [];
    }
  });
  const copyRejectedResult = await copyRejectExecutor.run('copy url');
  assert.equal(copyRejectedResult.type, 'error');
  assert.match(copyRejectedResult.message, /clipboard denied|复制失败/);

  const pythonRejectExecutor = createExecutor({
    navigate() {},
    reload() {},
    copy() {
      return Promise.resolve(true);
    },
    runPython() {
      return Promise.reject(new Error('python crashed'));
    },
    getCurrentUrl() {
      return 'http://127.0.0.1:5173/cli/';
    },
    setTheme() {},
    getHistory() {
      return [];
    }
  });
  const pythonRejectedResult = await pythonRejectExecutor.run('py 1 + 2');
  assert.equal(pythonRejectedResult.type, 'error');
  assert.match(pythonRejectedResult.message, /python crashed|Python 执行失败/);

  const navigateThrowExecutor = createExecutor(testAdapter({
    navigate() {
      throw new Error('navigation denied');
    }
  }));
  const navigateThrowResult = await navigateThrowExecutor.run('open math');
  assert.equal(navigateThrowResult.type, 'error');
  assert.match(navigateThrowResult.message, /navigation denied|打开失败/);

  const reloadThrowExecutor = createExecutor(testAdapter({
    reload() {
      throw new Error('reload denied');
    }
  }));
  const reloadThrowResult = await reloadThrowExecutor.run('reload');
  assert.equal(reloadThrowResult.type, 'error');
  assert.match(reloadThrowResult.message, /reload denied|刷新失败/);

  const historyThrowExecutor = createExecutor(testAdapter({
    getHistory() {
      throw new Error('history denied');
    }
  }));
  const historyThrowResult = await historyThrowExecutor.run('history');
  assert.equal(historyThrowResult.type, 'error');
  assert.match(historyThrowResult.message, /history denied|读取历史失败/);

  const currentUrlThrowExecutor = createExecutor(testAdapter({
    getCurrentUrl() {
      throw new Error('url denied');
    }
  }));
  const currentUrlThrowResult = await currentUrlThrowExecutor.run('copy url');
  assert.equal(currentUrlThrowResult.type, 'error');
  assert.match(currentUrlThrowResult.message, /url denied|复制失败/);

  const themeThrowExecutor = createExecutor(testAdapter({
    setTheme() {
      throw new Error('theme denied');
    }
  }));
  const themeThrowResult = await themeThrowExecutor.run('theme');
  assert.equal(themeThrowResult.type, 'error');
  assert.match(themeThrowResult.message, /theme denied|切换主题失败/);

  const searchOpenFallbackExecutor = createExecutor(testAdapter({
    open() {
      return false;
    },
    navigate(path) {
      calls.push(['navigate-fallback', path]);
    }
  }));
  const searchOpenFallbackResult = await searchOpenFallbackExecutor.run('bing fallback');
  assert.equal(searchOpenFallbackResult.type, 'search');
  assert.deepEqual(calls.pop(), ['navigate-fallback', 'https://www.bing.com/search?q=fallback']);
}

assert.ok(ROUTES.length >= 12);
assert.ok(SEARCH_PROVIDERS.length >= 8);
assert.equal(COMMAND_REGISTRY.get('py').name, 'python');
assert.equal(COMMAND_REGISTRY.get('pyblock').name, '%%python');
assert.equal(COMMAND_REGISTRY.get('go').name, 'open');
testParseCommand();
testCliInputMarkup();
testResolveRoute();
testResolveSearchProvider();
testParseCommandOptions();
testCompletion();
await testExecutor();
await testExecutorReviewFixes();
console.log('CLI core tests passed');

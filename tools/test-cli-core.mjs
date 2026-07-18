import assert from 'node:assert/strict';
import {
  ROUTES,
  parseCommand,
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
}

function testResolveRoute() {
  assert.equal(resolveRoute('math').path, '/work/py_software/apps/math-solver/');
  assert.equal(resolveRoute('/work/tools/').path, '/work/tools/');
  assert.equal(resolveRoute('//example.com'), null);
  assert.equal(resolveRoute('/\\example.com'), null);
  assert.equal(resolveRoute('missing-route'), null);
}

function testCompletion() {
  assert.deepEqual(
    getCompletions('op').map((item) => item.value),
    ['open']
  );
  assert.ok(getCompletions('open ma').some((item) => item.value === 'math'));
  assert.ok(getCompletions('help re').some((item) => item.value === 'reload'));
  assert.ok(getCompletions('copy u').some((item) => item.value === 'url'));
}

async function testExecutor() {
  const calls = [];
  const executor = createExecutor({
    navigate(path) {
      calls.push(['navigate', path]);
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

  const pythonModeResult = await executor.run('python');
  assert.equal(pythonModeResult.type, 'python-mode');
  assert.equal(calls.length, 0);

  const pyResult = await executor.run('py 1 + 2');
  assert.equal(pyResult.type, 'python');
  assert.deepEqual(calls.shift(), ['python', '1 + 2']);

  const copyUrlResult = await executor.run('copy url');
  assert.equal(copyUrlResult.type, 'copy');
  assert.deepEqual(calls.shift(), ['copy', 'http://127.0.0.1:5173/cli/']);

  const copyMathResult = await executor.run('copy math');
  assert.equal(copyMathResult.type, 'copy');
  assert.deepEqual(calls.shift(), ['copy', '/work/py_software/apps/math-solver/']);

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
}

assert.ok(ROUTES.length >= 12);
testParseCommand();
testResolveRoute();
testCompletion();
await testExecutor();
await testExecutorReviewFixes();
console.log('CLI core tests passed');

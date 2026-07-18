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
  assert.equal(resolveRoute('missing-route'), null);
}

function testCompletion() {
  assert.deepEqual(
    getCompletions('op').map((item) => item.value),
    ['open']
  );
  assert.ok(getCompletions('open ma').some((item) => item.value === 'math'));
  assert.ok(getCompletions('help re').some((item) => item.value === 'reload'));
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

  const pyResult = await executor.run('py 1 + 2');
  assert.equal(pyResult.type, 'python');
  assert.deepEqual(calls.shift(), ['python', '1 + 2']);

  const unknownResult = await executor.run('unknown');
  assert.equal(unknownResult.type, 'error');
  assert.match(unknownResult.message, /未知命令/);
}

assert.ok(ROUTES.length >= 12);
testParseCommand();
testResolveRoute();
testCompletion();
await testExecutor();
console.log('CLI core tests passed');

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runnerPath = resolve(root, 'cli/cli-python.py');

const script = String.raw`
import importlib.util
import json
import sys
import types

runner_path = sys.argv[1]

class DummyEvent:
    @staticmethod
    def new(name):
        return name

dummy_window = types.SimpleNamespace(
    Event=DummyEvent,
    dispatchEvent=lambda event: None,
)
js_module = types.ModuleType("js")
js_module.window = dummy_window
sys.modules["js"] = js_module

spec = importlib.util.spec_from_file_location("site_cli_python", runner_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def run(code):
    return json.loads(module.site_cli_run_python(code))

def reset_session():
    return json.loads(module.site_cli_reset_python_session())

def assert_ok(code, expected_result="", expected_stdout=""):
    result = run(code)
    assert result["ok"], result
    assert result["result"] == expected_result, result
    assert result["stdout"] == expected_stdout, result

def assert_runtime_error(code, expected_text):
    result = run(code)
    assert not result["ok"], result
    assert expected_text in result["stderr"], result

def assert_blocked(code, expected_text="不允许"):
    result = run(code)
    assert not result["ok"], result
    assert expected_text in result["stderr"], result
    assert "__import__(\"os\")" not in result["stdout"], result

def assert_error_output_capped(code):
    result = run(code)
    assert not result["ok"], result
    assert len(result["stderr"]) <= module.MAX_OUTPUT_CHARS, result
    assert "输出已截断" in result["stderr"], result

assert_ok("1 + 2", "3")
assert_ok("2 ** 10", "1024")
assert_ok("print('你好')", "", "你好\n")
assert_ok("sum(range(10))", "45")
assert_ok("for i in range(3):\n    print(i)", "", "0\n1\n2\n")
assert_ok("[i * 2 for i in range(3)]", "[0, 2, 4]")
assert_ok('f"{1 + 2}"', "'3'")
assert_ok("x = 2\ndef f():\n    return x\nf()", "2")
assert_ok("n = 3\nfor i in range(n):\n    print(i)", "", "0\n1\n2\n")
assert_ok("items = ['春', '夏']\nfor item in items:\n    print(item)", "", "春\n夏\n")
assert_ok("pairs = ['甲', '乙']\nfor index, item in enumerate(pairs):\n    print(index, item)", "", "0 甲\n1 乙\n")

reset_session()
assert_ok("a = 1")
assert_ok("print(a)", "", "1\n")
assert_ok("a + 2", "3")

reset_session()
assert_ok("n = 4")
assert_ok("for i in range(n):\n    print(i)", "", "0\n1\n2\n3\n")
assert_ok("values = [2, 3, 5]")
assert_ok("for value in values:\n    print(value * 2)", "", "4\n6\n10\n")

reset_session()
assert_ok("base = 10\ndef add(n):\n    return base + n")
assert_ok("add(5)", "15")
assert_ok("base = 20\nadd(5)", "25")

reset_session()
assert_ok("items = [1]")
rollback_mutation = run("items.append(2)\n1 / 0")
assert not rollback_mutation["ok"], rollback_mutation
assert_ok("items", "[1]")

reset_session()
assert_ok("stable = 7")
rollback_new_binding = run("new_value = 1\n1 / 0")
assert not rollback_new_binding["ok"], rollback_new_binding
assert_ok("stable", "7")
assert_runtime_error("new_value", "NameError")

reset_result = reset_session()
assert reset_result["ok"], reset_result
assert reset_result["result"] == "Python 记忆已清空。", reset_result
assert_runtime_error("stable", "NameError")

assert_blocked("__builtins__", "不允许访问 Python 运行时保留名称。")
assert_blocked("__name__", "不允许访问 Python 运行时保留名称。")
assert_blocked("_site_cli_mul", "不允许访问 Python 运行时保留名称。")
assert_blocked('del __builtins__; __import__("os").getcwd()')
assert_blocked('__builtins__ = {}; __import__("os").getcwd()')
assert_blocked('def f(__builtins__):\n    return 1\nf(0)')
assert_blocked('def __builtins__():\n    return 1')
assert_blocked('class __builtins__:\n    pass')
assert_blocked('import math as __builtins__')
assert_blocked('abs = lambda x: sum(range(100000))', "不允许修改 Python 运行时保留名称")
assert_blocked('def abs(x):\n    return x', "不允许修改 Python 运行时保留名称")
assert_blocked('_site_cli_mul = lambda a, b: "".rjust(b, a)\nx = "x" * int("13000")\nlen(x)', "不允许修改 Python 运行时保留名称")
assert_blocked('try:\n    1 / 0\nexcept ZeroDivisionError as __builtins__:\n    pass')
assert_blocked('global __builtins__')
assert_blocked('match 1:\n    case __builtins__:\n        pass')
assert_blocked('print.__self__.__dict__["__import__"]("math").sqrt(9)')
assert_blocked('print.__self__.__dict__["open"]("cli/cli-python.py").read()[:20]')
assert_blocked('def f():\n    return 1\n"{0.__globals__}".format(f)', "不允许使用 str.format")
assert_blocked('"{value}".format_map({"value": 1})', "不允许使用 str.format")
assert_blocked('len("".rjust(13000))', "不允许使用可能产生过大结果")
assert_blocked('x = [0]\nx.extend(x)\nlen(x)', "不允许使用可能产生过大结果")
assert_blocked('(0).to_bytes(13000, "big")', "不允许使用可能产生过大结果")
assert_blocked('while True:\n    pass', "不允许使用 while 循环")
assert_blocked('sum(range(10**10))', "range 太大")
assert_blocked('10 ** 13', "指数过大")
assert_blocked('pow(2, 13)', "指数过大")
assert_blocked('x = 2\nx **= 13\nx', "不允许使用复合赋值")
assert_blocked('for i in range(300):\n    for j in range(300):\n        pass', "显式循环规模过大")
assert_blocked('[i * j for i in range(300) for j in range(300)]', "推导式规模过大")
assert_blocked('def f():\n    for j in range(50000):\n        pass\nfor i in range(50000):\n    f()', "循环或推导式中只允许调用简单内置函数")
assert_blocked('def f(i):\n    return i\n[f(i) for i in range(3)]', "循环或推导式中只允许调用简单内置函数")
assert_blocked('for i in range(50000):\n    sum(range(100000))', "循环或推导式中只允许调用简单内置函数")
assert_blocked('[sum(range(100000)) for _ in range(50000)]', "循环或推导式中只允许调用简单内置函数")
assert_blocked('for value in ["a"]:\n    value.upper()', "循环或推导式中只允许调用简单内置函数")
assert_blocked('list(map(lambda x: x, range(10)))', "不允许使用 map 或 filter")
assert_blocked('m = map\nlist(m(lambda x: x, range(10)))', "不允许使用 map 或 filter")
assert_blocked('sorted(range(10), key=lambda x: x)', "不允许使用 sorted")
assert_blocked('s = sorted\ns(range(10), key=lambda x: x)', "不允许使用 sorted")
assert_blocked('n = int("10")\nfor i in range(n):\n    pass', "显式循环的 range 参数必须是小型整数常量或已知小型整数变量")
assert_blocked('n = 50001\nfor i in range(n):\n    pass', "显式循环规模过大")
assert_blocked('n = 3\nif True:\n    n = int("10")\nfor i in range(n):\n    pass', "显式循环的 range 参数必须是小型整数常量或已知小型整数变量")
assert_blocked('n = 3\nfor _ in range(1):\n    n = int("10")\nfor i in range(n):\n    pass', "显式循环的 range 参数必须是小型整数常量或已知小型整数变量")
assert_blocked('n = 3\ndef change():\n    global n\n    n = 50001\nchange()\nfor i in range(n):\n    pass', "显式循环的 range 参数必须是小型整数常量或已知小型整数变量")
assert_blocked("print('x' * 13000)", "字符串或序列重复过大")
assert_blocked("'x' * 13000", "字符串或序列重复过大")
assert_blocked('s = "x"\ns *= int("13000")\nlen(s)', "不允许使用复合赋值")
assert_blocked('"x" * int("1000000000")', "字符串或序列重复过大")
assert_blocked('"x" * (10000 * 10000)', "字符串或序列重复过大")
assert_blocked('list(range(100000)) * 100000', "字符串或序列重复过大")
assert_error_output_capped('assert False, "' + ("x" * 13000) + '"')

after_error = run("2 + 2")
assert after_error["ok"], after_error
assert after_error["result"] == "4", after_error
`;

const result = spawnSync('python3', ['-c', script, runnerPath], {
  cwd: root,
  encoding: 'utf8'
});

if (result.status !== 0) {
  console.error(result.stdout);
  console.error(result.stderr);
}

assert.equal(result.status, 0);
console.log('CLI Python runner tests passed');

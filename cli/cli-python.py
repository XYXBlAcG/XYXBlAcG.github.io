import ast
import contextlib
import io
import json
import sys
import traceback
from types import MappingProxyType

from js import window

MAX_OUTPUT_CHARS = 12000
MAX_RANGE_ITEMS = 100000
MAX_AST_NODES = 500
MAX_LOOP_STEPS = 50000
MAX_POWER_EXPONENT = 12
MAX_TRACE_EVENTS = 120000
BLOCKED_FORMAT_METHODS = {"format", "format_map"}
BLOCKED_GROWTH_METHODS = {
    "center",
    "decode",
    "encode",
    "expandtabs",
    "extend",
    "fromhex",
    "join",
    "ljust",
    "replace",
    "rjust",
    "sort",
    "to_bytes",
    "zfill",
}
BLOCKED_HIGHER_ORDER_CALLS = {"map", "filter"}
LOOP_SAFE_CALLS = {
    "abs",
    "bin",
    "bool",
    "dict",
    "divmod",
    "float",
    "hex",
    "int",
    "len",
    "oct",
    "pow",
    "print",
    "range",
    "round",
    "str",
}
SEQUENCE_REPEAT_TYPES = (str, bytes, list, tuple)


class SafeFunction:
    __slots__ = ("_function",)

    def __init__(self, function):
        object.__setattr__(self, "_function", function)

    def __call__(self, *args, **kwargs):
        return object.__getattribute__(self, "_function")(*args, **kwargs)

    def __getattribute__(self, name):
        raise AttributeError(name)

    def __setattr__(self, name, value):
        raise AttributeError(name)

    def __delattr__(self, name):
        raise AttributeError(name)


class LimitedStringIO(io.StringIO):
    def write(self, value):
        if len(self.getvalue()) + len(value) > MAX_OUTPUT_CHARS:
            raise ValueError("输出过长，已中止执行。")
        return super().write(value)


class RuntimeBudget:
    def __init__(self, max_events):
        self.remaining_events = max_events

    def trace(self, frame, event, arg):
        if event in {"call", "line", "return", "exception"}:
            self.remaining_events -= 1
            if self.remaining_events < 0:
                raise ValueError("执行步数过多，已中止执行。")
        return self.trace


def _safe_print(*values, sep=" ", end="\n", flush=False):
    if sep is None:
        sep = " "
    if end is None:
        end = "\n"
    if not isinstance(sep, str):
        raise TypeError("sep must be None or a string")
    if not isinstance(end, str):
        raise TypeError("end must be None or a string")

    print(sep.join(str(value) for value in values), end=end, flush=bool(flush))


def _safe(function):
    return SafeFunction(function)


def _safe_range(*args):
    value = range(*args)
    if len(value) > MAX_RANGE_ITEMS:
        raise ValueError(f"range 太大，最多允许 {MAX_RANGE_ITEMS} 项。")
    return value


def _safe_pow(base, exp, mod=None):
    if not isinstance(exp, int) or isinstance(exp, bool):
        raise TypeError("指数必须是整数。")
    if abs(exp) > MAX_POWER_EXPONENT:
        raise ValueError(f"指数过大，最多允许 {MAX_POWER_EXPONENT}。")
    if mod is None:
        return pow(base, exp)
    return pow(base, exp, mod)


def _safe_mul(left, right):
    _validate_sequence_repeat(left, right)
    _validate_sequence_repeat(right, left)
    value = left * right
    if isinstance(value, SEQUENCE_REPEAT_TYPES) and len(value) > MAX_OUTPUT_CHARS:
        raise ValueError("乘法结果过大，已中止执行。")
    return value


def _validate_sequence_repeat(sequence, count):
    if not isinstance(sequence, SEQUENCE_REPEAT_TYPES) or type(count) is not int:
        return
    if len(sequence) * max(count, 0) > MAX_OUTPUT_CHARS:
        raise ValueError("字符串或序列重复过大，已中止执行。")


def _blocked_higher_order(*args, **kwargs):
    raise ValueError("不允许使用 map 或 filter，以避免隐藏的大量函数调用。")


def _safe_sorted(*args, **kwargs):
    if "key" in kwargs and kwargs["key"] is not None:
        raise ValueError("不允许使用 sorted(key=...)，以避免隐藏的大量函数调用。")
    return sorted(*args, **kwargs)


ALLOWED_BUILTINS = MappingProxyType(
    {
        "abs": _safe(abs),
        "all": _safe(all),
        "any": _safe(any),
        "bin": _safe(bin),
        "bool": bool,
        "dict": dict,
        "divmod": _safe(divmod),
        "enumerate": enumerate,
        "filter": _safe(_blocked_higher_order),
        "float": float,
        "format": _safe(format),
        "hex": _safe(hex),
        "int": int,
        "len": _safe(len),
        "list": list,
        "map": _safe(_blocked_higher_order),
        "max": _safe(max),
        "min": _safe(min),
        "oct": _safe(oct),
        "pow": _safe(_safe_pow),
        "print": _safe(_safe_print),
        "range": _safe(_safe_range),
        "round": _safe(round),
        "set": set,
        "sorted": _safe(_safe_sorted),
        "str": str,
        "sum": _safe(sum),
        "tuple": tuple,
        "zip": zip,
    }
)

PROTECTED_NAMES = {"__builtins__", "__name__"}
RUNTIME_HELPERS = {
    "_site_cli_mul": _safe_mul,
    "_site_cli_pow": _safe_pow,
}
RUNTIME_HELPER_NAMES = set(RUNTIME_HELPERS)
RESERVED_NAMES = PROTECTED_NAMES | RUNTIME_HELPER_NAMES | set(ALLOWED_BUILTINS)
BLOCKED_RUNTIME_READS = PROTECTED_NAMES | RUNTIME_HELPER_NAMES


def _reject_protected_binding(name):
    if name in RESERVED_NAMES:
        raise ValueError("不允许修改 Python 运行时保留名称。")


def _int_constant(node):
    if isinstance(node, ast.Constant) and type(node.value) is int:
        return node.value
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
        value = _int_constant(node.operand)
        if value is None:
            return None
        return -value if isinstance(node.op, ast.USub) else value
    return None


def _range_length_from_args(args):
    if not 1 <= len(args) <= 3:
        return None
    values = [_int_constant(arg) for arg in args]
    if any(value is None for value in values):
        return None
    try:
        return len(range(*values))
    except ValueError:
        return None


def _estimate_iterable_items(node):
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "range":
        length = _range_length_from_args(node.args)
        if length is None:
            raise ValueError("显式循环的 range 参数必须是小型整数常量。")
        if length > MAX_RANGE_ITEMS:
            raise ValueError(f"range 太大，最多允许 {MAX_RANGE_ITEMS} 项。")
        return length
    if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
        return len(node.elts)
    if isinstance(node, ast.Constant) and isinstance(node.value, (str, bytes)):
        return len(node.value)
    raise ValueError("显式循环只允许遍历小型 range 或字面量集合。")


def _literal_item_count(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, (str, bytes)):
        return len(node.value)
    if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
        return len(node.elts)
    return None


def _validate_repeat(node):
    left_items = _literal_item_count(node.left)
    right_items = _literal_item_count(node.right)
    left_count = _int_constant(node.left)
    right_count = _int_constant(node.right)

    if left_items is not None and right_count is not None:
        if left_items * max(right_count, 0) > MAX_OUTPUT_CHARS:
            raise ValueError("字符串或序列重复过大，已中止执行。")
    if right_items is not None and left_count is not None:
        if right_items * max(left_count, 0) > MAX_OUTPUT_CHARS:
            raise ValueError("字符串或序列重复过大，已中止执行。")


class ResourceBudgetVisitor(ast.NodeVisitor):
    def __init__(self, defined_functions):
        self.defined_functions = defined_functions
        self.iteration_depth = 0
        self.loop_multiplier = 1

    def visit_For(self, node):
        item_count = _estimate_iterable_items(node.iter)
        next_multiplier = self.loop_multiplier * max(item_count, 1)
        if next_multiplier > MAX_LOOP_STEPS:
            raise ValueError(f"显式循环规模过大，最多允许 {MAX_LOOP_STEPS} 步。")

        self.visit(node.target)
        self.visit(node.iter)

        previous_multiplier = self.loop_multiplier
        self.loop_multiplier = next_multiplier
        self.iteration_depth += 1
        try:
            for statement in [*node.body, *node.orelse]:
                self.visit(statement)
        finally:
            self.iteration_depth -= 1
            self.loop_multiplier = previous_multiplier

    def visit_While(self, node):
        raise ValueError("不允许使用 while 循环，以避免卡住浏览器。")

    def visit_Call(self, node):
        call_name = _call_name(node)
        if call_name in BLOCKED_HIGHER_ORDER_CALLS:
            raise ValueError("不允许使用 map 或 filter，以避免隐藏的大量函数调用。")
        if call_name == "sorted" and any(keyword.arg == "key" for keyword in node.keywords):
            raise ValueError("不允许使用 sorted(key=...)，以避免隐藏的大量函数调用。")
        if self.iteration_depth > 0:
            if not isinstance(node.func, ast.Name) or call_name not in LOOP_SAFE_CALLS:
                raise ValueError("循环或推导式中只允许调用简单内置函数。")
            if call_name in self.defined_functions:
                raise ValueError("循环或推导式中不允许调用自定义函数。")
        self.generic_visit(node)

    def _validate_comprehension(self, generators):
        steps = self.loop_multiplier
        for generator in generators:
            steps *= max(_estimate_iterable_items(generator.iter), 1)
            if steps > MAX_LOOP_STEPS:
                raise ValueError(f"推导式规模过大，最多允许 {MAX_LOOP_STEPS} 步。")
        return steps

    def _visit_comprehension_parts(self, node, value_nodes):
        steps = self._validate_comprehension(node.generators)

        for generator in node.generators:
            self.visit(generator.target)
            self.visit(generator.iter)

        previous_multiplier = self.loop_multiplier
        self.loop_multiplier = steps
        self.iteration_depth += 1
        try:
            for generator in node.generators:
                for condition in generator.ifs:
                    self.visit(condition)
            for value_node in value_nodes:
                self.visit(value_node)
        finally:
            self.iteration_depth -= 1
            self.loop_multiplier = previous_multiplier

    def visit_ListComp(self, node):
        self._visit_comprehension_parts(node, [node.elt])

    def visit_SetComp(self, node):
        self._visit_comprehension_parts(node, [node.elt])

    def visit_DictComp(self, node):
        self._visit_comprehension_parts(node, [node.key, node.value])

    def visit_GeneratorExp(self, node):
        self._visit_comprehension_parts(node, [node.elt])


class RuntimeGuardTransformer(ast.NodeTransformer):
    def visit_BinOp(self, node):
        self.generic_visit(node)
        if isinstance(node.op, ast.Mult):
            return ast.copy_location(
                ast.Call(
                    func=ast.Name(id="_site_cli_mul", ctx=ast.Load()),
                    args=[node.left, node.right],
                    keywords=[],
                ),
                node,
            )
        if isinstance(node.op, ast.Pow):
            return ast.copy_location(
                ast.Call(
                    func=ast.Name(id="_site_cli_pow", ctx=ast.Load()),
                    args=[node.left, node.right],
                    keywords=[],
                ),
                node,
            )
        return node


def _call_name(node):
    if isinstance(node.func, ast.Name):
        return node.func.id
    if isinstance(node.func, ast.Attribute):
        return node.func.attr
    return ""


def _validate_tree(tree):
    nodes = list(ast.walk(tree))
    if len(nodes) > MAX_AST_NODES:
        raise ValueError(f"代码过长，最多允许 {MAX_AST_NODES} 个语法节点。")
    defined_functions = {
        node.name
        for node in nodes
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    }

    for node in nodes:
        if isinstance(node, ast.Attribute) and node.attr.startswith("__"):
            raise ValueError("不允许访问双下划线属性。")
        if isinstance(node, ast.Attribute) and node.attr in BLOCKED_FORMAT_METHODS:
            raise ValueError("不允许使用 str.format 或 str.format_map。")
        if isinstance(node, ast.Attribute) and node.attr in BLOCKED_GROWTH_METHODS:
            raise ValueError("不允许使用可能产生过大结果的字符串或序列方法。")
        if isinstance(node, ast.Name) and node.id in BLOCKED_RUNTIME_READS:
            if node.id in BLOCKED_RUNTIME_READS and isinstance(node.ctx, ast.Load):
                raise ValueError("不允许访问 Python 运行时保留名称。")
        if isinstance(node, ast.Name) and node.id in RESERVED_NAMES:
            if isinstance(node.ctx, (ast.Store, ast.Del)):
                _reject_protected_binding(node.id)
        if isinstance(node, ast.While):
            raise ValueError("不允许使用 while 循环，以避免卡住浏览器。")
        if isinstance(node, ast.AugAssign):
            raise ValueError("不允许使用复合赋值，以避免绕过运行时限制。")
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Pow):
            exponent = _int_constant(node.right)
            if exponent is None or abs(exponent) > MAX_POWER_EXPONENT:
                raise ValueError(f"指数过大，最多允许 {MAX_POWER_EXPONENT}。")
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mult):
            _validate_repeat(node)
        if isinstance(node, ast.arg) and node.arg in RESERVED_NAMES:
            _reject_protected_binding(node.arg)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            _reject_protected_binding(node.name)
        if isinstance(node, ast.alias):
            _reject_protected_binding(node.asname or node.name.split(".", 1)[0])
        if isinstance(node, ast.ExceptHandler) and node.name:
            _reject_protected_binding(node.name)
        if isinstance(node, (ast.Global, ast.Nonlocal)):
            for name in node.names:
                _reject_protected_binding(name)
        if isinstance(node, ast.MatchAs) and node.name:
            _reject_protected_binding(node.name)
        if isinstance(node, ast.MatchStar) and node.name:
            _reject_protected_binding(node.name)
        if isinstance(node, ast.MatchMapping) and node.rest:
            _reject_protected_binding(node.rest)

    ResourceBudgetVisitor(defined_functions).visit(tree)


def _prepare_tree(tree):
    _validate_tree(tree)
    transformed = RuntimeGuardTransformer().visit(tree)
    ast.fix_missing_locations(transformed)
    return transformed


def _restore_runtime_namespace(namespace):
    namespace["__builtins__"] = ALLOWED_BUILTINS
    namespace["__name__"] = "__main__"
    namespace.update(RUNTIME_HELPERS)


def _run_with_budget(callback, budget):
    previous_trace = sys.gettrace()
    sys.settrace(budget.trace)
    try:
        return callback()
    finally:
        sys.settrace(previous_trace)


def _format_result(value):
    text = repr(value)
    if len(text) > MAX_OUTPUT_CHARS:
        raise ValueError("结果过长，已中止执行。")
    return text


def _trim_output(text):
    if len(text) <= MAX_OUTPUT_CHARS:
        return text
    suffix = "\n... 输出已截断 ..."
    return text[: MAX_OUTPUT_CHARS - len(suffix)] + suffix


def _run_python(code):
    stdout = LimitedStringIO()
    stderr = LimitedStringIO()
    namespace = {"__builtins__": ALLOWED_BUILTINS, "__name__": "__main__"}
    result = ""

    try:
        tree = _prepare_tree(ast.parse(code, mode="exec"))
        last_expr = tree.body[-1] if tree.body else None
        budget = RuntimeBudget(MAX_TRACE_EVENTS)

        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            if isinstance(last_expr, ast.Expr):
                exec_tree = ast.Module(body=tree.body[:-1], type_ignores=[])
                _restore_runtime_namespace(namespace)
                _run_with_budget(
                    lambda: exec(compile(exec_tree, "<site-cli>", "exec"), namespace, namespace),
                    budget,
                )
                _restore_runtime_namespace(namespace)
                value = _run_with_budget(
                    lambda: eval(
                        compile(ast.Expression(last_expr.value), "<site-cli>", "eval"),
                        namespace,
                        namespace,
                    ),
                    budget,
                )
                if value is not None:
                    result = _format_result(value)
            else:
                _restore_runtime_namespace(namespace)
                _run_with_budget(
                    lambda: exec(compile(tree, "<site-cli>", "exec"), namespace, namespace),
                    budget,
                )
            _restore_runtime_namespace(namespace)

        return {
            "ok": True,
            "stdout": stdout.getvalue(),
            "stderr": stderr.getvalue(),
            "result": result,
        }
    except Exception:
        return {
            "ok": False,
            "stdout": stdout.getvalue(),
            "stderr": _trim_output(stderr.getvalue() + traceback.format_exc(limit=4)),
            "result": "",
        }


def site_cli_run_python(code):
    return json.dumps(_run_python(str(code)), ensure_ascii=False)


window.siteCliRunPython = site_cli_run_python
window.dispatchEvent(window.Event.new("site-cli-python-ready"))

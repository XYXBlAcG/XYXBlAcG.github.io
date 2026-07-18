import ast
import contextlib
import io
import json
import traceback
from types import MappingProxyType

from js import window


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
        "filter": filter,
        "float": float,
        "format": _safe(format),
        "hex": _safe(hex),
        "int": int,
        "len": _safe(len),
        "list": list,
        "map": map,
        "max": _safe(max),
        "min": _safe(min),
        "oct": _safe(oct),
        "pow": _safe(pow),
        "print": _safe(_safe_print),
        "range": range,
        "round": _safe(round),
        "set": set,
        "sorted": _safe(sorted),
        "str": str,
        "sum": _safe(sum),
        "tuple": tuple,
        "zip": zip,
    }
)


def _validate_tree(tree):
    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute) and node.attr.startswith("__"):
            raise ValueError("不允许访问双下划线属性。")


def _run_python(code):
    stdout = io.StringIO()
    stderr = io.StringIO()
    namespace = {"__builtins__": ALLOWED_BUILTINS, "__name__": "__main__"}
    result = ""

    try:
        tree = ast.parse(code, mode="exec")
        _validate_tree(tree)
        last_expr = tree.body[-1] if tree.body else None

        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            if isinstance(last_expr, ast.Expr):
                exec_tree = ast.Module(body=tree.body[:-1], type_ignores=[])
                exec(compile(exec_tree, "<site-cli>", "exec"), namespace, namespace)
                value = eval(
                    compile(ast.Expression(last_expr.value), "<site-cli>", "eval"),
                    namespace,
                    namespace,
                )
                if value is not None:
                    result = repr(value)
            else:
                exec(compile(tree, "<site-cli>", "exec"), namespace, namespace)

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
            "stderr": stderr.getvalue() + traceback.format_exc(limit=4),
            "result": "",
        }


def site_cli_run_python(code):
    return json.dumps(_run_python(str(code)), ensure_ascii=False)


window.siteCliRunPython = site_cli_run_python
window.dispatchEvent(window.Event.new("site-cli-python-ready"))

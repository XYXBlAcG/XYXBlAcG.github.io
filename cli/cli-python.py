import ast
import contextlib
import io
import json
import traceback

from js import window


SAFE_GLOBALS = {
    "__builtins__": {
        "abs": abs,
        "all": all,
        "any": any,
        "bin": bin,
        "bool": bool,
        "dict": dict,
        "divmod": divmod,
        "enumerate": enumerate,
        "filter": filter,
        "float": float,
        "format": format,
        "hex": hex,
        "int": int,
        "len": len,
        "list": list,
        "map": map,
        "max": max,
        "min": min,
        "oct": oct,
        "pow": pow,
        "print": print,
        "range": range,
        "round": round,
        "set": set,
        "sorted": sorted,
        "str": str,
        "sum": sum,
        "tuple": tuple,
        "zip": zip,
    }
}


def _run_python(code):
    stdout = io.StringIO()
    stderr = io.StringIO()
    namespace = {}
    result = ""

    try:
        tree = ast.parse(code, mode="exec")
        last_expr = tree.body[-1] if tree.body else None

        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            if isinstance(last_expr, ast.Expr):
                exec_tree = ast.Module(body=tree.body[:-1], type_ignores=[])
                exec(compile(exec_tree, "<site-cli>", "exec"), SAFE_GLOBALS, namespace)
                value = eval(
                    compile(ast.Expression(last_expr.value), "<site-cli>", "eval"),
                    SAFE_GLOBALS,
                    namespace,
                )
                if value is not None:
                    result = repr(value)
            else:
                exec(compile(tree, "<site-cli>", "exec"), SAFE_GLOBALS, namespace)

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
            "stderr": traceback.format_exc(limit=4),
            "result": "",
        }


def site_cli_run_python(code):
    return json.dumps(_run_python(str(code)), ensure_ascii=False)


window.siteCliRunPython = site_cli_run_python
window.dispatchEvent(window.Event.new("site-cli-python-ready"))

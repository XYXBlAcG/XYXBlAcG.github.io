# import sympy as sm
from sympy import *
from pyscript import document, display
from latex2sympy2 import latex2sympy, latex2latex
from pyodide.ffi.wrappers import add_event_listener
import ast
import json
import math
import re
#from sympy import symbols, solve, Eq
# from math import *


def handle_py_action(event):
    action = event.currentTarget.getAttribute("data-py-action")
    handler = globals().get(action)
    if not handler:
        set_result_output(make_error("action_error", "找不到操作：" + str(action)))
        return
    try:
        handler(event)
    except Exception as exc:
        set_result_output(make_error("action_error", str(exc)))


def bind_py_actions():
    buttons = document.querySelectorAll("[data-py-action]")
    for button in buttons:
        add_event_listener(button, "click", handle_py_action)
    document.body.dataset.pyActionsBound = str(len(buttons))
    print("Bound Python actions:", len(buttons))



def solve_equation(equation_str):
    x = symbols('x')
    try:
        equation_split = equation_str.split('=')
        left_side = eval(equation_split[0])
        right_side = eval(equation_split[1])
        equation = Eq(left_side, right_side)
        solutions = solve(equation, x)
        if solutions:
            return solutions
        else:
            return "该方程无解."
    except Exception as e:
        return "输入的方程不正确或者解超出计算量."

def go_latex(content):
    print("类型为: ", type(content))
    output_div = document.querySelector("#latexCode")
    output_div.innerText += '$$'
    i = 0
    for expr in content:
        i += 1
        print(expr)
        lexpr = latex(expr)
        print(lexpr)
        output_div.innerText += lexpr
        if(i != len(content)):
            output_div.innerText += ' , '
    output_div.innerText += '$$'

def runsrc(content):
    input_text = document.querySelector("#inputer")
    run_legacy_command("solve x: " + input_text.value)

def modifier(input_str):
    input_text = document.querySelector(input_str)
    is_on = document.querySelector('input[name="show_latexer"]')
    if is_on.checked:
        input_text.value = latex2sympy(input_text.value)
    return input_text.value


def make_error(kind, message, warning=None):
    return {
        "ok": False,
        "kind": kind,
        "plain": message,
        "latex": "",
        "decimal": "",
        "copyable": message,
        "plot": "",
        "warnings": [warning] if warning else []
    }


def decimal_for_value(value):
    try:
        return decimal_value_to_text(value)
    except Exception:
        return ""


def decimal_value_to_text(value):
    if isinstance(value, (list, tuple, set)):
        return "[" + ", ".join(decimal_value_to_text(item) for item in value) + "]"
    if isinstance(value, dict):
        pairs = []
        for key, item in value.items():
            pairs.append(str(key) + ": " + decimal_value_to_text(item))
        return "{" + ", ".join(pairs) + "}"
    if hasattr(value, "evalf"):
        return str(N(value, 10))
    return str(value)


def latex_for_value(value):
    try:
        if isinstance(value, (list, tuple, set)):
            return "$$" + " , ".join([latex(item) for item in value]) + "$$"
        if isinstance(value, dict):
            pairs = []
            for key, item in value.items():
                pairs.append(latex(key) + " = " + latex(item))
            return "$$" + " , ".join(pairs) + "$$"
        return "$$" + latex(value) + "$$"
    except Exception:
        return ""


ASSUMPTION_ALIASES = {
    "real": "real",
    "reals": "real",
    "r": "real",
    "integer": "integer",
    "integers": "integer",
    "int": "integer",
    "z": "integer",
    "positive": "positive",
    "negative": "negative",
    "nonnegative": "nonnegative",
    "non-negative": "nonnegative",
    "nonpositive": "nonpositive",
    "non-positive": "nonpositive",
    "rational": "rational",
    "complex": "complex",
    "nonzero": "nonzero",
    "non-zero": "nonzero"
}


def split_condition_suffix(body):
    parts = re.split(r"\s+where\s+", body, maxsplit=1, flags=re.I)
    if len(parts) == 1:
        return body, {}
    return parts[0].strip(), parse_variable_conditions(parts[1])


def parse_variable_conditions(conditions_text):
    conditions = {}
    for item in conditions_text.replace("，", ",").split(","):
        item = item.strip()
        if not item:
            continue
        parts = item.split()
        if len(parts) < 2:
            raise ValueError("变量条件格式应为 x real 或 x positive")
        variable = validate_variable_name(parts[0], "where")
        assumptions = conditions.setdefault(variable, {})
        for raw_assumption in parts[1:]:
            assumption = ASSUMPTION_ALIASES.get(raw_assumption.lower())
            if not assumption:
                raise ValueError("暂不支持变量条件：" + raw_assumption)
            assumptions[assumption] = True
    return conditions


def symbol_map_from_names(names, conditions=None):
    conditions = conditions or {}
    symbol_map = {}
    ordered_names = list(names or [])
    for name in conditions:
        if name not in ordered_names:
            ordered_names.append(name)
    for name in ordered_names:
        symbol_map[name] = symbols(name, **conditions.get(name, {}))
    return symbol_map


def condition_summary(conditions):
    if not conditions:
        return ""
    parts = []
    for name, assumptions in conditions.items():
        parts.append(name + " " + " ".join(assumptions.keys()))
    return ", ".join(parts)


def make_result(kind, value, warnings=None, task=None):
    plain = str(value)
    return {
        "ok": True,
        "kind": kind,
        "plain": plain,
        "latex": latex_for_value(value),
        "decimal": decimal_for_value(value),
        "copyable": plain,
        "plot": plot_json_for_task(task, value) if task else "",
        "warnings": warnings or []
    }


def make_text_result(kind, text):
    return {
        "ok": True,
        "kind": kind,
        "plain": text,
        "latex": "",
        "decimal": "",
        "copyable": text,
        "plot": "",
        "warnings": []
    }


def split_commands(raw_input):
    commands = []
    current = []
    for line in raw_input.replace(";", "\n").splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if re.match(r"^(help|solve|diff|integrate|sum|limit|series|nsolve|solveset|roots|solve_inequality|reduce_inequalities|factor_list|laplace|inverse_laplace|linsolve|nonlinsolve|groebner|simplify|expand|factor|trigsimp|expand_trig|apart|together|cancel|matrix|calc)\b", stripped):
            if current:
                commands.append("\n".join(current))
                current = []
        current.append(stripped)
    if current:
        commands.append("\n".join(current))
    return commands


def split_header_body(text, command_name):
    prefix = command_name + " "
    if not text.startswith(prefix) and not text.startswith(command_name + ":"):
        raise ValueError("命令格式不正确")
    if ":" not in text:
        raise ValueError("缺少冒号")
    header, body = text.split(":", 1)
    return header.strip(), body.strip()


def validate_variable_name(variable, command_name):
    if not re.match(r"^[A-Za-z_]\w*$", variable):
        raise ValueError(command_name + " 命令变量名不正确")
    return variable


def split_variable_names(variables_text, command_name):
    text = variables_text.replace("，", ",").strip()
    if not text:
        raise ValueError(command_name + " 命令需要至少一个变量，例如 x 或 x,y")
    if "," not in text and re.search(r"\s+", text):
        raise ValueError(command_name + " 命令变量请用逗号分隔，例如 x,y")

    variables = [item.strip() for item in text.split(",")]
    if not all(variables):
        raise ValueError(command_name + " 命令变量列表不能有空项")
    for variable in variables:
        if re.search(r"\s+", variable):
            raise ValueError(command_name + " 命令变量请用逗号分隔，例如 x,y")
    return [validate_variable_name(variable, command_name) for variable in variables]


def validate_expression_body(expression, message):
    expression = expression.strip()
    if not expression:
        raise ValueError(message)
    return expression


def parse_equation_text(equation_text, symbol_map=None):
    if "=" not in equation_text:
        raise ValueError("方程缺少等号")
    left, right = equation_text.split("=", 1)
    return Eq(sympify(left.strip(), locals=symbol_map or {}), sympify(right.strip(), locals=symbol_map or {}))


def symbols_as_list(names, conditions=None):
    if isinstance(names, list):
        symbol_map = symbol_map_from_names(names, conditions)
        return [symbol_map[name] for name in names]
    return [symbols(names, **(conditions or {}).get(names, {}))]


MATRIX_CELL_ERROR = "矩阵元素只支持数字、变量名和简单算术表达式"
MATRIX_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_]\w*$")


def matrix_identifier(name):
    if not MATRIX_IDENTIFIER_PATTERN.match(name):
        raise ValueError(MATRIX_CELL_ERROR)
    return symbols(name)


def parse_matrix_power_exponent(node):
    sign = 1
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
        sign = -1 if isinstance(node.op, ast.USub) else 1
        node = node.operand
    if not isinstance(node, ast.Constant) or isinstance(node.value, bool) or not isinstance(node.value, int):
        raise ValueError("矩阵元素幂次必须是不超过 8 的整数")
    exponent = sign * node.value
    if abs(exponent) > 8:
        raise ValueError("矩阵元素幂次必须是不超过 8 的整数")
    return exponent


def parse_matrix_cell(node):
    if isinstance(node, ast.Constant):
        if isinstance(node.value, bool):
            raise ValueError(MATRIX_CELL_ERROR)
        if isinstance(node.value, (int, float, complex)):
            return node.value
        if isinstance(node.value, str):
            return matrix_identifier(node.value)
        raise ValueError(MATRIX_CELL_ERROR)

    if isinstance(node, ast.Name):
        return matrix_identifier(node.id)

    if isinstance(node, ast.UnaryOp):
        value = parse_matrix_cell(node.operand)
        if isinstance(node.op, ast.UAdd):
            return +value
        if isinstance(node.op, ast.USub):
            return -value
        raise ValueError(MATRIX_CELL_ERROR)

    if isinstance(node, ast.BinOp):
        left = parse_matrix_cell(node.left)
        if isinstance(node.op, ast.Pow):
            return left ** parse_matrix_power_exponent(node.right)
        right = parse_matrix_cell(node.right)
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, ast.Mult):
            return left * right
        if isinstance(node.op, ast.Div):
            return left / right
        raise ValueError(MATRIX_CELL_ERROR)

    raise ValueError(MATRIX_CELL_ERROR)


def parse_matrix_literal(text):
    try:
        parsed = ast.parse(text, mode="eval")
    except SyntaxError as exc:
        raise ValueError("矩阵必须是 [[1, 2], [3, 4]] 这样的列表格式") from exc

    data = parsed.body
    if not isinstance(data, (ast.List, ast.Tuple)) or not data.elts:
        raise ValueError("矩阵必须是二维列表")
    if not all(isinstance(row, (ast.List, ast.Tuple)) for row in data.elts):
        raise ValueError("矩阵必须是二维列表")

    row_length = len(data.elts[0].elts)
    if row_length == 0 or any(len(row.elts) != row_length for row in data.elts):
        raise ValueError("矩阵每一行的列数必须一致")
    return [[parse_matrix_cell(item) for item in row.elts] for row in data.elts]


def parse_solve(command):
    header, body = split_header_body(command, "solve")
    variables = split_variable_names(header.replace("solve", "", 1), "solve")
    body, conditions = split_condition_suffix(body)
    equations = [line.strip() for line in body.splitlines() if line.strip()]
    if not equations:
        raise ValueError("solve 命令需要至少一个方程")
    return {
        "type": "solve",
        "variables": variables,
        "equations": equations,
        "conditions": conditions
    }


def parse_diff(command):
    header, body = split_header_body(command, "diff")
    body, conditions = split_condition_suffix(body)
    variable = header.replace("diff", "", 1).strip()
    if not variable:
        raise ValueError("diff 命令需要变量，例如 diff x: x**2")
    variable = validate_variable_name(variable, "diff")
    body = validate_expression_body(body, "diff 命令需要表达式，例如 diff x: x**2")
    return {
        "type": "diff",
        "variable": variable,
        "expression": body,
        "conditions": conditions
    }


def parse_integrate(command):
    header, body = split_header_body(command, "integrate")
    body, conditions = split_condition_suffix(body)
    match = re.match(r"integrate\s+(\w+)(?:\s+from\s+(.+?)\s+to\s+(.+))?$", header)
    if not match:
        raise ValueError("integrate 格式应为 integrate x: x**2 或 integrate x from 0 to 1: x**2")
    variable = validate_variable_name(match.group(1), "integrate")
    body = validate_expression_body(body, "integrate 命令需要表达式，例如 integrate x: x**2")
    return {
        "type": "integrate",
        "variable": variable,
        "expression": body,
        "bounds": [match.group(2), match.group(3)] if match.group(2) is not None else None,
        "conditions": conditions
    }


def parse_sum(command):
    header, body = split_header_body(command, "sum")
    body, conditions = split_condition_suffix(body)
    match = re.match(r"sum\s+(\w+)\s+from\s+(.+?)\s+to\s+(.+)$", header)
    if not match:
        raise ValueError("sum 格式应为 sum n from 1 to 10: n**2")
    variable = validate_variable_name(match.group(1), "sum")
    body = validate_expression_body(body, "sum 命令需要表达式，例如 sum n from 1 to 10: n**2")
    return {
        "type": "sum",
        "variable": variable,
        "lower": match.group(2),
        "upper": match.group(3),
        "expression": body,
        "conditions": conditions
    }


def parse_expression(command):
    operation, expression = command.split(":", 1)
    operation = operation.strip()
    if operation not in ["simplify", "expand", "factor", "trigsimp", "expand_trig", "apart", "together", "cancel"]:
        raise ValueError("不支持的表达式操作")
    expression, conditions = split_condition_suffix(expression)
    expression = validate_expression_body(expression, operation + " 命令需要表达式")
    return {
        "type": "expression",
        "operation": operation,
        "expression": expression,
        "conditions": conditions
    }


def parse_limit(command):
    header, body = split_header_body(command, "limit")
    body, conditions = split_condition_suffix(body)
    match = re.match(r"limit\s+(\w+)\s+to\s+(.+)$", header)
    if not match:
        raise ValueError("limit 格式应为 limit x to 0: sin(x)/x")
    variable = validate_variable_name(match.group(1), "limit")
    target = match.group(2).strip()
    direction = "+-"
    if target.endswith("+") or target.endswith("-"):
        direction = target[-1]
        target = target[:-1].strip()
    return {
        "type": "limit",
        "variable": variable,
        "target": target,
        "direction": direction,
        "expression": validate_expression_body(body, "limit 命令需要表达式"),
        "conditions": conditions
    }


def parse_series(command):
    header, body = split_header_body(command, "series")
    body, conditions = split_condition_suffix(body)
    match = re.match(r"series\s+(\w+)\s+at\s+(.+?)\s+order\s+(\d+)$", header)
    if not match:
        raise ValueError("series 格式应为 series x at 0 order 6: sin(x)")
    order = int(match.group(3))
    if order < 1 or order > 30:
        raise ValueError("series 阶数应在 1 到 30 之间")
    return {
        "type": "series",
        "variable": validate_variable_name(match.group(1), "series"),
        "point": match.group(2).strip(),
        "order": order,
        "expression": validate_expression_body(body, "series 命令需要表达式"),
        "conditions": conditions
    }


def parse_nsolve(command):
    header, body = split_header_body(command, "nsolve")
    body, conditions = split_condition_suffix(body)
    match = re.match(r"nsolve\s+(\w+)\s+near\s+(.+)$", header)
    if not match:
        raise ValueError("nsolve 格式应为 nsolve x near 1: cos(x) - x")
    return {
        "type": "nsolve",
        "variable": validate_variable_name(match.group(1), "nsolve"),
        "guess": match.group(2).strip(),
        "expression": validate_expression_body(body, "nsolve 命令需要表达式或方程"),
        "conditions": conditions
    }


def parse_variable_expression(command, command_name):
    header, body = split_header_body(command, command_name)
    body, conditions = split_condition_suffix(body)
    variable = header.replace(command_name, "", 1).strip()
    if not variable:
        raise ValueError(command_name + " 格式应为 " + command_name + " x: 表达式")
    return {
        "type": command_name,
        "variable": validate_variable_name(variable, command_name),
        "expression": validate_expression_body(body, command_name + " 命令需要表达式"),
        "conditions": conditions
    }


DOMAIN_ALIASES = {
    "reals": Reals,
    "real": Reals,
    "r": Reals,
    "complexes": Complexes,
    "complex": Complexes,
    "c": Complexes,
    "integers": Integers,
    "integer": Integers,
    "z": Integers,
    "naturals": Naturals,
    "natural": Naturals,
    "n": Naturals,
    "naturals0": Naturals0,
    "n0": Naturals0,
    "rationals": Rationals,
    "rational": Rationals,
    "q": Rationals
}


def parse_domain_text(domain_text):
    text = domain_text.strip()
    if not text:
        return Complexes
    alias = DOMAIN_ALIASES.get(text.lower())
    if alias is not None:
        return alias
    return sympify(text, locals={
        "S": S,
        "Interval": Interval,
        "Union": Union,
        "FiniteSet": FiniteSet,
        "Reals": Reals,
        "Complexes": Complexes,
        "Integers": Integers,
        "Naturals": Naturals,
        "Naturals0": Naturals0,
        "Rationals": Rationals,
        "oo": oo
    })


def expression_lines(body):
    lines = [line.strip() for line in body.splitlines() if line.strip()]
    if not lines:
        raise ValueError("命令需要至少一个表达式")
    return lines


def parse_solveset(command):
    header, body = split_header_body(command, "solveset")
    body, conditions = split_condition_suffix(body)
    match = re.match(r"solveset\s+(\w+)(?:\s+in\s+(.+))?$", header)
    if not match:
        raise ValueError("solveset 格式应为 solveset x in Reals: sin(x) = 0")
    return {
        "type": "solveset",
        "variable": validate_variable_name(match.group(1), "solveset"),
        "domain": (match.group(2) or "Complexes").strip(),
        "expression": validate_expression_body(body, "solveset 命令需要表达式或方程"),
        "conditions": conditions
    }


def parse_transform(command, command_name):
    header, body = split_header_body(command, command_name)
    body, conditions = split_condition_suffix(body)
    variables_text = header.replace(command_name, "", 1).strip()
    variables = split_variable_names(variables_text, command_name)
    if len(variables) != 2:
        raise ValueError(command_name + " 格式应为 " + command_name + " t,s: 表达式")
    return {
        "type": command_name,
        "variable": variables[0],
        "target_variable": variables[1],
        "expression": validate_expression_body(body, command_name + " 命令需要表达式"),
        "conditions": conditions
    }


def parse_system_command(command, command_name):
    header, body = split_header_body(command, command_name)
    body, conditions = split_condition_suffix(body)
    variables = split_variable_names(header.replace(command_name, "", 1).strip(), command_name)
    return {
        "type": command_name,
        "variables": variables,
        "expressions": expression_lines(body),
        "conditions": conditions
    }


HELP_COMMAND_ORDER = [
    "solve",
    "diff",
    "integrate",
    "sum",
    "limit",
    "series",
    "nsolve",
    "solveset",
    "solve_inequality",
    "reduce_inequalities",
    "roots",
    "factor_list",
    "laplace",
    "inverse_laplace",
    "linsolve",
    "nonlinsolve",
    "groebner",
    "matrix",
    "det",
    "inv",
    "transpose",
    "rref",
    "eigenvals",
    "eigenvects",
    "simplify",
    "expand",
    "factor",
    "trigsimp",
    "expand_trig",
    "apart",
    "together",
    "cancel"
]


HELP_TOPICS = {
    "solve": """solve: 解方程或方程组
格式：
  solve x: 方程
  solve x,y: 方程1; 方程2
示例：
  solve x: x**2 - 1 = 0
  solve x,y: x + y = 3; x - y = 1
变量必须用逗号分隔。可以追加条件：
  solve x: x**2 = 1 where x positive""",
    "diff": """diff: 求导
格式：
  diff 变量: 表达式
示例：
  diff x: sin(x) * x**2""",
    "integrate": """integrate: 不定积分或定积分
格式：
  integrate x: 表达式
  integrate x from 下界 to 上界: 表达式
示例：
  integrate x: x**2
  integrate x from 0 to 1: x**2""",
    "sum": """sum: 求和
格式：
  sum n from 下界 to 上界: 表达式
示例：
  sum n from 1 to 10: n**2""",
    "limit": """limit: 求极限
格式：
  limit x to 趋近值: 表达式
  limit x to 0+: 表达式
  limit x to 0-: 表达式
示例：
  limit x to 0: sin(x)/x""",
    "series": """series: 泰勒/幂级数展开
格式：
  series x at 展开点 order 阶数: 表达式
示例：
  series x at 0 order 6: sin(x)
阶数建议保持较小，当前限制为 1 到 30。""",
    "nsolve": """nsolve: 数值求解
格式：
  nsolve x near 初值: 表达式或方程
示例：
  nsolve x near 1: cos(x) - x
  nsolve x near 1: cos(x) = x
初值会影响收敛到哪个解。""",
    "solveset": """solveset: 在指定集合中求解
格式：
  solveset x in 域: 表达式或方程
示例：
  solveset x in Reals: sin(x) = 0
常用域：Reals, Complexes, Integers, Naturals, Naturals0, Rationals。""",
    "solve_inequality": """solve_inequality: 单变量不等式
格式：
  solve_inequality x: 不等式
示例：
  solve_inequality x: x**2 - 1 > 0""",
    "reduce_inequalities": """reduce_inequalities: 不等式组化简
格式：
  reduce_inequalities x: 不等式1; 不等式2
示例：
  reduce_inequalities x: x**2 - 1 > 0; x < 5""",
    "roots": """roots: 多项式根和重数
格式：
  roots x: 多项式
示例：
  roots x: x**3 - 1""",
    "factor_list": """factor_list: 因式和重数
格式：
  factor_list x: 多项式
示例：
  factor_list x: x**4 - 1""",
    "laplace": """laplace: Laplace 变换
格式：
  laplace 原变量,目标变量: 表达式
示例：
  laplace t,s: sin(t)
输出通常为 (变换结果, 收敛平面, 条件)。""",
    "inverse_laplace": """inverse_laplace: 逆 Laplace 变换
格式：
  inverse_laplace 原变量,目标变量: 表达式
示例：
  inverse_laplace s,t: 1/(s**2 + 1)""",
    "linsolve": """linsolve: 线性方程组解集
格式：
  linsolve x,y: 方程1; 方程2
示例：
  linsolve x,y: x + y = 3; x - y = 1""",
    "nonlinsolve": """nonlinsolve: 非线性方程组解集
格式：
  nonlinsolve x,y: 方程1; 方程2
示例：
  nonlinsolve x,y: x**2 + y**2 = 1; x - y = 0""",
    "groebner": """groebner: 多项式系统 Groebner 基
格式：
  groebner x,y: 多项式1; 多项式2
示例：
  groebner x,y: x**2 + y**2 - 1; x - y""",
    "matrix": """matrix / calc: 矩阵定义和计算
格式：
  matrix A = [[1, 2], [3, 4]]
  calc A.det()
示例：
  matrix A = [[1, 2], [3, 4]]
  matrix B = [[5, 6], [7, 8]]
  calc A + B
常用表达式：A.det(), A.inv(), A.T, A.rref(), A.eigenvals(), A.eigenvects()。""",
    "det": """det: 矩阵行列式
格式：
  calc A.det()
示例：
  matrix A = [[1, 2], [3, 4]]
  calc A.det()
只适用于方阵。""",
    "inv": """inv: 矩阵逆
格式：
  calc A.inv()
示例：
  matrix A = [[1, 2], [3, 4]]
  calc A.inv()
矩阵必须可逆。""",
    "transpose": """transpose / T: 矩阵转置
格式：
  calc A.T
  calc A.transpose()
示例：
  matrix A = [[1, 2], [3, 4]]
  calc A.T""",
    "rref": """rref: 矩阵行最简形
格式：
  calc A.rref()
示例：
  matrix A = [[1, 2], [3, 4]]
  calc A.rref()
输出通常是 (行最简矩阵, 主元列)。""",
    "eigenvals": """eigenvals: 矩阵特征值
格式：
  calc A.eigenvals()
示例：
  matrix A = [[1, 2], [3, 4]]
  calc A.eigenvals()
输出是 特征值: 重数。""",
    "eigenvects": """eigenvects: 矩阵特征向量
格式：
  calc A.eigenvects()
示例：
  matrix A = [[1, 2], [3, 4]]
  calc A.eigenvects()
输出包含特征值、重数和对应特征向量。""",
    "simplify": """simplify: 化简表达式
格式：
  simplify: 表达式
示例：
  simplify: sin(x)**2 + cos(x)**2""",
    "expand": """expand: 展开表达式
格式：
  expand: 表达式
示例：
  expand: (x + 1)**4""",
    "factor": """factor: 因式分解
格式：
  factor: 表达式
示例：
  factor: x**4 - 1""",
    "trigsimp": """trigsimp: 三角化简
格式：
  trigsimp: 表达式
示例：
  trigsimp: sin(x)**2 + cos(x)**2""",
    "expand_trig": """expand_trig: 三角展开
格式：
  expand_trig: 表达式
示例：
  expand_trig: sin(x + y)""",
    "apart": """apart: 部分分式展开
格式：
  apart: 表达式
示例：
  apart: 1/(x**2 - 1)""",
    "together": """together: 通分合并
格式：
  together: 表达式
示例：
  together: 1/x + 1/(x + 1)""",
    "cancel": """cancel: 有理式约分
格式：
  cancel: 表达式
示例：
  cancel: (x**2 - 1)/(x - 1)"""
}


HELP_ALIASES = {
    "calc": "matrix",
    "inequality": "solve_inequality",
    "reduce": "reduce_inequalities",
    "t": "transpose"
}


def parse_help(command):
    topic = command.replace("help", "", 1).strip().lower()
    if topic.startswith("+"):
        topic = topic[1:].strip()
    if "." in topic:
        topic = topic.rsplit(".", 1)[1]
    if topic.endswith("()"):
        topic = topic[:-2]
    return {
        "type": "help",
        "command": HELP_ALIASES.get(topic, topic)
    }


def help_task(task):
    topic = task.get("command", "")
    if not topic:
        return (
            "help: 查看智能输入命令用法\n"
            "格式：help 指令\n"
            "示例：help solve\n\n"
            "可查指令：\n  " + ", ".join(HELP_COMMAND_ORDER)
        )
    if topic in HELP_TOPICS:
        return HELP_TOPICS[topic].strip()
    return (
        "没有找到指令：" + topic + "\n"
        "输入 help 查看可查指令列表。"
    )


def parse_matrix_commands(commands):
    matrices = {}
    expression = ""
    for command in commands:
        if command.startswith("matrix "):
            match = re.match(r"matrix\s+([A-Za-z]\w*)\s*=\s*(.+)$", command, re.S)
            if not match:
                raise ValueError("matrix 格式应为 matrix A = [[1, 2], [3, 4]]")
            matrices[match.group(1)] = parse_matrix_literal(match.group(2).strip())
        elif command.startswith("calc "):
            expression = command.replace("calc", "", 1).strip()
    if not matrices:
        raise ValueError("矩阵计算需要至少一个 matrix 定义")
    if not expression:
        raise ValueError("矩阵计算需要 calc 表达式")
    return {
        "type": "matrix",
        "matrices": matrices,
        "expression": expression
    }


def parse_input(raw_input, mode=None):
    text = raw_input.strip()
    if not text:
        raise ValueError("请输入要计算的内容")
    commands = split_commands(text)
    first = commands[0]
    if first.startswith("help"):
        return parse_help(first)
    if first.startswith("matrix ") or first.startswith("calc "):
        return parse_matrix_commands(commands)
    if first.startswith("solve "):
        return parse_solve(first)
    if first.startswith("diff "):
        return parse_diff(first)
    if first.startswith("integrate "):
        return parse_integrate(first)
    if first.startswith("sum "):
        return parse_sum(first)
    if first.startswith("limit "):
        return parse_limit(first)
    if first.startswith("series "):
        return parse_series(first)
    if first.startswith("nsolve "):
        return parse_nsolve(first)
    if first.startswith("solveset "):
        return parse_solveset(first)
    if first.startswith("roots "):
        return parse_variable_expression(first, "roots")
    if first.startswith("solve_inequality "):
        return parse_variable_expression(first, "solve_inequality")
    if first.startswith("reduce_inequalities "):
        return parse_system_command(first, "reduce_inequalities")
    if first.startswith("factor_list "):
        return parse_variable_expression(first, "factor_list")
    if first.startswith("laplace "):
        return parse_transform(first, "laplace")
    if first.startswith("inverse_laplace "):
        return parse_transform(first, "inverse_laplace")
    if first.startswith("linsolve "):
        return parse_system_command(first, "linsolve")
    if first.startswith("nonlinsolve "):
        return parse_system_command(first, "nonlinsolve")
    if first.startswith("groebner "):
        return parse_system_command(first, "groebner")
    if any(first.startswith(name + ":") for name in ["simplify", "expand", "factor", "trigsimp", "expand_trig", "apart", "together", "cancel"]):
        return parse_expression(first)
    raise ValueError("无法识别输入。示例：solve x: x + 1 = 0 或 limit x to 0: sin(x)/x")


def format_task_preview(task):
    lines = ["类型：" + task.get("type", "unknown")]
    if "variables" in task:
        lines.append("变量：" + ", ".join(task["variables"]))
    if "variable" in task:
        lines.append("变量：" + task["variable"])
    if "equations" in task:
        lines.append("方程：" + "\n".join(task["equations"]))
    if "expressions" in task:
        lines.append("表达式组：" + "\n".join(task["expressions"]))
    if "expression" in task:
        lines.append("表达式：" + task["expression"])
    if task.get("conditions"):
        lines.append("条件：" + condition_summary(task["conditions"]))
    if task.get("bounds"):
        lines.append("上下界：" + " 到 ".join(task["bounds"]))
    if task.get("target"):
        lines.append("趋近：" + task["target"])
    if task.get("target_variable"):
        lines.append("目标变量：" + task["target_variable"])
    if task.get("domain"):
        lines.append("域：" + task["domain"])
    if task.get("point") is not None:
        lines.append("展开点：" + task["point"])
    if task.get("order") is not None:
        lines.append("阶数：" + str(task["order"]))
    if task.get("guess") is not None:
        lines.append("初值：" + task["guess"])
    if task.get("matrices"):
        lines.append("矩阵：" + ", ".join(task["matrices"].keys()))
    if task.get("type") == "help":
        lines.append("主题：" + (task.get("command") or "命令列表"))
    return "\n".join(lines)


def solve_task(task):
    symbol_values = symbols_as_list(task["variables"], task.get("conditions"))
    symbol_map = symbol_map_from_names(task["variables"], task.get("conditions"))
    equations = [parse_equation_text(equation, symbol_map) for equation in task["equations"]]
    if len(symbol_values) == 1 and len(equations) == 1:
        return solve(equations[0], symbol_values[0])
    return solve(equations, symbol_values, dict=True)


def calculus_task(task):
    symbol_map = symbol_map_from_names([task["variable"]], task.get("conditions"))
    variable = symbol_map[task["variable"]]
    expression = sympify(task["expression"], locals=symbol_map)
    if task["type"] == "diff":
        return diff(expression, variable)
    if task["type"] == "integrate":
        if task.get("bounds"):
            lower, upper = task["bounds"]
            return integrate(expression, (variable, sympify(lower, locals=symbol_map), sympify(upper, locals=symbol_map)))
        return integrate(expression, variable)
    if task["type"] == "sum":
        return summation(expression, (variable, sympify(task["lower"], locals=symbol_map), sympify(task["upper"], locals=symbol_map)))
    raise ValueError("不支持的微积分任务")


def expression_task(task):
    symbol_map = symbol_map_from_names([], task.get("conditions"))
    expression = sympify(task["expression"], locals=symbol_map)
    operation = task["operation"]
    operations = {
        "simplify": simplify,
        "expand": expand,
        "factor": factor,
        "trigsimp": trigsimp,
        "expand_trig": expand_trig,
        "apart": apart,
        "together": together,
        "cancel": cancel
    }
    return operations[operation](expression)


def is_plain_equation_text(text):
    if "=" in text and not any(operator in text for operator in [">=", "<=", ">", "<"]):
        return True
    return False


def expression_or_equation_difference(text, symbol_map):
    if is_plain_equation_text(text):
        equation = parse_equation_text(text, symbol_map)
        return equation.lhs - equation.rhs
    return sympify(text, locals=symbol_map)


def equation_or_expression(text, symbol_map):
    if is_plain_equation_text(text):
        return parse_equation_text(text, symbol_map)
    return sympify(text, locals=symbol_map)


def same_limit_value(left, right):
    if left == right:
        return True
    try:
        return simplify(left - right) == 0
    except Exception:
        return False


def advanced_task(task):
    variable_names = task.get("variables") or [task["variable"]]
    if task.get("target_variable"):
        variable_names = variable_names + [task["target_variable"]]
    symbol_map = symbol_map_from_names(variable_names, task.get("conditions"))
    primary_variable_name = task.get("variable") or task.get("variables", [None])[0]
    variable = symbol_map[primary_variable_name] if primary_variable_name else None
    expression = task.get("expression", "")
    if task["type"] == "limit":
        parsed_expression = sympify(expression, locals=symbol_map)
        target = sympify(task["target"], locals=symbol_map)
        if task["direction"] == "+-":
            left_limit = limit(parsed_expression, variable, target, dir="-")
            right_limit = limit(parsed_expression, variable, target, dir="+")
            if same_limit_value(left_limit, right_limit):
                return right_limit
            return {"left": left_limit, "right": right_limit}
        return limit(parsed_expression, variable, target, dir=task["direction"])
    if task["type"] == "series":
        return series(
            sympify(expression, locals=symbol_map),
            variable,
            sympify(task["point"], locals=symbol_map),
            task["order"]
        )
    if task["type"] == "nsolve":
        return nsolve(
            expression_or_equation_difference(expression, symbol_map),
            variable,
            sympify(task["guess"], locals=symbol_map)
        )
    if task["type"] == "roots":
        return roots(sympify(expression, locals=symbol_map), variable)
    if task["type"] == "solve_inequality":
        return solve_univariate_inequality(sympify(expression, locals=symbol_map), variable)
    if task["type"] == "solveset":
        return solveset(
            expression_or_equation_difference(expression, symbol_map),
            variable,
            parse_domain_text(task["domain"])
        )
    if task["type"] == "reduce_inequalities":
        relations = [sympify(item, locals=symbol_map) for item in task["expressions"]]
        return reduce_inequalities(relations, variable)
    if task["type"] == "factor_list":
        return factor_list(sympify(expression, locals=symbol_map), variable)
    if task["type"] == "laplace":
        target_variable = symbol_map[task["target_variable"]]
        return laplace_transform(sympify(expression, locals=symbol_map), variable, target_variable)
    if task["type"] == "inverse_laplace":
        target_variable = symbol_map[task["target_variable"]]
        return inverse_laplace_transform(sympify(expression, locals=symbol_map), variable, target_variable)
    if task["type"] == "linsolve":
        variables = [symbol_map[name] for name in task["variables"]]
        system = [equation_or_expression(item, symbol_map) for item in task["expressions"]]
        return linsolve(system, variables)
    if task["type"] == "nonlinsolve":
        variables = [symbol_map[name] for name in task["variables"]]
        system = [expression_or_equation_difference(item, symbol_map) for item in task["expressions"]]
        return nonlinsolve(system, variables)
    if task["type"] == "groebner":
        variables = [symbol_map[name] for name in task["variables"]]
        polynomials = [expression_or_equation_difference(item, symbol_map) for item in task["expressions"]]
        return groebner(polynomials, *variables)
    raise ValueError("不支持的高级任务")


def apply_matrix_method(value, method):
    if method.startswith("_"):
        raise ValueError("不支持的矩阵方法")
    methods = {
        "det": lambda matrix: matrix.det(),
        "inv": lambda matrix: matrix.inv(),
        "transpose": lambda matrix: matrix.transpose(),
        "rref": lambda matrix: matrix.rref(),
        "eigenvals": lambda matrix: matrix.eigenvals(),
        "eigenvects": lambda matrix: matrix.eigenvects()
    }
    if method not in methods:
        raise ValueError("不支持的矩阵方法")
    try:
        return methods[method](value)
    except AttributeError as exc:
        raise ValueError("不支持的矩阵方法") from exc


def eval_matrix_ast(node, matrix_values):
    if isinstance(node, ast.Name):
        if node.id in matrix_values:
            return matrix_values[node.id]
        raise ValueError("不支持的矩阵表达式：未知名称 " + node.id)

    if isinstance(node, ast.Constant):
        if isinstance(node.value, bool) or not isinstance(node.value, int):
            raise ValueError("不支持的矩阵表达式：幂次必须是整数")
        return node.value

    if isinstance(node, ast.UnaryOp):
        value = eval_matrix_ast(node.operand, matrix_values)
        if isinstance(node.op, ast.UAdd):
            return +value
        if isinstance(node.op, ast.USub):
            return -value
        raise ValueError("不支持的矩阵表达式")

    if isinstance(node, ast.BinOp):
        left = eval_matrix_ast(node.left, matrix_values)
        right = eval_matrix_ast(node.right, matrix_values)
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, (ast.Mult, ast.MatMult)):
            return left * right
        if isinstance(node.op, ast.Pow):
            if not isinstance(right, int) or abs(right) > 8:
                raise ValueError("不支持的矩阵表达式：幂次必须是不超过 8 的整数")
            return left ** right
        raise ValueError("不支持的矩阵表达式")

    if isinstance(node, ast.Attribute):
        if node.attr.startswith("_"):
            raise ValueError("不支持的矩阵方法")
        value = eval_matrix_ast(node.value, matrix_values)
        if node.attr == "T":
            return value.T
        raise ValueError("不支持的矩阵方法")

    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Attribute):
            raise ValueError("不支持的矩阵表达式")
        if node.args or node.keywords:
            raise ValueError("不支持的矩阵方法")
        value = eval_matrix_ast(node.func.value, matrix_values)
        return apply_matrix_method(value, node.func.attr)

    raise ValueError("不支持的矩阵表达式")


def eval_matrix_expression(expression, matrix_values):
    try:
        parsed = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise ValueError("不支持的矩阵表达式") from exc
    return eval_matrix_ast(parsed.body, matrix_values)


def matrix_task(task):
    matrix_values = {
        name: Matrix(value)
        for name, value in task["matrices"].items()
    }
    return eval_matrix_expression(task["expression"], matrix_values)


def finite_float(value):
    try:
        numeric = complex(value.evalf()) if hasattr(value, "evalf") else complex(value)
    except Exception:
        return None
    if abs(numeric.imag) > 1e-8:
        return None
    result = float(numeric.real)
    return result if math.isfinite(result) else None


def plot_json_for_expression(expression, variable, title):
    points = []
    sample_count = 161
    for index in range(sample_count):
        x_value = -10 + 20 * index / (sample_count - 1)
        try:
            y_value = finite_float(expression.subs(variable, x_value))
        except Exception:
            y_value = None
        if y_value is not None:
            points.append([round(x_value, 4), round(y_value, 8)])
    if len(points) < 2:
        return ""
    return json.dumps({
        "title": title,
        "variable": str(variable),
        "points": points
    }, ensure_ascii=False, separators=(",", ":"))


def plot_expression_from_task(task, value):
    if not task:
        return None, None, ""
    task_type = task.get("type")
    if task_type == "solve" and len(task.get("variables", [])) == 1 and len(task.get("equations", [])) == 1:
        symbol_map = symbol_map_from_names(task["variables"], task.get("conditions"))
        equation = parse_equation_text(task["equations"][0], symbol_map)
        variable = symbol_map[task["variables"][0]]
        return equation.lhs - equation.rhs, variable, "方程左右差值"
    if task_type in ["diff", "integrate"]:
        symbol_map = symbol_map_from_names([task["variable"]], task.get("conditions"))
        variable = symbol_map[task["variable"]]
        if hasattr(value, "free_symbols") and variable in value.free_symbols:
            return value, variable, "结果函数"
    if task_type == "expression":
        target = value
        if not hasattr(target, "free_symbols"):
            return None, None, ""
        free_symbols = list(target.free_symbols)
        if len(free_symbols) == 1:
            return target, free_symbols[0], "表达式"
    return None, None, ""


def plot_json_for_task(task, value):
    try:
        expression, variable, title = plot_expression_from_task(task, value)
        if expression is None or variable is None:
            return ""
        return plot_json_for_expression(expression, variable, title)
    except Exception:
        return ""


def dispatch_task(task):
    task_type = task["type"]
    if task_type == "help":
        return help_task(task)
    if task_type == "solve":
        return solve_task(task)
    if task_type in ["diff", "integrate", "sum"]:
        return calculus_task(task)
    if task_type in [
        "limit",
        "series",
        "nsolve",
        "solveset",
        "roots",
        "solve_inequality",
        "reduce_inequalities",
        "factor_list",
        "laplace",
        "inverse_laplace",
        "linsolve",
        "nonlinsolve",
        "groebner"
    ]:
        return advanced_task(task)
    if task_type == "expression":
        return expression_task(task)
    if task_type == "matrix":
        return matrix_task(task)
    raise ValueError("不支持的任务类型：" + task_type)


def run_solver(raw_input, mode=None):
    try:
        task = parse_input(raw_input, mode)
        value = dispatch_task(task)
        if task["type"] == "help":
            return make_text_result("help", value)
        return make_result(task["type"], value, task=task)
    except Exception as exc:
        return make_error("solver_error", str(exc))


def run_legacy_command(command):
    result = run_solver(command)
    set_result_output(result)
    return result


def set_result_output(result):
    output_div = document.querySelector("#output")
    latex_code = document.querySelector("#latexCode")
    latex_div = document.querySelector("#latexDiv")
    numeric_div = document.querySelector("#numeric_output")
    copyable_div = document.querySelector("#copyable_output")
    copy_button = document.querySelector("#copy-result-button")
    plot_data = document.querySelector("#plot_data")

    output_div.dataset.resultKind = result["kind"]
    output_div.dataset.helpRendered = "false"
    output_div.innerText = result["plain"]
    latex_code.innerText = result["latex"]
    if numeric_div:
        numeric_div.innerText = result["decimal"] or "暂无小数近似"
    if copyable_div:
        copyable_div.innerText = result["copyable"]
    if copy_button:
        copy_button.title = "复制结果"
    if plot_data:
        plot_data.innerText = result["plot"]
    if latex_div:
        if result["latex"]:
            latex_div.innerText = "正在渲染 Latex 结果..."
        else:
            latex_div.innerText = result["plain"]


def run_smart_solver(content):
    input_text = document.querySelector("#smart_inputer")
    result = run_solver(input_text.value)
    set_result_output(result)


def preview_smart_input(content):
    input_text = document.querySelector("#smart_inputer")
    preview_div = document.querySelector("#parse_preview")
    try:
        task = parse_input(input_text.value)
        preview_div.innerText = format_task_preview(task)
    except Exception as exc:
        preview_div.innerText = "解析失败：" + str(exc)


def helper(content):
    output_div = document.querySelector("#output")
    output_div.innerText = \
    "不可省略乘号.\n" + \
    "幂次请使用 '**'. \n" + \
    "允许通过 pi, E 来调用 π 和 e 的值. 其他数学函数可能可用, 形如 gamma 函数.\n" + \
    "函数内含未知数参数的方程无法解出. 如 x * sin(x) = 1 .\n" + \
    "如果方程结果没有正常显示, 请注意观察下面的报错信息.\n" + \
    "name: Easy_Math_Solver\n" + \
    "author: XYX\n" + \
    "version: v0.1.2\n" + \
    "lastest update: 2024/06/23\n" + \
    "\n v0.1.2 加入求和功能. 24/06/23\n" + \
    "\n v0.1.1 加入积分功能, 加入一言. 24/05/24\n" + \
    "\n v0.1.0 加入化简展开功能. 24/04/19\n" + \
    "\n v0.0.4 更好的界面, 尝试加入化学功能. 24/04/13\n" + \
    "\n v0.0.3 添加解矩阵功能. 24/04/04\n" + \
    "\n v0.0.2 添加求导功能. 24/03\n" + \
    "\n v0.0.1 初代版本. 24/03\n"
    
def clean_content(content):
    output_div = document.querySelector("#output")
    output_div.dataset.resultKind = ""
    output_div.innerText = " "
    output_div = document.querySelector("#latexCode")
    output_div.innerText = " "
    output_div = document.querySelector("#latexDiv")
    output_div.innerText = " "
    output_div = document.querySelector("#copyable_output")
    if output_div:
        output_div.innerText = " "
    output_div = document.querySelector("#numeric_output")
    if output_div:
        output_div.innerText = " "
    output_div = document.querySelector("#plot_data")
    if output_div:
        output_div.innerText = " "
    output_div = document.querySelector("#plot_status")
    if output_div:
        output_div.innerText = "暂无可绘制图像"
    copy_button = document.querySelector("#copy-result-button")
    if copy_button:
        copy_button.title = "复制结果"

def extract_expressions(input_str):
    expressions = [expr.strip() for expr in input_str.split(',')]
    return expressions

def mult_func_solve(variables, equations, beta = 0):
    print("variables : ", variables)
    print("equations : ", equations)
    

    try:
        symbols_list = symbols(variables)
        if (beta == 1):
            eqs = []
            for i in range(len(equations)):
                equations[i] = latex2sympy(equations[i])
                print(equations[i])
                print(type(equations[i]))
                if(type(equations[i]) == list):
                    for equation in equations[i]:
                        eqs.append(equation)
                else:
                    eqs.append(equations[i])
            # eqs = [Eq(equation.split('=')[0].strip(), equation.split('=')[1].strip()) for equation in equations]
            solutions = solve(eqs)
        else:
            eqs = [Eq(sympify(equation.split('=')[0].strip()), sympify(equation.split('=')[1].strip())) for equation in equations]
            solutions = solve(eqs)
        if solutions:
            return solutions
        else:
            return "该方程无解."
    except Exception as e:
        print(e)
        return "解方程时出现错误, 输入可能非法."

def runsrc_mult(content):
    input_var = document.querySelector("#unknown_num")
    input_equ = document.querySelector("#mul_inputer")
    equations = "\n  ".join([item.strip() for item in input_equ.value.replace(",", "\n").splitlines() if item.strip()])
    run_legacy_command("solve " + input_var.value + ":\n  " + equations)

def split_matrix_row_values(row_text):
    row_text = row_text.strip().strip("[]()")
    if not row_text:
        raise ValueError("矩阵行不能为空")
    if "," in row_text:
        values = [value.strip() for value in row_text.split(",") if value.strip()]
    else:
        values = [value.strip() for value in row_text.split() if value.strip()]
    if not values:
        raise ValueError("矩阵行不能为空")
    return values


def matrix_data_to_literal(matrix_data):
    matrix_data = matrix_data.strip()
    if not matrix_data:
        raise ValueError("矩阵内容不能为空")
    if not matrix_data.startswith("[["):
        raise ValueError("矩阵定义格式应为 A = [[1, 2], [3, 4]]")
    parse_matrix_literal(matrix_data)
    return matrix_data


def matrix_definition_to_command(name, matrix_data):
    validate_variable_name(name, "matrix")
    return "matrix " + name + " = " + matrix_data_to_literal(matrix_data)


def readable_matrix_to_command(matrix_text, expression_text):
    text = matrix_text.strip()
    if not text:
        raise ValueError("请先输入矩阵定义")
    if "#" in text:
        raise ValueError("矩阵不再支持 # 分隔的旧格式；请使用 A = [[1, 2], [3, 4]]")

    if re.search(r"(?m)^\s*(matrix\s+|calc\s+)", text):
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if expression_text.strip() and not any(line.startswith("calc ") for line in lines):
            lines.append("calc " + expression_text.strip())
        return "\n".join(lines)

    lines = []
    current_name = ""
    current_data = []

    def flush_current():
        if current_name:
            if not current_data:
                raise ValueError("矩阵 " + current_name + " 缺少内容")
            lines.append(matrix_definition_to_command(current_name, "\n".join(current_data)))

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        match = re.match(r"^(?:matrix\s+)?([A-Za-z]\w*)\s*[:=]\s*(.*)$", line)
        if match:
            flush_current()
            current_name = match.group(1)
            rest = match.group(2).strip()
            current_data = [rest] if rest else []
        elif current_name:
            current_data.append(line)
        else:
            raise ValueError("矩阵定义格式应为 A = [[1, 2], [3, 4]]")

    flush_current()
    if not lines:
        raise ValueError("矩阵定义格式应为 A = [[1, 2], [3, 4]]")
    if expression_text.strip():
        lines.append("calc " + expression_text.strip())
    return "\n".join(lines)


def runsrc_mat(content):
    matrices = document.querySelector("#mat_inputer").value
    expression = document.querySelector("#mat_cal").value
    run_legacy_command(readable_matrix_to_command(matrices, expression))

def der_diff(content):
    x = symbols('x')
    print(content)
    f = sympify(content)
    return diff(f, x)

def runsrc_der(content):
    input_a = document.querySelector("#func_inputer")
    run_legacy_command("diff x: " + input_a.value)

def solve_simplify(variables, equations):
    try:
        symbols_list = symbols(variables)
        expression = sympify(equations)
        return simplify(expression)
    except Exception as e:
        return "化简时出现错误, 输入可能非法."

def runsrc_simplify(content):
    input_equ = document.querySelector("#simple_inputer")
    run_legacy_command("simplify: " + input_equ.value)

def solve_factor(variables, equations):
    try:
        symbols_list = symbols(variables)
        expression = sympify(equations)
        return factor(expression)
    except Exception as e:
        return "化简时出现错误, 输入可能非法."

def runsrc_factor(content):
    input_equ = document.querySelector("#simple_inputer")
    run_legacy_command("factor: " + input_equ.value)

def solve_expand(variables, equations):
    try:
        symbols_list = symbols(variables)
        expression = sympify(equations)
        return expand(expression)
    except Exception as e:
        return "展开时出现错误, 输入可能非法."

def runsrc_expand(content):
    input_equ = document.querySelector("#simple_inputer")
    run_legacy_command("expand: " + input_equ.value)

def solve_trigsimp(variables, equations):
    try:
        symbols_list = symbols(variables)
        expression = sympify(equations)
        return trigsimp(expression)
    except Exception as e:
        return "化简时出现错误, 输入可能非法."

def runsrc_trigsimp(content):
    input_equ = document.querySelector("#simple_inputer")
    run_legacy_command("trigsimp: " + input_equ.value)

def solve_expand_trig(variables, equations):
    try:
        symbols_list = symbols(variables)
        expression = sympify(equations)
        return expand_trig(expression)
    except Exception as e:
        return "展开时出现错误, 输入可能非法."

def runsrc_expand_trig(content):
    input_equ = document.querySelector("#simple_inputer")
    run_legacy_command("expand_trig: " + input_equ.value)

def high_solver(variables, equations, domains):
    # try:
    # domains = domains.split()
    variable_names = split_variable_names(variables, "high")
    if len(variable_names) != 1:
        raise ValueError("高级求解目前只支持一个变量，例如 x")
    # if(len(domains) == 0):
    symbol_value = symbols(variable_names[0])
    # else:
    #     a = 0
    #     for i in variables:
    #         symbols_list.append(symbols(i, domain=domains[a]))
    #         a += 1
    R = Reals
    C = Complexes
    Z = Integers
    N = Naturals
    N0 = Naturals0
    Q = Rationals
    domains = sympify(domains)
    print("domain = ", domains)
    return solveset(equations, symbol_value, domains)
    # except Exception as e:
    #     return "解方程时出现错误, 输入可能非法."

def runsrc_high(content):
    input_var = document.querySelector("#unknown_high")
    input_domain = document.querySelector("#domain_high")
    input_equ = document.querySelector("#high_inputer")
    try:
        answer = high_solver(input_var.value, input_equ.value, input_domain.value)
        set_result_output(make_result("high", answer))
    except Exception as exc:
        set_result_output(make_error("high", str(exc)))

def inte_ud(var, equ, domain):
    symbols_list = symbols(var)
    lft, rgt = domain.split(',')
    return integrate(sympify(equ), (symbols_list, sympify(lft), sympify(rgt)))

def runsrc_inte_ud(content):
    input_var = document.querySelector("#unknown_inte")
    input_domain = document.querySelector("#ud_inte")
    input_equ = document.querySelector("#inte_inputer")
    bounds = [item.strip() for item in input_domain.value.split(",", 1)]
    if len(bounds) < 2 or not bounds[0] or not bounds[1]:
        set_result_output(make_error("legacy_input_error", "定积分上下界格式应为 0,1"))
        return
    run_legacy_command("integrate " + input_var.value + " from " + bounds[0] + " to " + bounds[1] + ": " + input_equ.value)

def inte_(var, equ):
    symbols_list = symbols(var)
    return integrate(sympify(equ), (symbols_list))

def runsrc_inte(content):
    input_var = document.querySelector("#unknown_inte")
    input_equ = document.querySelector("#inte_inputer")
    run_legacy_command("integrate " + input_var.value + ": " + input_equ.value)

def sum_(equ, var, vars):
    tovar = tuple(var.split(','))
    symbols_list = symbols(vars)
    return summation(sympify(equ), tovar)


def runsrc_sum(content):
    input_var = document.querySelector("#sum_sub")
    input_equ = document.querySelector("#sum_inputer")
    parts = [item.strip() for item in input_var.value.split(",")]
    if len(parts) < 3 or not parts[0] or not parts[1] or not parts[2]:
        set_result_output(make_error("legacy_input_error", "求和下标格式应为 n,1,10"))
        return
    run_legacy_command("sum " + parts[0] + " from " + parts[1] + " to " + parts[2] + ": " + input_equ.value)

def clean_latex_entry(entry):
    entry = entry.strip()
    for left, right in [("$$", "$$"), ("\\[", "\\]"), ("\\(", "\\)")]:
        if entry.startswith(left) and entry.endswith(right):
            entry = entry[len(left):-len(right)].strip()
            break
    if entry.startswith("$") and entry.endswith("$"):
        entry = entry[1:-1].strip()
    entry = re.sub(r"\\begin\{(?:aligned|align|cases|array)\}", "", entry)
    entry = re.sub(r"\\end\{(?:aligned|align|cases|array)\}", "", entry)
    return entry.replace("&", "").strip()


def latex_environment_at(text, index):
    before = text[:index]
    begins = re.findall(r"\\begin\{([A-Za-z*]+)\}", before)
    ends = re.findall(r"\\end\{([A-Za-z*]+)\}", before)
    stack = []
    for name in begins:
        stack.append(name)
    for name in ends:
        if name in stack:
            stack.remove(name)
    return stack[-1] if stack else ""


def is_matrix_latex_environment(name):
    return name in ["matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "smallmatrix"]


def split_latex_entries(raw_input):
    text = raw_input.replace("\r\n", "\n").replace("\r", "\n")
    entries = []
    current = []
    brace_depth = 0
    bracket_depth = 0
    paren_depth = 0
    escaped = False
    index = 0
    length = len(text)
    while index < length:
        char = text[index]
        if char == "\\" and index + 1 < length and text[index + 1] == "\\":
            environment = latex_environment_at(text, index)
            if (
                brace_depth == 0
                and bracket_depth == 0
                and paren_depth == 0
                and not is_matrix_latex_environment(environment)
            ):
                entry = "".join(current).strip()
                if entry:
                    entries.append(clean_latex_entry(entry))
                current = []
            else:
                current.append("\\\\")
            index += 2
            escaped = False
            continue
        if char == "\\" and not escaped:
            current.append(char)
            escaped = True
            index += 1
            continue
        if char == "{" and not escaped:
            brace_depth += 1
        elif char == "}" and not escaped and brace_depth > 0:
            brace_depth -= 1
        elif char == "[" and not escaped:
            bracket_depth += 1
        elif char == "]" and not escaped and bracket_depth > 0:
            bracket_depth -= 1
        elif char == "(" and not escaped:
            paren_depth += 1
        elif char == ")" and not escaped and paren_depth > 0:
            paren_depth -= 1
        if (
            (char == "\n" or char == ";")
            and brace_depth == 0
            and bracket_depth == 0
            and paren_depth == 0
            and not escaped
        ):
            entry = "".join(current).strip()
            if entry:
                entries.append(clean_latex_entry(entry))
            current = []
        else:
            current.append(char)
        escaped = False
        index += 1
    entry = "".join(current).strip()
    if entry:
        entries.append(clean_latex_entry(entry))
    return entries


def split_latex_equation(entry):
    brace_depth = 0
    bracket_depth = 0
    paren_depth = 0
    escaped = False
    for index, char in enumerate(entry):
        if char == "\\" and not escaped:
            escaped = True
            continue
        if char == "{" and not escaped:
            brace_depth += 1
        elif char == "}" and not escaped and brace_depth > 0:
            brace_depth -= 1
        elif char == "[" and not escaped:
            bracket_depth += 1
        elif char == "]" and not escaped and bracket_depth > 0:
            bracket_depth -= 1
        elif char == "(" and not escaped:
            paren_depth += 1
        elif char == ")" and not escaped and paren_depth > 0:
            paren_depth -= 1
        elif (
            char == "="
            and brace_depth == 0
            and bracket_depth == 0
            and paren_depth == 0
            and not escaped
        ):
            left = entry[:index].strip()
            right = entry[index + 1:].strip()
            if not left or not right:
                raise ValueError("Latex 方程等号两边都需要表达式")
            return left, right
        escaped = False
    return None


def has_top_level_latex_equation(entry):
    return split_latex_equation(entry) is not None


def split_latex_relation_commas(entry):
    parts = []
    current = []
    brace_depth = 0
    bracket_depth = 0
    paren_depth = 0
    escaped = False
    for index, char in enumerate(entry):
        if char == "\\" and not escaped:
            current.append(char)
            escaped = True
            continue
        if char == "{" and not escaped:
            brace_depth += 1
        elif char == "}" and not escaped and brace_depth > 0:
            brace_depth -= 1
        elif char == "[" and not escaped:
            bracket_depth += 1
        elif char == "]" and not escaped and bracket_depth > 0:
            bracket_depth -= 1
        elif char == "(" and not escaped:
            paren_depth += 1
        elif char == ")" and not escaped and paren_depth > 0:
            paren_depth -= 1
        if (
            char == ","
            and brace_depth == 0
            and bracket_depth == 0
            and paren_depth == 0
            and not escaped
        ):
            left = "".join(current).strip()
            right = entry[index + 1:].strip()
            if (
                left
                and right
                and has_top_level_latex_equation(left)
                and has_top_level_latex_equation(right)
            ):
                parts.append(left)
                current = []
            else:
                current.append(char)
        else:
            current.append(char)
        escaped = False
    final = "".join(current).strip()
    if final:
        parts.append(final)
    return parts if len(parts) > 1 else [entry]


def normalize_latex_number_commas(fragment):
    def remove_thousands(match):
        return match.group(0).replace(",", "")

    fragment = re.sub(r"\d{1,3}(?:,\d{3})+(?!\d)", remove_thousands, fragment)
    return re.sub(r"(?<=\d),(?=\d)", ".", fragment)


def latex_fragment_to_sympy(fragment):
    fragment = normalize_latex_number_commas(fragment)
    try:
        return latex2sympy(fragment)
    except Exception as exc:
        pythonish = fragment.replace("^", "**").replace("\\cdot", "*").replace("\\times", "*")
        try:
            return sympify(pythonish)
        except Exception:
            raise exc


def flatten_latex_result(converted):
    if isinstance(converted, (list, tuple, set)):
        return list(converted)
    return [converted]


def latex_entry_to_equations(entry):
    entry = clean_latex_entry(entry)
    comma_parts = split_latex_relation_commas(entry)
    if len(comma_parts) > 1:
        equations = []
        for part in comma_parts:
            equations.extend(latex_entry_to_equations(part))
        return equations
    equation_parts = split_latex_equation(entry)
    if equation_parts:
        left, right = equation_parts
        return [Eq(latex_fragment_to_sympy(left), latex_fragment_to_sympy(right))]
    return flatten_latex_result(latex_fragment_to_sympy(entry))


def latex_to_equations(raw_input):
    entries = split_latex_entries(raw_input)
    if not entries:
        raise ValueError("请输入至少一个 Latex 方程")
    equations = []
    for entry in entries:
        equations.extend(latex_entry_to_equations(entry))
    return equations


def solve_latex_input(variables_text, latex_text):
    variables = split_variable_names(variables_text, "latex")
    symbol_values = symbols_as_list(variables)
    equations = latex_to_equations(latex_text)
    if len(symbol_values) == 1 and len(equations) == 1:
        return solve(equations[0], symbol_values[0])
    return solve(equations, symbol_values, dict=True)


def runsrc_latex_test(content):
    input_var = document.querySelector("#latex_test_num")
    input_equ = document.querySelector("#latex_test_inputer")
    try:
        answer = solve_latex_input(input_var.value, input_equ.value)
        set_result_output(make_result("latex_test", answer))
    except Exception as exc:
        set_result_output(make_error("latex_test", str(exc)))


bind_py_actions()

# import sympy as sm
from sympy import *
from pyscript import document, display
from latex2sympy2 import latex2sympy, latex2latex
import ast
import re
#from sympy import symbols, solve, Eq
# from math import *




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
        "copyable": message,
        "warnings": [warning] if warning else []
    }


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


def make_result(kind, value, warnings=None):
    plain = str(value)
    return {
        "ok": True,
        "kind": kind,
        "plain": plain,
        "latex": latex_for_value(value),
        "copyable": plain,
        "warnings": warnings or []
    }


def split_commands(raw_input):
    commands = []
    current = []
    for line in raw_input.replace(";", "\n").splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if re.match(r"^(solve|diff|integrate|sum|simplify|expand|factor|trigsimp|expand_trig|matrix|calc)\b", stripped):
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


def validate_expression_body(expression, message):
    expression = expression.strip()
    if not expression:
        raise ValueError(message)
    return expression


def parse_equation_text(equation_text):
    if "=" not in equation_text:
        raise ValueError("方程缺少等号")
    left, right = equation_text.split("=", 1)
    return Eq(sympify(left.strip()), sympify(right.strip()))


def symbols_as_list(names):
    parsed = symbols(" ".join(names) if isinstance(names, list) else names)
    if isinstance(parsed, tuple):
        return list(parsed)
    return [parsed]


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
    variables = header.replace("solve", "", 1).strip().split()
    if not variables:
        raise ValueError("solve 命令需要至少一个变量，例如 solve x: x + 1 = 0")
    variables = [validate_variable_name(variable, "solve") for variable in variables]
    equations = [line.strip() for line in body.splitlines() if line.strip()]
    if not equations:
        raise ValueError("solve 命令需要至少一个方程")
    return {
        "type": "solve",
        "variables": variables,
        "equations": equations
    }


def parse_diff(command):
    header, body = split_header_body(command, "diff")
    variable = header.replace("diff", "", 1).strip()
    if not variable:
        raise ValueError("diff 命令需要变量，例如 diff x: x**2")
    variable = validate_variable_name(variable, "diff")
    body = validate_expression_body(body, "diff 命令需要表达式，例如 diff x: x**2")
    return {
        "type": "diff",
        "variable": variable,
        "expression": body
    }


def parse_integrate(command):
    header, body = split_header_body(command, "integrate")
    match = re.match(r"integrate\s+(\w+)(?:\s+from\s+(.+?)\s+to\s+(.+))?$", header)
    if not match:
        raise ValueError("integrate 格式应为 integrate x: x**2 或 integrate x from 0 to 1: x**2")
    variable = validate_variable_name(match.group(1), "integrate")
    body = validate_expression_body(body, "integrate 命令需要表达式，例如 integrate x: x**2")
    return {
        "type": "integrate",
        "variable": variable,
        "expression": body,
        "bounds": [match.group(2), match.group(3)] if match.group(2) is not None else None
    }


def parse_sum(command):
    header, body = split_header_body(command, "sum")
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
        "expression": body
    }


def parse_expression(command):
    operation, expression = command.split(":", 1)
    operation = operation.strip()
    if operation not in ["simplify", "expand", "factor", "trigsimp", "expand_trig"]:
        raise ValueError("不支持的表达式操作")
    expression = validate_expression_body(expression, operation + " 命令需要表达式")
    return {
        "type": "expression",
        "operation": operation,
        "expression": expression
    }


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
    if any(first.startswith(name + ":") for name in ["simplify", "expand", "factor", "trigsimp", "expand_trig"]):
        return parse_expression(first)
    raise ValueError("无法识别输入。示例：solve x: x + 1 = 0")


def format_task_preview(task):
    lines = ["类型：" + task.get("type", "unknown")]
    if "variables" in task:
        lines.append("变量：" + " ".join(task["variables"]))
    if "variable" in task:
        lines.append("变量：" + task["variable"])
    if "equations" in task:
        lines.append("方程：" + "\n".join(task["equations"]))
    if "expression" in task:
        lines.append("表达式：" + task["expression"])
    if task.get("bounds"):
        lines.append("上下界：" + " 到 ".join(task["bounds"]))
    if task.get("matrices"):
        lines.append("矩阵：" + ", ".join(task["matrices"].keys()))
    return "\n".join(lines)


def solve_task(task):
    symbol_values = symbols_as_list(task["variables"])
    equations = [parse_equation_text(equation) for equation in task["equations"]]
    if len(symbol_values) == 1 and len(equations) == 1:
        return solve(equations[0], symbol_values[0])
    return solve(equations, symbol_values, dict=True)


def calculus_task(task):
    variable = symbols(task["variable"])
    expression = sympify(task["expression"])
    if task["type"] == "diff":
        return diff(expression, variable)
    if task["type"] == "integrate":
        if task.get("bounds"):
            lower, upper = task["bounds"]
            return integrate(expression, (variable, sympify(lower), sympify(upper)))
        return integrate(expression, variable)
    if task["type"] == "sum":
        return summation(expression, (variable, sympify(task["lower"]), sympify(task["upper"])))
    raise ValueError("不支持的微积分任务")


def expression_task(task):
    expression = sympify(task["expression"])
    operation = task["operation"]
    operations = {
        "simplify": simplify,
        "expand": expand,
        "factor": factor,
        "trigsimp": trigsimp,
        "expand_trig": expand_trig
    }
    return operations[operation](expression)


def apply_matrix_method(value, method):
    if method.startswith("_"):
        raise ValueError("不支持的矩阵方法")
    methods = {
        "det": lambda matrix: matrix.det(),
        "inv": lambda matrix: matrix.inv(),
        "transpose": lambda matrix: matrix.transpose()
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


def dispatch_task(task):
    task_type = task["type"]
    if task_type == "solve":
        return solve_task(task)
    if task_type in ["diff", "integrate", "sum"]:
        return calculus_task(task)
    if task_type == "expression":
        return expression_task(task)
    if task_type == "matrix":
        return matrix_task(task)
    raise ValueError("不支持的任务类型：" + task_type)


def run_solver(raw_input, mode=None):
    try:
        task = parse_input(raw_input, mode)
        value = dispatch_task(task)
        return make_result(task["type"], value)
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
    copyable_div = document.querySelector("#copyable_output")
    copy_button = document.querySelector("#copy-result-button")

    output_div.innerText = result["plain"]
    latex_code.innerText = result["latex"]
    if copyable_div:
        copyable_div.innerText = result["copyable"]
    if copy_button:
        copy_button.title = "复制结果"
    if latex_div:
        if result["latex"]:
            latex_div.innerText = "点击“显示Latex”查看渲染结果。"
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
    output_div.innerText = " "
    output_div = document.querySelector("#latexCode")
    output_div.innerText = " "
    output_div = document.querySelector("#latexDiv")
    output_div.innerText = " "
    output_div = document.querySelector("#copyable_output")
    if output_div:
        output_div.innerText = " "
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

def define_mat():
    # matrix_names = input("请输入你想定义的矩阵的名称（以空格分隔）：").split()
    # matrix_inputs = input("请输入矩阵内容，格式为 '1,2;3,4#2,3;4,5#3,4;5,6'（#号用于分隔不同的矩阵）：").split('#')
    matrix_names = document.querySelector("#unknown_mat").value.split()
    matrix_inputs = document.querySelector("#mat_inputer").value.split('#')
    matrices = []
    for name, input_data in zip(matrix_names, matrix_inputs):
        matrix_values = [[float(num) for num in row.split(',')] for row in input_data.split(';')]
        matrices.append((name, Matrix(matrix_values)))
    return matrices

def legacy_matrix_to_command(names_text, matrix_text, expression_text):
    names = names_text.split()
    matrix_inputs = matrix_text.split("#")
    lines = []
    for name, input_data in zip(names, matrix_inputs):
        rows = []
        for row in input_data.split(";"):
            values = [value.strip() for value in row.split(",") if value.strip()]
            rows.append("[" + ", ".join(values) + "]")
        lines.append("matrix " + name + " = [" + ", ".join(rows) + "]")
    lines.append("calc " + expression_text)
    return "\n".join(lines)

def runsrc_mat(content):
    names = document.querySelector("#unknown_mat").value
    matrices = document.querySelector("#mat_inputer").value
    expression = document.querySelector("#mat_cal").value
    run_legacy_command(legacy_matrix_to_command(names, matrices, expression))

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
    symbols_list = []
    # if(len(domains) == 0):
    symbols_list = symbols(variables)
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
    return solveset(equations, symbols_list, domains)
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

def runsrc_chem_e(content):
    pass

def runsrc_chem_a(content):
    pass

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

def split_latex_entries(raw_input):
    text = raw_input.replace("\\\\", "\n")
    entries = []
    current = []
    brace_depth = 0
    escaped = False
    for char in text:
        if char == "\\" and not escaped:
            current.append(char)
            escaped = True
            continue
        if char == "{" and not escaped:
            brace_depth += 1
        elif char == "}" and not escaped and brace_depth > 0:
            brace_depth -= 1
        if (char == "\n" or char == ";" or char == ",") and brace_depth == 0 and not escaped:
            entry = "".join(current).strip()
            if entry:
                entries.append(entry)
            current = []
        else:
            current.append(char)
        escaped = False
    entry = "".join(current).strip()
    if entry:
        entries.append(entry)
    return entries


def latex_to_equations(raw_input):
    entries = split_latex_entries(raw_input)
    if not entries:
        raise ValueError("请输入至少一个 Latex 方程")
    equations = []
    for entry in entries:
        converted = latex2sympy(entry)
        if isinstance(converted, (list, tuple, set)):
            equations.extend(converted)
        else:
            equations.append(converted)
    return equations


def solve_latex_input(variables_text, latex_text):
    variables = [validate_variable_name(item, "latex") for item in variables_text.split()]
    if not variables:
        raise ValueError("Latex 输入需要先填写变量，例如 x 或 x y")
    symbol_values = symbols_as_list(variables)
    equations = latex_to_equations(latex_text)
    if len(symbol_values) == 1 and len(equations) == 1:
        return solve(equations[0], symbol_values[0])
    return solve(equations, symbol_values, dict=True)


def runsrc_console(content):
    input_text = document.querySelector("#console_inputer")
    output_div = document.querySelector("#console_output")
    output_div.innerText = exec(input_text.value)

def runsrc_latex_test(content):
    input_var = document.querySelector("#latex_test_num")
    input_equ = document.querySelector("#latex_test_inputer")
    try:
        answer = solve_latex_input(input_var.value, input_equ.value)
        set_result_output(make_result("latex_test", answer))
    except Exception as exc:
        set_result_output(make_error("latex_test", str(exc)))

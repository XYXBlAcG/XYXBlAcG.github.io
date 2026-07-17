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
    output_div = document.querySelector("#output")
    answer = solve_equation(input_text.value)
    output_div.innerText = answer
    go_latex(answer)

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


def parse_matrix_cell(item):
    if isinstance(item, bool):
        raise ValueError("矩阵元素必须是数字或简单变量名")
    if isinstance(item, (int, float, complex)):
        return item
    if isinstance(item, str):
        if not re.match(r"^[A-Za-z_]\w*$", item):
            raise ValueError("矩阵字符串元素只能是简单变量名")
        return sympify(item)
    raise ValueError("矩阵元素必须是数字或简单变量名")


def parse_matrix_literal(text):
    try:
        data = ast.literal_eval(text)
    except Exception as exc:
        raise ValueError("矩阵必须是 [[1, 2], [3, 4]] 这样的列表格式") from exc
    if not isinstance(data, list) or not data or not all(isinstance(row, list) for row in data):
        raise ValueError("矩阵必须是二维列表")
    row_length = len(data[0])
    if row_length == 0 or any(len(row) != row_length for row in data):
        raise ValueError("矩阵每一行的列数必须一致")
    return [[parse_matrix_cell(item) for item in row] for row in data]


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


def matrix_task(task):
    matrix_values = {
        name: Matrix(value)
        for name, value in task["matrices"].items()
    }
    allowed_names = {
        "__builtins__": {},
        "Matrix": Matrix,
        "eye": eye,
        "zeros": zeros,
        "ones": ones
    }
    return eval(task["expression"], allowed_names, matrix_values)


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


def set_result_output(result):
    output_div = document.querySelector("#output")
    latex_code = document.querySelector("#latexCode")
    latex_div = document.querySelector("#latexDiv")

    output_div.innerText = result["plain"]
    latex_code.innerText = result["latex"]
    if latex_div:
        latex_div.innerText = "点击“显示Latex”查看渲染结果。" if result["latex"] else result["plain"]


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
    output_div = document.querySelector("#output")
    answer = mult_func_solve(input_var.value, input_equ.value.split(','))
    output_div.innerText = answer
    # print("answer = ", type(answer))
    if(type(answer) == list):
        go_latex(answer)
    else:
        go_latex(list(answer.values()))

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

def runsrc_mat(content):
    output_div = document.querySelector("#output")
    matrices = define_mat()
    symbols_list = symbols(' '.join([mat[0] for mat in matrices]))
    symbols_dict = {**{'Matrix': Matrix}, **{mat[0]: mat[1] for mat in matrices}}
    # expr_input = input(f"请输入一个式子，使用 a * b 之类的格式：")
    lhs = document.querySelector("#mat_cal").value
    lhs_matrix = eval(lhs, globals(), symbols_dict)
    print("得到的矩阵为: ", lhs_matrix)
    output_div.innerText = lhs_matrix
    result_latex = latex(lhs_matrix)
    print("LaTeX 格式：")
    print(result_latex)
    output_div = document.querySelector("#latexCode")
    output_div.innerText += '$$' + result_latex + '$$'

def der_diff(content):
    x = symbols('x')
    print(content)
    f = sympify(content)
    return diff(f, x)

def runsrc_der(content):
    input_a = document.querySelector("#func_inputer")
    output_div = document.querySelector("#output")
    answer = der_diff(input_a.value)
    output_div.innerText = answer
    print(type(answer))
    output_div = document.querySelector("#latexCode")
    output_div.innerText += '$$' + latex(answer) + '$$'

def solve_simplify(variables, equations):
    try:
        symbols_list = symbols(variables)
        expression = sympify(equations)
        return simplify(expression)
    except Exception as e:
        return "化简时出现错误, 输入可能非法."

def runsrc_simplify(content):
    input_var = document.querySelector("#unknown_simple")
    input_equ = document.querySelector("#simple_inputer")
    output_div = document.querySelector("#output")
    answer = solve_simplify(input_var.value, input_equ.value)
    output_div.innerText = answer
    output_div = document.querySelector("#latexCode")
    output_div.innerText += '$$' + latex(answer) + '$$'

def solve_factor(variables, equations):
    try:
        symbols_list = symbols(variables)
        expression = sympify(equations)
        return factor(expression)
    except Exception as e:
        return "化简时出现错误, 输入可能非法."

def runsrc_factor(content):
    input_var = document.querySelector("#unknown_simple")
    input_equ = document.querySelector("#simple_inputer")
    output_div = document.querySelector("#output")
    answer = solve_factor(input_var.value, input_equ.value)
    output_div.innerText = answer
    output_div = document.querySelector("#latexCode")
    output_div.innerText += '$$' + latex(answer) + '$$'

def solve_expand(variables, equations):
    try:
        symbols_list = symbols(variables)
        expression = sympify(equations)
        return expand(expression)
    except Exception as e:
        return "展开时出现错误, 输入可能非法."

def runsrc_expand(content):
    input_var = document.querySelector("#unknown_simple")
    input_equ = document.querySelector("#simple_inputer")
    output_div = document.querySelector("#output")
    answer = solve_expand(input_var.value, input_equ.value)
    output_div.innerText = answer
    output_div = document.querySelector("#latexCode")
    output_div.innerText += '$$' + latex(answer) + '$$'

def solve_trigsimp(variables, equations):
    try:
        symbols_list = symbols(variables)
        expression = sympify(equations)
        return trigsimp(expression)
    except Exception as e:
        return "化简时出现错误, 输入可能非法."

def runsrc_trigsimp(content):
    input_var = document.querySelector("#unknown_simple")
    input_equ = document.querySelector("#simple_inputer")
    output_div = document.querySelector("#output")
    answer = solve_trigsimp(input_var.value, input_equ.value)
    output_div.innerText = answer
    output_div = document.querySelector("#latexCode")
    output_div.innerText += '$$' + latex(answer) + '$$'

def solve_expand_trig(variables, equations):
    try:
        symbols_list = symbols(variables)
        expression = sympify(equations)
        return expand_trig(expression)
    except Exception as e:
        return "展开时出现错误, 输入可能非法."

def runsrc_expand_trig(content):
    input_var = document.querySelector("#unknown_simple")
    input_equ = document.querySelector("#simple_inputer")
    output_div = document.querySelector("#output")
    answer = solve_expand_trig(input_var.value, input_equ.value)
    output_div.innerText = answer
    output_div = document.querySelector("#latexCode")
    output_div.innerText += '$$' + latex(answer) + '$$'

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
    output_div = document.querySelector("#output")
    answer = high_solver(input_var.value, input_equ.value, input_domain.value)
    output_div.innerText = answer
    # print("answer = ", type(answer))
    if(type(answer) == list):
        go_latex(answer)
    else:
        output_div = document.querySelector("#latexCode")
        output_div.innerText += '$$' + latex(answer) + '$$'

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
    output_div = document.querySelector("#output")
    answer = inte_ud(input_var.value, input_equ.value, input_domain.value)
    output_div.innerText = answer
    output_div = document.querySelector("#latexCode")
    output_div.innerText += '$$' + latex(answer) + '$$'

def inte_(var, equ):
    symbols_list = symbols(var)
    return integrate(sympify(equ), (symbols_list))

def runsrc_inte(content):
    input_var = document.querySelector("#unknown_inte")
    input_equ = document.querySelector("#inte_inputer")
    output_div = document.querySelector("#output")
    answer = inte_(input_var.value, input_equ.value)
    output_div.innerText = answer
    output_div = document.querySelector("#latexCode")
    output_div.innerText += '$$' + latex(answer) + '$$'

def sum_(equ, var, vars):
    tovar = tuple(var.split(','))
    symbols_list = symbols(vars)
    return summation(sympify(equ), tovar)


def runsrc_sum(content):
    input_var = document.querySelector("#sum_sub")
    input_vars = document.querySelector("#sum_var")
    input_equ = document.querySelector("#sum_inputer")
    output_div = document.querySelector("#output")
    answer = sum_(input_equ.value, input_var.value, input_vars.value)
    output_div.innerText = answer
    output_div = document.querySelector("#latexCode")
    output_div.innerText += '$$' + latex(answer) + '$$'

def runsrc_console(content):
    input_text = document.querySelector("#console_inputer")
    output_div = document.querySelector("#console_output")
    output_div.innerText = exec(input_text.value)

def runsrc_latex_test(content):
    input_var = document.querySelector("#latex_test_num")
    input_equ = document.querySelector("#latex_test_inputer")
    output_div = document.querySelector("#output")
    answer = mult_func_solve(input_var.value, input_equ.value.split(','), 1)
    output_div.innerText = answer
    # print("answer = ", type(answer))
    output_div = document.querySelector("#latexCode")
    output_div.innerText += '$$' + latex(answer) + '$$'

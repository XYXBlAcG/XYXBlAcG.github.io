# import sympy as sm
from sympy import *
from pyscript import document, display
from latex2sympy2 import latex2sympy, latex2latex
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
    print("得到的矩阵为: ", lhs_matrix)  # 添加打印语句
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
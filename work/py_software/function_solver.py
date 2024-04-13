import sympy as sm
from pyscript import document, display
#from sympy import symbols, solve, Eq
from math import *


def solve_equation(equation_str):
    x = sm.symbols('x')
    try:
        equation_split = equation_str.split('=')
        left_side = eval(equation_split[0])
        right_side = eval(equation_split[1])
        equation = sm.Eq(left_side, right_side)
        solutions = sm.solve(equation, x)
        if solutions:
            return solutions
        else:
            return "该方程无解."
    except Exception as e:
        return "输入的方程不正确或者解超出计算量."

def go_latex(content):
    output_div = document.querySelector("#latexCode")
    output_div.innerText += '$$'
    i = 0
    for expr in content:
        i += 1
        print(expr)
        lexpr = sm.latex(expr)
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


def helper(content):
    output_div = document.querySelector("#output")
    output_div.innerText = \
    "不可省略乘号.\n" + \
    "幂次请使用 '**'. \n" + \
    "请输入等式.\n" + \
    "允许通过pi, e来调用π和e的值. 其他数学函数可能可用.\n" + \
    "函数内含未知数参数的方程无法解出. 如 x * sin(x) = 1 .\n" + \
    "Latex 可能有锅, 请谨慎使用.\n" + \
    "请注意观察下面的报错信息.\n" + \
    "name: easy_math_solver\n" + \
    "author: XYX\n" + \
    "version: v0.0.4\n" + \
    "lastest update: 2024/04/13\n" + \
    "\n v0.0.4 更好的界面, 尝试加入化学功能.\n" + \
    "\n v0.0.3 添加解矩阵功能.\n" + \
    "\n v0.0.2 添加求导功能.\n" + \
    "\n v0.0.1 初代版本.\n"
    
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

def mult_func_solve(variables, equations):
    print("variables : ", variables)
    print("equations : ", equations)

    try:
        symbols_list = sm.symbols(variables)
        eqs = [sm.Eq(sm.sympify(equation.split('=')[0].strip()), sm.sympify(equation.split('=')[1].strip())) for equation in equations]
        solutions = sm.solve(eqs)
        if solutions:
            return solutions
        else:
            return "该方程无解."
    except Exception as e:
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
        matrices.append((name, sm.Matrix(matrix_values)))
    return matrices

def runsrc_mat(content):
    output_div = document.querySelector("#output")
    matrices = define_mat()
    symbols_list = sm.symbols(' '.join([mat[0] for mat in matrices]))
    symbols_dict = {**{'Matrix': sm.Matrix}, **{mat[0]: mat[1] for mat in matrices}}
    # expr_input = input(f"请输入一个式子，使用 a * b 之类的格式：")
    lhs = document.querySelector("#mat_cal").value
    lhs_matrix = eval(lhs, globals(), symbols_dict)
    print("得到的矩阵为: ", lhs_matrix)  # 添加打印语句
    output_div.innerText = lhs_matrix
    result_latex = sm.latex(lhs_matrix)
    print("LaTeX 格式：")
    print(result_latex)
    output_div = document.querySelector("#latexCode")
    output_div.innerText += '$$' + result_latex + '$$'

def der_diff(content):
    x = sm.symbols('x')
    print(content)
    f = sm.sympify(content)
    return sm.diff(f, x)

def runsrc_der(content):
    input_a = document.querySelector("#func_inputer")
    output_div = document.querySelector("#output")
    answer = der_diff(input_a.value)
    output_div.innerText = answer
    print(type(answer))
    output_div = document.querySelector("#latexCode")
    output_div.innerText += '$$' + sm.latex(answer) + '$$'

def runsrc_chem_e(content):
    pass

def runsrc_chem_a(content):
    pass
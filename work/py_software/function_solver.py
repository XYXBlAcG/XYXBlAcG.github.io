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
    # output_div.innerText = lat

def runsrc(content):
    input_text = document.querySelector("#inputer")
    output_div = document.querySelector("#output")
    answer = solve_equation(input_text.value)
    output_div.innerText = answer
    go_latex(answer)


def helper(content):
    output_div = document.querySelector("#output")
    output_div.innerText = \
    "本程序暂只支持单个未知数的求解.\n"  + \
    "未知数只能是x.\n" + \
    "不可省略乘号.\n" + \
    "幂次请使用 '**' \n" + \
    "请输入一个等式.\n" + \
    "允许通过Pi, E来调用π和e的值. 其他数学函数可能可用.\n" + \
    "过难的方程可能解不出来. 如 x * sin(x) = 1\n" + \
    "Latex 可能有锅, 请谨慎使用.\n" + \
    "name: function_solver\n" + \
    "author: XYX\n" + \
    "version: v0.0.1 alpha\n"
    
def clean_content(content):
    output_div = document.querySelector("#output")
    output_div.innerText = " "
    output_div = document.querySelector("#latexCode")
    output_div.innerText = " "
    output_div = document.querySelector("#latexDiv")
    output_div.innerText = " "

def extract_expressions(input_str):
    # 去除字符串两端的中括号，并按逗号分隔字符串，去除每个子字符串两端的空格
    expressions = [expr.strip() for expr in input_str.strip("[]").split(',')]
    
    return expressions


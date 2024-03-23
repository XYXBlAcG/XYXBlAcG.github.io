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

def runsrc(content):
    input_text = document.querySelector("#inputer")
    output_div = document.querySelector("#output")
    output_div.innerText = solve_equation(input_text.value)


def helper(content):
    display('\n')
    display("本程序暂只支持单个未知数的求解.")
    display("未知数只能是x.")
    display("不可省略乘号.")
    display("幂次请使用 '**' ")
    display("请输入一个等式.")
    display("允许通过Pi, E来调用π和e的值. 其他数学函数可能可用.")
    display("过难的方程可能解不出来. 如 x * sin(x) = 1")
    display("name: function_solver")
    display("author: XYX")
    display("version: v0.0.1 alpha")
    
def clean_content(content):
    output_div = document.querySelector("#output")
    output_div.replaceChildren()

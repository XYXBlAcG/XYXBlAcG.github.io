# import sympy as sm
# #from sympy import symbols, solve, Eq
# from math import *

# def solve_equation(equation_str):
#     x = sm.symbols('x')
#     try:
#         equation_split = equation_str.split('=')
#         left_side = eval(equation_split[0])
#         right_side = eval(equation_split[1])
#         equation = sm.Eq(left_side, right_side)
#         solutions = sm.solve(equation, x)
#         if solutions:
#             return solutions
#         else:
#             return "该方程无解."
#     except Exception as e:
#         return "输入的方程不正确或者解超出计算量."

# def main():
#     print("首次使用请看帮助界面.")
#     while True:
#         equation = input("请输入一个方程 (例: (x + 2) * (x - 1) = 0) , 输入 q 退出 , 输入 help 进入帮助: ")
#         if equation.lower() == 'q':
#             print("程序已退出.")
#             break
#         if equation.lower() == 'help':
#             print("\n帮助界面")
#             print("输入 q 来退出.")
#             print("输入 help 来进入帮助.")
#             print("本程序暂只支持单个未知数的求解.")
#             print("未知数只能是x.")
#             print("不可省略乘号.")
#             print("未来可能会更新更多.")
#             print("允许通过Pi, E来调用π和e的值. 其他数学函数可能可用.")
#             print("过难的方程可能解不出来. 如 x * sin(x) = 1")
#             print("name: function_solver")
#             print("author: xyx")
#             print("version: v0.0.1 alpha")
#             print("\n")
#             continue
#         solutions = solve_equation(equation)
#         print("方程的解为:", solutions)

# if __name__ == "__main__":
#     main()



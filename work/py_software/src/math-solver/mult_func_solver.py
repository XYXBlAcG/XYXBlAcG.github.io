from sympy import symbols, Eq, solve, sympify

def solve_system_of_equations(variables, equations):
    print("variables : ", variables)
    print("equations : ", equations)
    # 定义未知数
    symbols_list = symbols(variables)

    # 定义方程
    eqs = [Eq(sympify(equation.split('=')[0].strip()), sympify(equation.split('=')[1].strip())) for equation in equations]

    # 解方程
    solution = solve(eqs)

    return solution

# 输入变量和方程
variables = input("请输入未知数，以空格分隔：")
equations = []
num_equations = len(variables.split())
print(f"请输入{num_equations}个方程，每个方程一行：")
for i in range(num_equations):
    equation = input()
    equations.append(equation)

# 解方程组
result = solve_system_of_equations(variables, equations)
print(result)




# # 示例用法
# variables = 'x y'  # 输入变量
# equations = ['2*x + 3*y = 6', '3*x - 2*y = 2']  # 输入方程

# result = solve_system_of_equations(variables, equations)
# print(result)

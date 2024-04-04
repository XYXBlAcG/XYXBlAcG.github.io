from sympy import symbols, Matrix, latex

def input_matrices(t):
    matrices = []
    for i in range(t):
        matrix_name = input(f"请输入你想定义的矩阵的名称：")
        matrix_input = input(f"请输入矩阵 {matrix_name}，格式为 '1,2,3;4,5,6'（分号用于分隔行）：")
        matrix_values = [[float(num) for num in row.split(',')] for row in matrix_input.split(';')]
        matrices.append((matrix_name, Matrix(matrix_values)))
    return matrices

def main():
    t = int(input("请输入矩阵的数量（t）："))
    matrices = input_matrices(t)
    symbols_list = symbols(' '.join([mat[0] for mat in matrices]))
    symbols_dict = {**{'Matrix': Matrix}, **{mat[0]: mat[1] for mat in matrices}}
    expr_input = input(f"请输入一个式子，使用 a * b 之类的格式：")
    lhs = expr_input
    lhs_matrix = eval(lhs, globals(), symbols_dict)
    print("得到的矩阵为: ", lhs_matrix)  # 添加打印语句
    result_latex = latex(lhs_matrix)
    print("LaTeX 格式：")
    print(result_latex)


if __name__ == "__main__":
    main()

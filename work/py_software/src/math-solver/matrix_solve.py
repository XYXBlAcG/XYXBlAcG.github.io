from sympy import symbols, Matrix

def input_matrices():
    matrices = {}
    while True:
        matrix_name = input("Enter matrix name (or press Enter to finish): ").strip()
        if not matrix_name:
            break
        matrix_str = input(f"Enter matrix {matrix_name} (e.g., [[1, 2], [3, 4]]): ")
        matrix_list = eval(matrix_str)
        matrices[matrix_name] = Matrix(matrix_list)
    return matrices

def evaluate_expression(matrices, expression):
    try:
        result = eval(expression, matrices)
        print("Result:")
        print(result)
    except Exception as e:
        print("Error evaluating expression:", e)

if __name__ == "__main__":
    matrices = input_matrices()
    expression = input("Enter expression using matrix names (e.g., 'x*y'): ")
    evaluate_expression(matrices, expression)

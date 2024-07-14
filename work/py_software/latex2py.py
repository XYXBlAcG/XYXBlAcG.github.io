from latex2sympy2 import latex2sympy, latex2latex

content = input("Enter the latex code: ")

# Convert latex to python code
py_code = latex2sympy(content)

print(py_code)

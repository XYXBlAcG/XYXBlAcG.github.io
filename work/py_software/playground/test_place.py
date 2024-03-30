def extract_expressions(input_str):
    # 去除字符串两端的中括号，并按逗号分隔字符串，去除每个子字符串两端的空格
    expressions = [expr.strip() for expr in input_str.strip("[]").split(',')]
    
    return expressions

# 测试
input_str = "[sqrt(4), 1+2]"
result = extract_expressions(input_str)
print(result)

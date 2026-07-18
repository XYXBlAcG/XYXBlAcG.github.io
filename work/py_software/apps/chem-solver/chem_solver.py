import sympy as sm
import pyscript as pyc
import chempy as cm

def go_latex(content):
    output_div = pyc.document.querySelector("#latexCode")
    output_div.innerText += '$$' + sm.latex(sm.sympify(content)) + '$$'
    # output_div.innerText += '$$' + chempy_.latex(content) + '$$'

def format_coefficient(coeff):
    if coeff == 1:
        return ""
    return str(coeff)

def fc_high(coefficient):
    if any(char.isdigit() for char in coefficient) and not coefficient.isdigit():
        return f"({coefficient})"
    else:
        return coefficient

def format_equation(reactants, products, reactant_coeff, product_coeff):
    # reactant_side = " + ".join([format_coefficient(reactant_coeff[reactant]) + reactant for reactant in reactants])
    # product_side = " + ".join([format_coefficient(product_coeff[product]) + product for product in products])
    # 构建反应物和生成物的字符串表示
    reactant_strings = []
    product_strings = []

    for reactant in reactants:
        coefficient = format_coefficient(reactant_coeff[reactant])
        reactant_strings.append(fc_high(coefficient) + reactant)

    for product in products:
        coefficient = format_coefficient(product_coeff[product])
        product_strings.append(fc_high(coefficient) + product)

    reactant_side = " + ".join(reactant_strings)
    product_side = " + ".join(product_strings)
    return reactant_side + " -> " + product_side

def balance_equation(equation):
    reactants, products = equation.split('=')
    reactants = reactants.strip().split('+')
    products = products.strip().split('+')
    reactant_coeff, product_coeff = cm.balance_stoichiometry(reactants, products)
    return format_equation(reactants, products, reactant_coeff, product_coeff)

def runsrc_chem_e(content):
    print("running")
    input_text = pyc.document.querySelector("#chem_e")
    output_div = pyc.document.querySelector("#output")
    answer = balance_equation(input_text.value)
    output_div.innerText = answer
    go_latex(answer)
    print("end.")

def clean_content(content):
    output_div = document.querySelector("#output")
    output_div.innerText = " "
    output_div = document.querySelector("#latexCode")
    output_div.innerText = " "
    output_div = document.querySelector("#latexDiv")
    output_div.innerText = " "

def balance():
    while True:
        equation = input("输入化学方程式, 用 + 号分隔物质, = 号分隔反应物和生成物, 输入 q 退出程序. ")
        if(equation == 'q'):
            print("退出方程式配平.")
            return
        try:
            balanced_equation = balance_equation(equation)
            print("配平后的方程式为:")
            print(balanced_equation)
        except Exception as e:
            print("发生错误 ", e)

def mol_mass():
    while True:
        formula = input("请输入化学式, 输入 q 退出程序.")
        if(formula == 'q'):
            print("退出查询摩尔质量.")
            return
        try:
            substance = cm.Substance.from_formula(formula)
            molar_mass = substance.mass
            print(f"{formula} 的摩尔质量为：{molar_mass} g/mol")
        except Exception as e:
            print("发生错误 ", e)

def parse_equation(equation):
    reactants, products = equation.split("=")
    reactants = reactants.strip().split(',')
    products = products.strip().split(',')
    return reactants, products

def l_balance():
    print("使用前须知!!!")
    print("如果你输入的电荷绝对值大于 1 , 形如 Fe2+, 那么必须输入为 Fe+2 !!! 不然会被判断为两个 Fe 原子有一个正电荷 (大雾)")
    while True:
        equation = input("输入离子方程式, 用逗号分隔物质, = 号分隔反应物和生成物,  输入 q 退出程序. ")
        if(equation == 'q'):
            print("退出离子方程式配平.")
            return
        try:
            reactants, products = parse_equation(equation)
            # print(reactants, " -> ", products)
            reactant_coeff, product_coeff = cm.balance_stoichiometry(reactants, products)
            balanced_equation = format_equation(reactants, products, reactant_coeff, product_coeff)
            print("配平后的离子方程式为:")
            print(balanced_equation)
        except Exception as e:
            print("发生错误 ", e)


def main():
    print("欢迎来到化学工具箱 v0.0.1")
    while True:
        a = input("你想要进行什么操作呢qwq? 1 : 配平化学方程式, 2 : 查询摩尔质量, 3 : 配平离子方程式, q : 退出程序 ")
        if(a == '1'):
            balance()
        elif(a == '2'):
            mol_mass()
        elif(a == '3'):
            l_balance()
        elif(a == 'q'):
            print("程序已退出.")
            exit(0)
        else:
            print("非法的输入. 找不到相应的功能. ")

if __name__ == "__main__":
    main()


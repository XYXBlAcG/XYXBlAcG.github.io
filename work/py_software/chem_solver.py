import sympy as sm
import pyscript as pyc
from chempy import balance_stoichiometry

def go_latex(content):
    output_div = pyc.document.querySelector("#latexCode")
    output_div.innerText += '$$' + sm.latex(sm.sympify(content)) + '$$'
    # output_div.innerText += '$$' + chempy_.latex(content) + '$$'

def format_coefficient(coeff):
    if coeff == 1:
        return ""
    return str(coeff)

def format_equation(reactants, products, reactant_coeff, product_coeff):
    reactant_side = " + ".join([format_coefficient(reactant_coeff[reactant]) + reactant for reactant in reactants])
    product_side = " + ".join([format_coefficient(product_coeff[product]) + product for product in products])
    return reactant_side + " = " + product_side

def balance_equation(equation):
    reactants, products = equation.split('=')
    reactants = reactants.strip().split('+')
    products = products.strip().split('+')
    reactant_coeff, product_coeff = balance_stoichiometry(reactants, products)
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

if __name__ == "__main__":
    while True:
        equation = input("输入化学方程式: ")
        if(equation == 'q'):
            print("退出程序.")
            quit()
        try:
            balanced_equation = balance_equation(equation)
            print("配平后的方程式为:")
            print(balanced_equation)
        except Exception as e:
            print("发生错误 ", e)
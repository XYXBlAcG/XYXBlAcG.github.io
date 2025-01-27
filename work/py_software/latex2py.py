from sympy import *
from pyscript import document, display
from latex2sympy2 import latex2sympy, latex2latex

def convert(content):
    input_str = document.querySelector('#latex_input').value
    output_str = latex2sympy(input_str)
    output_div = document.querySelector("#output")
    output_div.innerText = output_str
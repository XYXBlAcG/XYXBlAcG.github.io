from flask import Flask, request, jsonify
from chempy import balance_stoichiometry

app = Flask(__name__)

def balance_equation(equation):
    reactants, products = equation.split('->')
    reactants = [reactant.strip() for reactant in reactants.split('+')]
    products = [product.strip() for product in products.split('+')]
    balanced_reactants, balanced_products = balance_stoichiometry(reactants, products)
    return {'reactants': balanced_reactants, 'products': balanced_products}

@app.route('/balance', methods=['POST'])
def balance():
    data = request.json
    equation = data['equation']
    result = balance_equation(equation)
    return jsonify(result)

if __name__ == '__main__':
    app.run(port=5500)

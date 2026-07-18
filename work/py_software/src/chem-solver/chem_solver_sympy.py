from sympy import symbols, Eq, solve

def count_atoms(compound):
    atoms = {}
    for atom in compound.split():
        if atom in atoms:
            atoms[atom] += 1
        else:
            atoms[atom] = 1
    return atoms

def balance_equation(equation):
    # Split equation into reactants and products
    reactants, products = equation.split('->')

    # Split reactants and products into individual compounds
    reactants = reactants.strip().split('+')
    products = products.strip().split('+')

    # Get unique elements
    elements = set(element for compound in reactants + products for element in compound.split())

    # Create symbol variables for each compound coefficient
    compound_coefficients = {compound: symbols(compound + '_coeff') for compound in reactants + products}

    # Count atoms for each compound
    reactant_atoms = {compound: count_atoms(compound) for compound in reactants}
    product_atoms = {compound: count_atoms(compound) for compound in products}

    # Create equations
    equations = []
    for compound in reactants + products:
        equations.append(Eq(compound_coefficients[compound], 0))

    # Add equations for reactants and products
    for compound, atoms in reactant_atoms.items():
        for element, count in atoms.items():
            equations[reactants.index(compound)] += int(count) * compound_coefficients[compound]

    for compound, atoms in product_atoms.items():
        for element, count in atoms.items():
            equations[products.index(compound) + len(reactants)] -= int(count) * compound_coefficients[compound]

    # Solve equations
    solutions = solve(equations)

    # Print balanced coefficients
    for compound in reactants + products:
        print(f'{compound}: {solutions[compound_coefficients[compound]]}')

# Example: Balance the equation
equation = "H2 + O2 -> H2O"
balance_equation(equation)

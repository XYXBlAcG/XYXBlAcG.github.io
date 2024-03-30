from chempy import balance_stoichiometry
from chempy import Equilibrium
from chempy.chemistry import Species
from chempy.equilibria import EqSystem

# Function to parse species with charges
def parse_species(species_str):
    species_parts = species_str.split('+')
    name = species_parts[0].strip()
    charge = int(species_parts[1]) if len(species_parts) > 1 and species_parts[1] else 0
    return name, charge

# 输入物质和反应物
input_str = input("请输入物质和反应物（使用逗号隔开物质，使用等号隔开反应物和生成物）：")
reactants_str, products_str = input_str.split('=')

# 提取反应物和生成物并解析成Species对象
reactants = [parse_species(ion) for ion in reactants_str.split(',')]
products = [parse_species(ion) for ion in products_str.split(',')]

# Convert reactants and products into strings
reactants = ['{}{}'.format(name, '+' if charge > 0 else '') + '{}'.format(charge if charge != 0 else '') for name, charge in reactants]
products = ['{}{}'.format(name, '+' if charge > 0 else '') + '{}'.format(charge if charge != 0 else '') for name, charge in products]

# 配平方程式
balanced_reaction = balance_stoichiometry(reactants, products)

# 将结果转换为化学方程式
reaction_string = ' + '.join(reactants) + ' = ' + ' + '.join(products)

# 输出结果
print("配平后的方程式为:")
print(reaction_string)

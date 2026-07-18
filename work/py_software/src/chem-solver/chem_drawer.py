import matplotlib.pyplot as plt

# 读取文本文件中的数字
def read_numbers_from_file(filename):
    with open(filename, 'r') as file:
        numbers = [float(line.strip()) for line in file]
    return numbers

# 绘制图像
def plot_numbers(numbers):
    plt.plot(numbers)
    plt.xlabel('Index')
    plt.ylabel('Acc')
    plt.title('Acc graph')
    for i, acc in enumerate(numbers):
        plt.text(i, acc, f'{acc:.2f}', ha='center', va='bottom')
    plt.show()

# 将数字写入文本文件
def write_numbers_to_file(numbers, filename):
    with open(filename, 'w') as file:
        for number in numbers:
            file.write(str(number) + '\n')

def new_num():
    t = s = 0
    while True:
        a = input("> ")
        if(a == 'q') :
            break
        s += int(a)
        t += 1
    if(t == 0):
        return 0
    return float(s) / float(t)
        

# 从文件中读取数字并绘制图像
filename = 'chem_drawer.txt'
numbers = read_numbers_from_file(filename)

# 输入新的数字
new_number = new_num()

# 将新数字添加到列表中
numbers.append(new_number)

# 绘制新图像
plot_numbers(numbers)

# 将更新后的数字写入文本文件
write_numbers_to_file(numbers, filename)

import math

def degree_to_radian(degree):
    return degree * math.pi / 180

def sin_using_induction(angle):
    angle = angle % 360  # Ensure angle is within 0 to 360 degrees
    if angle <= 180:
        return math.sin(degree_to_radian(angle))
    else:
        return -sin_using_induction(angle - 180)

def cos_using_induction(angle):
    angle = angle % 360  # Ensure angle is within 0 to 360 degrees
    if angle <= 180:
        return math.cos(degree_to_radian(angle))
    else:
        return cos_using_induction(360 - angle)  # convert cos to sin

def tan_using_induction(angle):
    angle = angle % 360  # Ensure angle is within 0 to 360 degrees
    if angle < 90 or angle > 270:
        return math.tan(degree_to_radian(angle))
    elif angle == 90 or angle == 270:
        return float('inf')
    else:
        return -tan_using_induction(angle - 180)

def main():
    trig_function = input("请输入要计算的三角函数(sin/cos/tan): ")
    angle = float(input("请输入角度(0到180度): "))

    if trig_function == 'sin':
        result = sin_using_induction(angle)
    elif trig_function == 'cos':
        result = cos_using_induction(angle)
    elif trig_function == 'tan':
        result = tan_using_induction(angle)
    else:
        print("请输入有效的三角函数名称：sin、cos或tan")
        return

    print(f"{trig_function}({angle}度) = {result}")

if __name__ == "__main__":
    main()

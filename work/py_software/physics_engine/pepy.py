'''
Author: Xie Yuxuan
Inspiration from wuli engine.
File Create Time: 04/26/2024 19:42
A simple Physics Engine.
'''

import pyglet as g
import sympy as sm


class showModule:
    '''
    物理库的显示部分.
    '''

    def __init__(self, width, height):
        return g.window.Window(width, height, "Physics Engine (Author: XYX)", True)


    def run(self):
        g.app.run()

class Physics:
    '''
    物理库的物理实现部分.
    '''

    objectList = []

    def printerror(self, e):
        print("出现错误. 请看下面的日志.")
        print("--- start ---\n", e, "\n --- end ---")

    def __init__(self, mass, velocity, location, color = (0, 0, 0), shape = 5.0):
        ''' 
        创建一个物体.
        :param mass: float 质量大小, 正数
        :param velocity: list[x, y] x, y 为 float, 速度, 二维矢量
        :param location: list[x, y] x, y 为 float, 位置, 二维矢量
        :param color: str or tuple(r, g, b) 物体的颜色
        :param shape: float 表示创建一个圆, shape 为圆的半径 或者 list[...] 表示一个长方形的长和宽.
        '''
        try:
            self.mass = mass
            self.velocity = velocity
            self.location = location
            self.acceleration = [0, 0]
            self.acc = self.acceleration
            self.color = color
            if type(shape) == int or type(shape) == float:
                self.type = "circle"
                self.shape = float(shape)
            else:
                self.type = "non-circle"
                self.shape = shape
            Physics.objectList.append(self)
        except Exception as e:
            self.printerror(e)

    def printInfo(self, lang = 'en'):
        '''
        打印一个物体的信息.
        :param lang: 打印语言, 默认英文.
        '''
        if lang == 'en':
            return f"mass = {self.mass}, velocity = {self.velocity}, location = {self.location}, acceleration = {self.acceleration}"
        elif lang == 'zh-CN':
            return f"质量 = {self.mass}, 速度 = {self.velocity}, 位置 = {self.location}, 加速度 = {self.acceleration}"

    def force(self, forceNum, forceDir = [0, 0]):
        '''
        对物体施加一个力.
        直接定义力这个矢量或者定义力的大小和方向.
        :param forceNum: list[x, y] x, y 为 float, 力, 二维矢量 或者 float, 力的大小.
        :param forceDir: list[x, y] x, y 为 float, 力的方向 (直接定义力的矢量将不会用到这一参量)
        '''
        if type(forceNum) == list:
            self.acceleration[0] += forceNum[0] / self.mass
            self.acceleration[1] += forceNum[1] / self.mass
        else:
            mdx = [forceDir[0] - self.forceDir[0], p[1] - self.forceDir[1], p[2] - self.forceDir[2]]
            odx = ((forceDir[0] - self.forceDir[0]) ** 2 + (forceDir[1] - self.forceDir[1]) ** 2 + (forceDir[2] - self.forceDir[2]) ** 2) ** 0.5
            Force = [forceNum * mdx[0] / odx, forceNum * mdx[1] / odx, forceNum * mdx[2] / odx]
            self.force(Force)
    
    springLength = {}
    springPoint = []

    def resilience(self, length = None, k = 100, other = None, string = False):
        if length is None and (not ((self, other) in Physics.springLength.keys())):
            Physics.springLength[(self, other)] = ((other.location[0] - self.location[0]) ** 2 + (other.location[1] - self.location[1]) ** 2) ** 0.5
            length = Physics.springLength[(self, other)]
        elif length is None:
            length = Physics.springLength[(self, other)]
        dx = ((other.location[0] - self.location[0]) ** 2 + (other.location[1] - self.location[1]) ** 2) ** 0.5 - length
        if dx < 0 and string is True:
            forceNum = 0
        else:
            forceNum = dx * k
        self.force(forceNum, other.location)
        other.force(forceNum, self.location)
        if not((self, other) in Physics.springPoint):
            Physics.springPoint.append((self, other))

    @classmethod
    def transferResilience(cls, list_):
        for i in list_:
            i["self"].resilience(i["length"], i["k"], i["other"], i["string"])

    def bounce(self, k, other="*"):
        if other == "*":
            other = Physics.springPoint
        for i in other:
            if i == self:
                continue
            elif (((i.location[0] - self.location[0]) ** 2 + (i.location[1] - self.location[1]) ** 2) ** 0.5) - self.r - i.r <= 0:
                self.resilience(self.r + i.r, k / 2, i)

    '''
    给所有物体施加重力.
    '''
    @classmethod
    def gravity(cls, g):
        for a in objectList:
            for b in objectList:
                if a == b:
                    continue
                r = ((a.location[0] - b.location[0]) ** 2 + (a.location[1] - b.location[1]) ** 2) ** 0.5
                G = g * a.mass * b.mass / (r ** 2)
                a.force(G, b.location)
    
    '''
    动量的计算.
    '''
    @classmethod
    def momentum(cls):
        mom = [0, 0]
        for i in Physics.objectList:
            mom[0] += i.v[0] * i.m
            mom[1] += i.v[1] * i.m
        return mom
            
    def render(fps):
        '''
        以每秒 (fps) 帧进行渲染.
        '''
        T = 1.0 / float(fps)
        for obj in Physics.objectList:
            obj.velocity[0] += obj.acceleration[0] * T
            obj.velocity[1] += obj.acceleration[1] * T
            obj.location[0] += obj.velocity[0] * T
            obj.location[1] += obj.velocity[1] * T
            obj.acc = obj.acceleration[:]
            obj.acceleration = [0, 0]

    def saveToPy():
        '''
        将当前的图形数据保存为 .py 文件.
        '''
        pass

    positionOffset = [0, 0]
    postionScale = 1

    def camera():
        '''
        摄像机控制函数.
        '''
        pass

    def draw(window):
        '''
        绘图.
        '''
        objecter = 0
        for obj in Physics.objectList:
            if obj.type == "circle":
                objecter = g.shapes.Circle(x = obj.location[0], y = obj.location[1], radius = obj.shape, color = obj.color)
            else:
                objecter = g.shapes.Rectangle(x = obj.location[0], y = obj.location[1], width = obj.shape[0], height = obj.shape[1], color = obj.color)
            @window.event
            def on_draw():
                window.clear()
                objecter.draw()
        
        

        
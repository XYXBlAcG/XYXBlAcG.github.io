import pyglet as g
import sympy as sm

'''
Author: Xie Yuxuan
Inspiration from wuli engine.
File Create Time: 04/26/2024 19:42
A simple Physics Engine.
'''

class showModule:
    def __init__(width, height):
        g.window.Window(width, height, "Physics Engine (Author: XYX)", True)

    def run():
        g.app.run()

class Physics:

    objectList = []

    def __init__(self, mass, velocity, location, color = "black", shape = 5.0):
        ''' 
        创建一个物体.
        :param mass: float 质量大小, 正数
        :param velocity: list[x, y] x, y 为 float, 速度, 二维矢量
        :param location: list[x, y] x, y 为 float, 位置, 二维矢量
        :param color: str or tuple(r, g, b) 物体的颜色
        :param shape: float 表示创建一个圆, shape 为圆的半径 或者 list[...] 表示顶点集.
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
            print("出现错误. 请看下面的日志.")
            print("--- start ---\n", e, "\n --- end ---")

    def printInfo(self):
        return f"mass = {self.m}, velocity = {self.velocity}, location = {self.location}, acceleration = {self.acceleration}"

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
    
    def resilience(self, length=None):
        pass

            
    def render(fps):
        T = 1.0 / float(fps)
        for obj in Physics.objectList:
            obj.velocity[0] += obj.acceleration[0] * T
            obj.velocity[1] += obj.acceleration[1] * T
            obj.location[0] += obj.velocity[0] * T
            obj.location[1] += obj.velocity[1] * T
            obj.acc = obj.acceleration[:]
            obj.acceleration = [0, 0]

    def saveToPy():
        
        pass

    def draw():
        pass
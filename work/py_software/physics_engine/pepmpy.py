import pymunk as pm 

def setSpace(gravity):
    space = pm.space()
    space.gravity = (0, gravity)
    return space

def staticObj(postion):
    obj = pm.Body(body_type=pymunk.Body.STATIC)
    obj.postion = postion
    return obj

def dynamicObj(postion):
    obj = pm.Body(body_type=pymunk.Body.DYNAMIC)
    obj.postion = postion
    return obj

def shapeObj(obj, size, k):
    shape = pm.Circle(obj, size)
    shape.elasticity = k
    return shape
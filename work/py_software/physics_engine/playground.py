from pepy import *

player = showModule(600, 600)


a = Physics.__init__(1, [0, 0], [0, 0], (0, 0, 0),  5.0)
while True:
    a.force([1, 0])
    Physics.render(100)
    Physics.draw(player)
    a.printInfo()
    

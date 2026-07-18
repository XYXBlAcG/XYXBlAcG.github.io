import pyglet

class Button:
    def __init__(self, x, y, width, height, label):
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.label = label
        self.position = (x, y)  # 初始化按钮位置为左上角

    def apply_force(self, force):
        # Add force to the object
        self.forces[0] += force[0]
        self.forces[1] += force[1]

    def update(self, dt):
        # Update object's velocity based on forces
        acceleration = [self.forces[0] / self.mass, self.forces[1] / self.mass]
        self.velocity[0] += acceleration[0] * dt
        self.velocity[1] += acceleration[1] * dt

        # Update object's position based on velocity
        self.position[0] += self.velocity[0] * dt
        self.position[1] += self.velocity[1] * dt

        # Reset forces
        self.forces = [0, 0]

    def draw(self):
        # Draw the object
        pass


class Button:
    def __init__(self, x, y, width, height, label):
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.label = label

    def draw(self):
        x, y = self.position
        size = self.size
        # 绘制方块
        pyglet.graphics.draw(4, pyglet.gl.GL_QUADS,
                              ('v2f', [x, y, x + size, y, x + size, y + size, x, y + size]))

class SimulationWindow(pyglet.window.Window):
    def __init__(self, width, height):
        super().__init__(width, height, "Physics Simulation")
        self.objects = []
        self.buttons = [Button(20, 20, 100, 40, "Create Square")]

    def on_draw(self):
        self.clear()
        for obj in self.objects:
            obj.draw()
        for button in self.buttons:
            button.draw()

    def on_mouse_press(self, x, y, button, modifiers):
        if button == pyglet.window.mouse.LEFT:
            # Check if any button was clicked
            for btn in self.buttons:
                if btn.x < x < btn.x + btn.width and btn.y < y < btn.y + btn.height:
                    # Create a square when the "Create Square" button is clicked
                    square = PhysicsObject(mass=1, size=50)
                    square.position = [x, y]
                    self.objects.append(square)

if __name__ == "__main__":
    window = SimulationWindow(800, 600)
    pyglet.app.run()

// Input Handling Class

class Input {
    constructor() {
        this.keys = {};
        this.mouse = {
            x: 0,
            y: 0,
            down: false,
            clicked: false
        };
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Keyboard events
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        // Mouse events
        window.addEventListener('mousemove', (e) => {
            const canvas = document.getElementById('gameCanvas');
            const rect = canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });

        window.addEventListener('mousedown', (e) => {
            this.mouse.down = true;
            this.mouse.clicked = true;
        });

        window.addEventListener('mouseup', (e) => {
            this.mouse.down = false;
        });

        // Prevent context menu on right click
        window.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    // Check if key is pressed
    isKeyPressed(key) {
        return this.keys[key.toLowerCase()] || false;
    }

    // Get movement direction from WASD/Arrow keys
    getMovementDirection() {
        let dx = 0;
        let dy = 0;

        if (this.isKeyPressed('w') || this.isKeyPressed('arrowup')) dy -= 1;
        if (this.isKeyPressed('s') || this.isKeyPressed('arrowdown')) dy += 1;
        if (this.isKeyPressed('a') || this.isKeyPressed('arrowleft')) dx -= 1;
        if (this.isKeyPressed('d') || this.isKeyPressed('arrowright')) dx += 1;

        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            dx *= 0.707; // 1/sqrt(2)
            dy *= 0.707;
        }

        return { dx, dy };
    }

    // Check if mouse was clicked this frame
    isMouseClicked() {
        if (this.mouse.clicked) {
            this.mouse.clicked = false; // Reset after checking
            return true;
        }
        return false;
    }

    // Get mouse position
    getMousePosition() {
        return { x: this.mouse.x, y: this.mouse.y };
    }

    // Check if mouse button is held down
    isMouseDown() {
        return this.mouse.down;
    }
}

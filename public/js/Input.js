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

        // Mouse events (convert to logical coords for fixed viewport / zoom protection)
        window.addEventListener('mousemove', (e) => {
            const pos = this._toLogicalCoords(e.clientX, e.clientY);
            this.mouse.x = pos.x;
            this.mouse.y = pos.y;
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

        // Prevent Ctrl+Plus / Ctrl+Minus (browser zoom) for fair play
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=')) {
                e.preventDefault();
            }
        });

        // Prevent Ctrl+Scroll (browser zoom) for fair play
        window.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
            }
        }, { passive: false });
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

    // Map screen coords to logical canvas coords (handles CSS scaling from fixed viewport)
    _toLogicalCoords(clientX, clientY) {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const logicalW = canvas.width;
        const logicalH = canvas.height;
        const scale = Math.min(rect.width / logicalW, rect.height / logicalH);
        const contentW = logicalW * scale;
        const contentH = logicalH * scale;
        const left = rect.left + (rect.width - contentW) / 2;
        const top = rect.top + (rect.height - contentH) / 2;
        const x = (clientX - left) / scale;
        const y = (clientY - top) / scale;
        return {
            x: Math.max(0, Math.min(logicalW, x)),
            y: Math.max(0, Math.min(logicalH, y))
        };
    }

    // Get mouse position (logical canvas coords)
    getMousePosition() {
        return { x: this.mouse.x, y: this.mouse.y };
    }

    // Check if mouse button is held down
    isMouseDown() {
        return this.mouse.down;
    }
}

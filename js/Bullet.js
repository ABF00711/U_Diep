// Bullet Class

class Bullet {
    constructor(x, y, angle, speed, options = {}) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
        this.size = options.size || 14; // Bigger bullets (default 7 instead of 4)
        this.color = options.color || '#fff';
        this.damage = options.damage || 10;
        this.penetration = options.penetration || 1;
        this.ownerId = options.ownerId || null;
        this.isPlayer = options.isPlayer || false;
        this.lifetime = options.lifetime || 5000; // 5 seconds max
        this.age = 0;
    }

    update(deltaTime) {
        // Move bullet
        this.x += Math.cos(this.angle) * this.speed * deltaTime;
        this.y += Math.sin(this.angle) * this.speed * deltaTime;
        
        // Update age
        this.age += deltaTime * 1000; // Convert to milliseconds
    }

    draw(ctx) {
        ctx.save();
        
        // Draw bullet (circle)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        // Outline for visibility
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }

    isOutOfBounds(canvasWidth, canvasHeight) {
        return this.x < -this.size || this.x > canvasWidth + this.size ||
               this.y < -this.size || this.y > canvasHeight + this.size;
    }

    isExpired() {
        return this.age >= this.lifetime;
    }
}

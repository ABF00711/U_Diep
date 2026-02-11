// Bullet Class

class Bullet {
    constructor(x, y, angle, speed, options = {}) {
        // Current position
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
        this.lifetime = options.lifetime || GameConfig.BULLET.DEFAULT_LIFETIME; // Lifetime acts as range (higher speed = further distance)
        this.age = 0;
        
        // Track targets already hit this frame to prevent multiple hits on same target
        this.hitTargetsThisFrame = new Set();
    }

    update(deltaTime) {
        // Move bullet
        this.x += Math.cos(this.angle) * this.speed * deltaTime;
        this.y += Math.sin(this.angle) * this.speed * deltaTime;
        
        // Update age
        this.age += deltaTime * 1000; // Convert to milliseconds
        
        // Clear hit targets set each frame (allows hitting same target again if bullet passes through)
        this.hitTargetsThisFrame.clear();
    }
    
    /**
     * Check if this target was already hit this frame
     * @param {string} targetId - ID of the target
     * @returns {boolean} - True if already hit this frame
     */
    hasHitTarget(targetId) {
        return this.hitTargetsThisFrame.has(targetId);
    }
    
    /**
     * Mark a target as hit this frame
     * @param {string} targetId - ID of the target
     */
    markTargetHit(targetId) {
        this.hitTargetsThisFrame.add(targetId);
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

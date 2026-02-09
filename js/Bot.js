// Bot Class

class Bot {
    // Admin-configurable settings
    static DEFAULT_RESPAWN_TIME = 60000; // 1 minute in milliseconds
    static setRespawnTime(seconds) {
        Bot.DEFAULT_RESPAWN_TIME = seconds * 1000; // Convert to milliseconds
    }
    constructor(x, y, type = 'rectangle', options = {}) {
        this.x = x;
        this.y = y;
        this.type = type; // 'rectangle' or 'triangle'
        this.id = options.id || Math.random().toString(36).substr(2, 9);
        
        // Bot properties based on type
        if (type === 'triangle') {
            this.health = options.health || 150;
            this.maxHealth = options.maxHealth || 150;
            this.bodyDamage = options.bodyDamage || 15;
            this.size = options.size || 25;
            this.xpReward = 100;
            this.spriteName = 'SharpTriangle'; // Use SharpTriangle.png or RoundedTriangle.png
        } else {
            // Rectangle (weaker)
            this.health = options.health || 75;
            this.maxHealth = options.maxHealth || 75;
            this.bodyDamage = options.bodyDamage || 8;
            this.size = options.size || 20;
            this.xpReward = 50;
            this.spriteName = 'SharpRectangle'; // Use SharpRectangle.png or RoundedRectangle.png
        }
        
        // Movement
        this.speed = options.speed || 30; // Slow movement
        this.vx = 0;
        this.vy = 0;
        this.moveDirection = Math.random() * Math.PI * 2; // Random initial direction
        this.directionChangeTime = 0;
        this.directionChangeInterval = 2 + Math.random() * 3; // Change direction every 2-5 seconds
        
        // Sprite
        this.sprite = options.sprite || null; // Loaded image
        this.spriteLoaded = false;
        
        // Respawn tracking
        this.isDead = false;
        this.deathTime = 0;
        // Respawn time can be configured by admin (default: 1 minute)
        this.respawnTime = options.respawnTime || Bot.DEFAULT_RESPAWN_TIME || 60000; // milliseconds
    }

    update(deltaTime, canvasWidth, canvasHeight) {
        // Ensure valid canvas dimensions
        canvasWidth = Math.max(canvasWidth || 800, 800);
        canvasHeight = Math.max(canvasHeight || 600, 600);
        
        if (this.isDead) {
            // Check if it's time to respawn
            this.deathTime += deltaTime * 1000; // Convert to milliseconds
            if (this.deathTime >= this.respawnTime) {
                this.respawn(canvasWidth, canvasHeight);
            }
            return;
        }
        
        // Ensure bot has valid position
        if (typeof this.x !== 'number' || typeof this.y !== 'number') {
            this.x = random(this.size + 50, canvasWidth - this.size - 50);
            this.y = random(this.size + 50, canvasHeight - this.size - 50);
        }

        // Update movement direction periodically
        this.directionChangeTime += deltaTime;
        if (this.directionChangeTime >= this.directionChangeInterval) {
            this.moveDirection = Math.random() * Math.PI * 2; // Random new direction
            this.directionChangeTime = 0;
            this.directionChangeInterval = 2 + Math.random() * 3; // New interval
        }

        // Move bot (slow, random movement)
        this.vx = Math.cos(this.moveDirection) * this.speed;
        this.vy = Math.sin(this.moveDirection) * this.speed;
        
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        
        // Keep bot within bounds
        this.x = clamp(this.x, this.size, canvasWidth - this.size);
        this.y = clamp(this.y, this.size, canvasHeight - this.size);
    }

    takeDamage(amount, attackerId) {
        if (this.isDead) return false;
        
        this.health = Math.max(0, this.health - amount);
        
        if (this.health <= 0) {
            this.isDead = true;
            this.deathTime = 0;
            return { killed: true, xpReward: this.xpReward, attackerId: attackerId };
        }
        
        return { killed: false };
    }

    respawn(canvasWidth, canvasHeight) {
        // Ensure valid canvas dimensions
        canvasWidth = Math.max(canvasWidth || 800, 800);
        canvasHeight = Math.max(canvasHeight || 600, 600);
        
        // Respawn at random location
        this.x = random(this.size + 50, canvasWidth - this.size - 50);
        this.y = random(this.size + 50, canvasHeight - this.size - 50);
        this.health = this.maxHealth;
        this.isDead = false;
        this.deathTime = 0;
        this.moveDirection = Math.random() * Math.PI * 2;
    }

    draw(ctx) {
        if (this.isDead) return; // Don't draw dead bots

        ctx.save();
        ctx.translate(this.x, this.y);

        // Draw bot sprite if loaded, otherwise draw simple shape
        if (this.sprite && this.spriteLoaded) {
            ctx.drawImage(
                this.sprite,
                -this.size,
                -this.size,
                this.size * 2,
                this.size * 2
            );
        } else {
            // Fallback: draw simple shape
            ctx.fillStyle = this.type === 'triangle' ? '#ff6b6b' : '#4ecdc4';
            ctx.beginPath();
            
            if (this.type === 'triangle') {
                // Draw triangle
                ctx.moveTo(0, -this.size);
                ctx.lineTo(-this.size, this.size);
                ctx.lineTo(this.size, this.size);
                ctx.closePath();
            } else {
                // Draw rectangle
                ctx.fillRect(-this.size, -this.size, this.size * 2, this.size * 2);
            }
            
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.restore();

        // Draw health bar
        this.drawHealthBar(ctx);
    }

    drawHealthBar(ctx) {
        const barWidth = this.size * 2;
        const barHeight = 4;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 12;

        // Background
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Health fill
        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = healthPercent > 0.5 ? '#4caf50' : healthPercent > 0.25 ? '#ff9800' : '#f44336';
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

        // Border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    loadSprite(image) {
        if (image && image.complete) {
            this.sprite = image;
            this.spriteLoaded = true;
        }
    }
}

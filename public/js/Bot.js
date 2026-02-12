// Bot Class

class Bot {
    // Admin-configurable settings
    static DEFAULT_RESPAWN_TIME = GameConfig.BOT.DEFAULT_RESPAWN_TIME;
    static DEFAULT_DAMAGE_COOLDOWN = GameConfig.BOT.DEFAULT_DAMAGE_COOLDOWN;
    
    static setRespawnTime(seconds) {
        Bot.DEFAULT_RESPAWN_TIME = seconds * 1000; // Convert to milliseconds
    }
    
    static setDamageCooldown(seconds) {
        Bot.DEFAULT_DAMAGE_COOLDOWN = seconds * 1000; // Convert to milliseconds
    }
    constructor(x, y, type = 'rectangle', options = {}) {
        this.x = x;
        this.y = y;
        this.type = type; // 'rectangle' or 'triangle'
        this.id = options.id || Math.random().toString(36).substr(2, 9);
        this.serverBotId = options.serverBotId || null; // Track if managed by server
        
        // Bot properties based on type
        const botConfig = type === 'triangle' ? GameConfig.BOT.TRIANGLE : GameConfig.BOT.RECTANGLE;
        
        this.health = options.health || botConfig.HEALTH;
        this.maxHealth = options.maxHealth || botConfig.MAX_HEALTH;
        this.bodyDamage = options.bodyDamage || botConfig.BODY_DAMAGE;
        this.size = options.size || botConfig.SIZE;
        this.xpReward = botConfig.XP_REWARD;
        this.spriteName = botConfig.SPRITE_NAME;
        
        // Movement
        this.speed = options.speed || GameConfig.BOT.DEFAULT_SPEED;
        this.vx = 0;
        this.vy = 0;
        this.moveDirection = Math.random() * Math.PI * 2; // Random initial direction
        this.directionChangeTime = 0;
        const changeInterval = GameConfig.BOT.DIRECTION_CHANGE_MIN + 
            Math.random() * (GameConfig.BOT.DIRECTION_CHANGE_MAX - GameConfig.BOT.DIRECTION_CHANGE_MIN);
        this.directionChangeInterval = changeInterval;
        
        // Rotation for visual effect
        this.rotation = Math.random() * Math.PI * 2; // Random initial rotation
        this.rotationSpeed = (Math.random() - 0.5) * 0.05; // Random rotation speed (-0.025 to 0.025 rad/frame)
        
        // Sprite
        this.sprite = options.sprite || null; // Loaded image
        this.spriteLoaded = false;
        
        // Respawn tracking
        this.isDead = false;
        this.deathTime = 0;
        // Respawn time can be configured by admin (default: 1 minute)
        this.respawnTime = options.respawnTime || Bot.DEFAULT_RESPAWN_TIME || GameConfig.BOT.DEFAULT_RESPAWN_TIME;
        
        // Damage cooldown - bots can only damage players once per second (admin configurable)
        this.damageCooldown = options.damageCooldown || Bot.DEFAULT_DAMAGE_COOLDOWN || GameConfig.BOT.DEFAULT_DAMAGE_COOLDOWN;
        this.lastDamageTime = {}; // Track last damage time per player (playerId -> timestamp)
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
            const margin = GameConfig.GAME.SPAWN_MARGIN;
            this.x = random(this.size + margin, canvasWidth - this.size - margin);
            this.y = random(this.size + margin, canvasHeight - this.size - margin);
        }

        // Update rotation (continuous rotation for visual effect)
        this.rotation += this.rotationSpeed * deltaTime * 60; // Scale by 60 for consistent speed regardless of FPS

        // Update movement direction periodically
        this.directionChangeTime += deltaTime;
        if (this.directionChangeTime >= this.directionChangeInterval) {
            this.moveDirection = Math.random() * Math.PI * 2; // Random new direction
            this.directionChangeTime = 0;
            const changeInterval = GameConfig.BOT.DIRECTION_CHANGE_MIN + 
                Math.random() * (GameConfig.BOT.DIRECTION_CHANGE_MAX - GameConfig.BOT.DIRECTION_CHANGE_MIN);
            this.directionChangeInterval = changeInterval;
        }

        // Move bot (combine random movement with velocity from collisions)
        const randomVx = Math.cos(this.moveDirection) * this.speed;
        const randomVy = Math.sin(this.moveDirection) * this.speed;
        
        // Combine random movement with collision velocity (squirt effect)
        // Apply dampening to collision velocity so it gradually slows down
        this.vx = this.vx * GameConfig.BOT.SQUIRT_DAMPENING + randomVx * (1 - GameConfig.BOT.SQUIRT_DAMPENING);
        this.vy = this.vy * GameConfig.BOT.SQUIRT_DAMPENING + randomVy * (1 - GameConfig.BOT.SQUIRT_DAMPENING);
        
        // Update position with combined velocity
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        
        // Keep bot within world bounds (use world size from config)
        const worldWidth = GameConfig.GAME.WORLD_WIDTH;
        const worldHeight = GameConfig.GAME.WORLD_HEIGHT;
        this.x = clamp(this.x, this.size, worldWidth - this.size);
        this.y = clamp(this.y, this.size, worldHeight - this.size);
        
        // Reset velocity if bot hits boundary (bounce effect)
        if (this.x <= this.size || this.x >= worldWidth - this.size) {
            this.vx *= -0.5; // Reverse and dampen
        }
        if (this.y <= this.size || this.y >= worldHeight - this.size) {
            this.vy *= -0.5; // Reverse and dampen
        }
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

    canDamagePlayer(playerId, currentTime) {
        // Check if enough time has passed since last damage to this player
        const lastDamage = this.lastDamageTime[playerId] || 0;
        return (currentTime - lastDamage) >= this.damageCooldown;
    }

    recordDamageToPlayer(playerId, currentTime) {
        // Record that we damaged this player at this time
        this.lastDamageTime[playerId] = currentTime;
    }

    respawn(canvasWidth, canvasHeight) {
        // Respawn at random location in world (use world bounds)
        const worldWidth = GameConfig.GAME.WORLD_WIDTH;
        const worldHeight = GameConfig.GAME.WORLD_HEIGHT;
        const margin = GameConfig.GAME.SPAWN_MARGIN;
        this.x = random(this.size + margin, worldWidth - this.size - margin);
        this.y = random(this.size + margin, worldHeight - this.size - margin);
        this.health = this.maxHealth;
        this.isDead = false;
        this.deathTime = 0;
        this.moveDirection = Math.random() * Math.PI * 2;
        this.rotation = Math.random() * Math.PI * 2; // Random initial rotation
        this.rotationSpeed = (Math.random() - 0.5) * 0.05; // Random rotation speed
    }

    draw(ctx) {
        if (this.isDead) return; // Don't draw dead bots

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation); // Apply rotation

        // Draw pellet programmatically (always use programmatic drawing, no sprites)
        if (this.type === 'triangle') {
            this.drawTrianglePellet(ctx);
        } else {
            this.drawSquarePellet(ctx);
        }

        ctx.restore();

        // Draw health bar (outside rotation so it stays horizontal)
        this.drawHealthBar(ctx);
    }
    
    /**
     * Draw a square pellet (like SquarePolygon.png)
     * Golden yellow square with darker border and rounded corners
     */
    drawSquarePellet(ctx) {
        const size = this.size;
        const cornerRadius = size * 0.15; // Rounded corners
        
        // Draw filled square with rounded corners
        ctx.fillStyle = GameConfig.COLORS.BOT_RECTANGLE;
        ctx.beginPath();
        this.roundedRect(ctx, -size, -size, size * 2, size * 2, cornerRadius);
        ctx.fill();
        
        // Draw border
        ctx.strokeStyle = GameConfig.COLORS.BOT_RECTANGLE_BORDER;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    /**
     * Draw a triangle pellet (like TrianglePellet.png)
     * Reddish-orange triangle with darker border and rounded corners
     * Triangle points to the right
     */
    drawTrianglePellet(ctx) {
        const size = this.size;
        const cornerRadius = size * 0.12; // Rounded corner radius
        
        // Triangle pointing right: apex on right, base on left (vertical)
        const apexX = size * 0.9;   // Right point (apex)
        const apexY = 0;
        const topX = -size * 0.8;   // Top-left corner
        const topY = -size;
        const bottomX = -size * 0.8; // Bottom-left corner
        const bottomY = size;
        
        ctx.fillStyle = GameConfig.COLORS.BOT_TRIANGLE;
        ctx.beginPath();
        
        // Draw triangle with rounded corners
        // Start from top-left, going clockwise
        ctx.moveTo(topX, topY + cornerRadius);
        ctx.quadraticCurveTo(topX, topY, topX + cornerRadius, topY);
        ctx.lineTo(apexX - cornerRadius, apexY - cornerRadius);
        ctx.quadraticCurveTo(apexX, apexY, apexX - cornerRadius, apexY + cornerRadius);
        ctx.lineTo(bottomX + cornerRadius, bottomY);
        ctx.quadraticCurveTo(bottomX, bottomY, bottomX, bottomY - cornerRadius);
        ctx.closePath();
        
        ctx.fill();
        
        // Draw border
        ctx.strokeStyle = GameConfig.COLORS.BOT_TRIANGLE_BORDER;
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }
    
    /**
     * Helper: Draw rounded rectangle
     */
    roundedRect(ctx, x, y, width, height, radius) {
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
    }

    drawHealthBar(ctx) {
        const barWidth = this.size * 2;
        const barHeight = 4;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 12;

        // Background
        ctx.fillStyle = GameConfig.COLORS.HEALTH_BAR_BG;
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Health fill
        const healthPercent = this.health / this.maxHealth;
        let healthColor = GameConfig.COLORS.HEALTH_BAR_LOW;
        if (healthPercent > 0.5) {
            healthColor = GameConfig.COLORS.HEALTH_BAR_HIGH;
        } else if (healthPercent > 0.25) {
            healthColor = GameConfig.COLORS.HEALTH_BAR_MEDIUM;
        }
        ctx.fillStyle = healthColor;
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

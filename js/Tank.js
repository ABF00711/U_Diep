// Tank Class

class Tank {
    constructor(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.angle = options.angle || 0;
        this.size = options.size || 30;
        this.barrelLength = options.barrelLength || 25;
        this.barrelWidth = options.barrelWidth || 24; // Thicker barrel
        this.color = options.color || '#4a90e2';
        this.health = options.health || 100;
        this.maxHealth = options.maxHealth || 100;
        this.level = options.level || 1;
        this.xp = options.xp || 0;
        this.xpToNextLevel = options.xpToNextLevel || 100;
        this.name = options.name || 'Player';
        this.id = options.id || Math.random().toString(36).substr(2, 9);
        this.isPlayer = options.isPlayer || false;
        
        // Movement
        this.speed = options.speed || 200;
        this.vx = 0;
        this.vy = 0;
        
        // Tank stats (diep.io style)
        this.stats = {
            healthRegen: options.healthRegen || 0,
            maxHealth: options.maxHealth || 0,
            bodyDamage: options.bodyDamage || 0,
            bulletSpeed: options.bulletSpeed || 0,
            bulletPenetration: options.bulletPenetration || 0,
            bulletDamage: options.bulletDamage || 0,
            reload: options.reload || 5,
            movementSpeed: options.movementSpeed || 5,
        };
        
        // Shooting
        this.lastShotTime = 0;
        this.reloadTime = 1000;// Base reload time in ms
    }

    update(deltaTime, input, canvasWidth, canvasHeight) {
        // Update movement
        if (this.isPlayer && input) {
            const direction = input.getMovementDirection();
            this.vx = direction.dx * this.speed * (1 + this.stats.movementSpeed * 0.1);
            this.vy = direction.dy * this.speed * (1 + this.stats.movementSpeed * 0.1);
            
            // Update barrel angle to follow mouse
            const mouse = input.getMousePosition();
            this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);
        }
        
        // Update position
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        
        // Clamp to canvas bounds
        this.x = clamp(this.x, this.size, canvasWidth - this.size);
        this.y = clamp(this.y, this.size, canvasHeight - this.size);
        
        // Health regeneration
        if (this.health < this.maxHealth && this.stats.healthRegen > 0) {
            this.health = Math.min(
                this.maxHealth,
                this.health + this.stats.healthRegen * deltaTime
            );
        }
        
        // Update reload timer
        this.lastShotTime += deltaTime * 1000;
    }

    canShoot() {
        return this.lastShotTime >= this.reloadTime * (1 - this.stats.reload * 0.1);
    }

    shoot() {
        if (!this.canShoot()) return null;
        
        this.lastShotTime = 0;
        
        // Calculate bullet spawn position (at end of barrel)
        const barrelEndX = this.x + Math.cos(this.angle) * (this.size + this.barrelLength);
        const barrelEndY = this.y + Math.sin(this.angle) * (this.size + this.barrelLength);
        
        // Calculate bullet speed based on stats
        const baseSpeed = 500;
        const bulletSpeed = baseSpeed + (this.stats.bulletSpeed || 0) * 50;
        
        // Create bullet
        const bullet = new Bullet(
            barrelEndX,
            barrelEndY,
            this.angle,
            bulletSpeed,
            {
                size: 14 + (this.stats.bulletDamage || 0) * 0.5, // Bigger bullets (base size 6 instead of 3)
                color: this.isPlayer ? '#4a90e2' : '#e24a4a',
                damage: 10 + (this.stats.bulletDamage || 0) * 2,
                penetration: 1 + (this.stats.bulletPenetration || 0),
                ownerId: this.id,
                isPlayer: this.isPlayer
            }
        );
        
        return bullet;
    }

    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        return this.health <= 0;
    }

    addXP(amount) {
        this.xp += amount;
        while (this.xp >= this.xpToNextLevel) {
            this.xp -= this.xpToNextLevel;
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;
        this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.2); // Increase XP needed
        // TODO: Allow player to allocate stat points
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Draw tank body (circle - no gradient, solid color)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Body outline
        ctx.strokeStyle = darkenColor(this.color, 0.5);
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw barrel (thicker, no gradient, solid darker color)
        ctx.rotate(this.angle);
        ctx.fillStyle = darkenColor(this.color, 0.4); // Solid darker color
        ctx.fillRect(this.size, -this.barrelWidth / 2, this.barrelLength, this.barrelWidth);
        
        // Barrel outline
        ctx.strokeStyle = darkenColor(this.color, 0.7);
        ctx.lineWidth = 2;
        ctx.strokeRect(this.size, -this.barrelWidth / 2, this.barrelLength, this.barrelWidth);

        ctx.restore();

        // Draw UI elements
        this.drawHealthBar(ctx);
        this.drawLevel(ctx);
        if (this.isPlayer || this.name) {
            this.drawName(ctx);
        }
    }

    drawHealthBar(ctx) {
        const barWidth = this.size * 2;
        const barHeight = 4;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.size - 15;

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

    drawLevel(ctx) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeText(`Lv.${this.level}`, this.x, this.y - this.size - 25);
        ctx.fillText(`Lv.${this.level}`, this.x, this.y - this.size - 25);
    }

    drawName(ctx) {
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeText(this.name, this.x, this.y - this.size - 35);
        ctx.fillText(this.name, this.x, this.y - this.size - 35);
    }
}

// Tank Class

class Tank {
    constructor(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.angle = options.angle || 0;
        this.size = options.size || GameConfig.TANK.DEFAULT_SIZE;
        this.barrelLength = options.barrelLength || GameConfig.TANK.DEFAULT_BARREL_LENGTH;
        this.barrelWidth = options.barrelWidth || GameConfig.TANK.DEFAULT_BARREL_WIDTH;
        this.color = options.color || GameConfig.COLORS.PLAYER_TANK;
        this.health = options.health || GameConfig.TANK.DEFAULT_HEALTH;
        this.maxHealth = options.maxHealth || GameConfig.TANK.DEFAULT_MAX_HEALTH;
        this.level = options.level || 1;
        this.xp = options.xp || 0;
        this.xpToNextLevel = options.xpToNextLevel || GameConfig.XP.BASE_XP_TO_NEXT_LEVEL;
        this.name = options.name || 'Player';
        this.id = options.id || Math.random().toString(36).substr(2, 9);
        this.isPlayer = options.isPlayer || false;
        this.stake = options.stake || 0; // Wager amount for this tank (for reward calculation)
        this.isDead = false; // Track if tank is dead
        
        // Movement
        this.speed = options.speed || GameConfig.TANK.DEFAULT_SPEED;
        this.vx = 0;
        this.vy = 0;
        
        // Tank stats (diep.io style) - all start at 0, allocated via stat points
        // Note: bodyDamage stat starts at 0, but base body damage (3) is added when calculating damage
        this.stats = {
            healthRegen: options.healthRegen || 0,
            maxHealth: options.maxHealth || 0,
            bodyDamage: options.bodyDamage || 0,
            bulletSpeed: options.bulletSpeed || 0,
            bulletPenetration: options.bulletPenetration || 0,
            bulletDamage: options.bulletDamage || 0,
            reload: options.reload || 0,
            movementSpeed: options.movementSpeed || 0,
        };
        
        // Stat points available for allocation
        this.statPoints = options.statPoints || 0;
        
        // Track if stat allocation UI should be shown
        this.pendingStatAllocation = false;
        
        // Initialize max health (will be updated when maxHealth stat is allocated)
        // Base health is DEFAULT_MAX_HEALTH, +5 HP per maxHealth stat point
        this.maxHealth = GameConfig.TANK.DEFAULT_MAX_HEALTH + (this.stats.maxHealth * 5);
        
        // Shooting
        this.lastShotTime = 0;
        this.reloadTime = GameConfig.TANK.BASE_RELOAD_TIME;
        
        // Body damage cooldown - tanks can only damage entities once per second
        this.bodyDamageCooldown = GameConfig.TANK.BODY_DAMAGE_COOLDOWN;
        this.lastBodyDamageTime = {}; // Track last body damage time per target (targetId -> timestamp)
    }

    update(deltaTime, input, canvasWidth, canvasHeight) {
        // Update movement
        if (this.isPlayer && input) {
            const direction = input.getMovementDirection();
            const speedMultiplier = 1 + this.stats.movementSpeed * GameConfig.TANK.MOVEMENT_SPEED_MULTIPLIER;
            this.vx = direction.dx * this.speed * speedMultiplier;
            this.vy = direction.dy * this.speed * speedMultiplier;
            
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
        const reloadMultiplier = 1 - this.stats.reload * GameConfig.TANK.RELOAD_MULTIPLIER;
        return this.lastShotTime >= this.reloadTime * reloadMultiplier;
    }

    shoot() {
        if (!this.canShoot()) return null;
        
        this.lastShotTime = 0;
        
        // Calculate bullet spawn position (at end of barrel)
        const barrelEndX = this.x + Math.cos(this.angle) * (this.size + this.barrelLength);
        const barrelEndY = this.y + Math.sin(this.angle) * (this.size + this.barrelLength);
        
        // Calculate bullet speed based on stats
        const bulletSpeed = GameConfig.BULLET.BASE_SPEED + (this.stats.bulletSpeed || 0) * GameConfig.BULLET.SPEED_MULTIPLIER;
        
        // Create bullet
        const bullet = new Bullet(
            barrelEndX,
            barrelEndY,
            this.angle,
            bulletSpeed,
            {
                size: GameConfig.BULLET.BASE_SIZE + (this.stats.bulletDamage || 0) * GameConfig.BULLET.SIZE_MULTIPLIER,
                color: this.isPlayer ? GameConfig.COLORS.PLAYER_BULLET : GameConfig.COLORS.ENEMY_BULLET,
                damage: GameConfig.BULLET.BASE_DAMAGE + (this.stats.bulletDamage || 0) * GameConfig.BULLET.DAMAGE_MULTIPLIER,
                penetration: GameConfig.BULLET.DEFAULT_PENETRATION + (this.stats.bulletPenetration || 0),
                ownerId: this.id,
                isPlayer: this.isPlayer
            }
        );
        
        return bullet;
    }

    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        if (this.health <= 0) {
            this.isDead = true;
        }
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
        this.xpToNextLevel = Math.floor(this.xpToNextLevel * GameConfig.XP.XP_MULTIPLIER_PER_LEVEL);
        
        // Give stat point on level up (1 point per level)
        this.statPoints++;
        this.pendingStatAllocation = true; // Flag to show stat UI
    }
    
    /**
     * Allocate a stat point to a specific stat
     * @param {string} statName - Name of the stat to allocate to
     * @returns {boolean} - True if allocation successful, false if no points available or stat at max
     */
    allocateStatPoint(statName) {
        if (this.statPoints <= 0) {
            return false; // No points available
        }
        
        if (!this.stats.hasOwnProperty(statName)) {
            return false; // Invalid stat name
        }
        
        // Check if stat is already at maximum (7)
        if (this.stats[statName] >= GameConfig.TANK.MAX_STAT_POINTS) {
            return false; // Stat already at maximum
        }
        
        // Allocate point
        this.stats[statName]++;
        this.statPoints--;
        
        // Apply stat changes immediately
        this.applyStatChanges(statName);
        
        return true;
    }
    
    /**
     * Apply stat changes when a stat is allocated
     * @param {string} statName - Name of the stat that was changed
     */
    applyStatChanges(statName) {
        switch(statName) {
            case 'maxHealth':
                // Update max health (+5 HP per point)
                this.maxHealth = GameConfig.TANK.DEFAULT_MAX_HEALTH + (this.stats.maxHealth * 5);
                // Heal to new max if current health is at old max
                if (this.health >= this.maxHealth - 5) {
                    this.health = this.maxHealth;
                }
                break;
            case 'healthRegen':
                // Health regen is applied in update() method
                break;
            case 'movementSpeed':
                // Movement speed is applied in update() method
                break;
            case 'reload':
                // Reload is applied in canShoot() method
                break;
            // Other stats (bulletSpeed, bulletPenetration, bulletDamage, bodyDamage)
            // are applied when creating bullets or calculating damage
        }
    }
    
    /**
     * Get available stat points
     */
    getStatPoints() {
        return this.statPoints;
    }
    
    /**
     * Check if stat allocation is pending
     */
    hasPendingStatAllocation() {
        return this.pendingStatAllocation && this.statPoints > 0;
    }
    
    /**
     * Mark stat allocation as complete
     */
    completeStatAllocation() {
        this.pendingStatAllocation = false;
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

    canDamageTarget(targetId, currentTime) {
        // Check if enough time has passed since last body damage to this target
        const lastDamage = this.lastBodyDamageTime[targetId] || 0;
        return (currentTime - lastDamage) >= this.bodyDamageCooldown;
    }

    recordBodyDamageToTarget(targetId, currentTime) {
        // Record that we damaged this target at this time
        this.lastBodyDamageTime[targetId] = currentTime;
    }

    getBodyDamage() {
        // Calculate body damage: base damage (3) + stat points
        return GameConfig.TANK.DEFAULT_BODY_DAMAGE + this.stats.bodyDamage;
    }
}

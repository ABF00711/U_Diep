// Collision Manager - Handles all collision detection and responses

class CollisionManager {
    constructor(game) {
        this.game = game;
        this.rewardManager = new RewardManager(game.economy);
        this.deathHandler = new DeathHandler(game);
    }

    /**
     * Check bullet collision with tanks
     * Bullets with penetration > 1 can pass through multiple targets
     * @param {Bullet} bullet - Bullet to check
     * @param {Array} tanks - Array of tanks to check against
     * @returns {boolean} - True if bullet should be removed (penetration reached 0)
     */
    checkBulletTankCollision(bullet, tanks) {
        for (const tank of tanks) {
            if (!tank || bullet.ownerId === tank.id) continue; // Can't hit self
            if (bullet.hasHitTarget(tank.id)) continue; // Already hit this target this frame
            
            const distance = getDistance(bullet.x, bullet.y, tank.x, tank.y);
            if (distance < tank.size + bullet.size) {
                // Hit! Mark this target as hit
                bullet.markTargetHit(tank.id);
                
                // Apply damage
                const isDead = tank.takeDamage(bullet.damage);
                
                // Decrease penetration (bullet passes through)
                bullet.penetration--;
                
                // Check if player killed enemy tank
                if (isDead && this.game.playerTank && bullet.ownerId === this.game.playerTank.id && !tank.isPlayer) {
                    // Get actual victim's stake (or use current room stake as fallback)
                    const victimStake = tank.stake || this.game.economy.getCurrentWager() || GameConfig.ECONOMY.DEFAULT_VICTIM_STAKE;
                    const calculation = this.rewardManager.giveKillReward(victimStake);
                    
                    // Calculate XP reward based on level difference
                    const levelDiff = tank.level - this.game.playerTank.level;
                    let xpReward = GameConfig.XP.BASE_KILL_XP;
                    
                    // If enemy is higher level, give bonus XP
                    if (levelDiff > 0) {
                        xpReward += levelDiff * GameConfig.XP.LEVEL_DIFF_MULTIPLIER;
                    }
                    // If enemy is lower level, reduce XP (minimum 10 XP, never negative)
                    else if (levelDiff < 0) {
                        // Reduce XP by 5 per level difference, but never below minimum
                        xpReward = Math.max(GameConfig.XP.MIN_KILL_XP, GameConfig.XP.BASE_KILL_XP + (levelDiff * 5));
                    }
                    
                    // Cap XP at maximum
                    xpReward = Math.min(xpReward, GameConfig.XP.MAX_KILL_XP);
                    
                    // Give XP to player
                    this.game.playerTank.addXP(xpReward);
                    
                    console.log(`Killed enemy! Reward: $${calculation.reward.toFixed(2)}, XP: ${xpReward}, Level diff: ${levelDiff}`);
                    this.game.showMessage(`Killed enemy! +$${calculation.reward.toFixed(2)} (+${xpReward} XP)`, GameConfig.UI.MESSAGE_DURATION);
                    this.game.updateBalanceDisplay();
                }
                
                // Check if player died
                if (isDead && tank.isPlayer) {
                    this.deathHandler.handlePlayerDeath('bullet');
                }
                
                // If penetration is 0, bullet should be removed (can't pass through more)
                if (bullet.penetration <= 0) {
                    return true; // Remove bullet
                }
                
                // Bullet continues forward (penetration > 0), check for more targets
                // Don't return here - continue checking other tanks
            }
        }
        return false; // Bullet still has penetration left, keep it
    }

    /**
     * Check bullet collision with bots
     * Bullets with penetration > 1 can pass through multiple bots
     * @param {Bullet} bullet - Bullet to check
     * @param {Array} bots - Array of bots to check against
     * @returns {boolean} - True if bullet should be removed (penetration reached 0)
     */
    checkBulletBotCollision(bullet, bots) {
        for (const bot of bots) {
            if (!bot || bot.isDead) continue;
            if (bullet.hasHitTarget(bot.id)) continue; // Already hit this bot this frame
            
            const distance = getDistance(bullet.x, bullet.y, bot.x, bot.y);
            if (distance < bot.size + bullet.size) {
                // Hit bot! Mark this bot as hit
                bullet.markTargetHit(bot.id);
                
                // Apply damage
                const result = bot.takeDamage(bullet.damage, bullet.ownerId);
                
                // Decrease penetration (bullet passes through)
                bullet.penetration--;
                
                // Give XP if player killed bot
                if (result.killed && result.attackerId && this.game.playerTank && result.attackerId === this.game.playerTank.id) {
                    this.game.playerTank.addXP(result.xpReward);
                }
                
                // If penetration is 0, bullet should be removed (can't pass through more)
                if (bullet.penetration <= 0) {
                    return true; // Remove bullet
                }
                
                // Bullet continues forward (penetration > 0), check for more bots
                // Don't return here - continue checking other bots
            }
        }
        return false; // Bullet still has penetration left, keep it
    }

    /**
     * Check tank collision with bots (mutual body damage + push-back with squirt effect)
     * @param {Tank} tank - Tank to check
     * @param {Array} bots - Array of bots to check against
     */
    checkTankBotCollision(tank, bots) {
        if (!tank) return;
        
        const currentTime = Date.now();
        
        for (const bot of bots) {
            if (!bot || bot.isDead) continue;
            
            const distance = getDistance(bot.x, bot.y, tank.x, tank.y);
            if (distance < bot.size + tank.size) {
                // Apply push-back with squirt effect first
                this.applyTankBotPushBack(tank, bot);
                
                // Mutual collision - both take body damage
                
                // Bot damages tank
                if (bot.canDamagePlayer(tank.id, currentTime)) {
                    const isDead = tank.takeDamage(bot.bodyDamage);
                    bot.recordDamageToPlayer(tank.id, currentTime);
                    
                    if (isDead && tank.isPlayer) {
                        this.deathHandler.handlePlayerDeath('bot');
                        return; // Exit early since player is dead
                    }
                }
                
                // Tank damages bot
                if (tank.canDamageTarget(bot.id, currentTime)) {
                    const result = bot.takeDamage(tank.getBodyDamage(), tank.id);
                    tank.recordBodyDamageToTarget(bot.id, currentTime);
                    
                    if (result.killed && tank.isPlayer) {
                        tank.addXP(result.xpReward);
                    }
                }
            }
        }
    }
    
    /**
     * Apply push-back with squirt effect when tank collides with pellet/bot
     * Pellets get "squirted" away from the tank with velocity
     * @param {Tank} tank - The tank
     * @param {Bot} bot - The pellet/bot
     */
    applyTankBotPushBack(tank, bot) {
        // Calculate distance between tank and bot centers
        const dx = bot.x - tank.x;
        const dy = bot.y - tank.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Avoid division by zero
        if (distance === 0) {
            // If bot is exactly on top of tank, separate them randomly
            const angle = Math.random() * Math.PI * 2;
            const separation = (tank.size + bot.size) * 0.5;
            bot.x = tank.x + Math.cos(angle) * separation;
            bot.y = tank.y + Math.sin(angle) * separation;
            return;
        }
        
        // Calculate minimum distance (sum of radii)
        const minDistance = tank.size + bot.size;
        
        // If tank and bot are overlapping
        if (distance < minDistance) {
            // Calculate overlap amount
            const overlap = minDistance - distance;
            
            // Calculate collision normal (direction from tank to bot)
            const normalX = dx / distance;
            const normalY = dy / distance;
            
            // Push bot away from tank (position correction)
            const pushDistance = overlap * 0.6; // Push bot most of the way out
            bot.x = tank.x + normalX * minDistance;
            bot.y = tank.y + normalY * minDistance;
            
            // Apply "squirt" effect - give bot velocity away from tank
            const squirtForce = GameConfig.BOT.SQUIRT_FORCE;
            bot.vx = normalX * squirtForce;
            bot.vy = normalY * squirtForce;
            
            // Also slightly push tank back (much less force)
            const tankPushBack = overlap * 0.2;
            tank.x -= normalX * tankPushBack;
            tank.y -= normalY * tankPushBack;
            
            // Clamp tank position to canvas bounds
            if (this.game && this.game.canvas) {
                const canvasWidth = this.game.canvas.width || GameConfig.GAME.CANVAS_MIN_WIDTH;
                const canvasHeight = this.game.canvas.height || GameConfig.GAME.CANVAS_MIN_HEIGHT;
                tank.x = clamp(tank.x, tank.size, canvasWidth - tank.size);
                tank.y = clamp(tank.y, tank.size, canvasHeight - tank.size);
            }
        }
    }

    /**
     * Check tank vs tank collisions (mutual body damage)
     * @param {Array} tanks - Array of all tanks
     */
    checkTankTankCollision(tanks) {
        const currentTime = Date.now();
        
        for (let i = 0; i < tanks.length; i++) {
            for (let j = i + 1; j < tanks.length; j++) {
                const tank1 = tanks[i];
                const tank2 = tanks[j];
                
                if (!tank1 || !tank2) continue;
                
                const distance = getDistance(tank1.x, tank1.y, tank2.x, tank2.y);
                if (distance < tank1.size + tank2.size) {
                    // Tanks are colliding - mutual body damage
                    this.processTankCollision(tank1, tank2, currentTime);
                }
            }
        }
    }

    /**
     * Process collision between two tanks
     * @param {Tank} tank1 - First tank
     * @param {Tank} tank2 - Second tank
     * @param {number} currentTime - Current timestamp
     */
    processTankCollision(tank1, tank2, currentTime) {
        // Calculate collision push-back first
        this.applyTankPushBack(tank1, tank2);
        
        // Tank1 damages Tank2
        if (tank1.canDamageTarget(tank2.id, currentTime)) {
            const isDead = tank2.takeDamage(tank1.getBodyDamage());
            tank1.recordBodyDamageToTarget(tank2.id, currentTime);
            
            if (isDead && tank2.isPlayer) {
                this.deathHandler.handlePlayerDeath('tank_collision');
            }
            
            // Check if player (tank1) killed tank2 - give reward
            if (isDead && tank1.isPlayer && !tank2.isPlayer) {
                // Get actual victim's stake (or use current room stake as fallback)
                const victimStake = tank2.stake || this.game.economy.getCurrentWager() || GameConfig.ECONOMY.DEFAULT_VICTIM_STAKE;
                const calculation = this.rewardManager.giveKillReward(victimStake);
                
                // Calculate XP reward based on level difference
                const levelDiff = tank2.level - tank1.level;
                let xpReward = GameConfig.XP.BASE_KILL_XP;
                
                // If enemy is higher level, give bonus XP
                if (levelDiff > 0) {
                    xpReward += levelDiff * GameConfig.XP.LEVEL_DIFF_MULTIPLIER;
                }
                // If enemy is lower level, reduce XP (minimum MIN_KILL_XP, never negative)
                else if (levelDiff < 0) {
                    // Reduce XP by 5 per level difference, but never below minimum
                    xpReward = Math.max(GameConfig.XP.MIN_KILL_XP, GameConfig.XP.BASE_KILL_XP + (levelDiff * 5));
                }
                
                // Cap XP at maximum
                xpReward = Math.min(xpReward, GameConfig.XP.MAX_KILL_XP);
                
                // Give XP to player
                tank1.addXP(xpReward);
                
                console.log(`Killed enemy tank! Reward: $${calculation.reward.toFixed(2)}, XP: ${xpReward}, Level diff: ${levelDiff}`);
                this.game.showMessage(`Killed enemy! +$${calculation.reward.toFixed(2)} (+${xpReward} XP)`, GameConfig.UI.MESSAGE_DURATION);
                this.game.updateBalanceDisplay();
            }
        }
        
        // Tank2 damages Tank1
        if (tank2.canDamageTarget(tank1.id, currentTime)) {
            const isDead = tank1.takeDamage(tank2.getBodyDamage());
            tank2.recordBodyDamageToTarget(tank1.id, currentTime);
            
            if (isDead && tank1.isPlayer) {
                this.deathHandler.handlePlayerDeath('tank_collision');
            }
        }
    }
    
    /**
     * Apply push-back physics when two tanks collide
     * Prevents tanks from overlapping by pushing them apart
     * @param {Tank} tank1 - First tank
     * @param {Tank} tank2 - Second tank
     */
    applyTankPushBack(tank1, tank2) {
        // Calculate distance between tank centers
        const dx = tank2.x - tank1.x;
        const dy = tank2.y - tank1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Avoid division by zero
        if (distance === 0) {
            // If tanks are exactly on top of each other, separate them randomly
            const angle = Math.random() * Math.PI * 2;
            const separation = (tank1.size + tank2.size) * 0.5;
            tank1.x -= Math.cos(angle) * separation;
            tank1.y -= Math.sin(angle) * separation;
            tank2.x += Math.cos(angle) * separation;
            tank2.y += Math.sin(angle) * separation;
            return;
        }
        
        // Calculate minimum distance (sum of radii)
        const minDistance = tank1.size + tank2.size;
        
        // If tanks are overlapping
        if (distance < minDistance) {
            // Calculate overlap amount
            const overlap = minDistance - distance;
            
            // Calculate collision normal (direction from tank1 to tank2)
            const normalX = dx / distance;
            const normalY = dy / distance;
            
            // Calculate push-back force (proportional to overlap)
            const pushForce = overlap * GameConfig.TANK.COLLISION_PUSH_FORCE;
            
            // Push tanks apart along the collision normal
            // Each tank moves proportionally
            const pushX = normalX * pushForce;
            const pushY = normalY * pushForce;
            
            // Store original positions for bounds checking
            const oldX1 = tank1.x;
            const oldY1 = tank1.y;
            const oldX2 = tank2.x;
            const oldY2 = tank2.y;
            
            // Apply push-back to both tanks (tank1 pushed back, tank2 pushed forward)
            tank1.x -= pushX;
            tank1.y -= pushY;
            tank2.x += pushX;
            tank2.y += pushY;
            
            // Clamp positions to canvas bounds (if canvas dimensions available)
            if (this.game && this.game.canvas) {
                const canvasWidth = this.game.canvas.width || GameConfig.GAME.CANVAS_MIN_WIDTH;
                const canvasHeight = this.game.canvas.height || GameConfig.GAME.CANVAS_MIN_HEIGHT;
                
                tank1.x = clamp(tank1.x, tank1.size, canvasWidth - tank1.size);
                tank1.y = clamp(tank1.y, tank1.size, canvasHeight - tank1.size);
                tank2.x = clamp(tank2.x, tank2.size, canvasWidth - tank2.size);
                tank2.y = clamp(tank2.y, tank2.size, canvasHeight - tank2.size);
            }
            
            // Also apply velocity dampening to prevent jittering
            // Reduce velocity component along collision normal
            const dot1 = tank1.vx * normalX + tank1.vy * normalY;
            const dot2 = tank2.vx * normalX + tank2.vy * normalY;
            
            // Only dampen if tanks are moving towards each other
            if (dot1 > 0) {
                tank1.vx -= normalX * dot1 * 0.5;
                tank1.vy -= normalY * dot1 * 0.5;
            }
            if (dot2 < 0) {
                tank2.vx -= normalX * dot2 * 0.5;
                tank2.vy -= normalY * dot2 * 0.5;
            }
        }
    }
}

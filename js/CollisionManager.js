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
                    
                    console.log(`Killed enemy! Reward: $${calculation.reward.toFixed(2)}, Platform fee: $${calculation.platformFee.toFixed(2)}`);
                    this.game.showMessage(`Killed enemy! +$${calculation.reward.toFixed(2)}`, GameConfig.UI.MESSAGE_DURATION);
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
     * Check tank collision with bots (mutual body damage)
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
                
                console.log(`Killed enemy tank! Reward: $${calculation.reward.toFixed(2)}, Platform fee: $${calculation.platformFee.toFixed(2)}`);
                this.game.showMessage(`Killed enemy! +$${calculation.reward.toFixed(2)}`, GameConfig.UI.MESSAGE_DURATION);
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
}

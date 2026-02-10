// Collision Manager - Handles all collision detection and responses

class CollisionManager {
    constructor(game) {
        this.game = game;
        this.rewardManager = new RewardManager(game.economy);
        this.deathHandler = new DeathHandler(game);
    }

    /**
     * Check bullet collision with tanks
     * @param {Bullet} bullet - Bullet to check
     * @param {Array} tanks - Array of tanks to check against
     * @returns {boolean} - True if bullet should be removed
     */
    checkBulletTankCollision(bullet, tanks) {
        for (const tank of tanks) {
            if (!tank || bullet.ownerId === tank.id) continue; // Can't hit self
            
            const distance = getDistance(bullet.x, bullet.y, tank.x, tank.y);
            if (distance < tank.size + bullet.size) {
                // Hit!
                const isDead = tank.takeDamage(bullet.damage);
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
                
                return bullet.penetration <= 0; // Remove bullet if no penetration left
            }
        }
        return false;
    }

    /**
     * Check bullet collision with bots
     * @param {Bullet} bullet - Bullet to check
     * @param {Array} bots - Array of bots to check against
     * @returns {boolean} - True if bullet should be removed
     */
    checkBulletBotCollision(bullet, bots) {
        for (const bot of bots) {
            if (!bot || bot.isDead) continue;
            
            const distance = getDistance(bullet.x, bullet.y, bot.x, bot.y);
            if (distance < bot.size + bullet.size) {
                // Hit bot!
                const result = bot.takeDamage(bullet.damage, bullet.ownerId);
                bullet.penetration--;
                
                // Give XP if player killed bot
                if (result.killed && result.attackerId && this.game.playerTank && result.attackerId === this.game.playerTank.id) {
                    this.game.playerTank.addXP(result.xpReward);
                }
                
                return bullet.penetration <= 0; // Remove bullet if no penetration left
            }
        }
        return false;
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

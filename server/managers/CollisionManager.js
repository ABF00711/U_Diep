// Collision Manager
// Handles all collision detection and response

const GameConfig = require('../../shared/Config.js');
const BOT_CONFIG = GameConfig.BOT;

class CollisionManager {
    /**
     * Check bot-tank collisions
     */
    checkBotTankCollisions(room, playerManager, onPlayerDeath, onBotKilled) {
        const currentTime = Date.now();
        const tankSize = 30;
        
        room.players.forEach((player) => {
            if (player.isDead) return;
            
            room.bots.forEach((bot) => {
                if (bot.isDead) return;
                
                const distance = Math.sqrt(
                    Math.pow(bot.x - player.x, 2) + 
                    Math.pow(bot.y - player.y, 2)
                );
                
                if (distance < bot.size + tankSize) {
                    // Collision detected
                    // Apply push-back with squirt effect
                    const dx = bot.x - player.x;
                    const dy = bot.y - player.y;
                    const dist = Math.max(distance, 0.1); // Avoid division by zero
                    const normalX = dx / dist;
                    const normalY = dy / dist;
                    
                    const minDistance = bot.size + tankSize;
                    const overlap = minDistance - distance;
                    
                    if (overlap > 0) {
                        // Push bot away (squirt effect)
                        bot.vx += normalX * BOT_CONFIG.SQUIRT_FORCE * (1/60);
                        bot.vy += normalY * BOT_CONFIG.SQUIRT_FORCE * (1/60);
                        
                        // Push player back slightly
                        player.x -= normalX * overlap * 0.3;
                        player.y -= normalY * overlap * 0.3;
                        
                        // Clamp positions
                        const canvasWidth = player.canvasWidth || 1920;
                        const canvasHeight = player.canvasHeight || 1080;
                        player.x = Math.max(tankSize, Math.min(canvasWidth - tankSize, player.x));
                        player.y = Math.max(tankSize, Math.min(canvasHeight - tankSize, player.y));
                    }
                    
                    // Apply body damage (bot damages player)
                    if (!bot.lastDamageTime[player.id] || 
                        (currentTime - bot.lastDamageTime[player.id]) >= bot.damageCooldown) {
                        const oldHealth = player.health;
                        player.health = Math.max(0, player.health - bot.bodyDamage);
                        bot.lastDamageTime[player.id] = currentTime;
                        
                        // Check if player died from bot
                        if (player.health <= 0 && oldHealth > 0) {
                            player.health = 0;
                            player.isDead = true;
                            // No killer for bot death - player just dies
                            onPlayerDeath(null, player);
                        }
                    }
                    
                    // Player damages bot (body damage)
                    const playerBodyDamage = GameConfig.TANK.DEFAULT_BODY_DAMAGE + (player.stats.bodyDamage || 0);
                    if (!bot.lastDamageTime[`player_${player.id}`] || 
                        (currentTime - (bot.lastDamageTime[`player_${player.id}`] || 0)) >= bot.damageCooldown) {
                        const oldBotHealth = bot.health;
                        bot.health = Math.max(0, bot.health - playerBodyDamage);
                        bot.lastDamageTime[`player_${player.id}`] = currentTime;
                        
                        // Check if bot died
                        if (bot.health <= 0 && oldBotHealth > 0) {
                            bot.health = 0;
                            bot.isDead = true;
                            bot.deathTime = 0;
                            
                            // Callback to handle bot kill (gives XP to player)
                            onBotKilled(player, bot);
                        }
                    }
                }
            });
        });
    }

    /**
     * Check bullet-player collisions
     */
    checkBulletPlayerCollisions(room, playerManager, onPlayerDeath) {
        room.bullets.forEach((bullet) => {
            room.players.forEach((targetPlayer) => {
                if (targetPlayer.isDead || targetPlayer.id === bullet.ownerId) return;
                if (bullet.hitTargets.has(targetPlayer.id)) return; // Already hit this frame
                
                const distance = Math.sqrt(
                    Math.pow(bullet.x - targetPlayer.x, 2) + 
                    Math.pow(bullet.y - targetPlayer.y, 2)
                );
                const tankSize = 30;
                
                if (distance < tankSize + bullet.size) {
                    // Hit! Mark target as hit
                    bullet.hitTargets.add(targetPlayer.id);
                    
                    // Apply damage
                    const attacker = playerManager.getPlayer(bullet.ownerId);
                    if (attacker) {
                        const oldHealth = targetPlayer.health;
                        targetPlayer.health = Math.max(0, targetPlayer.health - bullet.damage);
                        
                        // Check if target died
                        if (targetPlayer.health <= 0 && oldHealth > 0) {
                            targetPlayer.health = 0;
                            targetPlayer.isDead = true;
                            onPlayerDeath(attacker, targetPlayer);
                        }
                    }
                    
                    // Decrease penetration
                    bullet.penetration--;
                    if (bullet.penetration <= 0) {
                        room.bullets.delete(bullet.id);
                    }
                }
            });
        });
    }

    /**
     * Check bullet-bot collisions
     */
    checkBulletBotCollisions(room, playerManager, onBotKilled) {
        room.bullets.forEach((bullet) => {
            if (bullet.hitTargets.has('bot')) return; // Already hit a bot this frame
            
            room.bots.forEach((bot) => {
                if (bot.isDead) return;
                if (bullet.hitTargets.has(bot.id)) return; // Already hit this bot
                
                const distance = Math.sqrt(
                    Math.pow(bullet.x - bot.x, 2) + 
                    Math.pow(bullet.y - bot.y, 2)
                );
                
                if (distance < bot.size + bullet.size) {
                    // Hit bot
                    bullet.hitTargets.add(bot.id);
                    bullet.hitTargets.add('bot'); // Mark as hit any bot
                    
                    const oldBotHealth = bot.health;
                    bot.health = Math.max(0, bot.health - bullet.damage);
                    
                    // Check if bot died
                    if (bot.health <= 0 && oldBotHealth > 0) {
                        bot.health = 0;
                        bot.isDead = true;
                        bot.deathTime = 0;
                        
                        // Get attacker and call callback
                        const attacker = playerManager.getPlayer(bullet.ownerId);
                        if (attacker && attacker.roomStake === room.stake) {
                            onBotKilled(attacker, bot);
                        }
                    }
                    
                    // Decrease penetration
                    bullet.penetration--;
                    if (bullet.penetration <= 0) {
                        room.bullets.delete(bullet.id);
                    }
                }
            });
        });
    }
}

module.exports = CollisionManager;

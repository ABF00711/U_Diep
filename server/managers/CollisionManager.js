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
        const bulletsToRemove = [];
        
        room.bullets.forEach((bullet) => {
            // Skip if bullet has no penetration left
            if (bullet.penetration <= 0) {
                bulletsToRemove.push(bullet.id);
                return;
            }
            
            room.players.forEach((targetPlayer) => {
                // Skip if bullet ran out of penetration (might have been reduced by previous hit in this frame)
                if (bullet.penetration <= 0) return;
                
                if (targetPlayer.isDead || targetPlayer.id === bullet.ownerId) return;
                if (bullet.hitTargets.has(targetPlayer.id)) return; // Already hit this target this frame (prevents double-hit)
                
                const distance = Math.sqrt(
                    Math.pow(bullet.x - targetPlayer.x, 2) + 
                    Math.pow(bullet.y - targetPlayer.y, 2)
                );
                const tankSize = 30;
                
                if (distance < tankSize + bullet.size) {
                    // Hit! Mark target as hit (prevents hitting same target multiple times in one frame)
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
                    
                    // Decrease penetration (allows bullet to hit multiple targets if penetration > 1)
                    bullet.penetration--;
                    if (bullet.penetration <= 0) {
                        bulletsToRemove.push(bullet.id);
                    }
                }
            });
        });
        
        // Remove bullets that ran out of penetration
        bulletsToRemove.forEach(bulletId => {
            room.bullets.delete(bulletId);
        });
    }

    /**
     * Check tank-tank collisions (mutual body damage with push-back)
     */
    checkTankTankCollisions(room, playerManager, onPlayerDeath) {
        const currentTime = Date.now();
        const tankSize = 30;
        const players = Array.from(room.players.values()).filter(p => !p.isDead);
        
        // Check all pairs of players
        for (let i = 0; i < players.length; i++) {
            for (let j = i + 1; j < players.length; j++) {
                const player1 = players[i];
                const player2 = players[j];
                
                const distance = Math.sqrt(
                    Math.pow(player2.x - player1.x, 2) + 
                    Math.pow(player2.y - player1.y, 2)
                );
                
                if (distance < tankSize * 2) {
                    // Collision detected - apply push-back first
                    const dx = player2.x - player1.x;
                    const dy = player2.y - player1.y;
                    const dist = Math.max(distance, 0.1); // Avoid division by zero
                    const normalX = dx / dist;
                    const normalY = dy / dist;
                    
                    const minDistance = tankSize * 2;
                    const overlap = minDistance - distance;
                    
                    if (overlap > 0) {
                        // Apply immediate position correction to prevent overlap
                        const separationForce = overlap * 0.5; // Immediate separation
                        player1.x -= normalX * separationForce;
                        player1.y -= normalY * separationForce;
                        player2.x += normalX * separationForce;
                        player2.y += normalY * separationForce;
                        
                        // Apply squirt effect - add velocity to both tanks (like bot-tank collision)
                        // Use similar force as bot squirt for consistency
                        const squirtForce = 150; // Same as BOT_CONFIG.SQUIRT_FORCE
                        player1.vx -= normalX * squirtForce * (1/60); // Convert to per-frame velocity
                        player1.vy -= normalY * squirtForce * (1/60);
                        player2.vx += normalX * squirtForce * (1/60);
                        player2.vy += normalY * squirtForce * (1/60);
                        
                        // Clamp positions
                        const canvasWidth1 = player1.canvasWidth || 1920;
                        const canvasHeight1 = player1.canvasHeight || 1080;
                        const canvasWidth2 = player2.canvasWidth || 1920;
                        const canvasHeight2 = player2.canvasHeight || 1080;
                        
                        player1.x = Math.max(tankSize, Math.min(canvasWidth1 - tankSize, player1.x));
                        player1.y = Math.max(tankSize, Math.min(canvasHeight1 - tankSize, player1.y));
                        player2.x = Math.max(tankSize, Math.min(canvasWidth2 - tankSize, player2.x));
                        player2.y = Math.max(tankSize, Math.min(canvasHeight2 - tankSize, player2.y));
                    }
                    
                    // Apply mutual body damage (with cooldown)
                    // Player1 damages Player2
                    const bodyDamage1 = GameConfig.TANK.DEFAULT_BODY_DAMAGE + (player1.stats.bodyDamage || 0);
                    if (!player1.lastBodyDamageTime || !player1.lastBodyDamageTime[player2.id] || 
                        (currentTime - (player1.lastBodyDamageTime[player2.id] || 0)) >= GameConfig.TANK.BODY_DAMAGE_COOLDOWN) {
                        if (!player1.lastBodyDamageTime) player1.lastBodyDamageTime = {};
                        const oldHealth2 = player2.health;
                        player2.health = Math.max(0, player2.health - bodyDamage1);
                        player1.lastBodyDamageTime[player2.id] = currentTime;
                        
                        // Check if player2 died
                        if (player2.health <= 0 && oldHealth2 > 0) {
                            player2.health = 0;
                            player2.isDead = true;
                            onPlayerDeath(player1, player2);
                        }
                    }
                    
                    // Player2 damages Player1
                    const bodyDamage2 = GameConfig.TANK.DEFAULT_BODY_DAMAGE + (player2.stats.bodyDamage || 0);
                    if (!player2.lastBodyDamageTime || !player2.lastBodyDamageTime[player1.id] || 
                        (currentTime - (player2.lastBodyDamageTime[player1.id] || 0)) >= GameConfig.TANK.BODY_DAMAGE_COOLDOWN) {
                        if (!player2.lastBodyDamageTime) player2.lastBodyDamageTime = {};
                        const oldHealth1 = player1.health;
                        player1.health = Math.max(0, player1.health - bodyDamage2);
                        player2.lastBodyDamageTime[player1.id] = currentTime;
                        
                        // Check if player1 died
                        if (player1.health <= 0 && oldHealth1 > 0) {
                            player1.health = 0;
                            player1.isDead = true;
                            onPlayerDeath(player2, player1);
                        }
                    }
                }
            }
        }
    }

    /**
     * Check bullet-bot collisions
     * Note: This is called AFTER checkBulletPlayerCollisions, so bullets that hit players
     * and ran out of penetration will already be removed. Bullets with remaining penetration
     * can still hit bots.
     */
    checkBulletBotCollisions(room, playerManager, onBotKilled) {
        const bulletsToRemove = [];
        
        room.bullets.forEach((bullet) => {
            // Skip if bullet has no penetration left (might have been reduced by hitting a player)
            if (bullet.penetration <= 0) {
                bulletsToRemove.push(bullet.id);
                return;
            }
            
            room.bots.forEach((bot) => {
                // Skip if bullet ran out of penetration (might have been reduced by previous hit in this frame)
                if (bullet.penetration <= 0) return;
                
                if (bot.isDead) return;
                if (bullet.hitTargets.has(bot.id)) return; // Already hit this bot this frame (prevents double-hit)
                
                const distance = Math.sqrt(
                    Math.pow(bullet.x - bot.x, 2) + 
                    Math.pow(bullet.y - bot.y, 2)
                );
                
                if (distance < bot.size + bullet.size) {
                    // Hit bot - mark target as hit (prevents hitting same bot multiple times in one frame)
                    bullet.hitTargets.add(bot.id);
                    
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
                    
                    // Decrease penetration (allows bullet to hit multiple bots if penetration > 1)
                    bullet.penetration--;
                    if (bullet.penetration <= 0) {
                        bulletsToRemove.push(bullet.id);
                    }
                }
            });
        });
        
        // Remove bullets that ran out of penetration
        bulletsToRemove.forEach(bulletId => {
            room.bullets.delete(bulletId);
        });
    }
}

module.exports = CollisionManager;

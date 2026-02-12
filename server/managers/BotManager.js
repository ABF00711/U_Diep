// Bot Manager
// Handles bot spawning, updates, and movement

const GameConfig = require('../../shared/Config.js');
const BOT_CONFIG = GameConfig.BOT;

class BotManager {
    /**
     * Spawn bots for a room
     */
    spawnBotsForRoom(room, count) {
        const spawnWidth = 1920; // Default canvas width
        const spawnHeight = 1080; // Default canvas height
        const margin = 50;
        
        for (let i = 0; i < count; i++) {
            const type = Math.random() < BOT_CONFIG.RECTANGLE_SPAWN_CHANCE ? 'rectangle' : 'triangle';
            const botConfig = type === 'triangle' ? BOT_CONFIG.TRIANGLE : BOT_CONFIG.RECTANGLE;
            
            const bot = {
                id: `bot_${room.stake}_${Date.now()}_${Math.random()}`,
                type: type,
                x: margin + Math.random() * (spawnWidth - margin * 2),
                y: margin + Math.random() * (spawnHeight - margin * 2),
                health: botConfig.HEALTH,
                maxHealth: botConfig.MAX_HEALTH,
                bodyDamage: botConfig.BODY_DAMAGE,
                size: botConfig.SIZE,
                xpReward: botConfig.XP_REWARD,
                speed: BOT_CONFIG.DEFAULT_SPEED,
                vx: 0,
                vy: 0,
                moveDirection: Math.random() * Math.PI * 2,
                directionChangeTime: 0,
                directionChangeInterval: BOT_CONFIG.DIRECTION_CHANGE_MIN + 
                    Math.random() * (BOT_CONFIG.DIRECTION_CHANGE_MAX - BOT_CONFIG.DIRECTION_CHANGE_MIN),
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.05,
                isDead: false,
                deathTime: 0,
                respawnTime: BOT_CONFIG.DEFAULT_RESPAWN_TIME,
                damageCooldown: BOT_CONFIG.DEFAULT_DAMAGE_COOLDOWN,
                lastDamageTime: {} // Map<playerId, timestamp>
            };
            
            room.bots.set(bot.id, bot);
        }
        
        console.log(`Spawned ${count} bots for room $${room.stake}`);
    }

    /**
     * Update all bots in a room
     */
    updateBots(room, deltaTime) {
        // Use average canvas size from players in room, or default
        let canvasWidth = 1920;
        let canvasHeight = 1080;
        if (room.players.size > 0) {
            const firstPlayer = Array.from(room.players.values())[0];
            canvasWidth = firstPlayer.canvasWidth || 1920;
            canvasHeight = firstPlayer.canvasHeight || 1080;
        }
        
        const margin = 50;
        const minX = margin;
        const maxX = canvasWidth - margin;
        const minY = margin;
        const maxY = canvasHeight - margin;
        
        room.bots.forEach((bot) => {
            if (bot.isDead) {
                // Handle respawn
                bot.deathTime += deltaTime * 1000; // Convert to milliseconds
                if (bot.deathTime >= bot.respawnTime) {
                    // Respawn bot
                    bot.x = minX + Math.random() * (maxX - minX);
                    bot.y = minY + Math.random() * (maxY - minY);
                    bot.health = bot.maxHealth;
                    bot.isDead = false;
                    bot.deathTime = 0;
                    bot.moveDirection = Math.random() * Math.PI * 2;
                    bot.rotation = Math.random() * Math.PI * 2;
                    bot.rotationSpeed = (Math.random() - 0.5) * 0.05;
                    bot.vx = 0;
                    bot.vy = 0;
                }
                return;
            }
            
            // Update rotation
            bot.rotation += bot.rotationSpeed * deltaTime * 60;
            
            // Update movement direction periodically
            bot.directionChangeTime += deltaTime;
            if (bot.directionChangeTime >= bot.directionChangeInterval) {
                bot.moveDirection = Math.random() * Math.PI * 2;
                bot.directionChangeTime = 0;
                bot.directionChangeInterval = BOT_CONFIG.DIRECTION_CHANGE_MIN + 
                    Math.random() * (BOT_CONFIG.DIRECTION_CHANGE_MAX - BOT_CONFIG.DIRECTION_CHANGE_MIN);
            }
            
            // Move bot (combine random movement with collision velocity)
            const randomVx = Math.cos(bot.moveDirection) * bot.speed;
            const randomVy = Math.sin(bot.moveDirection) * bot.speed;
            
            // Apply dampening to collision velocity
            bot.vx = bot.vx * BOT_CONFIG.SQUIRT_DAMPENING + randomVx * (1 - BOT_CONFIG.SQUIRT_DAMPENING);
            bot.vy = bot.vy * BOT_CONFIG.SQUIRT_DAMPENING + randomVy * (1 - BOT_CONFIG.SQUIRT_DAMPENING);
            
            // Update position
            bot.x += bot.vx * deltaTime;
            bot.y += bot.vy * deltaTime;
            
            // Clamp to bounds
            bot.x = Math.max(bot.size, Math.min(maxX - bot.size, bot.x));
            bot.y = Math.max(bot.size, Math.min(maxY - bot.size, bot.y));
            
            // Bounce off boundaries
            if (bot.x <= bot.size || bot.x >= maxX - bot.size) {
                bot.vx *= -0.5;
            }
            if (bot.y <= bot.size || bot.y >= maxY - bot.size) {
                bot.vy *= -0.5;
            }
        });
    }
}

module.exports = BotManager;

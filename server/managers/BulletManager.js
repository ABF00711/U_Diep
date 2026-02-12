// Bullet Manager
// Handles bullet creation and updates

const GameConfig = require('../../shared/Config.js');

class BulletManager {
    /**
     * Create a bullet from player stats
     */
    createBullet(player, angle) {
        const bulletSpeed = GameConfig.BULLET.BASE_SPEED + (player.stats.bulletSpeed * GameConfig.BULLET.SPEED_MULTIPLIER);
        const bulletDamage = GameConfig.BULLET.BASE_DAMAGE + (player.stats.bulletDamage * GameConfig.BULLET.DAMAGE_MULTIPLIER);
        const bulletSize = GameConfig.BULLET.BASE_SIZE + (player.stats.bulletSize * GameConfig.BULLET.SIZE_MULTIPLIER);
        const penetration = GameConfig.BULLET.DEFAULT_PENETRATION + player.stats.bulletPenetration;

        return {
            id: `bullet_${player.id}_${Date.now()}_${Math.random()}`,
            x: player.x + Math.cos(angle) * 35, // Spawn in front of tank
            y: player.y + Math.sin(angle) * 35,
            angle: angle,
            speed: bulletSpeed,
            damage: bulletDamage,
            size: bulletSize,
            lifetime: GameConfig.BULLET.DEFAULT_LIFETIME,
            age: 0,
            penetration: penetration,
            hitTargets: new Set(), // Track targets hit this frame (for multi-hit penetration)
            ownerId: player.id,
            createdAt: Date.now()
        };
    }

    /**
     * Update bullets in a room
     */
    updateBullets(room, deltaTime) {
        const bulletsToRemove = [];
        const maxX = 5000; // World bounds
        const maxY = 5000;
        
        room.bullets.forEach((bullet, bulletId) => {
            // Update bullet position
            bullet.x += Math.cos(bullet.angle) * bullet.speed * deltaTime;
            bullet.y += Math.sin(bullet.angle) * bullet.speed * deltaTime;
            bullet.age += deltaTime * 1000; // Convert to milliseconds
            
            // Clear hit targets from previous frame
            bullet.hitTargets.clear();
            
            // Check if bullet expired or out of bounds
            if (bullet.age >= bullet.lifetime || 
                bullet.x < -bullet.size || bullet.x > maxX + bullet.size ||
                bullet.y < -bullet.size || bullet.y > maxY + bullet.size) {
                bulletsToRemove.push(bulletId);
            }
        });
        
        // Remove expired bullets
        bulletsToRemove.forEach(bulletId => {
            room.bullets.delete(bulletId);
        });
    }
}

module.exports = BulletManager;

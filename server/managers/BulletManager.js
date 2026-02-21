// Bullet Manager
// Handles bullet creation and updates

const GameConfig = require('../../shared/Config.js');

class BulletManager {
    /**
     * Get tank type config (default to basic). Case-insensitive lookup.
     */
    getTankTypeConfig(tankType) {
        const types = GameConfig.TANK_TYPES || {};
        if (!tankType || typeof tankType !== 'string') return types.basic || {};
        const key = tankType.toLowerCase();
        return types[key] || types.basic || {};
    }

    /**
     * Create bullet(s) from player stats. Returns array (Gun fires 2, others fire 1).
     */
    createBullets(player, angle) {
        const tankType = (player.tankType || 'basic').toString().toLowerCase();
        const typeConfig = this.getTankTypeConfig(tankType);
        const spawnDist = (typeConfig.size || 30) + (typeConfig.barrelLength || 25);

        let baseSpeed = GameConfig.BULLET.BASE_SPEED + (player.stats.bulletSpeed * GameConfig.BULLET.SPEED_MULTIPLIER);
        let baseDamage = GameConfig.BULLET.BASE_DAMAGE + (player.stats.bulletDamage * GameConfig.BULLET.DAMAGE_MULTIPLIER);
        const bulletSize = GameConfig.BULLET.BASE_SIZE + (player.stats.bulletSize * GameConfig.BULLET.SIZE_MULTIPLIER);
        let penetration = GameConfig.BULLET.DEFAULT_PENETRATION + (player.stats.bulletPenetration || 0);
        let lifetime = GameConfig.BULLET.DEFAULT_LIFETIME;

        // Apply tank type multipliers
        baseSpeed *= typeConfig.bulletSpeedMultiplier || 1;
        baseDamage *= typeConfig.bulletDamageMultiplier || 1;
        lifetime *= typeConfig.bulletLifetimeMultiplier || 1;

        // Gun fires 2 bullets; others use config or default to 1
        const bulletsPerShot = (tankType === 'gun' ? 2 : (typeConfig.bulletsPerShot || 1));
        const bulletSpreadDeg = (typeConfig.bulletSpreadDeg || 0) * (Math.PI / 180);
        const bullets = [];

        for (let i = 0; i < bulletsPerShot; i++) {
            const spreadOffset = bulletsPerShot === 1 ? 0 : bulletSpreadDeg * (i - 0.5) * 2;
            const bulletAngle = angle + spreadOffset;

            bullets.push({
                id: `bullet_${player.id}_${Date.now()}_${Math.random()}_${i}`,
                x: player.x + Math.cos(bulletAngle) * spawnDist,
                y: player.y + Math.sin(bulletAngle) * spawnDist,
                angle: bulletAngle,
                speed: baseSpeed,
                damage: baseDamage,
                size: bulletSize,
                lifetime: lifetime,
                age: 0,
                penetration: penetration,
                hitTargets: new Set(),
                ownerId: player.id,
                createdAt: Date.now()
            });
        }
        return bullets;
    }

    /**
     * Update bullets in a room
     */
    updateBullets(room, deltaTime) {
        const bulletsToRemove = [];
        const maxX = 5000; // World bounds
        const maxY = 5000;
        
        room.bullets.forEach((bullet, bulletId) => {
            // Skip bullets that have no penetration left (they should have been removed, but check anyway)
            if (bullet.penetration <= 0) {
                bulletsToRemove.push(bulletId);
                return;
            }
            
            // Update bullet position
            bullet.x += Math.cos(bullet.angle) * bullet.speed * deltaTime;
            bullet.y += Math.sin(bullet.angle) * bullet.speed * deltaTime;
            bullet.age += deltaTime * 1000; // Convert to milliseconds
            
            // Clear hit targets from previous frame (allows bullet to hit same target in different frames if penetration allows)
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

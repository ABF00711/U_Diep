// Bullet Manager
// Handles bullet creation and updates

const GameConfig = require('../../shared/Config.js');

function getTankTier(level) {
    return GameConfig.getTankTier ? GameConfig.getTankTier(level) : 0;
}

function getResolvedConfig(tankType, level) {
    const types = GameConfig.TANK_TYPES || {};
    const cfg = types[tankType || 'basic'] || types.basic || {};
    const tier = level != null ? getTankTier(level) : 0;
    const resolve = (v) => typeof v === 'function' ? v(tier) : (v ?? 1);
    return {
        size: cfg.size ?? 30,
        barrelLength: cfg.barrelLength ?? 25,
        bulletSpeedMultiplier: resolve(cfg.bulletSpeedMultiplier),
        bulletDamageMultiplier: resolve(cfg.bulletDamageMultiplier),
        bulletLifetimeMultiplier: resolve(cfg.bulletLifetimeMultiplier),
        bulletSizeMultiplier: resolve(cfg.bulletSizeMultiplier),
        penetrationMultiplier: resolve(cfg.penetrationMultiplier),
        cannonsCount: typeof cfg.cannonsCount === 'function' ? cfg.cannonsCount(tier) : (cfg.cannonsCount ?? 1)
    };
}

class BulletManager {
    /**
     * Create bullet(s) from player stats. Gun has multiple cannons by level tier.
     */
    createBullets(player, angle) {
        const tankType = (player.tankType || 'basic').toString().toLowerCase();
        const level = player.level || 1;
        const cfg = getResolvedConfig(tankType, level);
        const spawnDist = (cfg.size || 30) + (cfg.barrelLength || 25);

        let baseSpeed = GameConfig.BULLET.BASE_SPEED + ((player.stats.bulletSpeed || 0) * GameConfig.BULLET.SPEED_MULTIPLIER);
        let baseDamage = GameConfig.BULLET.BASE_DAMAGE + ((player.stats.bulletDamage || 0) * GameConfig.BULLET.DAMAGE_MULTIPLIER);
        let bulletSize = GameConfig.BULLET.BASE_SIZE + ((player.stats.bulletSize || 0) * GameConfig.BULLET.SIZE_MULTIPLIER);
        let penetration = GameConfig.BULLET.DEFAULT_PENETRATION + (player.stats.bulletPenetration || 0);
        let lifetime = GameConfig.BULLET.DEFAULT_LIFETIME;

        baseSpeed *= cfg.bulletSpeedMultiplier || 1;
        baseDamage *= cfg.bulletDamageMultiplier || 1;
        bulletSize *= cfg.bulletSizeMultiplier || 1;
        penetration = Math.max(0, Math.floor(penetration * (cfg.penetrationMultiplier || 1)));
        lifetime *= cfg.bulletLifetimeMultiplier || 1;

        const bulletsPerShot = cfg.cannonsCount || 1;
        const bullets = [];

        for (let i = 0; i < bulletsPerShot; i++) {
            let bulletAngle;
            if (bulletsPerShot === 1) {
                bulletAngle = angle;
            } else if (bulletsPerShot === 2 || bulletsPerShot === 3) {
                // 2–3 cannons: all fire forward (mouse aim) in a cone
                const spreadRad = (50 * (Math.PI / 180)) / Math.max(1, bulletsPerShot - 1);
                const spreadOffset = (i - (bulletsPerShot - 1) / 2) * spreadRad;
                bulletAngle = angle + spreadOffset;
            } else {
                // 4+ cannons: each fires in its own direction (front, back, sides)
                bulletAngle = angle + (2 * Math.PI * i) / bulletsPerShot;
            }

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
        const worldWidth = GameConfig.GAME.WORLD_WIDTH || 5000;
        const worldHeight = GameConfig.GAME.WORLD_HEIGHT || 5000;
        
        room.bullets.forEach((bullet, bulletId) => {
            if (bullet.penetration <= 0) {
                bulletsToRemove.push(bulletId);
                return;
            }
            
            bullet.x += Math.cos(bullet.angle) * bullet.speed * deltaTime;
            bullet.y += Math.sin(bullet.angle) * bullet.speed * deltaTime;
            bullet.age += deltaTime * 1000;
            bullet.hitTargets.clear();
            
            if (bullet.age >= bullet.lifetime || 
                bullet.x < -bullet.size || bullet.x > worldWidth + bullet.size ||
                bullet.y < -bullet.size || bullet.y > worldHeight + bullet.size) {
                bulletsToRemove.push(bulletId);
            }
        });
        
        bulletsToRemove.forEach(bulletId => room.bullets.delete(bulletId));
        return bulletsToRemove;
    }
}

module.exports = BulletManager;

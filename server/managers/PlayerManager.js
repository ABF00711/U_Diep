// Player Manager
// Handles player creation, updates, stats, and health regeneration

const GameConfig = require('../../shared/Config.js');

class PlayerManager {
    constructor() {
        this.players = new Map(); // Map<socketId, Player>
    }

    /**
     * Create a new player
     */
    createPlayer(socketId, playerName, balance, x, y, canvasWidth, canvasHeight) {
        const player = {
            id: socketId,
            name: playerName || `Player${socketId.slice(0, 6)}`,
            socket: null, // Will be set by caller
            roomStake: null,
            x: x,
            y: y,
            vx: 0, // Velocity for squirt effect
            vy: 0, // Velocity for squirt effect
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,
            angle: 0,
            level: 1,
            health: GameConfig.TANK.DEFAULT_HEALTH,
            maxHealth: GameConfig.TANK.DEFAULT_MAX_HEALTH,
            xp: 0,
            xpToNextLevel: GameConfig.XP.BASE_XP_TO_NEXT_LEVEL,
            lastHealthUpdate: Date.now(),
            stats: {
                maxHealth: 0,
                reload: 0,
                movementSpeed: 0,
                bulletSpeed: 0,
                bulletDamage: 0,
                bulletPenetration: 0,
                bulletSize: 0,
                bodyDamage: 0,
                healthRegen: 0
            },
            statPoints: 0,
            pendingStatAllocation: false,
            lastShotTime: 0,
            lastBodyDamageTime: {}, // Track last body damage time per target (targetId -> timestamp)
            isDead: false,
            balance: balance || GameConfig.ECONOMY.INITIAL_BALANCE
        };

        this.players.set(socketId, player);
        return player;
    }

    /**
     * Get a player by socket ID
     */
    getPlayer(socketId) {
        return this.players.get(socketId);
    }

    /**
     * Remove a player
     */
    removePlayer(socketId) {
        this.players.delete(socketId);
    }

    /**
     * Update player health regeneration
     */
    updateHealthRegeneration(deltaTime) {
        this.players.forEach((player) => {
            if (player.isDead || !player.roomStake) return;
            
            const healthRegen = player.stats.healthRegen || 0;
            if (healthRegen > 0 && player.health < player.maxHealth) {
                const regenAmount = healthRegen * deltaTime;
                player.health = Math.min(player.maxHealth, player.health + regenAmount);
            }
        });
    }

    /**
     * Apply stat changes to a player
     */
    applyStatChanges(player) {
        // Update max health based on stat points
        player.maxHealth = GameConfig.TANK.DEFAULT_MAX_HEALTH + (player.stats.maxHealth * 5);
        if (player.health > player.maxHealth) {
            player.health = player.maxHealth;
        }
        // Other stats are applied when creating bullets or calculating movement
    }

    /**
     * Level up a player
     */
    levelUp(player) {
        player.level++;
        player.statPoints++;
        player.pendingStatAllocation = true;
        player.xpToNextLevel = Math.floor(player.xpToNextLevel * GameConfig.XP.XP_MULTIPLIER_PER_LEVEL);
    }

    /**
     * Add XP to a player and handle level ups
     */
    addXP(player, xpAmount) {
        player.xp += xpAmount;
        while (player.xp >= player.xpToNextLevel) {
            player.xp -= player.xpToNextLevel;
            this.levelUp(player);
        }
    }

    /**
     * Get all players
     */
    getAllPlayers() {
        return this.players;
    }
}

module.exports = PlayerManager;

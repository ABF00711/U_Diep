// Player Manager
// Handles player creation, updates, stats, and health regeneration

const GameConfig = require('../../shared/Config.js');

class PlayerManager {
    constructor() {
        this.players = new Map(); // Map<socketId, Player>
    }

    /**
     * Default stats object (all zeros).
     */
    getDefaultStats() {
        return {
            maxHealth: 0, reload: 0, movementSpeed: 0, bulletSpeed: 0,
            bulletDamage: 0, bulletPenetration: 0, bulletSize: 0, bodyDamage: 0, healthRegen: 0
        };
    }

    /**
     * Get XP required for next level at a given level (for death penalty reset).
     */
    getXpToNextLevelForLevel(level) {
        let x = GameConfig.XP.BASE_XP_TO_NEXT_LEVEL;
        for (let i = 1; i < level; i++) {
            x = Math.floor(x * GameConfig.XP.XP_MULTIPLIER_PER_LEVEL);
        }
        return x;
    }

    getMaxHealthMultiplier(tankType, level) {
        const types = GameConfig.TANK_TYPES || {};
        const cfg = types[tankType || 'basic'] || types.basic || {};
        const tier = GameConfig.getTankTier ? GameConfig.getTankTier(level || 1) : 0;
        const v = cfg.maxHealthMultiplier;
        return typeof v === 'function' ? v(tier) : (v ?? 1);
    }

    /**
     * Apply death penalty: level halved, stats reset, player must re-allocate.
     */
    applyDeathPenalty(player) {
        const newLevel = Math.max(1, Math.floor(player.level / 2));
        player.level = newLevel;
        player.xp = 0;
        player.xpToNextLevel = this.getXpToNextLevelForLevel(newLevel);
        player.stats = { ...this.getDefaultStats() };
        player.statPoints = Math.max(0, newLevel - 1);
        player.pendingStatAllocation = player.statPoints > 0;
        const maxHealthMult = this.getMaxHealthMultiplier(player.tankType, newLevel);
        const baseMax = GameConfig.TANK.DEFAULT_MAX_HEALTH * maxHealthMult;
        player.maxHealth = baseMax;
        player.health = player.maxHealth;
        this.applyStatChanges(player);
    }

    /**
     * Create a new player
     * @param {string} [tankType] - Tank type (basic, sniper, gun, heavy) - always basic on join
     */
    createPlayer(socketId, playerName, balance, x, y, canvasWidth, canvasHeight, userId = null, gameStats = null, tankType = 'basic') {
        const level = gameStats && gameStats.level != null ? gameStats.level : 1;
        const maxHealthMult = this.getMaxHealthMultiplier(tankType, level);
        const defaultStats = this.getDefaultStats();
        const stats = gameStats && gameStats.stats
            ? { ...defaultStats, ...gameStats.stats }
            : { ...defaultStats };
        const xp = gameStats && gameStats.xp != null ? gameStats.xp : 0;
        const xpToNextLevel = gameStats && gameStats.xpToNextLevel != null ? gameStats.xpToNextLevel : GameConfig.XP.BASE_XP_TO_NEXT_LEVEL;
        const totalAllocated = Object.values(stats).reduce((s, v) => s + (Number(v) || 0), 0);
        const statPoints = Math.max(0, (level - 1) - totalAllocated);

        const baseMaxHealth = GameConfig.TANK.DEFAULT_MAX_HEALTH * maxHealthMult;
        const player = {
            id: socketId,
            userId: userId,
            tankType: tankType,
            name: playerName || `Player${socketId.slice(0, 6)}`,
            socket: null,
            roomStake: null,
            x: x,
            y: y,
            vx: 0,
            vy: 0,
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,
            angle: 0,
            level,
            health: baseMaxHealth,
            maxHealth: baseMaxHealth,
            xp,
            xpToNextLevel,
            lastHealthUpdate: Date.now(),
            stats,
            statPoints,
            pendingStatAllocation: statPoints > 0,
            lastShotTime: 0,
            lastBodyDamageTime: {},
            isDead: false,
            balance: balance || GameConfig.ECONOMY.INITIAL_BALANCE
        };
        this.applyStatChanges(player, 'maxHealth', tankType);
        if (player.health > player.maxHealth) player.health = player.maxHealth;

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
     * Apply stat changes to a player (only for stats that affect derived values on the server).
     * @param {object} player - Player object
     * @param {string} [statName] - Which stat was just allocated; omit to recompute from current stats (e.g. on rejoin)
     * @param {string} [tankType] - Tank type for maxHealth multiplier
     */
    applyStatChanges(player, statName, tankType) {
        if (statName === undefined || statName === null || statName === 'maxHealth') {
            const maxHealthMult = this.getMaxHealthMultiplier(tankType || player.tankType, player.level);
            const base = GameConfig.TANK.DEFAULT_MAX_HEALTH * maxHealthMult;
            const points = player.stats.maxHealth || 0;
            const currentHealthPercentage = player.maxHealth > 0 ? player.health / player.maxHealth : 1;
            player.maxHealth = base + (points * 50);
            player.health = player.maxHealth * currentHealthPercentage;
        }
        // Other stats (reload, movementSpeed, bulletDamage, etc.) are applied when creating bullets or calculating movement
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

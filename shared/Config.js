// Game Configuration Constants
// Shared configuration for both server and client
// Centralized configuration for easy maintenance and scalability

const GameConfig = {
    // Economy Settings
    ECONOMY: {
        INITIAL_BALANCE: 100,
        KILL_BUTTON_FEE_PERCENT: 0.1,      // 10% fee
        KILL_BUTTON_REFUND_PERCENT: 0.9,   // 90% refund
        KILL_REWARD_PERCENT: 0.9,          // 90% of victim's stake
        PLATFORM_FEE_PERCENT: 0.1,         // 10% platform fee
        DEFAULT_VICTIM_STAKE: 5,           // For testing (will be replaced with actual stake)
        ROOM_STAKES: [1, 5, 10]            // Available room stake amounts
    },

    // Tank level tiers: 5, 10, 15, 20, 25, 30 (tier 0 = level < 5, tier 1 at 5, etc.)
    TANK_LEVEL_TIERS: [5, 10, 15, 20, 25, 30],
    getTankTier(level) {
        const tiers = this.TANK_LEVEL_TIERS || [5, 10, 15, 20, 25, 30];
        let tier = 0;
        for (let i = 0; i < tiers.length; i++) {
            if (level >= tiers[i]) tier = i + 1;
        }
        return tier;
    },

    // Tank Types - features scale with level tier. All start Basic; unlock others at level 5.
    TANK_TYPES: {
        basic: {
            name: 'Basic',
            description: 'Balanced tank with standard stats',
            size: 30,
            barrelLength: 25,
            barrelWidth: 14,
            color: '#4a90e2',
            cannonsCount: 1,
            // All multipliers 1 (default)
            viewRangeMultiplier: 1,
            movementSpeedMultiplier: 1,
            bulletSpeedMultiplier: 1,
            bulletDamageMultiplier: 1,
            bulletLifetimeMultiplier: 1,
            bulletSizeMultiplier: 1,
            reloadMultiplier: 1,
            penetrationMultiplier: 1,
            bodyDamageMultiplier: 1,
            maxHealthMultiplier: 1
        },
        sniper: {
            name: 'Sniper',
            description: 'More view, range, bullet speed & damage. Less movement, reload, penetration.',
            size: 28,
            barrelLength: 40,
            barrelWidth: 10,
            color: '#5dade2',
            cannonsCount: 1,
            // Per-tier modifiers (tier 0-6). Base + (tier * step)
            viewRangeMultiplier: (tier) => 1 + tier * 0.06,      // 1.06 to 1.36 (reduced from 0.11)
            movementSpeedMultiplier: (tier) => Math.max(0.5, 1 - tier * 0.08),  // 0.92 to 0.52
            bulletSpeedMultiplier: (tier) => 1 + tier * 0.1,     // 1.1 to 1.6
            bulletDamageMultiplier: (tier) => 1 + tier * 0.08,   // 1.08 to 1.48
            bulletLifetimeMultiplier: (tier) => 1 + tier * 0.15,  // 1.15 to 1.9
            bulletSizeMultiplier: 1,
            reloadMultiplier: (tier) => 1 + tier * 0.1,          // slower: 1.1 to 1.6
            penetrationMultiplier: (tier) => Math.max(0.3, 1 - tier * 0.12),  // 0.88 to 0.28
            bodyDamageMultiplier: 1,
            maxHealthMultiplier: 1
        },
        gun: {
            name: 'Gun',
            description: 'Multi-cannon. Less view, range, damage, reload. Cannons by level: 5→2, 10→3, 15→4, 20→5, 25→6, 30→8.',
            size: 28,
            barrelLength: 14,
            barrelWidth: 10,
            color: '#e74c3c',
            cannonsCount: (tier) => [2, 3, 4, 5, 6, 8][Math.min(tier, 5)] || 2,
            viewRangeMultiplier: (tier) => Math.max(0.6, 1 - tier * 0.06),   // 0.94 to 0.64
            movementSpeedMultiplier: 1,
            bulletSpeedMultiplier: 1,
            bulletDamageMultiplier: (tier) => Math.max(0.5, 1 - tier * 0.08),  // 0.92 to 0.52
            bulletLifetimeMultiplier: (tier) => Math.max(0.5, 1 - tier * 0.08),  // range
            bulletSizeMultiplier: 1,
            reloadMultiplier: (tier) => 0.6 + tier * 0.05,        // faster: 0.65 to 0.9
            penetrationMultiplier: 1,
            bodyDamageMultiplier: 1,
            maxHealthMultiplier: 1
        },
        heavy: {
            name: 'Heavy',
            description: 'Huge bullets, high damage. Less movement, reload.',
            size: 32,
            barrelLength: 18,
            barrelWidth: 12,
            color: '#2ecc71',
            cannonsCount: 1,
            viewRangeMultiplier: 1,
            movementSpeedMultiplier: (tier) => Math.max(0.4, 1 - tier * 0.1),   // 0.9 to 0.4
            bulletSpeedMultiplier: 1,
            bulletDamageMultiplier: (tier) => 1 + tier * 0.25,     // 1.25 to 2.5 (higher damage)
            bulletLifetimeMultiplier: (tier) => 1 + tier * 0.12,   // 1.12 to 1.72 (increased range)
            bulletSizeMultiplier: (tier) => 1 + tier * 0.22,       // 1.22 to 2.32 (bigger bullets)
            reloadMultiplier: (tier) => 1 + tier * 0.08,           // 1.08 to 1.48 (slightly faster than before)
            penetrationMultiplier: 1,
            bodyDamageMultiplier: (tier) => 1 + tier * 0.18,      // 1.18 to 2.08
            maxHealthMultiplier: (tier) => 1 + tier * 0.2          // 1.2 to 2.2 (scales with level)
        }
    },

    // Tank Settings (base values - tank types apply multipliers)
    TANK: {
        DEFAULT_SIZE: 30,
        DEFAULT_BARREL_LENGTH: 25,
        DEFAULT_BARREL_WIDTH: 14,
        DEFAULT_SPEED: 200,
        DEFAULT_HEALTH: 100,
        DEFAULT_MAX_HEALTH: 100,
        HEALTH_MULTIPLIER: 0.2,            // Stat multiplier
        DEFAULT_BODY_DAMAGE: 3,            // Base body damage (added to stat value)
        BASE_RELOAD_TIME: 1000,            // milliseconds
        BODY_DAMAGE_COOLDOWN: 1000,        // milliseconds
        MOVEMENT_SPEED_MULTIPLIER: 20,    // Stat multiplier
        RELOAD_MULTIPLIER: 100,            // Stat multiplier (milliseconds per point - reduces reload time)
        MAX_STAT_POINTS: 7,                // Maximum points per stat
        COLLISION_PUSH_FORCE: 0.5          // Push-back force multiplier (0-1, higher = stronger push)
    },

    // Bullet Settings
    BULLET: {
        DEFAULT_SIZE: 7,
        BASE_SIZE: 6,
        DEFAULT_DAMAGE: 10,
        BASE_DAMAGE: 10,
        BASE_SPEED: 300,
        SPEED_MULTIPLIER: 50,              // Per stat point
        DAMAGE_MULTIPLIER: 2,              // Per stat point
        SIZE_MULTIPLIER: 0.5,              // Per stat point
        DEFAULT_LIFETIME: 1000,            // milliseconds (1 second) - acts as range (higher speed = further distance)
        DEFAULT_PENETRATION: 1
    },

    // Bot Settings
    BOT: {
        RECTANGLE: {
            HEALTH: 75,
            MAX_HEALTH: 75,
            BODY_DAMAGE: 8,
            SIZE: 20,
            XP_REWARD: 50,
            SPRITE_NAME: 'SharpRectangle'
        },
        TRIANGLE: {
            HEALTH: 150,
            MAX_HEALTH: 150,
            BODY_DAMAGE: 15,
            SIZE: 25,
            XP_REWARD: 100,
            SPRITE_NAME: 'TrianglePellet'
        },
        DEFAULT_SPEED: 30,
        DEFAULT_RESPAWN_TIME: 30000,       // 30 seconds in milliseconds
        DEFAULT_DAMAGE_COOLDOWN: 1000,     // 1 second in milliseconds
        DIRECTION_CHANGE_MIN: 2,           // seconds
        DIRECTION_CHANGE_MAX: 5,           // seconds
        RECTANGLE_SPAWN_CHANCE: 0.7,       // 70% chance to spawn rectangle
        SQUIRT_FORCE: 150,                 // Force applied when tank pushes pellet (pixels/second)
        SQUIRT_DAMPENING: 0.95             // Velocity dampening per frame (0-1, lower = more friction)
    },

    // Game Settings
    GAME: {
        DEFAULT_BOT_COUNT: 100,
        DEFAULT_ENEMY_TANK_COUNT: 5,
        MAX_DELTA_TIME: 0.1,               // Cap deltaTime to prevent large jumps
        // Fixed viewport (prevents zoom cheating - same view regardless of browser zoom/settings)
        VIEW_WIDTH: 1920,
        VIEW_HEIGHT: 1080,
        CANVAS_MIN_WIDTH: 800,
        CANVAS_MIN_HEIGHT: 600,
        SPAWN_MARGIN: 50,                  // Margin from edges when spawning
        GRID_SIZE: 50,                     // Grid cell size in pixels (like diep.io)
        WORLD_WIDTH: 5000,                 // World width in pixels (larger than viewport)
        WORLD_HEIGHT: 5000,                // World height in pixels (larger than viewport)
        CAMERA_SMOOTH_FACTOR: 0.15,        // Camera smoothing factor (0-1, higher = faster follow, like diep.io)
        CAMERA_DEAD_ZONE: 50,              // Dead zone radius in pixels (camera only moves if player is this far from center)
        PLAYER_INTERPOLATION_SPEED: 0.2    // Player position interpolation speed (0-1, higher = faster, smoother movement)
    },

    // Colors
    COLORS: {
        PLAYER_TANK: '#4a90e2',
        ENEMY_TANK: '#e24a4a',
        PLAYER_BULLET: '#4a90e2',
        ENEMY_BULLET: '#e24a4a',
        BOT_TRIANGLE: '#ED8A7D',            // Reddish-orange triangle fill
        BOT_TRIANGLE_BORDER: '#BD6F6F',     // Darker red triangle border
        BOT_RECTANGLE: '#FFD700',           // Golden yellow square fill
        BOT_RECTANGLE_BORDER: '#D4AF37',    // Darker gold square border
        ARENA_BACKGROUND: '#16213e',
        ARENA_BORDER: '#0f3460',
        GRID_LINE: '#1a2a3a',               // Grid line color (subtle, darker than background)
        HEALTH_BAR_BG: '#333',
        HEALTH_BAR_HIGH: '#4caf50',         // > 50%
        HEALTH_BAR_MEDIUM: '#ff9800',      // 25-50%
        HEALTH_BAR_LOW: '#f44336'          // < 25%
    },

    // UI Settings
    UI: {
        LOADING_SCREEN_DELAY: 1000,        // milliseconds
        MESSAGE_DURATION: 2000,            // milliseconds
        MESSAGE_DURATION_LONG: 3000        // milliseconds
    },

    // XP Settings
    XP: {
        BASE_XP_TO_NEXT_LEVEL: 100,
        XP_MULTIPLIER_PER_LEVEL: 1.2,      // Increase XP needed by 20% per level
        BASE_KILL_XP: 50,                  // Base XP for killing an enemy tank
        LEVEL_DIFF_MULTIPLIER: 100,         // Additional XP per level difference (if enemy is higher)
        MIN_KILL_XP: 10,                   // Minimum XP for killing an enemy (even if much lower level)
        MAX_KILL_XP: 200                   // Maximum XP from a single kill
    }
};

// Export for Node.js (server)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameConfig;
}

// Game Configuration Constants
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

    // Tank Settings
    TANK: {
        DEFAULT_SIZE: 30,
        DEFAULT_BARREL_LENGTH: 25,
        DEFAULT_BARREL_WIDTH: 14,
        DEFAULT_SPEED: 200,
        DEFAULT_HEALTH: 100,
        DEFAULT_MAX_HEALTH: 100,
        DEFAULT_BODY_DAMAGE: 3,
        BASE_RELOAD_TIME: 1000,            // milliseconds
        BODY_DAMAGE_COOLDOWN: 1000,        // milliseconds
        MOVEMENT_SPEED_MULTIPLIER: 0.1,    // Stat multiplier
        RELOAD_MULTIPLIER: 0.1             // Stat multiplier
    },

    // Bullet Settings
    BULLET: {
        DEFAULT_SIZE: 7,
        BASE_SIZE: 6,
        DEFAULT_DAMAGE: 10,
        BASE_DAMAGE: 10,
        BASE_SPEED: 500,
        SPEED_MULTIPLIER: 50,              // Per stat point
        DAMAGE_MULTIPLIER: 2,              // Per stat point
        SIZE_MULTIPLIER: 0.5,              // Per stat point
        DEFAULT_LIFETIME: 5000,            // milliseconds
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
            SPRITE_NAME: 'SharpTriangle'
        },
        DEFAULT_SPEED: 30,
        DEFAULT_RESPAWN_TIME: 60000,       // 1 minute in milliseconds
        DEFAULT_DAMAGE_COOLDOWN: 1000,     // 1 second in milliseconds
        DIRECTION_CHANGE_MIN: 2,           // seconds
        DIRECTION_CHANGE_MAX: 5,           // seconds
        RECTANGLE_SPAWN_CHANCE: 0.7        // 70% chance to spawn rectangle
    },

    // Game Settings
    GAME: {
        DEFAULT_BOT_COUNT: 15,
        DEFAULT_ENEMY_TANK_COUNT: 3,
        MAX_DELTA_TIME: 0.1,               // Cap deltaTime to prevent large jumps
        CANVAS_MIN_WIDTH: 800,
        CANVAS_MIN_HEIGHT: 600,
        SPAWN_MARGIN: 50                   // Margin from edges when spawning
    },

    // Colors
    COLORS: {
        PLAYER_TANK: '#4a90e2',
        ENEMY_TANK: '#e24a4a',
        PLAYER_BULLET: '#4a90e2',
        ENEMY_BULLET: '#e24a4a',
        BOT_TRIANGLE: '#ff6b6b',
        BOT_RECTANGLE: '#4ecdc4',
        ARENA_BACKGROUND: '#16213e',
        ARENA_BORDER: '#0f3460',
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
        XP_MULTIPLIER_PER_LEVEL: 1.2       // Increase XP needed by 20% per level
    }
};

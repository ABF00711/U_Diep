// Room Manager
// Handles room creation, joining, and management

const GameConfig = require('../../shared/Config.js');

class RoomManager {
    constructor(botManager) {
        this.rooms = new Map(); // Map<stake, Room>
        this.botManager = botManager;
    }

    /**
     * Get or create a room for a given stake
     */
    getOrCreateRoom(stake) {
        let room = this.rooms.get(stake);
        if (!room) {
            room = this.createRoom(stake, this.botManager);
            this.rooms.set(stake, room);
        }
        return room;
    }

    /**
     * Create a new room
     */
    createRoom(stake, botManager) {
        const room = {
            stake: stake,
            players: new Map(),
            bots: new Map(),
            bullets: new Map(),
            createdAt: Date.now()
        };
        
        // Spawn initial bots for the room
        botManager.spawnBotsForRoom(room, GameConfig.GAME.DEFAULT_BOT_COUNT);
        
        return room;
    }

    /**
     * Get a room by stake
     */
    getRoom(stake) {
        return this.rooms.get(stake);
    }

    /**
     * Remove a room if it's empty
     */
    removeEmptyRoom(stake) {
        const room = this.rooms.get(stake);
        if (room && room.players.size === 0) {
            this.rooms.delete(stake);
            console.log(`Removed empty room: $${stake}`);
        }
    }

    /**
     * Get all rooms
     */
    getAllRooms() {
        return this.rooms;
    }
}

module.exports = RoomManager;

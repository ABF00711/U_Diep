// Game Server Module
// Main orchestrator that coordinates all game managers

const GameConfig = require('../shared/Config.js');
const RoomManager = require('./managers/RoomManager.js');
const PlayerManager = require('./managers/PlayerManager.js');
const BotManager = require('./managers/BotManager.js');
const BulletManager = require('./managers/BulletManager.js');
const CollisionManager = require('./managers/CollisionManager.js');

class GameServer {
    constructor(io) {
        this.io = io;
        this.botManager = new BotManager();
        this.roomManager = new RoomManager(this.botManager);
        this.playerManager = new PlayerManager();
        this.bulletManager = new BulletManager();
        this.collisionManager = new CollisionManager();
        
        this.setupSocketHandlers();
        this.startGameLoop();
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`Player connected: ${socket.id}`);

            socket.on('joinRoom', (data) => {
                this.handleJoinRoom(socket, data);
            });

            socket.on('playerInput', (data) => {
                this.handlePlayerInput(socket, data);
            });

            socket.on('statAllocation', (data) => {
                this.handleStatAllocation(socket, data);
            });

            socket.on('killSelf', () => {
                this.handleKillSelf(socket);
            });

            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });

            socket.on('playerDamage', (data) => {
                this.handlePlayerDamage(socket, data);
            });

            // Request room player counts
            socket.on('requestRoomCounts', () => {
                this.handleRequestRoomCounts(socket);
            });
        });
    }

    // ==================== Socket Handlers ====================

    handleJoinRoom(socket, data) {
        const { stake, playerName, balance, canvasWidth, canvasHeight } = data;

        // Validate stake
        if (!GameConfig.ECONOMY.ROOM_STAKES.includes(stake)) {
            socket.emit('joinRoomError', { message: 'Invalid stake amount' });
            return;
        }

        // Check if player already in a room
        const existingPlayer = this.playerManager.getPlayer(socket.id);
        if (existingPlayer && existingPlayer.roomStake) {
            // If player is trying to join the same room, reject
            if (existingPlayer.roomStake === stake) {
                socket.emit('joinRoomError', { message: 'Already in this room' });
                return;
            }
            // If different room, remove from old room first (room switching)
            console.log(`Player ${socket.id} switching rooms: $${existingPlayer.roomStake} -> $${stake}`);
            this.removePlayerFromRoom(socket.id);
            // Re-fetch player after removal (roomStake should now be null)
            const playerAfterRemoval = this.playerManager.getPlayer(socket.id);
            if (!playerAfterRemoval) {
                socket.emit('joinRoomError', { message: 'Failed to switch rooms' });
                return;
            }
        }
        
        // Get or create room
        const room = this.roomManager.getOrCreateRoom(stake);

        // Calculate spawn position in world coordinates
        const worldWidth = GameConfig.GAME.WORLD_WIDTH;
        const worldHeight = GameConfig.GAME.WORLD_HEIGHT;
        const tankSize = 30;
        const margin = 100;
        const minX = margin + tankSize;
        const maxX = Math.max(worldWidth - margin - tankSize, minX + 100);
        const minY = margin + tankSize;
        const maxY = Math.max(worldHeight - margin - tankSize, minY + 100);
        
        // Store canvas dimensions for player (used for UI/viewport, not world bounds)
        const spawnWidth = canvasWidth || 1920;
        const spawnHeight = canvasHeight || 1080;
        
        // Get player (after potential room switch cleanup)
        let player = this.playerManager.getPlayer(socket.id);
        
        if (player && !player.roomStake) {
            // Player exists but was removed from room (died/disconnected/switched) - reset for rejoin
            // CRITICAL: Ensure player is fully removed from any old Socket.io rooms first
            if (player.socket) {
                // Leave all possible room sockets (safety check to prevent duplicate subscriptions)
                GameConfig.ECONOMY.ROOM_STAKES.forEach(possibleStake => {
                    player.socket.leave(`room_${possibleStake}`);
                });
            }
            
            // Sync balance from client (client sends original balance before deduction)
            player.balance = balance;
            
            player.isDead = false;
            player.health = GameConfig.TANK.DEFAULT_HEALTH;
            player.maxHealth = GameConfig.TANK.DEFAULT_MAX_HEALTH;
            
            // Recalculate maxHealth based on stats (preserve stat allocations)
            this.playerManager.applyStatChanges(player);
            
            player.x = minX + Math.random() * (maxX - minX);
            player.y = minY + Math.random() * (maxY - minY);
            player.vx = 0; // Reset velocity
            player.vy = 0; // Reset velocity
            player.canvasWidth = spawnWidth;
            player.canvasHeight = spawnHeight;
            player.angle = 0;
            // Keep level, XP, stats - balance synced from client above, then server deducts stake
            console.log(`Player ${socket.id} joining room $${stake} (level ${player.level})`);
        } else if (!player) {
            // Create new player with balance from client (original balance before deduction)
            player = this.playerManager.createPlayer(
                socket.id,
                playerName,
                balance,
                minX + Math.random() * (maxX - minX),
                minY + Math.random() * (maxY - minY),
                spawnWidth,
                spawnHeight
            );
        }

        // Deduct stake from player balance (server-authoritative)
        // Client sends original balance (before deduction), so server deducts stake here
        if (player.balance < stake) {
            socket.emit('joinRoomError', { message: 'Insufficient balance' });
            return;
        }
        
        player.balance -= stake;
        player.balance = Math.max(0, player.balance);
        
        // Set socket reference
        player.socket = socket;
        player.roomStake = stake;

        // Add player to room
        if (!room.players.has(socket.id)) {
            room.players.set(socket.id, player);
        }
        
        // Join Socket.io room (only after ensuring old room is left)
        socket.join(`room_${stake}`);

        // Send initial game state
        socket.emit('joinedRoom', {
            stake: stake,
            playerId: socket.id,
            balance: player.balance,  // Send server-authoritative balance
            playerData: {
                x: player.x,
                y: player.y,
                level: player.level,
                health: player.health,
                maxHealth: player.maxHealth,
                xp: player.xp,
                xpToNextLevel: player.xpToNextLevel,
                stats: player.stats,
                statPoints: player.statPoints
            }
        });

        // Send all existing players in room to new player
        const existingPlayers = Array.from(room.players.values())
            .filter(p => p.id !== socket.id)
            .map(p => ({
                playerId: p.id,
                playerData: {
                    name: p.name,
                    x: p.x,
                    y: p.y,
                    angle: p.angle,
                    level: p.level,
                    health: p.health,
                    maxHealth: p.maxHealth
                }
            }));
        
        if (existingPlayers.length > 0) {
            socket.emit('existingPlayers', existingPlayers);
        }

        // Broadcast to room that new player joined
        socket.to(`room_${stake}`).emit('playerJoined', {
            playerId: socket.id,
            playerData: {
                name: player.name,
                x: player.x,
                y: player.y,
                angle: player.angle,
                level: player.level,
                health: player.health,
                maxHealth: player.maxHealth
            }
        });

        console.log(`Player ${socket.id} joined $${stake} room. Total players: ${room.players.size}`);
        
        // Broadcast updated room counts to all clients (so they can see player counts)
        this.broadcastRoomCounts();
    }

    handleRequestRoomCounts(socket) {
        // Send current room player counts to requesting client
        const roomCounts = {};
        this.roomManager.getAllRooms().forEach((room, stake) => {
            roomCounts[stake] = room.players.size;
        });
        
        socket.emit('roomCounts', roomCounts);
    }

    broadcastRoomCounts() {
        // Broadcast room counts to all connected clients
        const roomCounts = {};
        this.roomManager.getAllRooms().forEach((room, stake) => {
            roomCounts[stake] = room.players.size;
        });
        
        // Send to all connected sockets
        this.io.emit('roomCounts', roomCounts);
    }

    handlePlayerInput(socket, data) {
        const player = this.playerManager.getPlayer(socket.id);
        if (!player || player.isDead || !player.roomStake) {
            // Reset velocity if player is dead or not in room
            if (player) {
                player.vx = 0;
                player.vy = 0;
            }
            return;
        }

        const { keys, mouseX, mouseY, isShooting } = data;
        const room = this.roomManager.getRoom(player.roomStake);
        if (!room) {
            // Reset velocity if room not found
            player.vx = 0;
            player.vy = 0;
            return;
        }

        // Update player position (movement)
        const moveSpeed = GameConfig.TANK.DEFAULT_SPEED + (player.stats.movementSpeed * GameConfig.TANK.MOVEMENT_SPEED_MULTIPLIER);
        const moveSpeedPerFrame = moveSpeed * (1/60); // Per frame at 60fps
        
        let moveX = 0;
        let moveY = 0;
        
        if (keys.w || keys.ArrowUp) moveY -= moveSpeedPerFrame;
        if (keys.s || keys.ArrowDown) moveY += moveSpeedPerFrame;
        if (keys.a || keys.ArrowLeft) moveX -= moveSpeedPerFrame;
        if (keys.d || keys.ArrowRight) moveX += moveSpeedPerFrame;
        
        // Normalize diagonal movement
        if (moveX !== 0 && moveY !== 0) {
            moveX *= 0.707; // 1/sqrt(2)
            moveY *= 0.707;
        }
        
        // Apply movement input (velocity is handled in updateGameState loop)
        player.x += moveX;
        player.y += moveY;
        
        // Clamp to canvas bounds
        const canvasWidth = player.canvasWidth || 1920;
        const canvasHeight = player.canvasHeight || 1080;
        // Clamp player to world bounds
        const worldWidth = GameConfig.GAME.WORLD_WIDTH;
        const worldHeight = GameConfig.GAME.WORLD_HEIGHT;
        const tankSize = 30;
        player.x = Math.max(tankSize, Math.min(worldWidth - tankSize, player.x));
        player.y = Math.max(tankSize, Math.min(worldHeight - tankSize, player.y));
        
        // Update angle (aim direction)
        if (mouseX !== undefined && mouseY !== undefined) {
            player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);
        }
        
        // Handle shooting
        if (isShooting) {
            // Reload stat reduces reload time: each point reduces by RELOAD_MULTIPLIER ms
            // Formula: BASE_RELOAD_TIME - (reload_stat * RELOAD_MULTIPLIER)
            // Example with 7 points: 1000ms - (7 * 100) = 300ms minimum reload time
            const reloadReduction = (player.stats.reload || 0) * GameConfig.TANK.RELOAD_MULTIPLIER;
            const reloadTime = Math.max(100, GameConfig.TANK.BASE_RELOAD_TIME - reloadReduction);
            const currentTime = Date.now();
            
            if (currentTime - player.lastShotTime >= reloadTime) {
                player.lastShotTime = currentTime;
                
                // Create bullet
                const bullet = this.bulletManager.createBullet(player, player.angle);
                room.bullets.set(bullet.id, bullet);
                
                // Broadcast bullet to room
                this.io.to(`room_${player.roomStake}`).emit('bulletFired', {
                    bulletId: bullet.id,
                    ownerId: bullet.ownerId,
                    x: bullet.x,
                    y: bullet.y,
                    angle: bullet.angle,
                    speed: bullet.speed,
                    damage: bullet.damage,
                    size: bullet.size,
                    lifetime: bullet.lifetime,
                    penetration: bullet.penetration
                });
            }
        }
    }

    handleStatAllocation(socket, data) {
        const player = this.playerManager.getPlayer(socket.id);
        if (!player) {
            console.warn(`Stat allocation from unknown player: ${socket.id}`);
            return;
        }

        const { statName } = data;
        
        // Validate stat allocation
        if (!statName || !player.stats.hasOwnProperty(statName)) {
            console.warn(`Invalid stat name: ${statName}`);
            return;
        }
        
        // Check if player has points and stat is not at max
        if (player.statPoints <= 0) {
            console.warn(`Player ${socket.id} tried to allocate stat but has no points`);
            return;
        }
        
        if (player.stats[statName] >= GameConfig.TANK.MAX_STAT_POINTS) {
            console.warn(`Player ${socket.id} tried to allocate stat ${statName} but it's at max`);
            return;
        }
        
        // Allocate stat point
        player.stats[statName]++;
        player.statPoints--;
        
        // Check if still has pending allocation
        if (player.statPoints <= 0) {
            player.pendingStatAllocation = false;
        }

        // Apply stat changes
        this.playerManager.applyStatChanges(player);

        // Send confirmation to player
        socket.emit('statAllocated', {
            statName: statName,
            newValue: player.stats[statName],
            remainingPoints: player.statPoints,
            pendingStatAllocation: player.pendingStatAllocation
        });
        
        console.log(`✅ Stat allocated: ${player.name} allocated ${statName} (${player.stats[statName]}/${GameConfig.TANK.MAX_STAT_POINTS}), ${player.statPoints} points remaining`);
    }

    handleKillSelf(socket) {
        const player = this.playerManager.getPlayer(socket.id);
        if (!player || !player.roomStake) {
            console.warn(`Kill self requested but player not in room: ${socket.id}`);
            return;
        }

        const stake = player.roomStake;
        const refund = stake * GameConfig.ECONOMY.KILL_BUTTON_REFUND_PERCENT;
        const fee = stake * GameConfig.ECONOMY.KILL_BUTTON_FEE_PERCENT;
        
        // Refund 90% of stake (stake was already deducted when joining room)
        // Note: Stake was deducted in handleJoinRoom, so we just add the refund
        player.balance += refund;
        player.balance = Math.max(0, player.balance);
        
        // Remove player from room
        this.removePlayerFromRoom(socket.id);
        
        // Notify player
        socket.emit('killedSelf', {
            refund: refund,
            fee: fee,
            newBalance: player.balance
        });
        
        // Broadcast to room
        this.io.to(`room_${stake}`).emit('playerLeft', {
            playerId: socket.id,
            reason: 'killed_self'
        });
        
        // Broadcast updated room counts
        this.broadcastRoomCounts();
        
        console.log(`Kill self processed: Refund $${refund.toFixed(2)}, Fee $${fee.toFixed(2)}`);
    }

    handleDisconnect(socket) {
        const player = this.playerManager.getPlayer(socket.id);
        if (!player) {
            console.log(`Unknown player disconnected: ${socket.id}`);
            return;
        }

        console.log(`Player disconnected: ${socket.id} (${player.name})`);

        // Store room stake before removal
        const roomStake = player.roomStake;

        // Remove from room first
        if (roomStake) {
            this.removePlayerFromRoom(socket.id);

            // Broadcast to room that player left
            this.io.to(`room_${roomStake}`).emit('playerLeft', {
                playerId: socket.id,
                reason: 'disconnected'
            });

            // Broadcast updated room counts
            this.broadcastRoomCounts();

            console.log(`Broadcasted player left to room $${roomStake}`);
        }

        // Remove from players map
        this.playerManager.removePlayer(socket.id);
        console.log(`Cleaned up player: ${socket.id}`);
    }

    handlePlayerDamage(socket, data) {
        const { targetId, damage } = data;
        const attacker = this.playerManager.getPlayer(socket.id);
        const target = this.playerManager.getPlayer(targetId);
        
        if (!attacker || !target) {
            console.warn(`Invalid damage event: attacker=${socket.id}, target=${targetId}`);
            return;
        }
        
        if (attacker.id === target.id) {
            console.warn(`Player tried to damage self: ${attacker.id}`);
            return;
        }
        
        // Validate players are in same room
        if (attacker.roomStake !== target.roomStake) {
            console.warn(`Players in different rooms: ${attacker.id} (${attacker.roomStake}) vs ${targetId} (${target.roomStake})`);
            return;
        }
        
        // Validate damage amount
        const maxDamage = 100;
        const validDamage = Math.min(Math.max(0, damage), maxDamage);
        
        // Apply damage
        const oldHealth = target.health;
        target.health = Math.max(0, target.health - validDamage);
        
        // Check if target died
        if (target.health <= 0 && oldHealth > 0) {
            target.health = 0;
            target.isDead = true;
            this.handlePlayerDeath(attacker, target);
        }
    }

    // ==================== Room Management ====================

    removePlayerFromRoom(socketId) {
        const player = this.playerManager.getPlayer(socketId);
        if (!player) {
            console.warn(`Cannot remove player from room: ${socketId} (player not found)`);
            return;
        }

        if (!player.roomStake) {
            return; // Already removed from room
        }

        const roomStake = player.roomStake;
        const room = this.roomManager.getRoom(roomStake);
        
        if (room) {
            // Remove player from room's players map
            room.players.delete(socketId);
            
            // Remove player's bullets from room (clean up bullets when leaving)
            const bulletsToRemove = [];
            room.bullets.forEach((bullet, bulletId) => {
                if (bullet.ownerId === socketId) {
                    bulletsToRemove.push(bulletId);
                }
            });
            bulletsToRemove.forEach(bulletId => {
                room.bullets.delete(bulletId);
            });
            
            // Leave Socket.io room (CRITICAL: prevents receiving updates from old room)
            if (player.socket) {
                player.socket.leave(`room_${roomStake}`);
            }
            
            // Clear player's room stake and mark as dead
            player.roomStake = null;
            player.isDead = true; // Mark as dead to prevent further input
            player.vx = 0; // Reset velocity
            player.vy = 0; // Reset velocity
            
            // Remove empty room
            this.roomManager.removeEmptyRoom(roomStake);
            
            // Broadcast updated room counts
            this.broadcastRoomCounts();
        }
    }

    // ==================== Game Loop ====================

    startGameLoop() {
        // Update game state and broadcast at 60 ticks per second
        setInterval(() => {
            this.updateGameState();
            this.broadcastGameState();
        }, 1000 / 60);
    }

    updateGameState() {
        const deltaTime = 1/60; // 60fps
        
        // Update health regeneration for all players
        this.playerManager.updateHealthRegeneration(deltaTime);

        // Update velocity for all players in rooms (squirt effect dampening)
        this.roomManager.getAllRooms().forEach((room, stake) => {
            room.players.forEach((player) => {
                if (player.isDead) {
                    // Reset velocity if dead
                    player.vx = 0;
                    player.vy = 0;
                    return;
                }
                
                // Apply velocity dampening (like bots)
                const squirtDampening = 0.95;
                player.vx = player.vx * squirtDampening;
                player.vy = player.vy * squirtDampening;
                
                // Stop very small velocities to prevent drift
                const velocityThreshold = 0.1;
                if (Math.abs(player.vx) < velocityThreshold) player.vx = 0;
                if (Math.abs(player.vy) < velocityThreshold) player.vy = 0;
                
                // Apply velocity to position
                player.x += player.vx * deltaTime;
                player.y += player.vy * deltaTime;
                
                // Clamp positions to world bounds
                const worldWidth = GameConfig.GAME.WORLD_WIDTH;
                const worldHeight = GameConfig.GAME.WORLD_HEIGHT;
                const tankSize = 30;
                player.x = Math.max(tankSize, Math.min(worldWidth - tankSize, player.x));
                player.y = Math.max(tankSize, Math.min(worldHeight - tankSize, player.y));
            });
        });

        // Update bullets, bots, and check collisions for each room
        this.roomManager.getAllRooms().forEach((room, stake) => {
            // Update bots
            this.botManager.updateBots(room, deltaTime);
            
            // Update bullets
            this.bulletManager.updateBullets(room, deltaTime);
            
            // Check collisions (order matters: tank-tank first, then bot-tank, then bullet collisions)
            this.collisionManager.checkTankTankCollisions(
                room,
                this.playerManager,
                (killer, victim) => this.handlePlayerDeath(killer, victim)
            );
            
            this.collisionManager.checkBotTankCollisions(
                room,
                this.playerManager,
                (killer, victim) => this.handlePlayerDeath(killer, victim),
                (player, bot) => this.handleBotKilled(player, bot)
            );
            
            // Check bullet collisions (bullets can hit both players and bots)
            // Both checks share the same bullet set, so bullets removed in one check won't be checked in the other
            this.collisionManager.checkBulletPlayerCollisions(
                room,
                this.playerManager,
                (attacker, target) => this.handlePlayerDeath(attacker, target)
            );
            
            // Check bot collisions (bullets that still have penetration can hit bots)
            this.collisionManager.checkBulletBotCollisions(
                room,
                this.playerManager,
                (attacker, bot) => this.handleBotKilled(attacker, bot)
            );
        });
    }

    broadcastGameState() {
        // Broadcast player positions and states to each room
        this.roomManager.getAllRooms().forEach((room, stake) => {
            const players = Array.from(room.players.values())
                .filter(p => !p.isDead)
                .map(p => ({
                    playerId: p.id,
                    x: p.x,
                    y: p.y,
                    angle: p.angle,
                    level: p.level,
                    health: p.health,
                    maxHealth: p.maxHealth,
                    xp: p.xp,
                    xpToNextLevel: p.xpToNextLevel,
                    statPoints: p.statPoints,
                    pendingStatAllocation: p.pendingStatAllocation
                }));

            // Get bot states
            const bots = Array.from(room.bots.values())
                .filter(b => !b.isDead)
                .map(b => ({
                    botId: b.id,
                    type: b.type,
                    x: b.x,
                    y: b.y,
                    health: b.health,
                    maxHealth: b.maxHealth,
                    size: b.size,
                    rotation: b.rotation
                }));

            // Get bullet states (so clients can sync and remove bullets that no longer exist)
            const bullets = Array.from(room.bullets.values())
                .map(b => ({
                    bulletId: b.id,
                    x: b.x,
                    y: b.y,
                    angle: b.angle,
                    penetration: b.penetration
                }));

            if (players.length > 0 || bots.length > 0 || bullets.length > 0) {
                this.io.to(`room_${stake}`).emit('gameState', {
                    players: players,
                    bots: bots,
                    bullets: bullets,
                    timestamp: Date.now()
                });
            }
        });
    }

    // ==================== Event Handlers ====================

    handlePlayerDeath(killer, victim) {
        const roomStake = victim.roomStake;
        if (!roomStake) return; // Already handled
        
        const room = this.roomManager.getRoom(roomStake);
        if (!room) return;
        
        const victimStake = victim.roomStake;
        
        // Calculate rewards if there's a killer
        if (killer && killer.id !== victim.id && killer.roomStake === roomStake) {
            // Calculate reward (90% of victim's stake)
            const reward = victimStake * GameConfig.ECONOMY.KILL_REWARD_PERCENT;
            const platformFee = victimStake * GameConfig.ECONOMY.PLATFORM_FEE_PERCENT;
            
            killer.balance += reward;
            killer.balance = Math.max(0, killer.balance);
            
            // Calculate XP reward based on level difference
            let xpReward = GameConfig.XP.BASE_KILL_XP;
            const levelDiff = victim.level - killer.level;
            if (levelDiff > 0) {
                xpReward += levelDiff * GameConfig.XP.LEVEL_DIFF_MULTIPLIER;
            } else if (levelDiff < 0) {
                xpReward = Math.max(GameConfig.XP.MIN_KILL_XP, GameConfig.XP.BASE_KILL_XP + (levelDiff * 5));
            }
            xpReward = Math.min(xpReward, GameConfig.XP.MAX_KILL_XP);
            
            // Update killer XP and level
            this.playerManager.addXP(killer, xpReward);
            
            // Notify killer (they stay in game and continue playing)
            killer.socket.emit('playerKilled', {
                victimId: victim.id,
                reward: reward,
                xpReward: xpReward,
                newBalance: killer.balance,
                newLevel: killer.level,
                newXP: killer.xp,
                xpToNextLevel: killer.xpToNextLevel,
                statPoints: killer.statPoints,
                pendingStatAllocation: killer.pendingStatAllocation
            });
            
            console.log(`💰 ${killer.name} killed ${victim.name}: +$${reward.toFixed(2)}, +${xpReward} XP`);
        }
        
        // Victim loses full stake (stake was already deducted when joining room)
        // No need to deduct again - stake is already lost
        // Note: The stake was deducted in handleJoinRoom, so victim already lost it
        
        // Remove victim from room FIRST (before notifications)
        this.removePlayerFromRoom(victim.id);
        
        // Notify victim directly (they died and lost stake - must exit room)
        victim.socket.emit('playerDied', {
            playerId: victim.id,
            killerId: killer && killer.id !== victim.id ? killer.id : null,
            lostStake: victimStake,
            newBalance: victim.balance  // Send current balance (stake already deducted)
        });
        
        // Broadcast player left to room (so other players know victim left)
        if (roomStake) {
            victim.socket.to(`room_${roomStake}`).emit('playerLeft', {
                playerId: victim.id,
                reason: 'died'
            });
        }
        
        // Broadcast updated room counts
        this.broadcastRoomCounts();
        
        console.log(`💀 ${victim.name} was killed by ${killer && killer.id !== victim.id ? killer.name : 'unknown'} - removed from room`);
    }

    handleBotKilled(player, bot) {
        // Give XP to player
        this.playerManager.addXP(player, bot.xpReward);
        
        // Notify player
        player.socket.emit('botKilled', {
            botId: bot.id,
            xpReward: bot.xpReward,
            newLevel: player.level,
            newXP: player.xp,
            xpToNextLevel: player.xpToNextLevel,
            statPoints: player.statPoints,
            pendingStatAllocation: player.pendingStatAllocation
        });
    }
}

module.exports = GameServer;

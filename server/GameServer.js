// Game Server Module
// Handles room management, player synchronization, and game state

class GameServer {
    constructor(io) {
        this.io = io;
        this.rooms = new Map(); // Map<stake, Room>
        this.players = new Map(); // Map<socketId, Player>
        
        // Game world bounds (can be made configurable)
        this.worldWidth = 3000;
        this.worldHeight = 3000;
        
        this.setupSocketHandlers();
        this.startGameLoop();
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`Player connected: ${socket.id}`);

            // Join room
            socket.on('joinRoom', (data) => {
                this.handleJoinRoom(socket, data);
            });

            // Player input (movement, shooting)
            socket.on('playerInput', (data) => {
                this.handlePlayerInput(socket, data);
            });

            // Player stat allocation
            socket.on('statAllocation', (data) => {
                this.handleStatAllocation(socket, data);
            });

            // Kill button (self-exit)
            socket.on('killSelf', () => {
                this.handleKillSelf(socket);
            });

            // Disconnect
            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });
        });
    }

    handleJoinRoom(socket, data) {
        const { stake, playerName, balance, canvasWidth, canvasHeight } = data;

        // Validate stake
        if (![1, 5, 10].includes(stake)) {
            socket.emit('joinRoomError', { message: 'Invalid stake amount' });
            return;
        }

        // Check if player already in a room
        const existingPlayer = this.players.get(socket.id);
        if (existingPlayer && existingPlayer.roomStake) {
            socket.emit('joinRoomError', { message: 'Already in a room' });
            return;
        }

        // Get or create room
        let room = this.rooms.get(stake);
        if (!room) {
            room = this.createRoom(stake);
            this.rooms.set(stake, room);
        }

        // Use canvas dimensions for spawning (default to reasonable browser size if not provided)
        const spawnWidth = canvasWidth || 1920;
        const spawnHeight = canvasHeight || 1080;
        const tankSize = 30;
        
        // Spawn within visible canvas bounds (with margin from edges)
        const margin = 100;
        const minX = margin + tankSize;
        const maxX = Math.max(spawnWidth - margin - tankSize, minX + 100);
        const minY = margin + tankSize;
        const maxY = Math.max(spawnHeight - margin - tankSize, minY + 100);
        
        // Create player
        const player = {
            id: socket.id,
            name: playerName || `Player${socket.id.slice(0, 6)}`,
            socket: socket,
            roomStake: stake,
            x: minX + Math.random() * (maxX - minX), // Random spawn within visible canvas
            y: minY + Math.random() * (maxY - minY),
            canvasWidth: spawnWidth, // Store canvas size for movement bounds
            canvasHeight: spawnHeight,
            angle: 0,
            level: 1,
            health: 100,
            maxHealth: 100,
            xp: 0,
            xpToNextLevel: 100,
            stats: {
                maxHealth: 0,
                reload: 0,
                movementSpeed: 0,
                bulletSpeed: 0,
                bulletDamage: 0,
                bulletPenetration: 0,
                bulletSize: 0,
                bodyDamage: 0
            },
            statPoints: 0,
            pendingStatAllocation: false,
            lastShotTime: 0,
            isDead: false,
            balance: balance || 100
        };

        // Add player to room
        room.players.set(socket.id, player);
        this.players.set(socket.id, player);
        socket.join(`room_${stake}`);

        // Send initial game state
        socket.emit('joinedRoom', {
            stake: stake,
            playerId: socket.id,
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

        // Broadcast player joined to room
        socket.to(`room_${stake}`).emit('playerJoined', {
            playerId: socket.id,
            playerData: {
                name: player.name,
                x: player.x,
                y: player.y,
                level: player.level,
                health: player.health,
                maxHealth: player.maxHealth
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

        console.log(`Player ${socket.id} joined $${stake} room. Total players: ${room.players.size}`);
    }

    handlePlayerInput(socket, data) {
        const player = this.players.get(socket.id);
        if (!player || player.isDead) return;

        const { keys, mouseX, mouseY, shooting } = data;

        // Update player position based on input
        const speed = 200 + (player.stats.movementSpeed * 20); // Base speed + stat bonus (pixels per second)
        const deltaTime = 0.016; // ~60fps (16.67ms per frame)
        const moveSpeed = speed * deltaTime; // Pixels per frame

        let newX = player.x;
        let newY = player.y;

        // Normalize diagonal movement
        let dx = 0;
        let dy = 0;
        if (keys.w || keys.ArrowUp) dy -= 1;
        if (keys.s || keys.ArrowDown) dy += 1;
        if (keys.a || keys.ArrowLeft) dx -= 1;
        if (keys.d || keys.ArrowRight) dx += 1;
        
        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            dx *= 0.707; // 1/sqrt(2)
            dy *= 0.707;
        }
        
        newX += dx * moveSpeed;
        newY += dy * moveSpeed;

        // Clamp to canvas bounds (not world bounds) - use player's canvas size or default
        const tankSize = 30; // Default tank size
        const canvasWidth = player.canvasWidth || 1920;
        const canvasHeight = player.canvasHeight || 1080;
        player.x = Math.max(tankSize, Math.min(canvasWidth - tankSize, newX));
        player.y = Math.max(tankSize, Math.min(canvasHeight - tankSize, newY));

        // Update angle (aim direction)
        if (mouseX !== undefined && mouseY !== undefined) {
            const dx = mouseX - player.x;
            const dy = mouseY - player.y;
            player.angle = Math.atan2(dy, dx);
        }

        // Handle shooting
        const currentTime = Date.now();
        const reloadTime = Math.max(100, 1000 - (player.stats.reload * 100)); // Minimum 100ms reload
        const canShoot = currentTime - player.lastShotTime >= reloadTime;
        
        if (shooting && canShoot) {
            const bullet = this.createBullet(player);
            player.lastShotTime = currentTime;

            // Broadcast bullet to room (including shooter for consistency)
            const room = this.rooms.get(player.roomStake);
            if (room) {
                // Debug: Log occasionally (5% chance)
                if (Math.random() < 0.05) {
                    console.log(`🔫 Player ${socket.id} fired bullet ${bullet.id}`);
                }
                this.io.to(`room_${player.roomStake}`).emit('bulletFired', {
                    bulletId: bullet.id,
                    x: bullet.x,
                    y: bullet.y,
                    angle: bullet.angle,
                    speed: bullet.speed,
                    damage: bullet.damage,
                    size: bullet.size,
                    penetration: bullet.penetration,
                    ownerId: socket.id
                });
            }
        }
    }

    handleStatAllocation(socket, data) {
        const player = this.players.get(socket.id);
        if (!player || !player.pendingStatAllocation) return;

        const { statName } = data;
        
        // Validate stat allocation (simplified - full validation should be on client)
        if (player.statPoints > 0 && player.stats[statName] < 7) {
            player.stats[statName]++;
            player.statPoints--;

            // Apply stat changes
            this.applyStatChanges(player);

            // Broadcast update
            socket.emit('statAllocated', {
                statName: statName,
                newValue: player.stats[statName],
                remainingPoints: player.statPoints
            });
        }
    }

    handleKillSelf(socket) {
        const player = this.players.get(socket.id);
        if (!player || !player.roomStake) return;

        // Process kill button penalty (10% fee, 90% refund)
        const refund = player.roomStake * 0.9;
        const fee = player.roomStake * 0.1;

        // Remove from room
        this.removePlayerFromRoom(socket.id);

        // Notify player
        socket.emit('killedSelf', {
            refund: refund,
            fee: fee,
            newBalance: player.balance + refund
        });

        // Broadcast to room
        socket.to(`room_${player.roomStake}`).emit('playerLeft', {
            playerId: socket.id
        });
    }

    handleDisconnect(socket) {
        const player = this.players.get(socket.id);
        if (!player) return;

        // Refund full wager on disconnect
        if (player.roomStake) {
            socket.emit('disconnected', {
                refund: player.roomStake,
                newBalance: player.balance + player.roomStake
            });

            // Remove from room
            this.removePlayerFromRoom(socket.id);

            // Broadcast to room
            socket.to(`room_${player.roomStake}`).emit('playerLeft', {
                playerId: socket.id
            });
        }

        this.players.delete(socket.id);
        console.log(`Player disconnected: ${socket.id}`);
    }

    createRoom(stake) {
        return {
            stake: stake,
            players: new Map(),
            bots: [], // Server-managed bots
            bullets: new Map(), // Server-managed bullets
            createdAt: Date.now()
        };
    }

    createBullet(player) {
        const bulletId = `${player.id}_${Date.now()}_${Math.random()}`;
        const bulletSpeed = 500 + (player.stats.bulletSpeed * 50);
        const bulletDamage = 10 + (player.stats.bulletDamage * 2);
        const bulletSize = 7 + (player.stats.bulletSize * 0.5);
        const penetration = 1 + player.stats.bulletPenetration;

        return {
            id: bulletId,
            x: player.x + Math.cos(player.angle) * 30,
            y: player.y + Math.sin(player.angle) * 30,
            angle: player.angle,
            speed: bulletSpeed,
            damage: bulletDamage,
            size: bulletSize,
            penetration: penetration,
            ownerId: player.id,
            createdAt: Date.now()
        };
    }

    applyStatChanges(player) {
        // Update derived stats
        player.maxHealth = 100 + (player.stats.maxHealth * 10);
        if (player.health > player.maxHealth) {
            player.health = player.maxHealth;
        }
    }

    removePlayerFromRoom(socketId) {
        const player = this.players.get(socketId);
        if (!player || !player.roomStake) return;

        const room = this.rooms.get(player.roomStake);
        if (room) {
            room.players.delete(socketId);
            player.roomStake = null;
            player.isDead = true;

            // Clean up empty rooms
            if (room.players.size === 0) {
                this.rooms.delete(player.roomStake);
            }
        }
    }

    startGameLoop() {
        // Broadcast game state at 60 ticks per second
        setInterval(() => {
            this.broadcastGameState();
        }, 1000 / 60);
    }

    broadcastGameState() {
        // Broadcast player positions and states to each room
        this.rooms.forEach((room, stake) => {
            const players = Array.from(room.players.values())
                .filter(p => !p.isDead)
                .map(p => ({
                    playerId: p.id,
                    x: p.x,
                    y: p.y,
                    angle: p.angle,
                    level: p.level,
                    health: p.health,
                    maxHealth: p.maxHealth
                }));

            if (players.length > 0) {
                this.io.to(`room_${stake}`).emit('gameState', {
                    players: players,
                    timestamp: Date.now()
                });
            }
        });
    }
}

module.exports = GameServer;

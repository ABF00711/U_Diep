// Game Server Module
// Handles room management, player synchronization, and game state

// Bot configuration (matches client Config.js)
const BOT_CONFIG = {
    RECTANGLE: {
        HEALTH: 75,
        MAX_HEALTH: 75,
        BODY_DAMAGE: 8,
        SIZE: 20,
        XP_REWARD: 50
    },
    TRIANGLE: {
        HEALTH: 150,
        MAX_HEALTH: 150,
        BODY_DAMAGE: 15,
        SIZE: 25,
        XP_REWARD: 100
    },
    DEFAULT_SPEED: 30,
    DEFAULT_RESPAWN_TIME: 30000, // 30 seconds
    DEFAULT_DAMAGE_COOLDOWN: 1000, // 1 second
    DIRECTION_CHANGE_MIN: 2, // seconds
    DIRECTION_CHANGE_MAX: 5, // seconds
    RECTANGLE_SPAWN_CHANCE: 0.7, // 70%
    SQUIRT_FORCE: 150,
    SQUIRT_DAMPENING: 0.95
};

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

            // Player damage event (for body damage, bot collisions, etc.)
            socket.on('playerDamage', (data) => {
                this.handlePlayerDamage(socket, data);
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
        
        // Reuse existing player or create new one
        let player = existingPlayer;
        if (player && !player.roomStake) {
            // Player exists but was removed from room (died/disconnected) - reset for rejoin
            player.isDead = false;
            player.health = 100;
            player.maxHealth = 100;
            player.roomStake = stake;
            player.x = minX + Math.random() * (maxX - minX);
            player.y = minY + Math.random() * (maxY - minY);
            player.canvasWidth = spawnWidth;
            player.canvasHeight = spawnHeight;
            player.angle = 0;
            // Keep level, XP, stats, balance - they continue with progress
            console.log(`Player ${socket.id} rejoining room $${stake} (level ${player.level})`);
        } else if (!player) {
            // Create new player
            player = {
                id: socket.id,
                name: playerName || `Player${socket.id.slice(0, 6)}`,
                socket: socket,
                roomStake: stake,
                x: minX + Math.random() * (maxX - minX),
                y: minY + Math.random() * (maxY - minY),
                canvasWidth: spawnWidth,
                canvasHeight: spawnHeight,
                angle: 0,
                level: 1,
                health: 100,
                maxHealth: 100,
                xp: 0,
                xpToNextLevel: 100,
                lastHealthUpdate: Date.now(),
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
        }

        // Add player to room (if not already added)
        if (!room.players.has(socket.id)) {
            room.players.set(socket.id, player);
        }
        // Ensure player is in players map
        if (!this.players.has(socket.id)) {
            this.players.set(socket.id, player);
        }
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
        if (!player || player.isDead || !player.roomStake) {
            // Player is dead or not in a room - ignore input
            return;
        }

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
                // Store bullet in room for collision detection
                room.bullets.set(bullet.id, {
                    ...bullet,
                    hitTargets: new Set(), // Track targets hit this frame
                    lifetime: 1000, // 1 second lifetime
                    age: 0
                });
                
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
        if (!player || !player.roomStake) {
            console.warn(`Kill self requested but player not in room: ${socket.id}`);
            return;
        }

        console.log(`Player ${socket.id} (${player.name}) killed self`);

        // Process kill button penalty (10% fee, 90% refund)
        const refund = player.roomStake * 0.9;
        const fee = player.roomStake * 0.1;
        const newBalance = player.balance + refund;

        // Store room stake before removal
        const roomStake = player.roomStake;

        // Remove from room
        this.removePlayerFromRoom(socket.id);

        // Notify player (before disconnect, socket is still connected)
        socket.emit('killedSelf', {
            refund: refund,
            fee: fee,
            newBalance: newBalance
        });

        // Broadcast to room that player left
        socket.to(`room_${roomStake}`).emit('playerLeft', {
            playerId: socket.id,
            reason: 'killed_self'
        });

        console.log(`Kill self processed: Refund $${refund.toFixed(2)}, Fee $${fee.toFixed(2)}`);
    }

    handleDisconnect(socket) {
        const player = this.players.get(socket.id);
        if (!player) {
            console.log(`Unknown player disconnected: ${socket.id}`);
            return;
        }

        console.log(`Player disconnected: ${socket.id} (${player.name})`);

        // Store room stake before removal (needed for broadcast)
        const roomStake = player.roomStake;

        // Remove from room first
        if (roomStake) {
            this.removePlayerFromRoom(socket.id);

            // Broadcast to room that player left (socket is disconnected, so use io.to)
            this.io.to(`room_${roomStake}`).emit('playerLeft', {
                playerId: socket.id,
                reason: 'disconnected'
            });

            console.log(`Broadcasted player left to room $${roomStake}`);
        }

        // Remove from players map
        this.players.delete(socket.id);
        console.log(`Cleaned up player: ${socket.id}`);
    }

    createRoom(stake) {
        const room = {
            stake: stake,
            players: new Map(),
            bots: new Map(), // Server-managed bots (botId -> bot data)
            bullets: new Map(), // Server-managed bullets (bulletId -> bullet data)
            createdAt: Date.now()
        };
        
        // Spawn initial bots for the room
        this.spawnBotsForRoom(room, 20); // Default bot count
        
        return room;
    }

    spawnBotsForRoom(room, count) {
        const spawnWidth = 1920; // Default canvas width
        const spawnHeight = 1080; // Default canvas height
        const margin = 50;
        
        for (let i = 0; i < count; i++) {
            const type = Math.random() < BOT_CONFIG.RECTANGLE_SPAWN_CHANCE ? 'rectangle' : 'triangle';
            const botConfig = type === 'triangle' ? BOT_CONFIG.TRIANGLE : BOT_CONFIG.RECTANGLE;
            
            const bot = {
                id: `bot_${room.stake}_${Date.now()}_${Math.random()}`,
                type: type,
                x: margin + Math.random() * (spawnWidth - margin * 2),
                y: margin + Math.random() * (spawnHeight - margin * 2),
                health: botConfig.HEALTH,
                maxHealth: botConfig.MAX_HEALTH,
                bodyDamage: botConfig.BODY_DAMAGE,
                size: botConfig.SIZE,
                xpReward: botConfig.XP_REWARD,
                speed: BOT_CONFIG.DEFAULT_SPEED,
                vx: 0,
                vy: 0,
                moveDirection: Math.random() * Math.PI * 2,
                directionChangeTime: 0,
                directionChangeInterval: BOT_CONFIG.DIRECTION_CHANGE_MIN + 
                    Math.random() * (BOT_CONFIG.DIRECTION_CHANGE_MAX - BOT_CONFIG.DIRECTION_CHANGE_MIN),
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.05,
                isDead: false,
                deathTime: 0,
                respawnTime: BOT_CONFIG.DEFAULT_RESPAWN_TIME,
                damageCooldown: BOT_CONFIG.DEFAULT_DAMAGE_COOLDOWN,
                lastDamageTime: {} // Map<playerId, timestamp>
            };
            
            room.bots.set(bot.id, bot);
        }
        
        console.log(`Spawned ${count} bots for room $${room.stake}`);
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
        if (!player) {
            console.warn(`Cannot remove player from room: ${socketId} (player not found)`);
            return;
        }

        if (!player.roomStake) {
            // Already removed from room
            return;
        }

        const roomStake = player.roomStake;
        const room = this.rooms.get(roomStake);
        
        if (room) {
            // Remove player from room
            room.players.delete(socketId);
            player.roomStake = null; // Clear room stake (allows rejoining)
            player.isDead = true; // Mark as dead (prevents input processing)

            console.log(`Removed player ${socketId} from $${roomStake} room. Remaining players: ${room.players.size}`);

            // Clean up empty rooms
            if (room.players.size === 0) {
                this.rooms.delete(roomStake);
                console.log(`Room $${roomStake} is now empty and has been removed`);
            }
        } else {
            console.warn(`Room $${roomStake} not found when trying to remove player ${socketId}`);
        }
    }

    handlePlayerDamage(socket, data) {
        const { targetId, damage, damageType } = data;
        const attacker = this.players.get(socket.id);
        const target = this.players.get(targetId);
        
        if (!attacker || !target || target.isDead) {
            console.warn(`Invalid damage event: attacker=${attacker?.id}, target=${targetId}, target exists=${!!target}`);
            return;
        }
        
        if (attacker.id === targetId) {
            console.warn(`Player tried to damage self: ${attacker.id}`);
            return; // Can't damage self
        }
        
        // Validate players are in same room
        if (attacker.roomStake !== target.roomStake) {
            console.warn(`Players in different rooms: ${attacker.id} (${attacker.roomStake}) vs ${targetId} (${target.roomStake})`);
            return;
        }
        
        // Validate damage amount (prevent cheating)
        const maxDamage = 100; // Reasonable max damage per hit
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
        
        // Debug: Log damage (occasionally)
        if (Math.random() < 0.1) { // 10% chance
            console.log(`💥 ${attacker.name} damaged ${target.name}: ${validDamage} HP (${target.health}/${target.maxHealth})`);
        }
    }

    handlePlayerDeath(killer, victim) {
        // Store room stake before removal
        const victimStake = victim.roomStake || 0;
        const roomStake = victimStake;
        
        // Process kill rewards
        const reward = victimStake * 0.9; // 90% to killer
        const fee = victimStake * 0.1; // 10% platform fee
        
        // Update killer balance and XP (killer stays in game!)
        if (killer && killer.id !== victim.id) {
            killer.balance += reward;
            
            // Calculate XP reward
            const levelDiff = victim.level - killer.level;
            let xpReward = 50; // Base XP
            if (levelDiff > 0) {
                xpReward += levelDiff * 10;
            } else if (levelDiff < 0) {
                xpReward = Math.max(10, 50 + (levelDiff * 5));
            }
            xpReward = Math.min(xpReward, 200);
            
            // Update killer XP and level
            const oldLevel = killer.level;
            killer.xp += xpReward;
            while (killer.xp >= killer.xpToNextLevel) {
                killer.xp -= killer.xpToNextLevel;
                killer.level++;
                killer.statPoints++;
                killer.pendingStatAllocation = true;
                killer.xpToNextLevel = Math.floor(killer.xpToNextLevel * 1.2);
            }
            
            // Notify killer (they stay in game and continue playing)
            killer.socket.emit('playerKilled', {
                victimId: victim.id,
                reward: reward,
                xpReward: xpReward,
                newBalance: killer.balance,
                newLevel: killer.level,
                newXP: killer.xp,
                xpToNextLevel: killer.xpToNextLevel,
                statPoints: killer.statPoints
            });
            
            console.log(`💰 ${killer.name} killed ${victim.name}: +$${reward.toFixed(2)}, +${xpReward} XP`);
        }
        
        // Remove victim from room FIRST (before notifications)
        // This clears their roomStake so they can rejoin
        this.removePlayerFromRoom(victim.id);
        
        // Notify victim directly (they died and lost stake - must exit room)
        victim.socket.emit('playerDied', {
            playerId: victim.id, // Include playerId so client knows it's them
            killerId: killer && killer.id !== victim.id ? killer.id : null,
            lostStake: victimStake
        });
        
        // Broadcast player left to room (so other players know victim left)
        // Use playerLeft event - other players just see them leave
        if (roomStake) {
            victim.socket.to(`room_${roomStake}`).emit('playerLeft', {
                playerId: victim.id,
                reason: 'died'
            });
        }
        
        console.log(`💀 ${victim.name} was killed by ${killer && killer.id !== victim.id ? killer.name : 'unknown'} - removed from room`);
    }

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
        this.players.forEach((player, playerId) => {
            if (player.isDead || !player.roomStake) return;
            
            // Health regeneration (if stat allocated)
            const healthRegen = player.stats.healthRegen || 0;
            if (healthRegen > 0 && player.health < player.maxHealth) {
                const regenAmount = healthRegen * deltaTime;
                player.health = Math.min(player.maxHealth, player.health + regenAmount);
            }
        });

        // Update bullets, bots, and check collisions
        this.rooms.forEach((room, stake) => {
            // Update bots
            this.updateBots(room, deltaTime);
            
            // Check bot-tank collisions
            this.checkBotTankCollisions(room);
            
            const bulletsToRemove = [];
            
            room.bullets.forEach((bullet, bulletId) => {
                // Update bullet position
                const deltaTime = 1/60; // 60fps
                bullet.x += Math.cos(bullet.angle) * bullet.speed * deltaTime;
                bullet.y += Math.sin(bullet.angle) * bullet.speed * deltaTime;
                bullet.age += deltaTime * 1000; // Convert to milliseconds
                
                // Clear hit targets from previous frame
                bullet.hitTargets.clear();
                
                // Check if bullet expired or out of bounds
                const maxX = 5000; // World bounds
                const maxY = 5000;
                if (bullet.age >= bullet.lifetime || 
                    bullet.x < -bullet.size || bullet.x > maxX + bullet.size ||
                    bullet.y < -bullet.size || bullet.y > maxY + bullet.size) {
                    bulletsToRemove.push(bulletId);
                    return;
                }
                
                // Check collision with players
                room.players.forEach((targetPlayer, targetId) => {
                    if (targetPlayer.isDead || targetPlayer.id === bullet.ownerId) return;
                    if (bullet.hitTargets.has(targetId)) return; // Already hit this frame
                    
                    const distance = Math.sqrt(
                        Math.pow(bullet.x - targetPlayer.x, 2) + 
                        Math.pow(bullet.y - targetPlayer.y, 2)
                    );
                    const tankSize = 30;
                    
                    if (distance < tankSize + bullet.size) {
                        // Hit! Mark target as hit
                        bullet.hitTargets.add(targetId);
                        
                        // Apply damage
                        const attacker = this.players.get(bullet.ownerId);
                        if (attacker) {
                            const oldHealth = targetPlayer.health;
                            targetPlayer.health = Math.max(0, targetPlayer.health - bullet.damage);
                            
                            // Check if target died
                            if (targetPlayer.health <= 0 && oldHealth > 0) {
                                targetPlayer.health = 0;
                                targetPlayer.isDead = true;
                                this.handlePlayerDeath(attacker, targetPlayer);
                            }
                        }
                        
                        // Decrease penetration
                        bullet.penetration--;
                        if (bullet.penetration <= 0) {
                            bulletsToRemove.push(bulletId);
                        }
                    }
                });
                
                // Check collision with bots (after updating bullet position)
                if (!bulletsToRemove.includes(bulletId)) {
                    room.bots.forEach((bot, botId) => {
                        if (bot.isDead) return;
                        if (bullet.hitTargets.has(botId)) return; // Already hit this bot
                        
                        const distance = Math.sqrt(
                            Math.pow(bullet.x - bot.x, 2) + 
                            Math.pow(bullet.y - bot.y, 2)
                        );
                        
                        if (distance < bot.size + bullet.size) {
                            // Hit bot
                            bullet.hitTargets.add(botId);
                            
                            const oldBotHealth = bot.health;
                            bot.health = Math.max(0, bot.health - bullet.damage);
                            
                            // Check if bot died
                            if (bot.health <= 0 && oldBotHealth > 0) {
                                bot.health = 0;
                                bot.isDead = true;
                                bot.deathTime = 0;
                                
                                // Give XP to bullet owner
                                const attacker = this.players.get(bullet.ownerId);
                                if (attacker && attacker.roomStake === room.stake) {
                                    attacker.xp += bot.xpReward;
                                    while (attacker.xp >= attacker.xpToNextLevel) {
                                        attacker.xp -= attacker.xpToNextLevel;
                                        attacker.level++;
                                        attacker.statPoints++;
                                        attacker.pendingStatAllocation = true;
                                        attacker.xpToNextLevel = Math.floor(attacker.xpToNextLevel * 1.2);
                                    }
                                    
                                    // Notify attacker
                                    attacker.socket.emit('botKilled', {
                                        botId: bot.id,
                                        xpReward: bot.xpReward,
                                        newLevel: attacker.level,
                                        newXP: attacker.xp,
                                        xpToNextLevel: attacker.xpToNextLevel,
                                        statPoints: attacker.statPoints
                                    });
                                }
                            }
                            
                            // Decrease penetration
                            bullet.penetration--;
                            if (bullet.penetration <= 0) {
                                bulletsToRemove.push(bulletId);
                            }
                        }
                    });
                }
            });
            
            // Remove expired/used bullets
            bulletsToRemove.forEach(bulletId => {
                room.bullets.delete(bulletId);
            });
        });
    }

    updateBots(room, deltaTime) {
        // Use average canvas size from players in room, or default
        let canvasWidth = 1920;
        let canvasHeight = 1080;
        if (room.players.size > 0) {
            const firstPlayer = Array.from(room.players.values())[0];
            canvasWidth = firstPlayer.canvasWidth || 1920;
            canvasHeight = firstPlayer.canvasHeight || 1080;
        }
        
        const margin = 50;
        const minX = margin;
        const maxX = canvasWidth - margin;
        const minY = margin;
        const maxY = canvasHeight - margin;
        
        room.bots.forEach((bot, botId) => {
            if (bot.isDead) {
                // Handle respawn
                bot.deathTime += deltaTime * 1000; // Convert to milliseconds
                if (bot.deathTime >= bot.respawnTime) {
                    // Respawn bot
                    bot.x = minX + Math.random() * (maxX - minX);
                    bot.y = minY + Math.random() * (maxY - minY);
                    bot.health = bot.maxHealth;
                    bot.isDead = false;
                    bot.deathTime = 0;
                    bot.moveDirection = Math.random() * Math.PI * 2;
                    bot.rotation = Math.random() * Math.PI * 2;
                    bot.rotationSpeed = (Math.random() - 0.5) * 0.05;
                    bot.vx = 0;
                    bot.vy = 0;
                }
                return;
            }
            
            // Update rotation
            bot.rotation += bot.rotationSpeed * deltaTime * 60;
            
            // Update movement direction periodically
            bot.directionChangeTime += deltaTime;
            if (bot.directionChangeTime >= bot.directionChangeInterval) {
                bot.moveDirection = Math.random() * Math.PI * 2;
                bot.directionChangeTime = 0;
                bot.directionChangeInterval = BOT_CONFIG.DIRECTION_CHANGE_MIN + 
                    Math.random() * (BOT_CONFIG.DIRECTION_CHANGE_MAX - BOT_CONFIG.DIRECTION_CHANGE_MIN);
            }
            
            // Move bot (combine random movement with collision velocity)
            const randomVx = Math.cos(bot.moveDirection) * bot.speed;
            const randomVy = Math.sin(bot.moveDirection) * bot.speed;
            
            // Apply dampening to collision velocity
            bot.vx = bot.vx * BOT_CONFIG.SQUIRT_DAMPENING + randomVx * (1 - BOT_CONFIG.SQUIRT_DAMPENING);
            bot.vy = bot.vy * BOT_CONFIG.SQUIRT_DAMPENING + randomVy * (1 - BOT_CONFIG.SQUIRT_DAMPENING);
            
            // Update position
            bot.x += bot.vx * deltaTime;
            bot.y += bot.vy * deltaTime;
            
            // Clamp to bounds
            bot.x = Math.max(bot.size, Math.min(maxX - bot.size, bot.x));
            bot.y = Math.max(bot.size, Math.min(maxY - bot.size, bot.y));
            
            // Bounce off boundaries
            if (bot.x <= bot.size || bot.x >= maxX - bot.size) {
                bot.vx *= -0.5;
            }
            if (bot.y <= bot.size || bot.y >= maxY - bot.size) {
                bot.vy *= -0.5;
            }
        });
    }

    checkBotTankCollisions(room) {
        const currentTime = Date.now();
        const tankSize = 30;
        
        room.players.forEach((player, playerId) => {
            if (player.isDead) return;
            
            room.bots.forEach((bot, botId) => {
                if (bot.isDead) return;
                
                const distance = Math.sqrt(
                    Math.pow(bot.x - player.x, 2) + 
                    Math.pow(bot.y - player.y, 2)
                );
                
                if (distance < bot.size + tankSize) {
                    // Collision detected
                    // Apply push-back with squirt effect
                    const dx = bot.x - player.x;
                    const dy = bot.y - player.y;
                    const dist = Math.max(distance, 0.1); // Avoid division by zero
                    const normalX = dx / dist;
                    const normalY = dy / dist;
                    
                    const minDistance = bot.size + tankSize;
                    const overlap = minDistance - distance;
                    
                    if (overlap > 0) {
                        // Push bot away (squirt effect)
                        bot.vx += normalX * BOT_CONFIG.SQUIRT_FORCE * (1/60);
                        bot.vy += normalY * BOT_CONFIG.SQUIRT_FORCE * (1/60);
                        
                        // Push player back slightly
                        player.x -= normalX * overlap * 0.3;
                        player.y -= normalY * overlap * 0.3;
                        
                        // Clamp positions
                        const canvasWidth = player.canvasWidth || 1920;
                        const canvasHeight = player.canvasHeight || 1080;
                        player.x = Math.max(tankSize, Math.min(canvasWidth - tankSize, player.x));
                        player.y = Math.max(tankSize, Math.min(canvasHeight - tankSize, player.y));
                    }
                    
                    // Apply body damage (bot damages player)
                    if (!bot.lastDamageTime[playerId] || 
                        (currentTime - bot.lastDamageTime[playerId]) >= bot.damageCooldown) {
                        const oldHealth = player.health;
                        player.health = Math.max(0, player.health - bot.bodyDamage);
                        bot.lastDamageTime[playerId] = currentTime;
                        
                        // Check if player died from bot
                        if (player.health <= 0 && oldHealth > 0) {
                            player.health = 0;
                            player.isDead = true;
                            // No killer for bot death - player just dies
                            this.handlePlayerDeath(null, player);
                        }
                    }
                    
                    // Player damages bot (body damage)
                    const playerBodyDamage = 3 + (player.stats.bodyDamage || 0); // Base + stat
                    if (!bot.lastDamageTime[`player_${playerId}`] || 
                        (currentTime - (bot.lastDamageTime[`player_${playerId}`] || 0)) >= bot.damageCooldown) {
                        const oldBotHealth = bot.health;
                        bot.health = Math.max(0, bot.health - playerBodyDamage);
                        bot.lastDamageTime[`player_${playerId}`] = currentTime;
                        
                        // Check if bot died
                        if (bot.health <= 0 && oldBotHealth > 0) {
                            bot.health = 0;
                            bot.isDead = true;
                            bot.deathTime = 0;
                            
                            // Give XP to player
                            player.xp += bot.xpReward;
                            while (player.xp >= player.xpToNextLevel) {
                                player.xp -= player.xpToNextLevel;
                                player.level++;
                                player.statPoints++;
                                player.pendingStatAllocation = true;
                                player.xpToNextLevel = Math.floor(player.xpToNextLevel * 1.2);
                            }
                            
                            // Notify player
                            player.socket.emit('botKilled', {
                                botId: bot.id,
                                xpReward: bot.xpReward,
                                newLevel: player.level,
                                newXP: player.xp,
                                xpToNextLevel: player.xpToNextLevel,
                                statPoints: player.statPoints
                            });
                        }
                    }
                }
            });
        });
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
                    maxHealth: p.maxHealth,
                    xp: p.xp,
                    xpToNextLevel: p.xpToNextLevel
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

            if (players.length > 0 || bots.length > 0) {
                this.io.to(`room_${stake}`).emit('gameState', {
                    players: players,
                    bots: bots,
                    timestamp: Date.now()
                });
            }
        });
    }
}

module.exports = GameServer;

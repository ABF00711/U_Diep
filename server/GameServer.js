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
        return {
            stake: stake,
            players: new Map(),
            bots: [], // Server-managed bots
            bullets: new Map(), // Server-managed bullets (bulletId -> bullet data)
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
        // Update health regeneration for all players
        this.players.forEach((player, playerId) => {
            if (player.isDead || !player.roomStake) return;
            
            // Health regeneration (if stat allocated)
            const healthRegen = player.stats.healthRegen || 0;
            if (healthRegen > 0 && player.health < player.maxHealth) {
                const regenAmount = healthRegen * (1/60); // Per frame (60fps)
                player.health = Math.min(player.maxHealth, player.health + regenAmount);
            }
        });

        // Update bullets and check collisions
        this.rooms.forEach((room, stake) => {
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
            });
            
            // Remove expired/used bullets
            bulletsToRemove.forEach(bulletId => {
                room.bullets.delete(bulletId);
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

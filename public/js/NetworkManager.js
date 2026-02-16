// Network Manager - Handles Socket.io communication
class NetworkManager {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.connected = false;
        this.playerId = null;
        this.roomStake = null;
        this.serverPlayers = new Map(); // Map<playerId, Tank>
        this.serverBullets = new Map(); // Map<bulletId, Bullet>
        
        // Throttle input sending to reduce network traffic
        this.lastInputSendTime = 0;
        this.inputSendInterval = 16; // Send input every ~16ms (60fps)
        
        this.connect();
    }

    connect() {
        // Wait for Socket.io to be available
        if (typeof io === 'undefined') {
            console.error('Socket.io library not loaded! Make sure you are accessing the game through http://localhost:3000');
            // Try again after a short delay
            setTimeout(() => this.connect(), 100);
            return;
        }
        
        // Connect to Socket.io server with auth token (for account system)
        const serverUrl = window.location.protocol === 'file:' 
            ? 'http://localhost:3000' 
            : window.location.origin;
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('u_diep_token') : null;
        this.socket = io(serverUrl, { auth: { token } });

        this.socket.on('connect', () => {
            console.log('✅ Connected to server:', this.socket.id);
            this.connected = true;
        });

        this.socket.on('disconnect', () => {
            console.log('⚠️ Disconnected from server');
            this.connected = false;

            // If we were in a game, handle disconnect
            if (this.game.state === 'playing' && this.playerId) {
                console.log('Handling disconnect during gameplay...');
                
                // Only refund if player didn't die (death is handled by handlePlayerDied)
                // Check if player tank is dead - if so, don't refund (death already handled)
                const playerDied = this.game.playerTank && this.game.playerTank.isDead;
                
                // Refund wager if in match AND player didn't die (client-side fallback for real disconnects)
                if (this.game.economy.isInMatch() && !playerDied) {
                    const wager = this.game.economy.getCurrentWager();
                    this.game.economy.refundWager(wager);
                    this.game.updateBalanceDisplay();
                    this.game.showMessage(
                        `Disconnected. Refunded: $${wager.toFixed(2)}`,
                        GameConfig.UI.MESSAGE_DURATION_LONG
                    );
                } else if (playerDied) {
                    // Player died - don't refund, death was already handled by handlePlayerDied
                    console.log('Player died - skipping disconnect refund (death already handled)');
                }

                // Clean up and exit
                this.cleanupGameState();
                this.exitToMenu('Connection lost');
            }

            // Clear server players
            this.serverPlayers.clear();
            this.playerId = null;
            this.roomStake = null;
        });

        // Room events
        this.socket.on('joinedRoom', (data) => {
            this.handleJoinedRoom(data);
        });

        this.socket.on('joinRoomError', (data) => {
            const msg = data.message || 'Unknown error';
            if (msg.toLowerCase().includes('log in')) {
                if (typeof localStorage !== 'undefined') localStorage.removeItem('u_diep_token');
                this.game.showAuthScreen();
                if (!this.game.setupAuthForm) return;
                this.game.setupAuthForm();
            }
            alert(`Failed to join room: ${msg}`);
            if (this.game.economy.isInMatch()) {
                const wager = this.game.economy.getCurrentWager();
                this.game.economy.refundWager(wager);
                this.game.updateBalanceDisplay();
            }
        });

        this.socket.on('playerJoined', (data) => {
            this.handlePlayerJoined(data);
        });

        this.socket.on('existingPlayers', (players) => {
            players.forEach(playerData => {
                this.createServerPlayer(playerData.playerId, playerData.playerData);
            });
        });

        this.socket.on('playerLeft', (data) => {
            this.handlePlayerLeft(data);
        });

        // Game state events
        this.socket.on('gameState', (data) => {
            this.handleGameState(data);
        });

        this.socket.on('bulletFired', (data) => {
            this.handleBulletFired(data);
        });

        // Player events
        this.socket.on('statAllocated', (data) => {
            // Sync stats from server (online-only: maxHealth and other derived values come from gameState)
            if (this.game.playerTank) {
                if (data.statName && this.game.playerTank.stats.hasOwnProperty(data.statName)) {
                    this.game.playerTank.stats[data.statName] = data.newValue;
                }
                if (data.remainingPoints !== undefined) {
                    this.game.playerTank.statPoints = data.remainingPoints;
                }
                if (this.game.statAllocationUI && this.game.statAllocationUI.isVisible) {
                    this.game.statAllocationUI.updateDisplay();
                }
            }
        });

        this.socket.on('killedSelf', (data) => {
            this.handleKilledSelf(data);
        });

        this.socket.on('disconnected', (data) => {
            this.handleDisconnected(data);
        });

        // Health and death events
        this.socket.on('playerKilled', (data) => {
            this.handlePlayerKilled(data);
        });

        this.socket.on('playerDied', (data) => {
            this.handlePlayerDied(data);
        });

        // Bot events
        this.socket.on('botKilled', (data) => {
            this.handleBotKilled(data);
        });

        // Room counts event
        this.socket.on('roomCounts', (data) => {
            this.handleRoomCounts(data);
        });
    }

    requestRoomCounts() {
        if (!this.connected) return;
        this.socket.emit('requestRoomCounts');
    }

    joinRoom(stake, playerName, balance) {
        if (!this.connected) {
            console.error('Not connected to server');
            return false;
        }

        // Get canvas dimensions to send to server for proper spawning
        // Ensure canvas is resized before getting dimensions
        if (this.game.canvas.width === 0 || this.game.canvas.height === 0) {
            this.game.resizeCanvas();
        }
        const canvasWidth = this.game.canvas.width || window.innerWidth;
        const canvasHeight = this.game.canvas.height || window.innerHeight;

        this.socket.emit('joinRoom', {
            stake: stake,
            playerName: playerName || 'Player',
            balance: balance,
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight
        });

        return true;
    }

    sendPlayerInput(keys, mouseX, mouseY, shooting) {
        if (!this.connected || !this.playerId) {
            // Silently skip if not connected (prevents console spam)
            return;
        }
        
        // Don't send input if we're not in a game
        if (this.game.state !== 'playing') {
            return;
        }

        // Throttle input sending
        const now = Date.now();
        if (now - this.lastInputSendTime < this.inputSendInterval) {
            return; // Skip this frame
        }
        this.lastInputSendTime = now;

        this.socket.emit('playerInput', {
            keys: keys,
            mouseX: mouseX,
            mouseY: mouseY,
            isShooting: shooting  // Match server expectation
        });
    }

    sendStatAllocation(statName) {
        if (!this.connected || !this.playerId) return;

        this.socket.emit('statAllocation', {
            statName: statName
        });
    }

    sendKillSelf() {
        if (!this.connected) {
            console.error('Cannot send kill self: not connected to server');
            return;
        }
        
        if (!this.playerId) {
            console.warn('Cannot send kill self: no player ID');
            return;
        }

        console.log('📤 Sending kill self request to server...');
        this.socket.emit('killSelf');
    }

    sendPlayerDamage(targetId, damage, damageType = 'bullet') {
        if (!this.connected || !this.playerId) return;
        
        this.socket.emit('playerDamage', {
            targetId: targetId,
            damage: damage,
            damageType: damageType
        });
    }

    handleJoinedRoom(data) {
        console.log('✅ Joined room:', data);
        this.playerId = data.playerId;
        this.roomStake = data.stake;

        // Sync balance from server (server-authoritative, stake was deducted server-side)
        if (data.balance !== undefined) {
            this.game.economy.setBalance(data.balance);
            // Server already deducted stake, so clear client-side wager tracking
            // (client may have deducted optimistically, but server balance is authoritative)
            this.game.economy.currentWager = data.stake; // Track wager amount for UI
            this.game.updateBalanceDisplay();
        }

        // Start game if not already started
        if (this.game.state !== 'playing') {
            this.game.startGame();
        }

        // Update local player tank with server data
        if (this.game.playerTank) {
            this.game.playerTank.x = data.playerData.x;
            this.game.playerTank.y = data.playerData.y;
            this.game.playerTank.level = data.playerData.level;
            this.game.playerTank.health = data.playerData.health;
            this.game.playerTank.maxHealth = data.playerData.maxHealth;
            this.game.playerTank.xp = data.playerData.xp;
            this.game.playerTank.xpToNextLevel = data.playerData.xpToNextLevel;
            // Sync stats from server if provided, otherwise ensure stats object exists
            if (data.playerData.stats) {
                this.game.playerTank.stats = data.playerData.stats;
            } else if (!this.game.playerTank.stats) {
                // Initialize stats if missing
                this.game.playerTank.stats = {
                    healthRegen: 0,
                    maxHealth: 0,
                    bodyDamage: 0,
                    bulletSpeed: 0,
                    bulletPenetration: 0,
                    bulletDamage: 0,
                    reload: 0,
                    movementSpeed: 0
                };
            }
            this.game.playerTank.statPoints = data.playerData.statPoints || 0;
        }
    }

    handlePlayerJoined(data) {
        this.createServerPlayer(data.playerId, data.playerData);
    }

    handlePlayerLeft(data) {
        const playerId = data.playerId;
        const reason = data.reason || 'unknown';
        
        // Ignore if it's the local player (we handle our own disconnect/death separately)
        if (playerId === this.playerId) {
            return;
        }
        
        const tank = this.serverPlayers.get(playerId);
        
        if (tank) {
            // Remove from enemy tanks
            this.game.enemyTanks = this.game.enemyTanks.filter(t => t !== tank);
            this.serverPlayers.delete(playerId);
            console.log(`👋 Removed player tank from game: ${playerId} (reason: ${reason})`);
        } else {
            // Tank not found - might have already been cleaned up or never existed
            // This can happen if:
            // 1. Player left before we received their join event
            // 2. Tank was already removed in a previous cleanup
            // 3. Player rejoined and we're receiving an old leave event
            // This is not an error, just log for debugging
            if (Math.random() < 0.1) { // Only log occasionally to avoid spam
                console.log(`ℹ️ Player left event received but tank not found (already cleaned up?): ${playerId}`);
            }
        }
    }

    handleGameState(data) {
        // Debug: Log game state updates (occasionally)
        if (Math.random() < 0.01) { // 1% chance
            console.log('📡 Game state update:', data.players.length, 'players', data.bots?.length || 0, 'bots', data.bullets?.length || 0, 'bullets');
        }
        
        // Sync bullets from server (server is authoritative - remove bullets that don't exist on server)
        if (data.bullets) {
            this.syncServerBullets(data.bullets);
        }
        
        // Update bots from server (server is authoritative)
        if (data.bots) {
            this.updateServerBots(data.bots);
        }
        
        // Update server players' positions and health (server is authoritative)
        data.players.forEach(playerData => {
            if (playerData.playerId === this.playerId) {
                // Update local player from server (authoritative)
                if (this.game.playerTank) {
                    // Server position is authoritative (for collisions/logic)
                    this.game.playerTank.x = playerData.x;
                    this.game.playerTank.y = playerData.y;
                    this.game.playerTank.angle = playerData.angle;
                    
                    // Initialize render position if not set (for smooth visual interpolation)
                    if (this.game.playerTank.renderX === undefined) {
                        this.game.playerTank.renderX = playerData.x;
                        this.game.playerTank.renderY = playerData.y;
                    }
                    // Level and XP are server-authoritative
                    const oldLevel = this.game.playerTank.level;
                    this.game.playerTank.level = playerData.level || this.game.playerTank.level;
                    if (playerData.xp !== undefined) {
                        this.game.playerTank.xp = playerData.xp;
                    }
                    if (playerData.xpToNextLevel !== undefined) {
                        this.game.playerTank.xpToNextLevel = playerData.xpToNextLevel;
                    }
                    // Sync stat points and pending allocation from server
                    if (playerData.statPoints !== undefined) {
                        this.game.playerTank.statPoints = playerData.statPoints;
                    }
                    if (playerData.pendingStatAllocation !== undefined) {
                        this.game.playerTank.pendingStatAllocation = playerData.pendingStatAllocation;
                    }
                    // Health is server-authoritative - always use server value
                    const oldHealth = this.game.playerTank.health;
                    this.game.playerTank.health = playerData.health;
                    this.game.playerTank.maxHealth = playerData.maxHealth;
                    
                    // Check if player died (health dropped to 0)
                    // Don't handle death here - wait for server's playerDied event
                    // This is just for visual state
                    if (playerData.health <= 0 && oldHealth > 0 && !this.game.playerTank.isDead) {
                        this.game.playerTank.isDead = true;
                        // Server will send playerDied event - don't disconnect here
                    }
                    
                    // Check if player was revived (shouldn't happen, but handle it)
                    if (playerData.health > 0 && this.game.playerTank.isDead) {
                        this.game.playerTank.isDead = false;
                    }
                }
            } else {
                // Update enemy player
                const tank = this.serverPlayers.get(playerData.playerId);
                if (tank) {
                    // Store server-authoritative position (for interpolation in game loop)
                    // Don't lerp here - let game.js handle smooth interpolation via renderX/renderY
                    tank.x = playerData.x;
                    tank.y = playerData.y;
                    tank.angle = playerData.angle;
                    tank.level = playerData.level || tank.level;
                    
                    // Initialize render position if not set (for smooth visual interpolation)
                    if (tank.renderX === undefined) {
                        tank.renderX = playerData.x;
                        tank.renderY = playerData.y;
                    }
                    
                    // Health is server-authoritative - always use server value
                    const oldEnemyHealth = tank.health;
                    tank.health = playerData.health;
                    tank.maxHealth = playerData.maxHealth;
                    
                    // Check if enemy died
                    if (playerData.health <= 0 && oldEnemyHealth > 0 && !tank.isDead) {
                        tank.isDead = true;
                        console.log(`💀 Enemy player died: ${playerData.playerId}`);
                    }
                    
                    // Check if enemy was revived (shouldn't happen, but handle it)
                    if (playerData.health > 0 && tank.isDead) {
                        tank.isDead = false;
                    }
                }
            }
        });
    }

    handleBulletFired(data) {
        // Create bullet from server data (server is authoritative for all bullets)
        // Debug: Log occasionally (10% chance)
        if (Math.random() < 0.1) {
            console.log('🔫 Bullet fired:', data.bulletId, 'by', data.ownerId);
        }

        // Check if bullet already exists (prevent duplicates)
        const existingBullet = this.game.bullets.find(b => b.id === data.bulletId);
        if (existingBullet) {
            // Update existing bullet position from server
            existingBullet.x = data.x;
            existingBullet.y = data.y;
            existingBullet.angle = data.angle;
            return;
        }

        // Determine bullet color based on owner (don't require owner tank to exist)
        // Owner might have disconnected between firing and receiving the event, but we can still render the bullet
        const isPlayerBullet = data.ownerId === this.playerId;
        const bulletColor = isPlayerBullet ? GameConfig.COLORS.PLAYER_BULLET : GameConfig.COLORS.ENEMY_BULLET;

        // Create new bullet (even if owner disconnected - server is authoritative)
        const bullet = new Bullet(
            data.x,
            data.y,
            data.angle,
            data.speed,
            {
                size: data.size,
                damage: data.damage,
                penetration: data.penetration,
                color: bulletColor,
                ownerId: data.ownerId,
                isPlayer: isPlayerBullet,
                lifetime: data.lifetime || GameConfig.BULLET.DEFAULT_LIFETIME
            }
        );
        
        // Set bullet ID for tracking
        bullet.id = data.bulletId;

        this.game.bullets.push(bullet);
        
        // Debug: Log if owner not found (for debugging, but don't prevent bullet creation)
        if (data.ownerId !== this.playerId && !this.serverPlayers.has(data.ownerId) && !this.game.playerTank?.id === data.ownerId) {
            // Owner might have disconnected - this is okay, bullet will still render
            if (Math.random() < 0.1) { // Only log occasionally to avoid spam
                console.log('ℹ️ Bullet from disconnected player:', data.ownerId, '- bullet will still render');
            }
        }
    }

    handleKilledSelf(data) {
        console.log('✅ Kill self confirmed by server:', data);

        // Update balance
        this.game.economy.setBalance(data.newBalance);
        this.game.economy.currentWager = 0; // Clear wager
        this.game.updateBalanceDisplay();

        // Show message
        this.game.showMessage(
            `Exited match. Refunded: $${data.refund.toFixed(2)} (Fee: $${data.fee.toFixed(2)})`,
            GameConfig.UI.MESSAGE_DURATION_LONG
        );

        // Clean up game state (remove enemy tanks, clear bullets, etc.)
        this.cleanupGameState();

        // Exit to menu
        this.exitToMenu();

        // Clear network state
        this.playerId = null;
        this.roomStake = null;
        
        console.log('✅ Kill self complete - returned to menu');
    }

    handleDisconnected(data) {
        // Note: This handler may not be called if socket is already disconnected
        // The socket 'disconnect' event handler below handles this case
        console.log('⚠️ Disconnected event received:', data);
        
        if (data) {
            // Update balance if data provided
            this.game.economy.setBalance(data.newBalance);
            this.game.economy.currentWager = 0; // Clear wager
            this.game.updateBalanceDisplay();
        }

        // Clean up and exit
        this.cleanupGameState();
        this.exitToMenu('Disconnected from server');
    }

    createServerPlayer(playerId, playerData) {
        // Don't create if it's our own player
        if (playerId === this.playerId) return;

        // Check if already exists
        if (this.serverPlayers.has(playerId)) return;

        const tank = new Tank(
            playerData.x,
            playerData.y,
            {
                color: GameConfig.COLORS.ENEMY_TANK,
                isPlayer: false,
                name: playerData.name || `Player${playerId.slice(0, 6)}`,
                stake: this.roomStake
            }
        );

        tank.level = playerData.level || 1;
        tank.health = playerData.health || 100;
        tank.maxHealth = playerData.maxHealth || 100;
        tank.angle = playerData.angle || 0;
        
        // Initialize render position for smooth interpolation (same as local player)
        tank.renderX = playerData.x;
        tank.renderY = playerData.y;

        this.serverPlayers.set(playerId, tank);
        this.game.enemyTanks.push(tank);
    }

    cleanupGameState() {
        // Clear all enemy tanks
        this.game.enemyTanks = [];
        this.serverPlayers.clear();
        
        // Clear bullets from other players (keep own bullets briefly for visual)
        this.game.bullets = this.game.bullets.filter(bullet => {
            // Remove bullets from disconnected players
            return !bullet.ownerId || bullet.ownerId === this.playerId;
        });
        
        console.log('🧹 Cleaned up game state');
    }

    exitToMenu(message) {
        // Exit game
        this.game.playerTank = null;
        this.game.state = 'menu';
        
        // Hide kill button
        const killButton = document.getElementById('killButton');
        if (killButton) {
            killButton.classList.add('hidden');
        }
        
        // Show room selection
        this.game.showRoomSelection();
        
        // Request updated room counts when returning to menu
        this.requestRoomCounts();
        
        // Show message if provided
        if (message) {
            this.game.showMessage(message, GameConfig.UI.MESSAGE_DURATION_LONG);
            console.log(`Exit to menu: ${message}`);
        }
    }

    handleRoomCounts(data) {
        // Update room button player counts
        if (this.game && this.game.updateRoomCounts) {
            this.game.updateRoomCounts(data);
        }
    }

    handlePlayerKilled(data) {
        // We killed another player - stay in game and continue playing!
        console.log('✅ Player killed:', data);
        
        // Sync balance from server (server-authoritative, reward was already added server-side)
        if (data.newBalance !== undefined) {
            this.game.economy.setBalance(data.newBalance);
            this.game.updateBalanceDisplay();
        }
        
        // Update XP and level (server is authoritative)
        if (this.game.playerTank && data.xpReward !== undefined) {
            const oldLevel = this.game.playerTank.level;
            this.game.playerTank.xp = data.newXP;
            this.game.playerTank.level = data.newLevel;
            this.game.playerTank.xpToNextLevel = data.xpToNextLevel || this.game.playerTank.xpToNextLevel;
            
            // Sync stat points and pending allocation from server
            if (data.statPoints !== undefined) {
                this.game.playerTank.statPoints = data.statPoints;
            }
            if (data.pendingStatAllocation !== undefined) {
                this.game.playerTank.pendingStatAllocation = data.pendingStatAllocation;
            }
            
            // Check if we leveled up
            if (data.newLevel > oldLevel) {
                // Stat points and pending allocation are already synced from server
                // Just ensure UI shows if needed
            }
            
            // Show message
            this.game.showMessage(
                `Killed enemy! +$${data.reward.toFixed(2)} (+${data.xpReward} XP)`,
                GameConfig.UI.MESSAGE_DURATION
            );
        }
        
        // IMPORTANT: Do NOT disconnect - stay in game and continue playing!
    }

    syncServerBullets(serverBullets) {
        // Create a map of server bullet IDs for quick lookup
        const serverBulletIds = new Set(serverBullets.map(b => b.bulletId));
        
        // Remove bullets that no longer exist on server
        this.game.bullets = this.game.bullets.filter(bullet => {
            if (bullet.id && !serverBulletIds.has(bullet.id)) {
                return false; // Remove bullet that's not on server anymore
            }
            return true;
        });
        
        // Update existing bullets or create new ones from server data
        serverBullets.forEach(bulletData => {
            let bullet = this.game.bullets.find(b => b.id === bulletData.bulletId);
            
            if (bullet) {
                // Update existing bullet position (server is authoritative)
                bullet.x = bulletData.x;
                bullet.y = bulletData.y;
                bullet.angle = bulletData.angle;
                // Update penetration (so client knows when bullet should be removed)
                if (bulletData.penetration !== undefined) {
                    bullet.penetration = bulletData.penetration;
                }
            }
            // Note: New bullets are created via bulletFired event, not here
        });
    }

    updateServerBots(serverBots) {
        // Create a map of server bot IDs for quick lookup
        const serverBotIds = new Set(serverBots.map(b => b.botId));
        
        // Remove bots that no longer exist on server
        this.game.bots = this.game.bots.filter(bot => {
            if (bot.serverBotId && !serverBotIds.has(bot.serverBotId)) {
                return false; // Remove bot that's not on server anymore
            }
            return true;
        });
        
        // Update or create bots from server data
        serverBots.forEach(botData => {
            let bot = this.game.bots.find(b => b.serverBotId === botData.botId);
            
            if (!bot) {
                // Create new bot from server data
                bot = new Bot(
                    botData.x,
                    botData.y,
                    botData.type,
                    {
                        id: botData.botId,
                        serverBotId: botData.botId,
                        health: botData.health,
                        maxHealth: botData.maxHealth,
                        size: botData.size
                    }
                );
                bot.rotation = botData.rotation || 0;
                bot.rotationSpeed = (Math.random() - 0.5) * 0.05; // Random rotation speed for visual effect
                this.game.bots.push(bot);
            } else {
                // Update existing bot (server is authoritative)
                bot.x = botData.x;
                bot.y = botData.y;
                bot.health = botData.health;
                bot.maxHealth = botData.maxHealth;
                bot.rotation = botData.rotation;
                bot.isDead = false; // Server only sends alive bots
            }
        });
    }

    handleBotKilled(data) {
        // We killed a bot - get XP reward
        console.log('✅ Bot killed:', data);
        
        if (this.game.playerTank && data.xpReward !== undefined) {
            const oldLevel = this.game.playerTank.level;
            this.game.playerTank.xp = data.newXP;
            this.game.playerTank.level = data.newLevel;
            this.game.playerTank.xpToNextLevel = data.xpToNextLevel || this.game.playerTank.xpToNextLevel;
            
            // Sync stat points and pending allocation from server
            if (data.statPoints !== undefined) {
                this.game.playerTank.statPoints = data.statPoints;
            }
            if (data.pendingStatAllocation !== undefined) {
                this.game.playerTank.pendingStatAllocation = data.pendingStatAllocation;
            }
            
            // Show message
            this.game.showMessage(
                `Killed bot! +${data.xpReward} XP`,
                GameConfig.UI.MESSAGE_DURATION
            );
        }
    }

    handlePlayerDied(data) {
        // Check if this is about us or another player
        if (data.playerId && data.playerId !== this.playerId) {
            // Another player died - just remove them from game
            console.log(`💀 Another player died: ${data.playerId}`);
            this.handlePlayerLeft({ playerId: data.playerId, reason: 'died' });
            return;
        }
        
        // We died - exit room and return to menu
        console.log('💀 We died:', data);
        
        if (this.game.playerTank) {
            // Mark player as dead FIRST (before disconnect handler might run)
            // This prevents disconnect handler from giving a refund
            this.game.playerTank.isDead = true;
            this.game.playerTank.health = 0;
            
            // Clear wager immediately to prevent disconnect handler from refunding
            this.game.economy.currentWager = 0;
            
            // Sync balance from server (stake was already deducted server-side when joining)
            // Victim loses full stake - NO REFUND when killed by another player
            if (data.newBalance !== undefined) {
                this.game.economy.setBalance(data.newBalance);
            }
            
            const lostStake = data.lostStake || this.game.economy.getCurrentWager();
            
            // Show message
            this.game.showMessage(
                `You died! Lost $${lostStake.toFixed(2)}`,
                GameConfig.UI.MESSAGE_DURATION_LONG
            );
            this.game.updateBalanceDisplay();
            
            // Clean up and exit to menu
            this.cleanupGameState();
            this.exitToMenu();
            
            // Clear network state (allows rejoining)
            this.playerId = null;
            this.roomStake = null;
            
            console.log('✅ Exited room after death - can rejoin');
        }
    }

    isConnected() {
        return this.connected;
    }
}

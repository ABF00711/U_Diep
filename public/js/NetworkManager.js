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
        
        // Connect to Socket.io server
        // If accessing via file://, use localhost:3000, otherwise use current host
        const serverUrl = window.location.protocol === 'file:' 
            ? 'http://localhost:3000' 
            : window.location.origin;
        this.socket = io(serverUrl);

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
                
                // Refund wager if in match (client-side fallback)
                if (this.game.economy.isInMatch()) {
                    const wager = this.game.economy.getCurrentWager();
                    this.game.economy.refundWager(wager);
                    this.game.updateBalanceDisplay();
                    this.game.showMessage(
                        `Disconnected. Refunded: $${wager.toFixed(2)}`,
                        GameConfig.UI.MESSAGE_DURATION_LONG
                    );
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
            alert(`Failed to join room: ${data.message}`);
            // Refund wager if failed
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
            // Update local player stats if needed
            if (this.game.playerTank) {
                // Stats are synced from server
            }
        });

        this.socket.on('killedSelf', (data) => {
            this.handleKilledSelf(data);
        });

        this.socket.on('disconnected', (data) => {
            this.handleDisconnected(data);
        });
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
            shooting: shooting
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

    handleJoinedRoom(data) {
        console.log('✅ Joined room:', data);
        this.playerId = data.playerId;
        this.roomStake = data.stake;

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
            this.game.playerTank.stats = data.playerData.stats;
            this.game.playerTank.statPoints = data.playerData.statPoints;
        }
    }

    handlePlayerJoined(data) {
        this.createServerPlayer(data.playerId, data.playerData);
    }

    handlePlayerLeft(data) {
        const playerId = data.playerId;
        const reason = data.reason || 'unknown';
        const tank = this.serverPlayers.get(playerId);
        
        console.log(`👋 Player left: ${playerId} (reason: ${reason})`);
        
        if (tank) {
            // Remove from enemy tanks
            this.game.enemyTanks = this.game.enemyTanks.filter(t => t !== tank);
            this.serverPlayers.delete(playerId);
            console.log(`Removed player tank from game: ${playerId}`);
        } else {
            console.warn(`Player left but tank not found: ${playerId}`);
        }
    }

    handleGameState(data) {
        // Debug: Log game state updates (occasionally)
        if (Math.random() < 0.01) { // 1% chance
            console.log('📡 Game state update:', data.players.length, 'players');
        }
        
        // Update server players' positions
        data.players.forEach(playerData => {
            if (playerData.playerId === this.playerId) {
                // Update local player position from server (authoritative)
                // Use direct position updates for responsiveness
                if (this.game.playerTank) {
                    // Direct update for immediate response (server is authoritative)
                    this.game.playerTank.x = playerData.x;
                    this.game.playerTank.y = playerData.y;
                    this.game.playerTank.angle = playerData.angle;
                    this.game.playerTank.level = playerData.level;
                    this.game.playerTank.health = playerData.health;
                    this.game.playerTank.maxHealth = playerData.maxHealth;
                }
            } else {
                // Update enemy player
                const tank = this.serverPlayers.get(playerData.playerId);
                if (tank) {
                    // Interpolate for smooth movement of other players
                    const lerp = 0.5; // Higher lerp for smoother enemy movement
                    tank.x += (playerData.x - tank.x) * lerp;
                    tank.y += (playerData.y - tank.y) * lerp;
                    tank.angle = playerData.angle;
                    tank.level = playerData.level;
                    tank.health = playerData.health;
                    tank.maxHealth = playerData.maxHealth;
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
        
        let ownerTank;
        if (data.ownerId === this.playerId) {
            ownerTank = this.game.playerTank;
        } else {
            ownerTank = this.serverPlayers.get(data.ownerId);
        }
        
        if (!ownerTank) {
            console.warn('⚠️ Bullet owner not found:', data.ownerId);
            return;
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

        // Create new bullet
        const bullet = new Bullet(
            data.x,
            data.y,
            data.angle,
            data.speed,
            {
                size: data.size,
                damage: data.damage,
                penetration: data.penetration,
                color: data.ownerId === this.playerId ? GameConfig.COLORS.PLAYER_BULLET : GameConfig.COLORS.ENEMY_BULLET,
                ownerId: data.ownerId,
                isPlayer: data.ownerId === this.playerId,
                lifetime: GameConfig.BULLET.DEFAULT_LIFETIME
            }
        );
        
        // Set bullet ID for tracking (Bullet class doesn't have id by default)
        bullet.id = data.bulletId;

        this.game.bullets.push(bullet);
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
        
        // Show message if provided
        if (message) {
            this.game.showMessage(message, GameConfig.UI.MESSAGE_DURATION_LONG);
            console.log(`Exit to menu: ${message}`);
        }
    }

    isConnected() {
        return this.connected;
    }
}

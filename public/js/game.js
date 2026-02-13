// Main Game Class

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.input = new Input();
        
        // Game state
        this.state = 'menu'; // menu, lobby, playing
        this.lastTime = 0;
        
        // Camera system (initialize before resizeCanvas)
        this.camera = {
            x: 0,                          // Camera position in world coordinates
            y: 0,                          // Camera position in world coordinates
            targetX: 0,                    // Target position (for smooth following)
            targetY: 0,                   // Target position (for smooth following)
            width: 0,                     // Viewport width (set in resizeCanvas)
            height: 0                     // Viewport height (set in resizeCanvas)
        };
        
        // Set canvas size (after camera is initialized)
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Economy system
        this.economy = new Economy(GameConfig.ECONOMY.INITIAL_BALANCE);
        
        // Managers
        this.rewardManager = new RewardManager(this.economy);
        this.deathHandler = new DeathHandler(this);
        this.collisionManager = new CollisionManager(this);
        this.statAllocationUI = new StatAllocationUI(this);
        this.networkManager = new NetworkManager(this);
        
        // Game objects
        this.playerTank = null;
        this.enemyTanks = [];
        this.bullets = [];
        this.bots = [];
        this.pellets = []; // Keep for now, will be replaced by bots
        
        // Bot sprites
        this.botSprites = {
            rectangle: null,
            triangle: null
        };
        this.loadBotSprites();
        
        // Pellet sprite
        this.pelletSprite = null;
        this.loadPelletSprite();
        
        // Minimap
        this.minimapCanvas = document.getElementById('minimap');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        this.minimapSize = 200; // Size in pixels
        this.minimapCanvas.width = this.minimapSize;
        this.minimapCanvas.height = this.minimapSize;
        
        // UI elements
        this.setupUI();
        
        // Start game loop
        this.gameLoop(0);
    }

    resizeCanvas() {
        // Set canvas to fill window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Update camera viewport size
        this.camera.width = this.canvas.width;
        this.camera.height = this.canvas.height;
    }

    /**
     * Convert world coordinates to screen coordinates (for rendering)
     */
    worldToScreen(worldX, worldY) {
        return {
            x: worldX - this.camera.x + this.camera.width / 2,
            y: worldY - this.camera.y + this.camera.height / 2
        };
    }

    /**
     * Convert screen coordinates to world coordinates (for input)
     */
    screenToWorld(screenX, screenY) {
        return {
            x: screenX + this.camera.x - this.camera.width / 2,
            y: screenY + this.camera.y - this.camera.height / 2
        };
    }

    /**
     * Update camera to follow player smoothly
     * Uses exponential smoothing for smooth camera movement (like diep.io)
     * Camera follows the player's render position (interpolated), not server position
     */
    updateCamera(deltaTime) {
        if (!this.playerTank || this.state !== 'playing') return;
        
        // Use player's render position (smoothed) for camera following
        // This prevents stiffness because camera follows smooth movement, not discrete server updates
        const targetX = this.playerTank.renderX !== undefined ? this.playerTank.renderX : this.playerTank.x;
        const targetY = this.playerTank.renderY !== undefined ? this.playerTank.renderY : this.playerTank.y;
        
        // Exponential smoothing (like diep.io) - smooth and responsive
        const smoothFactor = GameConfig.GAME.CAMERA_SMOOTH_FACTOR;
        this.camera.x += (targetX - this.camera.x) * smoothFactor;
        this.camera.y += (targetY - this.camera.y) * smoothFactor;
        
        // Clamp camera to world boundaries
        const worldWidth = GameConfig.GAME.WORLD_WIDTH;
        const worldHeight = GameConfig.GAME.WORLD_HEIGHT;
        const halfViewportWidth = this.camera.width / 2;
        const halfViewportHeight = this.camera.height / 2;
        
        this.camera.x = Math.max(halfViewportWidth, Math.min(worldWidth - halfViewportWidth, this.camera.x));
        this.camera.y = Math.max(halfViewportHeight, Math.min(worldHeight - halfViewportHeight, this.camera.y));
    }

    setupUI() {
        // Room selection buttons
        const roomButtons = document.querySelectorAll('.room-btn');
        roomButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const stake = parseInt(e.target.dataset.stake);
                this.joinRoom(stake);
            });
        });

        // Kill button
        const killButton = document.getElementById('killButton');
        killButton.addEventListener('click', () => {
            this.killSelf();
        });

        // Hide loading screen
        setTimeout(() => {
            document.getElementById('loadingScreen').classList.add('hidden');
            this.showRoomSelection();
            // Initialize balance display
            this.updateBalanceDisplay();
            
            // Request room counts after connection is established
            if (this.networkManager && this.networkManager.isConnected()) {
                // Small delay to ensure socket is ready
                setTimeout(() => {
                    this.networkManager.requestRoomCounts();
                }, 100);
            }
        }, GameConfig.UI.LOADING_SCREEN_DELAY);
    }

    showRoomSelection() {
        document.getElementById('roomSelection').classList.remove('hidden');
        document.getElementById('minimap').classList.add('hidden');
        this.state = 'menu';
        
        // Request room counts from server
        if (this.networkManager && this.networkManager.isConnected()) {
            this.networkManager.requestRoomCounts();
        }
    }

    updateRoomCounts(roomCounts) {
        // Update player count display on each room button
        const roomButtons = document.querySelectorAll('.room-btn');
        roomButtons.forEach(btn => {
            const stake = parseInt(btn.dataset.stake);
            const playerCount = roomCounts[stake] || 0;
            btn.textContent = `$${stake} Room (${playerCount} player${playerCount !== 1 ? 's' : ''})`;
        });
    }

    hideRoomSelection() {
        document.getElementById('roomSelection').classList.add('hidden');
        document.getElementById('killButton').classList.remove('hidden');
        document.getElementById('minimap').classList.remove('hidden');
        this.state = 'playing';
    }

    joinRoom(stake) {
        // Validate stake amount
        if (!GameConfig.ECONOMY.ROOM_STAKES.includes(stake)) {
            alert(`Invalid stake amount! Valid amounts: $${GameConfig.ECONOMY.ROOM_STAKES.join(', $')}`);
            return;
        }
        
        console.log(`Joining $${stake} room...`);
        
        // Check if player can afford the wager (but don't deduct yet - server will deduct)
        if (!this.economy.canAfford(stake)) {
            alert(`Insufficient balance! You need $${stake} but only have $${this.economy.getBalance()}`);
            return;
        }
        
        // Check if already in a match (allow rejoining if not connected)
        if (this.economy.isInMatch() && this.networkManager.isConnected() && this.networkManager.playerId) {
            alert('You are already in a match! Use Kill Self button to exit first.');
            return;
        }
        
        // If we were in a match but disconnected, clear the wager state
        if (this.economy.isInMatch() && (!this.networkManager.isConnected() || !this.networkManager.playerId)) {
            console.log('Clearing stale match state - allowing rejoin');
            this.economy.currentWager = 0;
        }
        
        // Store original balance to send to server (before deduction)
        // Server will deduct stake authoritatively and send back final balance
        const originalBalance = this.economy.getBalance();
        
        console.log(`Joining room with stake $${stake}. Current balance: $${originalBalance}`);
        
        // Connect to server and join room
        // Send original balance - server will deduct stake and send back final balance
        const joined = this.networkManager.joinRoom(
            stake,
            'Player',
            originalBalance
        );
        
        if (joined) {
            // Wait for server confirmation before starting game
            // Game will start when 'joinedRoom' event is received
            // Balance will be synced from server in handleJoinedRoom
        } else {
            // Failed to connect - no need to refund since we never deducted
            alert('Failed to connect to server. Please try again.');
        }
    }

    startGame() {
        this.hideRoomSelection();
        
        // Get current wager amount (for reward calculation)
        const currentStake = this.economy.getCurrentWager();
        
        // Create player tank (position will be set by server)
        this.playerTank = new Tank(
            this.canvas.width / 2,
            this.canvas.height / 2,
            {
                color: GameConfig.COLORS.PLAYER_TANK,
                isPlayer: true,
                name: 'Player',
                stake: currentStake // Store player's stake
            }
        );

        // Enemy tanks will be created by NetworkManager when other players join
        // No need to create test enemy tanks in multiplayer mode

        // Bots are now server-managed - don't generate locally when connected
        if (!this.networkManager.isConnected()) {
            // Only generate bots in offline mode
            this.generateBots(GameConfig.GAME.DEFAULT_BOT_COUNT);
        }
    }

    loadBotSprites() {
        // Load Rectangle sprite - using SquarePolygon.png instead of SharpRectangle.png
        const rectSprite = new Image();
        rectSprite.src = 'assets/SquarePolygon.png';
        rectSprite.onload = () => {
            this.botSprites.rectangle = rectSprite;
            console.log('Rectangle bot sprite (SquarePolygon) loaded successfully');
            // Update existing bots
            this.bots.forEach(bot => {
                if (bot.type === 'rectangle') {
                    bot.loadSprite(rectSprite);
                }
            });
        };
        rectSprite.onerror = () => {
            console.error('Failed to load rectangle bot sprite from:', rectSprite.src);
        };

        // Load Triangle sprite - using TrianglePellet.png
        const triSprite = new Image();
        triSprite.src = 'assets/TrianglePellet.png';
        triSprite.onload = () => {
            this.botSprites.triangle = triSprite;
            console.log('Triangle bot sprite (TrianglePellet) loaded successfully');
            // Update existing bots
            this.bots.forEach(bot => {
                if (bot.type === 'triangle') {
                    bot.loadSprite(triSprite);
                }
            });
        };
        triSprite.onerror = () => {
            console.error('Failed to load triangle bot sprite from:', triSprite.src);
        };
    }
    
    loadPelletSprite() {
        // No longer needed - pellets are drawn programmatically
        // Keeping method for compatibility but it does nothing now
    }
    
    /**
     * Draw grid pattern on the arena (static grid like diep.io)
     * Grid is drawn in world coordinates, visible based on camera position
     */
    drawGrid() {
        const gridSize = GameConfig.GAME.GRID_SIZE;
        const ctx = this.ctx;
        const worldWidth = GameConfig.GAME.WORLD_WIDTH;
        const worldHeight = GameConfig.GAME.WORLD_HEIGHT;
        
        ctx.strokeStyle = GameConfig.COLORS.GRID_LINE;
        ctx.lineWidth = 1;
        
        // Calculate visible grid range based on camera position
        const cameraLeft = this.camera.x - this.camera.width / 2;
        const cameraRight = this.camera.x + this.camera.width / 2;
        const cameraTop = this.camera.y - this.camera.height / 2;
        const cameraBottom = this.camera.y + this.camera.height / 2;
        
        // Find first grid line before camera view (with some padding for smooth scrolling)
        const startX = Math.floor((cameraLeft - gridSize) / gridSize) * gridSize;
        const endX = Math.ceil((cameraRight + gridSize) / gridSize) * gridSize;
        const startY = Math.floor((cameraTop - gridSize) / gridSize) * gridSize;
        const endY = Math.ceil((cameraBottom + gridSize) / gridSize) * gridSize;
        
        // Draw vertical lines (in world space, convert to screen)
        for (let worldX = startX; worldX <= endX; worldX += gridSize) {
            if (worldX < 0 || worldX > worldWidth) continue;
            
            const screenStart = this.worldToScreen(worldX, startY);
            const screenEnd = this.worldToScreen(worldX, endY);
            
            ctx.beginPath();
            ctx.moveTo(screenStart.x, screenStart.y);
            ctx.lineTo(screenEnd.x, screenEnd.y);
            ctx.stroke();
        }
        
        // Draw horizontal lines (in world space, convert to screen)
        for (let worldY = startY; worldY <= endY; worldY += gridSize) {
            if (worldY < 0 || worldY > worldHeight) continue;
            
            const screenStart = this.worldToScreen(startX, worldY);
            const screenEnd = this.worldToScreen(endX, worldY);
            
            ctx.beginPath();
            ctx.moveTo(screenStart.x, screenStart.y);
            ctx.lineTo(screenEnd.x, screenEnd.y);
            ctx.stroke();
        }
    }

    /**
     * Helper: Draw rounded rectangle for pellets
     */
    roundedRectPellet(ctx, x, y, width, height, radius) {
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
    }

    generateBots(count) {
        this.bots = [];
        
        // Ensure canvas has valid dimensions
        const canvasWidth = Math.max(this.canvas.width || GameConfig.GAME.CANVAS_MIN_WIDTH, GameConfig.GAME.CANVAS_MIN_WIDTH);
        const canvasHeight = Math.max(this.canvas.height || GameConfig.GAME.CANVAS_MIN_HEIGHT, GameConfig.GAME.CANVAS_MIN_HEIGHT);
        
        for (let i = 0; i < count; i++) {
            // Mix of rectangles and triangles (more rectangles than triangles)
            const type = Math.random() < GameConfig.BOT.RECTANGLE_SPAWN_CHANCE ? 'rectangle' : 'triangle';
            const bot = new Bot(
                random(GameConfig.GAME.SPAWN_MARGIN, canvasWidth - GameConfig.GAME.SPAWN_MARGIN),
                random(GameConfig.GAME.SPAWN_MARGIN, canvasHeight - GameConfig.GAME.SPAWN_MARGIN),
                type
            );
            
            // Load sprite if available
            if (this.botSprites[type]) {
                bot.loadSprite(this.botSprites[type]);
            }
            
            this.bots.push(bot);
        }
    }

    killSelf() {
        if (this.state === 'playing' && this.playerTank) {
            console.log('🔴 Kill self requested...');
            
            // Send to server and wait for confirmation
            if (this.networkManager.isConnected()) {
                // Server will handle cleanup and send 'killedSelf' event
                this.networkManager.sendKillSelf();
                // Don't clean up here - wait for server confirmation via handleKilledSelf
            } else {
                // Fallback for offline mode
                console.warn('Not connected to server, using offline mode');
                if (this.economy.isInMatch()) {
                    this.deathHandler.handleKillButtonExit();
                }
                this.playerTank = null;
                this.state = 'menu';
                document.getElementById('killButton').classList.add('hidden');
                this.showRoomSelection();
            }
        } else {
            console.warn('Cannot kill self: not in playing state or no player tank');
        }
    }
    
    showMessage(text, duration = GameConfig.UI.MESSAGE_DURATION) {
        // Create or get message element
        let messageEl = document.getElementById('gameMessage');
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.id = 'gameMessage';
            messageEl.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.9);
                color: #fff;
                padding: 20px 40px;
                border-radius: 8px;
                font-size: 18px;
                z-index: 1000;
                pointer-events: none;
            `;
            document.getElementById('uiOverlay').appendChild(messageEl);
        }
        
        messageEl.textContent = text;
        messageEl.style.display = 'block';
        
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, duration);
    }
    
    updateBalanceDisplay() {
        const balanceEl = document.getElementById('balance');
        if (balanceEl) {
            const balance = this.economy.getBalance();
            const wager = this.economy.getCurrentWager();
            if (wager > 0) {
                balanceEl.textContent = `Balance: $${balance.toFixed(2)} (Wagered: $${wager})`;
            } else {
                balanceEl.textContent = `Balance: $${balance.toFixed(2)}`;
            }
        }
    }

    update(deltaTime) {
        if (this.state !== 'playing') return;

        // Check for pending stat allocation (show UI if needed)
        if (this.playerTank && this.playerTank.hasPendingStatAllocation() && !this.statAllocationUI.isOpen()) {
            this.statAllocationUI.show();
        }

        // Update player tank
        if (this.playerTank) {
            // Interpolate player render position (for smooth visual movement)
            // Server position is authoritative, but we smooth it for rendering
            if (this.networkManager.isConnected() && this.playerTank.renderX !== undefined) {
                const interpolationSpeed = GameConfig.GAME.PLAYER_INTERPOLATION_SPEED;
                this.playerTank.renderX += (this.playerTank.x - this.playerTank.renderX) * interpolationSpeed;
                this.playerTank.renderY += (this.playerTank.y - this.playerTank.renderY) * interpolationSpeed;
            } else {
                // Initialize render position if not set
                if (this.playerTank.renderX === undefined) {
                    this.playerTank.renderX = this.playerTank.x;
                    this.playerTank.renderY = this.playerTank.y;
                }
            }
            
            // Update camera (follows render position, not server position)
            this.updateCamera(deltaTime);
            
            // Interpolate enemy tank render positions (for smooth visual movement)
            // This prevents jittery movement when collisions cause rapid server position updates
            if (this.networkManager.isConnected()) {
                const interpolationSpeed = GameConfig.GAME.PLAYER_INTERPOLATION_SPEED;
                this.enemyTanks.forEach(tank => {
                    if (tank && !tank.isDead && tank.renderX !== undefined) {
                        tank.renderX += (tank.x - tank.renderX) * interpolationSpeed;
                        tank.renderY += (tank.y - tank.renderY) * interpolationSpeed;
                    }
                });
            }
            // Send input to server
            if (this.networkManager.isConnected()) {
                const mousePos = this.input.getMousePosition();
                // Convert screen coordinates to world coordinates
                const worldMouse = this.screenToWorld(mousePos.x, mousePos.y);
                const worldMouseX = worldMouse.x;
                const worldMouseY = worldMouse.y;
                
                // Send shooting state (always send mouse down state, server handles reload)
                const isShooting = this.input.isMouseDown();
                
                this.networkManager.sendPlayerInput(
                    {
                        w: this.input.isKeyPressed('w'),
                        s: this.input.isKeyPressed('s'),
                        a: this.input.isKeyPressed('a'),
                        d: this.input.isKeyPressed('d'),
                        ArrowUp: this.input.isKeyPressed('arrowup'),
                        ArrowDown: this.input.isKeyPressed('arrowdown'),
                        ArrowLeft: this.input.isKeyPressed('arrowleft'),
                        ArrowRight: this.input.isKeyPressed('arrowright')
                    },
                    worldMouseX,
                    worldMouseY,
                    isShooting // Send raw mouse state, server handles reload timing
                );
                
                // Don't update locally when connected - server is authoritative
                // Only update angle for visual feedback (reuse worldMouse already calculated above)
                // Use render position for angle calculation to match visual position
                const renderX = this.playerTank.renderX !== undefined ? this.playerTank.renderX : this.playerTank.x;
                const renderY = this.playerTank.renderY !== undefined ? this.playerTank.renderY : this.playerTank.y;
                const dx = worldMouse.x - renderX;
                const dy = worldMouse.y - renderY;
                this.playerTank.angle = Math.atan2(dy, dx);
            } else {
                // Update locally when not connected (offline mode)
                this.playerTank.update(deltaTime, this.input, this.canvas.width, this.canvas.height);
            }
            
            // Shooting - when connected, server handles bullet creation
            // Don't create bullets locally when connected (server is authoritative)
            // The server will broadcast bullets back to us via NetworkManager
        }

        // Update enemy tanks and remove dead/disconnected ones
        this.enemyTanks = this.enemyTanks.filter(tank => {
            if (!tank || tank.isDead) return false; // Remove dead tanks
            
            // Only update if we're connected and in playing state
            if (this.networkManager.isConnected() && this.state === 'playing') {
                // Enemy tanks don't need bounds check (server handles), but pass world size for consistency
                const worldWidth = GameConfig.GAME.WORLD_WIDTH;
                const worldHeight = GameConfig.GAME.WORLD_HEIGHT;
                tank.update(deltaTime, null, worldWidth, worldHeight);
            }
            return true; // Keep alive tanks
        });

        // Update bots (server-managed when connected)
        if (this.networkManager.isConnected()) {
            // Server manages bots - just filter dead ones
            this.bots = this.bots.filter(bot => {
                if (!bot || bot.isDead) return false;
                // Update rotation for visual effect (server handles position)
                if (bot.rotationSpeed !== undefined) {
                    bot.rotation += bot.rotationSpeed * deltaTime * 60;
                }
                return true;
            });
        } else {
            // Offline mode - update bots locally (use world bounds)
            const worldWidth = GameConfig.GAME.WORLD_WIDTH;
            const worldHeight = GameConfig.GAME.WORLD_HEIGHT;
            this.bots = this.bots.filter(bot => {
                if (!bot) return false;
                bot.update(deltaTime, worldWidth, worldHeight);
                return true;
            });
        }

        // Update bullets
        const worldWidth = GameConfig.GAME.WORLD_WIDTH;
        const worldHeight = GameConfig.GAME.WORLD_HEIGHT;
        this.bullets = this.bullets.filter(bullet => {
            bullet.update(deltaTime);
            
            // Remove if out of world bounds or expired (lifetime acts as range)
            if (bullet.x < -bullet.size || bullet.x > worldWidth + bullet.size ||
                bullet.y < -bullet.size || bullet.y > worldHeight + bullet.size ||
                bullet.isExpired()) {
                return false;
            }
            
            // Remove if penetration reached 0 (server handles collisions when connected, but client should respect penetration)
            if (bullet.penetration !== undefined && bullet.penetration <= 0) {
                return false;
            }
            
            // Check collisions with tanks (only in offline mode - server handles when connected)
            if (!this.networkManager.isConnected()) {
                const allTanks = [this.playerTank, ...this.enemyTanks].filter(t => t && !t.isDead);
                const shouldRemove = this.collisionManager.checkBulletTankCollision(bullet, allTanks);
                if (shouldRemove) {
                    return false; // Remove bullet
                }
                
                // Check collisions with bots (only in offline mode - server handles when connected)
                const shouldRemoveBot = this.collisionManager.checkBulletBotCollision(bullet, this.bots);
                if (shouldRemoveBot) {
                    return false; // Remove bullet
                }
            }
            // Server handles collisions when connected - bullets are synced via gameState
            
            return true;
        });

        // Check tank collision with bots (only in offline mode - server handles when connected)
        if (this.playerTank && !this.networkManager.isConnected()) {
            this.collisionManager.checkTankBotCollision(this.playerTank, this.bots);
        }
        // Server handles tank-bot collisions when connected

        // Check pellet collisions (keep for now, can remove later)
        if (this.playerTank) {
            this.pellets = this.pellets.filter(pellet => {
                const distance = getDistance(pellet.x, pellet.y, this.playerTank.x, this.playerTank.y);
                if (distance < this.playerTank.size + pellet.size) {
                    // Collect pellet
                    this.playerTank.addXP(pellet.xp);
                    return false; // Remove pellet
                }
                return true;
            });
        }
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = GameConfig.COLORS.ARENA_BACKGROUND;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid pattern (static, like diep.io)
        this.drawGrid();

        if (this.state === 'playing') {
            // Apply camera transform for all world-space rendering
            this.ctx.save();
            this.ctx.translate(-this.camera.x + this.camera.width / 2, -this.camera.y + this.camera.height / 2);
            
            // Draw bots
            this.bots.forEach(bot => {
                if (bot && !bot.isDead) {
                    bot.draw(this.ctx);
                }
            });

            // Draw pellets (keep for now, can remove later)
            // Pellets are now drawn programmatically by bots, so this can be removed if pellets array is empty
            this.pellets.forEach(pellet => {
                // Draw square pellet programmatically (same style as rectangle bots)
                this.ctx.save();
                this.ctx.translate(pellet.x, pellet.y);
                
                const size = pellet.size || 5;
                const cornerRadius = size * 0.15;
                
                // Draw filled square with rounded corners
                this.ctx.fillStyle = GameConfig.COLORS.BOT_RECTANGLE;
                this.ctx.beginPath();
                this.roundedRectPellet(this.ctx, -size, -size, size * 2, size * 2, cornerRadius);
                this.ctx.fill();
                
                // Draw border
                this.ctx.strokeStyle = GameConfig.COLORS.BOT_RECTANGLE_BORDER;
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                
                this.ctx.restore();
            });

            // Draw bullets
            this.bullets.forEach(bullet => {
                bullet.draw(this.ctx);
            });

            // Draw enemy tanks (only alive ones)
            this.enemyTanks.forEach(tank => {
                if (tank && !tank.isDead) {
                    tank.draw(this.ctx);
                }
            });

            // Draw player tank
            if (this.playerTank && !this.playerTank.isDead) {
                this.playerTank.draw(this.ctx);
            }
            
            // Restore camera transform
            this.ctx.restore();

            // Update HUD
            if (this.playerTank) {
                document.getElementById('level').textContent = `Level: ${this.playerTank.level}`;
                document.getElementById('health').textContent = `Health: ${Math.floor(this.playerTank.health)}/${this.playerTank.maxHealth}`;
                document.getElementById('xp').textContent = `XP: ${this.playerTank.xp}/${this.playerTank.xpToNextLevel}`;
                
                // Show stat points if available
                const statPoints = this.playerTank.getStatPoints();
                let statPointsEl = document.getElementById('statPoints');
                if (statPoints > 0 || this.playerTank.hasPendingStatAllocation()) {
                    if (!statPointsEl) {
                        statPointsEl = document.createElement('div');
                        statPointsEl.id = 'statPoints';
                        statPointsEl.style.color = '#ffd700';
                        statPointsEl.style.fontWeight = 'bold';
                        statPointsEl.style.cursor = 'pointer';
                        statPointsEl.style.textDecoration = 'underline';
                        statPointsEl.addEventListener('click', () => {
                            if (!this.statAllocationUI.isOpen()) {
                                this.statAllocationUI.show();
                            }
                        });
                        document.getElementById('hud').appendChild(statPointsEl);
                    }
                    statPointsEl.textContent = `Stat Points: ${statPoints} (Click to allocate)`;
                } else if (statPointsEl) {
                    statPointsEl.textContent = '';
                }
                
                // Update stat allocation UI if it's open
                if (this.statAllocationUI.isOpen()) {
                    this.statAllocationUI.updateDisplay();
                }
            }
            
            // Update balance display
            this.updateBalanceDisplay();
            
            // Draw minimap
            this.drawMinimap();
        }
    }

    /**
     * Draw minimap showing player position (highlighted) and other players
     */
    drawMinimap() {
        if (!this.playerTank || this.state !== 'playing') return;
        
        const ctx = this.minimapCtx;
        const size = this.minimapSize;
        const worldWidth = GameConfig.GAME.WORLD_WIDTH;
        const worldHeight = GameConfig.GAME.WORLD_HEIGHT;
        
        // Clear minimap
        ctx.fillStyle = 'rgba(22, 33, 62, 0.9)';
        ctx.fillRect(0, 0, size, size);
        
        // Draw world bounds
        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, size, size);
        
        // Calculate scale to fit world in minimap
        const scaleX = size / worldWidth;
        const scaleY = size / worldHeight;
        const scale = Math.min(scaleX, scaleY);
        
        // Draw grid lines (optional, for reference)
        ctx.strokeStyle = 'rgba(74, 144, 226, 0.3)';
        ctx.lineWidth = 1;
        const gridSize = GameConfig.GAME.GRID_SIZE;
        for (let x = 0; x <= worldWidth; x += gridSize * 10) { // Every 10 grid cells
            const screenX = x * scale;
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, size);
            ctx.stroke();
        }
        for (let y = 0; y <= worldHeight; y += gridSize * 10) {
            const screenY = y * scale;
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(size, screenY);
            ctx.stroke();
        }
        
        // Draw enemy players (from both enemyTanks array and serverPlayers map)
        ctx.fillStyle = GameConfig.COLORS.ENEMY_TANK;
        
        // Draw from enemyTanks array
        this.enemyTanks.forEach(tank => {
            if (tank && !tank.isDead) {
                const renderX = tank.renderX !== undefined ? tank.renderX : tank.x;
                const renderY = tank.renderY !== undefined ? tank.renderY : tank.y;
                const minimapX = renderX * scale;
                const minimapY = renderY * scale;
                
                ctx.beginPath();
                ctx.arc(minimapX, minimapY, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        
        // Also draw from serverPlayers map (if connected)
        if (this.networkManager && this.networkManager.serverPlayers) {
            this.networkManager.serverPlayers.forEach((tank, playerId) => {
                if (tank && !tank.isDead && playerId !== this.networkManager.playerId) {
                    const renderX = tank.renderX !== undefined ? tank.renderX : tank.x;
                    const renderY = tank.renderY !== undefined ? tank.renderY : tank.y;
                    const minimapX = renderX * scale;
                    const minimapY = renderY * scale;
                    
                    ctx.beginPath();
                    ctx.arc(minimapX, minimapY, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }
        
        // Draw player (highlighted)
        const playerRenderX = this.playerTank.renderX !== undefined ? this.playerTank.renderX : this.playerTank.x;
        const playerRenderY = this.playerTank.renderY !== undefined ? this.playerTank.renderY : this.playerTank.y;
        const playerMinimapX = playerRenderX * scale;
        const playerMinimapY = playerRenderY * scale;
        
        // Draw player highlight circle
        ctx.fillStyle = 'rgba(74, 144, 226, 0.3)';
        ctx.beginPath();
        ctx.arc(playerMinimapX, playerMinimapY, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw player point
        ctx.fillStyle = GameConfig.COLORS.PLAYER_TANK;
        ctx.beginPath();
        ctx.arc(playerMinimapX, playerMinimapY, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw player direction indicator
        ctx.strokeStyle = GameConfig.COLORS.PLAYER_TANK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playerMinimapX, playerMinimapY);
        ctx.lineTo(
            playerMinimapX + Math.cos(this.playerTank.angle) * 6,
            playerMinimapY + Math.sin(this.playerTank.angle) * 6
        );
        ctx.stroke();
    }

    gameLoop(currentTime) {
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        // Cap deltaTime to prevent large jumps
        const clampedDelta = Math.min(deltaTime, GameConfig.GAME.MAX_DELTA_TIME);

        this.update(clampedDelta);
        this.render();

        requestAnimationFrame((time) => this.gameLoop(time));
    }
}

// Start game when page loads
window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
});

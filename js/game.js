// Main Game Class

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.input = new Input();
        
        // Set canvas size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Game state
        this.state = 'menu'; // menu, lobby, playing
        this.lastTime = 0;
        
        // Economy system
        this.economy = new Economy(GameConfig.ECONOMY.INITIAL_BALANCE);
        
        // Managers
        this.rewardManager = new RewardManager(this.economy);
        this.deathHandler = new DeathHandler(this);
        this.collisionManager = new CollisionManager(this);
        this.statAllocationUI = new StatAllocationUI(this);
        
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
        
        // UI elements
        this.setupUI();
        
        // Start game loop
        this.gameLoop(0);
    }

    resizeCanvas() {
        // Set canvas to fill window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
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
        }, GameConfig.UI.LOADING_SCREEN_DELAY);
    }

    showRoomSelection() {
        document.getElementById('roomSelection').classList.remove('hidden');
        this.state = 'menu';
    }

    hideRoomSelection() {
        document.getElementById('roomSelection').classList.add('hidden');
        document.getElementById('killButton').classList.remove('hidden');
        this.state = 'playing';
    }

    joinRoom(stake) {
        // Validate stake amount
        if (!GameConfig.ECONOMY.ROOM_STAKES.includes(stake)) {
            alert(`Invalid stake amount! Valid amounts: $${GameConfig.ECONOMY.ROOM_STAKES.join(', $')}`);
            return;
        }
        
        console.log(`Joining $${stake} room...`);
        
        // Check if player can afford the wager
        if (!this.economy.canAfford(stake)) {
            alert(`Insufficient balance! You need $${stake} but only have $${this.economy.getBalance()}`);
            return;
        }
        
        // Check if already in a match
        if (this.economy.isInMatch()) {
            alert('You are already in a match! Use Kill Self button to exit first.');
            return;
        }
        
        // Deduct wager
        const wagerSuccess = this.economy.wager(stake);
        if (!wagerSuccess) {
            alert(`Failed to wager $${stake}. Insufficient balance.`);
            return;
        }
        
        console.log(`Wagered $${stake}. New balance: $${this.economy.getBalance()}`);
        
        // Update balance display
        this.updateBalanceDisplay();
        
        // TODO: Connect to server, validate balance, etc.
        // For now, start local game
        this.startGame();
    }

    startGame() {
        this.hideRoomSelection();
        
        // Get current wager amount (for reward calculation)
        const currentStake = this.economy.getCurrentWager();
        
        // Create player tank
        this.playerTank = new Tank(
            this.canvas.width / 2,
            this.canvas.height / 2,
            {
                color: GameConfig.COLORS.PLAYER_TANK,
                isPlayer: true,
                name: 'Player1',
                stake: currentStake // Store player's stake
            }
        );

        // Create some enemy tanks for testing
        for (let i = 0; i < GameConfig.GAME.DEFAULT_ENEMY_TANK_COUNT; i++) {
            this.enemyTanks.push(new Tank(
                random(100, this.canvas.width - 100),
                random(100, this.canvas.height - 100),
                {
                    color: GameConfig.COLORS.ENEMY_TANK,
                    isPlayer: false,
                    name: `Enemy${i + 1}`,
                    stake: currentStake // Enemy tanks have same stake as room (for testing)
                }
            ));
        }

        // Generate bots (replace pellets)
        this.generateBots(GameConfig.GAME.DEFAULT_BOT_COUNT);
    }

    loadBotSprites() {
        // Load Rectangle sprite
        const rectSprite = new Image();
        rectSprite.src = 'assets/SharpRectangle.png';
        rectSprite.onload = () => {
            this.botSprites.rectangle = rectSprite;
            // Update existing bots
            this.bots.forEach(bot => {
                if (bot.type === 'rectangle') {
                    bot.loadSprite(rectSprite);
                }
            });
        };

        // Load Triangle sprite
        const triSprite = new Image();
        triSprite.src = 'assets/SharpTriangle.png';
        triSprite.onload = () => {
            this.botSprites.triangle = triSprite;
            // Update existing bots
            this.bots.forEach(bot => {
                if (bot.type === 'triangle') {
                    bot.loadSprite(triSprite);
                }
            });
        };
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
            console.log('Killing self...');
            
            // Process kill button penalty: 10% fee, 90% refund
            if (this.economy.isInMatch()) {
                this.deathHandler.handleKillButtonExit();
            }
            
            // TODO: Send to server, remove from room
            this.playerTank = null;
            this.state = 'menu';
            document.getElementById('killButton').classList.add('hidden');
            this.showRoomSelection();
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
            this.playerTank.update(deltaTime, this.input, this.canvas.width, this.canvas.height);
            
            // Shooting
            if (this.input.isMouseDown() && this.playerTank.canShoot()) {
                const bullet = this.playerTank.shoot();
                if (bullet) {
                    this.bullets.push(bullet);
                }
            }
        }

        // Update enemy tanks and remove dead ones
        this.enemyTanks = this.enemyTanks.filter(tank => {
            if (!tank || tank.isDead) return false; // Remove dead tanks
            tank.update(deltaTime, null, this.canvas.width, this.canvas.height);
            return true; // Keep alive tanks
        });

        // Update bots
        this.bots = this.bots.filter(bot => {
            if (!bot) return false; // Remove null/undefined bots
            bot.update(deltaTime, this.canvas.width, this.canvas.height);
            return true; // Keep bot
        });

        // Update bullets
        this.bullets = this.bullets.filter(bullet => {
            bullet.update(deltaTime);
            
            // Remove if out of bounds or expired
            if (bullet.isOutOfBounds(this.canvas.width, this.canvas.height) || bullet.isExpired()) {
                return false;
            }
            
            // Check collisions with tanks (only alive ones)
            const allTanks = [this.playerTank, ...this.enemyTanks].filter(t => t && !t.isDead);
            const shouldRemove = this.collisionManager.checkBulletTankCollision(bullet, allTanks);
            if (shouldRemove) {
                return false; // Remove bullet
            }
            
            // Check collisions with bots
            const shouldRemoveBot = this.collisionManager.checkBulletBotCollision(bullet, this.bots);
            if (shouldRemoveBot) {
                return false; // Remove bullet
            }
            
            return true;
        });

        // Check tank collision with bots (mutual body damage)
        if (this.playerTank) {
            this.collisionManager.checkTankBotCollision(this.playerTank, this.bots);
        }

        // Check tank vs tank collisions (mutual body damage) - only alive tanks
        const allTanks = [this.playerTank, ...this.enemyTanks].filter(t => t && !t.isDead);
        this.collisionManager.checkTankTankCollision(allTanks);

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

        if (this.state === 'playing') {
            // Draw bots
            this.bots.forEach(bot => {
                if (bot && !bot.isDead) {
                    bot.draw(this.ctx);
                }
            });

            // Draw pellets (keep for now, can remove later)
            this.pellets.forEach(pellet => {
                this.ctx.fillStyle = pellet.color;
                this.ctx.beginPath();
                this.ctx.arc(pellet.x, pellet.y, pellet.size, 0, Math.PI * 2);
                this.ctx.fill();
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
            if (this.playerTank) {
                this.playerTank.draw(this.ctx);
            }

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
        }
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

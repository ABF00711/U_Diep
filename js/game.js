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
        this.economy = new Economy(100); // Start with $100 Test Coins
        
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
        }, 1000);
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
        
        // Create player tank
        this.playerTank = new Tank(
            this.canvas.width / 2,
            this.canvas.height / 2,
            {
                color: '#4a90e2',
                isPlayer: true,
                name: 'Player1'
            }
        );

        // Create some enemy tanks for testing
        for (let i = 0; i < 3; i++) {
            this.enemyTanks.push(new Tank(
                random(100, this.canvas.width - 100),
                random(100, this.canvas.height - 100),
                {
                    color: '#e24a4a',
                    isPlayer: false,
                    name: `Enemy${i + 1}`
                }
            ));
        }

        // Generate bots (replace pellets)
        this.generateBots(15); // 15 bots total (mix of rectangles and triangles)
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
        const canvasWidth = Math.max(this.canvas.width || 800, 800);
        const canvasHeight = Math.max(this.canvas.height || 600, 600);
        
        for (let i = 0; i < count; i++) {
            // Mix of rectangles and triangles (more rectangles than triangles)
            const type = Math.random() < 0.7 ? 'rectangle' : 'triangle';
            const bot = new Bot(
                random(50, canvasWidth - 50),
                random(50, canvasHeight - 50),
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
                const refund = this.economy.refundKillButton();
                console.log(`Kill button: Refunded $${refund.refunded.toFixed(2)}, Fee: $${refund.fee.toFixed(2)}`);
                
                // Show refund message
                this.showMessage(`Exited match. Refunded: $${refund.refunded.toFixed(2)} (Fee: $${refund.fee.toFixed(2)})`, 3000);
            }
            
            // Update balance display
            this.updateBalanceDisplay();
            
            // TODO: Send to server, remove from room
            this.playerTank = null;
            this.state = 'menu';
            document.getElementById('killButton').classList.add('hidden');
            this.showRoomSelection();
        }
    }
    
    showMessage(text, duration = 2000) {
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

        // Update enemy tanks
        this.enemyTanks.forEach(tank => {
            tank.update(deltaTime, null, this.canvas.width, this.canvas.height);
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
            
            // Check collisions with tanks
            const allTanks = [this.playerTank, ...this.enemyTanks].filter(t => t);
            for (const tank of allTanks) {
                if (bullet.ownerId === tank.id) continue; // Can't hit self
                
                const distance = getDistance(bullet.x, bullet.y, tank.x, tank.y);
                if (distance < tank.size + bullet.size) {
                    // Hit!
                    const isDead = tank.takeDamage(bullet.damage);
                    bullet.penetration--;
                    
                    if (bullet.penetration <= 0) {
                        return false; // Remove bullet
                    }
                    
                    // Check if player killed another tank
                    if (isDead && this.playerTank && bullet.ownerId === this.playerTank.id && !tank.isPlayer) {
                        // Player killed enemy tank - give reward (90% of victim's stake)
                        // For now, use a default stake amount (in real game, get from victim's wager)
                        const victimStake = 5; // Default for testing - TODO: get from actual victim's wager
                        const reward = victimStake * 0.9; // 90% reward
                        const platformFee = victimStake * 0.1; // 10% platform fee
                        
                        this.economy.addKillReward(reward);
                        this.economy.recordPlatformFee(platformFee);
                        
                        console.log(`Killed enemy! Reward: $${reward.toFixed(2)}, Platform fee: $${platformFee.toFixed(2)}`);
                        this.showMessage(`Killed enemy! +$${reward.toFixed(2)}`, 2000);
                        this.updateBalanceDisplay();
                    }
                    
                    if (isDead && tank.isPlayer) {
                        // Player died - lose entire stake (no refund)
                        if (this.economy.isInMatch()) {
                            const lostWager = this.economy.getCurrentWager();
                            this.economy.currentWager = 0; // Clear wager (player lost it all)
                            console.log(`Player died! Lost entire wager: $${lostWager}`);
                            this.showMessage(`You died! Lost $${lostWager}`, 3000);
                            this.updateBalanceDisplay();
                        }
                        this.killSelf();
                    }
                    break;
                }
            }
            
            // Check collisions with bots
            for (const bot of this.bots) {
                if (!bot || bot.isDead) continue;
                
                const distance = getDistance(bullet.x, bullet.y, bot.x, bot.y);
                if (distance < bot.size + bullet.size) {
                    // Hit bot!
                    const result = bot.takeDamage(bullet.damage, bullet.ownerId);
                    bullet.penetration--;
                    
                    if (result.killed && result.attackerId && this.playerTank && result.attackerId === this.playerTank.id) {
                        // Player killed the bot - give XP
                        this.playerTank.addXP(result.xpReward);
                        // Note: Bot kills don't give money, only XP
                    }
                    
                    if (bullet.penetration <= 0) {
                        return false; // Remove bullet
                    }
                    break;
                }
            }
            
            return true;
        });

        // Check tank collision with bots (mutual body damage)
        if (this.playerTank) {
            const currentTime = Date.now(); // Get current time in milliseconds
            
            for (const bot of this.bots) {
                if (!bot || bot.isDead) continue;
                
                const distance = getDistance(bot.x, bot.y, this.playerTank.x, this.playerTank.y);
                if (distance < bot.size + this.playerTank.size) {
                    // Mutual collision - both take body damage
                    
                    // Bot damages player tank
                    if (bot.canDamagePlayer(this.playerTank.id, currentTime)) {
                        const isDead = this.playerTank.takeDamage(bot.bodyDamage);
                        bot.recordDamageToPlayer(this.playerTank.id, currentTime);
                        
                        if (isDead) {
                            // Player died from bot collision - lose entire stake
                            if (this.economy.isInMatch()) {
                                const lostWager = this.economy.getCurrentWager();
                                this.economy.currentWager = 0; // Clear wager (player lost it all)
                                console.log(`Player died from bot! Lost entire wager: $${lostWager}`);
                                this.showMessage(`You died! Lost $${lostWager}`, 3000);
                                this.updateBalanceDisplay();
                            }
                            this.killSelf();
                            break;
                        }
                    }
                    
                    // Player tank damages bot
                    if (this.playerTank && this.playerTank.canDamageTarget(bot.id, currentTime)) {
                        const result = bot.takeDamage(this.playerTank.getBodyDamage(), this.playerTank.id);
                        this.playerTank.recordBodyDamageToTarget(bot.id, currentTime);
                        
                        if (result.killed && this.playerTank) {
                            // Player killed the bot - give XP
                            this.playerTank.addXP(result.xpReward);
                            // Note: Bot kills don't give money, only XP
                        }
                    }
                }
            }
        }

        // Check tank vs tank collisions (mutual body damage)
        const currentTime = Date.now();
        const allTanks = [this.playerTank, ...this.enemyTanks].filter(t => t);
        
        for (let i = 0; i < allTanks.length; i++) {
            for (let j = i + 1; j < allTanks.length; j++) {
                const tank1 = allTanks[i];
                const tank2 = allTanks[j];
                
                if (!tank1 || !tank2) continue;
                
                const distance = getDistance(tank1.x, tank1.y, tank2.x, tank2.y);
                if (distance < tank1.size + tank2.size) {
                    // Tanks are colliding - mutual body damage
                    
                    // Tank1 damages Tank2
                    if (tank1.canDamageTarget(tank2.id, currentTime)) {
                        const isDead = tank2.takeDamage(tank1.getBodyDamage());
                        tank1.recordBodyDamageToTarget(tank2.id, currentTime);
                        
                        if (isDead && tank2.isPlayer) {
                            // Player (tank2) died from tank collision - lose entire stake
                            if (this.economy.isInMatch()) {
                                const lostWager = this.economy.getCurrentWager();
                                this.economy.currentWager = 0; // Clear wager (player lost it all)
                                console.log(`Player died from tank collision! Lost entire wager: $${lostWager}`);
                                this.showMessage(`You died! Lost $${lostWager}`, 3000);
                                this.updateBalanceDisplay();
                            }
                            this.killSelf();
                        }
                        
                        // Check if player (tank1) killed tank2 - give reward
                        if (isDead && tank1.isPlayer && !tank2.isPlayer) {
                            // Player killed enemy tank - give reward (90% of victim's stake)
                            const victimStake = 5; // Default for testing - TODO: get from actual victim's wager
                            const reward = victimStake * 0.9; // 90% reward
                            const platformFee = victimStake * 0.1; // 10% platform fee
                            
                            this.economy.addKillReward(reward);
                            this.economy.recordPlatformFee(platformFee);
                            
                            console.log(`Killed enemy tank! Reward: $${reward.toFixed(2)}, Platform fee: $${platformFee.toFixed(2)}`);
                            this.showMessage(`Killed enemy! +$${reward.toFixed(2)}`, 2000);
                            this.updateBalanceDisplay();
                        }
                    }
                    
                    // Tank2 damages Tank1
                    if (tank2.canDamageTarget(tank1.id, currentTime)) {
                        const isDead = tank1.takeDamage(tank2.getBodyDamage());
                        tank2.recordBodyDamageToTarget(tank1.id, currentTime);
                        
                        if (isDead && tank1.isPlayer) {
                            // Player died from tank collision - lose entire stake
                            if (this.economy.isInMatch()) {
                                const lostWager = this.economy.getCurrentWager();
                                this.economy.currentWager = 0; // Clear wager (player lost it all)
                                console.log(`Player died from tank collision! Lost entire wager: $${lostWager}`);
                                this.showMessage(`You died! Lost $${lostWager}`, 3000);
                                this.updateBalanceDisplay();
                            }
                            this.killSelf();
                        }
                    }
                }
            }
        }

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
        this.ctx.fillStyle = '#16213e';
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

            // Draw enemy tanks
            this.enemyTanks.forEach(tank => {
                tank.draw(this.ctx);
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
            }
            
            // Update balance display
            this.updateBalanceDisplay();
        }
    }

    gameLoop(currentTime) {
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        // Cap deltaTime to prevent large jumps
        const clampedDelta = Math.min(deltaTime, 0.1);

        this.update(clampedDelta);
        this.render();

        requestAnimationFrame((time) => this.gameLoop(time));
    }
}

// Start game when page loads
window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
});

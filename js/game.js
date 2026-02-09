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
            // TODO: Send to server, remove from room
            this.playerTank = null;
            this.state = 'menu';
            document.getElementById('killButton').classList.add('hidden');
            this.showRoomSelection();
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
                    
                    if (isDead && tank.isPlayer) {
                        // Player died
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
                    }
                    
                    if (bullet.penetration <= 0) {
                        return false; // Remove bullet
                    }
                    break;
                }
            }
            
            return true;
        });

        // Check tank collision with bots (body damage)
        if (this.playerTank) {
            for (const bot of this.bots) {
                if (!bot || bot.isDead) continue;
                
                const distance = getDistance(bot.x, bot.y, this.playerTank.x, this.playerTank.y);
                if (distance < bot.size + this.playerTank.size) {
                    // Tank touched bot - take body damage
                    if (this.playerTank) { // Check again in case it became null
                        const isDead = this.playerTank.takeDamage(bot.bodyDamage);
                        if (isDead) {
                            // Player died from bot collision
                            this.killSelf();
                            break; // Exit loop since player is dead
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

// Stat Allocation UI Component
// Visible only when stat points available; show by moving mouse to bottom-left or press 1-8

const STAT_KEY_ORDER = ['healthRegen', 'maxHealth', 'bodyDamage', 'bulletSpeed', 'bulletPenetration', 'bulletDamage', 'reload', 'movementSpeed'];
const HOT_ZONE_WIDTH = 200;
const HOT_ZONE_HEIGHT = 100;

class StatAllocationUI {
    constructor(game) {
        this.game = game;
        this.container = null;
        this.isVisible = false;
        this.createUI();
        this.setupMouseHotzone();
        this.setupKeyboardShortcuts();
    }

    createUI() {
        this.container = document.createElement('div');
        this.container.id = 'statAllocationUI';
        this.container.className = 'hidden';
        this.container.innerHTML = `
            <div class="stat-allocation-panel">
                <div class="stat-points-display"><span id="statPointsAvailable">0</span> pts</div>
                <div class="stats-grid">
                    <div class="stat-row" data-stat="healthRegen" data-key="1">
                        <span class="stat-name">Health Regen <span class="stat-key">[1]</span></span>
                        <span class="stat-value" id="stat-healthRegen">0</span>
                        <button class="stat-btn" data-stat="healthRegen">+</button>
                    </div>
                    <div class="stat-row" data-stat="maxHealth" data-key="2">
                        <span class="stat-name">Max Health <span class="stat-key">[2]</span></span>
                        <span class="stat-value" id="stat-maxHealth">0</span>
                        <button class="stat-btn" data-stat="maxHealth">+</button>
                    </div>
                    <div class="stat-row" data-stat="bodyDamage" data-key="3">
                        <span class="stat-name">Body Damage <span class="stat-key">[3]</span></span>
                        <span class="stat-value" id="stat-bodyDamage">0</span>
                        <button class="stat-btn" data-stat="bodyDamage">+</button>
                    </div>
                    <div class="stat-row" data-stat="bulletSpeed" data-key="4">
                        <span class="stat-name">Bullet Speed <span class="stat-key">[4]</span></span>
                        <span class="stat-value" id="stat-bulletSpeed">0</span>
                        <button class="stat-btn" data-stat="bulletSpeed">+</button>
                    </div>
                    <div class="stat-row" data-stat="bulletPenetration" data-key="5">
                        <span class="stat-name">Penetration <span class="stat-key">[5]</span></span>
                        <span class="stat-value" id="stat-bulletPenetration">0</span>
                        <button class="stat-btn" data-stat="bulletPenetration">+</button>
                    </div>
                    <div class="stat-row" data-stat="bulletDamage" data-key="6">
                        <span class="stat-name">Bullet Damage <span class="stat-key">[6]</span></span>
                        <span class="stat-value" id="stat-bulletDamage">0</span>
                        <button class="stat-btn" data-stat="bulletDamage">+</button>
                    </div>
                    <div class="stat-row" data-stat="reload" data-key="7">
                        <span class="stat-name">Reload <span class="stat-key">[7]</span></span>
                        <span class="stat-value" id="stat-reload">0</span>
                        <button class="stat-btn" data-stat="reload">+</button>
                    </div>
                    <div class="stat-row" data-stat="movementSpeed" data-key="8">
                        <span class="stat-name">Movement <span class="stat-key">[8]</span></span>
                        <span class="stat-value" id="stat-movementSpeed">0</span>
                        <button class="stat-btn" data-stat="movementSpeed">+</button>
                    </div>
                </div>
                <div class="stat-allocation-actions">
                    <button id="closeStatUI" class="close-btn">Close</button>
                </div>
            </div>
        `;
        document.getElementById('uiOverlay').appendChild(this.container);
        this.setupEventListeners();
    }

    setupMouseHotzone() {
        // Bottom-left: show panel when mouse enters zone. Do NOT hide when mouse leaves –
        // panel stays open until user clicks Close or runs out of points (fair while moving/aiming).
        window.addEventListener('mousemove', (e) => {
            if (this.game.state !== 'playing' || !this.game.playerTank) return;
            const points = this.game.playerTank.getStatPoints ? this.game.playerTank.getStatPoints() : 0;
            if (points <= 0) {
                if (this.isVisible) this.hide();
                return;
            }
            const inHotZone = e.clientX < HOT_ZONE_WIDTH && e.clientY >= window.innerHeight - HOT_ZONE_HEIGHT;
            if (inHotZone) this.show();
        });
    }

    setupKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            if (this.game.state !== 'playing' || !this.game.playerTank) return;
            const key = e.key;
            if (key >= '1' && key <= '8') {
                const idx = parseInt(key, 10) - 1;
                const statName = STAT_KEY_ORDER[idx];
                if (statName) {
                    this.allocateStat(statName);
                    e.preventDefault();
                }
            }
        });
    }

    setupEventListeners() {
        // Stat allocation buttons
        const statButtons = this.container.querySelectorAll('.stat-btn');
        statButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const statName = e.target.dataset.stat;
                this.allocateStat(statName);
            });
        });

        // Close button (can close even with points remaining)
        const closeBtn = this.container.querySelector('#closeStatUI');
        closeBtn.addEventListener('click', () => {
            this.hide();
        });
    }

    allocateStat(statName) {
        if (!this.game.playerTank) return;
        
        // Check if we're connected to server - if so, send to server
        if (this.game.networkManager && this.game.networkManager.isConnected()) {
            // Send to server - server will validate and update
            this.game.networkManager.sendStatAllocation(statName);
            // Don't update locally - wait for server confirmation via statAllocated event
        } else {
            // Offline mode - allocate locally
            const success = this.game.playerTank.allocateStatPoint(statName);
            if (success) {
                this.updateDisplay();
            } else {
                // Show feedback if allocation failed (max reached or no points)
                const tank = this.game.playerTank;
                if (tank.stats[statName] >= GameConfig.TANK.MAX_STAT_POINTS) {
                    const statBtn = this.container.querySelector(`.stat-btn[data-stat="${statName}"]`);
                    if (statBtn) {
                        statBtn.style.background = '#e24a4a';
                        setTimeout(() => {
                            statBtn.style.background = '';
                        }, 200);
                    }
                }
            }
        }
    }

    show() {
        if (!this.game.playerTank) return;
        const points = this.game.playerTank.getStatPoints ? this.game.playerTank.getStatPoints() : 0;
        if (points <= 0) return;
        this.isVisible = true;
        this.container.classList.remove('hidden');
        this.updateDisplay();
    }

    hide() {
        this.isVisible = false;
        this.container.classList.add('hidden');
        
        if (this.game.playerTank) {
            this.game.playerTank.completeStatAllocation();
        }
    }

    updateDisplay() {
        if (!this.game.playerTank) return;
        const tank = this.game.playerTank;
        
        if (!tank.stats || typeof tank.stats !== 'object') {
            tank.stats = {
                healthRegen: 0, maxHealth: 0, bodyDamage: 0, bulletSpeed: 0,
                bulletPenetration: 0, bulletDamage: 0, reload: 0, movementSpeed: 0
            };
        }
        
        const statPoints = tank.getStatPoints ? tank.getStatPoints() : (tank.statPoints || 0);
        if (statPoints <= 0 && this.isVisible) {
            this.hide();
            return;
        }
        
        // Update stat points available
        const pointsEl = this.container.querySelector('#statPointsAvailable');
        if (pointsEl) pointsEl.textContent = statPoints;
        
        // Update all stat values (show max indicator if at limit)
        // All stats display only the allocated stat points (0-7), not base/default values
        Object.keys(tank.stats).forEach(statName => {
            const valueEl = this.container.querySelector(`#stat-${statName}`);
            if (valueEl) {
                const statValue = tank.stats[statName] || 0;
                const isAtMax = statValue >= GameConfig.TANK.MAX_STAT_POINTS;
                
                // All stats display consistently: just the allocated points (0-7)
                if (isAtMax) {
                    valueEl.textContent = `${statValue} (MAX)`;
                    valueEl.style.color = '#ffd700';
                } else {
                    valueEl.textContent = statValue;
                    valueEl.style.color = '#4ecdc4';
                }
            }
        });
        
        const closeBtn = this.container.querySelector('#closeStatUI');
        if (closeBtn) closeBtn.textContent = statPoints > 0 ? `Close (${statPoints} pts left)` : 'Close';
        
        // Enable/disable stat buttons based on available points and max limit
        const statButtons = this.container.querySelectorAll('.stat-btn');
        statButtons.forEach(btn => {
            const statName = btn.dataset.stat;
            const currentStatValue = tank.stats[statName] || 0;
            const isAtMax = currentStatValue >= GameConfig.TANK.MAX_STAT_POINTS;
            const hasPoints = tank.getStatPoints() > 0;
            
            if (hasPoints && !isAtMax) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.title = '';
            } else {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                if (isAtMax) {
                    btn.title = 'Maximum reached (7/7)';
                } else {
                    btn.title = 'No stat points available';
                }
            }
        });
    }

    isOpen() {
        return this.isVisible;
    }
}

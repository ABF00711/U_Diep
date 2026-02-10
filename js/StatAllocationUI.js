// Stat Allocation UI Component

class StatAllocationUI {
    constructor(game) {
        this.game = game;
        this.container = null;
        this.isVisible = false;
        this.createUI();
    }

    createUI() {
        // Create stat allocation overlay
        this.container = document.createElement('div');
        this.container.id = 'statAllocationUI';
        this.container.className = 'hidden';
        this.container.innerHTML = `
            <div class="stat-allocation-panel">
                <h2>Level Up! Allocate Stat Points</h2>
                <div class="stat-points-display">
                    <span id="statPointsAvailable">0</span> points available
                </div>
                <div class="stats-grid">
                    <div class="stat-row" data-stat="healthRegen">
                        <span class="stat-name">Health Regen</span>
                        <span class="stat-value" id="stat-healthRegen">0</span>
                        <button class="stat-btn" data-stat="healthRegen">+</button>
                    </div>
                    <div class="stat-row" data-stat="maxHealth">
                        <span class="stat-name">Max Health</span>
                        <span class="stat-value" id="stat-maxHealth">0</span>
                        <button class="stat-btn" data-stat="maxHealth">+</button>
                    </div>
                    <div class="stat-row" data-stat="bodyDamage">
                        <span class="stat-name">Body Damage</span>
                        <span class="stat-value" id="stat-bodyDamage">0</span>
                        <button class="stat-btn" data-stat="bodyDamage">+</button>
                    </div>
                    <div class="stat-row" data-stat="bulletSpeed">
                        <span class="stat-name">Bullet Speed</span>
                        <span class="stat-value" id="stat-bulletSpeed">0</span>
                        <button class="stat-btn" data-stat="bulletSpeed">+</button>
                    </div>
                    <div class="stat-row" data-stat="bulletPenetration">
                        <span class="stat-name">Bullet Penetration</span>
                        <span class="stat-value" id="stat-bulletPenetration">0</span>
                        <button class="stat-btn" data-stat="bulletPenetration">+</button>
                    </div>
                    <div class="stat-row" data-stat="bulletDamage">
                        <span class="stat-name">Bullet Damage</span>
                        <span class="stat-value" id="stat-bulletDamage">0</span>
                        <button class="stat-btn" data-stat="bulletDamage">+</button>
                    </div>
                    <div class="stat-row" data-stat="reload">
                        <span class="stat-name">Reload</span>
                        <span class="stat-value" id="stat-reload">0</span>
                        <button class="stat-btn" data-stat="reload">+</button>
                    </div>
                    <div class="stat-row" data-stat="movementSpeed">
                        <span class="stat-name">Movement Speed</span>
                        <span class="stat-value" id="stat-movementSpeed">0</span>
                        <button class="stat-btn" data-stat="movementSpeed">+</button>
                    </div>
                </div>
                <div class="stat-allocation-actions">
                    <button id="closeStatUI" class="close-btn">Continue (${this.game.playerTank?.statPoints || 0} points remaining)</button>
                </div>
            </div>
        `;
        
        document.getElementById('uiOverlay').appendChild(this.container);
        this.setupEventListeners();
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
        
        const success = this.game.playerTank.allocateStatPoint(statName);
        if (success) {
            this.updateDisplay();
            // Play sound or visual feedback (optional)
        } else {
            // Show feedback if allocation failed (max reached or no points)
            const tank = this.game.playerTank;
            if (tank.stats[statName] >= GameConfig.TANK.MAX_STAT_POINTS) {
                // Stat is at maximum
                const statBtn = this.container.querySelector(`[data-stat="${statName}"]`);
                if (statBtn) {
                    statBtn.style.background = '#e24a4a';
                    setTimeout(() => {
                        statBtn.style.background = '';
                    }, 200);
                }
            }
        }
    }

    show() {
        if (!this.game.playerTank) return;
        
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
        
        // Update stat points available
        const pointsEl = this.container.querySelector('#statPointsAvailable');
        if (pointsEl) {
            pointsEl.textContent = tank.getStatPoints();
        }
        
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
        
        // Update close button
        const closeBtn = this.container.querySelector('#closeStatUI');
        if (closeBtn) {
            const points = tank.getStatPoints();
            if (points > 0) {
                closeBtn.textContent = `Continue (${points} points remaining)`;
                closeBtn.classList.add('has-points');
            } else {
                closeBtn.textContent = 'Continue';
                closeBtn.classList.remove('has-points');
            }
        }
        
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

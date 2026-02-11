// Economy Class - Manages player balance, wagers, and transactions

class Economy {
    constructor(initialBalance = GameConfig.ECONOMY.INITIAL_BALANCE) {
        this.balance = initialBalance; // Current balance (Test Coins)
        this.initialBalance = initialBalance; // Starting balance
        this.currentWager = 0; // Current wager in active room
        this.wagerHistory = []; // History of wagers
        this.transactionHistory = []; // All transactions (deposits, withdrawals, wagers, refunds)
    }

    /**
     * Get current balance
     */
    getBalance() {
        return this.balance;
    }

    /**
     * Check if player has enough balance for a wager
     */
    canAfford(amount) {
        return this.balance >= amount;
    }

    /**
     * Wager money to join a room
     * @param {number} amount - Amount to wager ($1, $5, or $10)
     * @returns {boolean} - True if wager successful, false if insufficient funds
     */
    wager(amount) {
        if (!this.canAfford(amount)) {
            return false; // Insufficient funds
        }

        this.balance -= amount;
        this.currentWager = amount;
        
        // Record transaction
        const transaction = {
            type: 'wager',
            amount: amount,
            balanceAfter: this.balance,
            timestamp: Date.now()
        };
        
        this.transactionHistory.push(transaction);
        this.wagerHistory.push({
            amount: amount,
            timestamp: Date.now()
        });

        return true;
    }

    /**
     * Refund wager (for kill button - 90% refund, 10% fee)
     * @returns {object} - { refunded: amount, fee: amount }
     */
    refundKillButton() {
        if (this.currentWager === 0) {
            return { refunded: 0, fee: 0 };
        }

        const fee = this.currentWager * GameConfig.ECONOMY.KILL_BUTTON_FEE_PERCENT;
        const refunded = this.currentWager * GameConfig.ECONOMY.KILL_BUTTON_REFUND_PERCENT;
        
        this.balance += refunded;
        
        // Record transaction
        const transaction = {
            type: 'kill_button_refund',
            wagerAmount: this.currentWager,
            refunded: refunded,
            fee: fee,
            balanceAfter: this.balance,
            timestamp: Date.now()
        };
        
        this.transactionHistory.push(transaction);
        
        const result = {
            refunded: refunded,
            fee: fee,
            originalWager: this.currentWager
        };
        
        this.currentWager = 0; // Clear wager
        
        return result;
    }

    /**
     * Full refund (for disconnect - 100% refund)
     * @returns {number} - Amount refunded
     */
    refundDisconnect() {
        if (this.currentWager === 0) {
            return 0;
        }

        const refunded = this.currentWager; // 100% refund
        
        this.balance += refunded;
        
        // Record transaction
        const transaction = {
            type: 'disconnect_refund',
            wagerAmount: this.currentWager,
            refunded: refunded,
            balanceAfter: this.balance,
            timestamp: Date.now()
        };
        
        this.transactionHistory.push(transaction);
        
        this.currentWager = 0; // Clear wager
        
        return refunded;
    }

    /**
     * Add reward from killing another player
     * @param {number} amount - Amount received (90% of victim's stake)
     */
    addKillReward(amount) {
        this.balance += amount;
        
        // Record transaction
        const transaction = {
            type: 'kill_reward',
            amount: amount,
            balanceAfter: this.balance,
            timestamp: Date.now()
        };
        
        this.transactionHistory.push(transaction);
    }

    /**
     * Add platform fee (for server/admin tracking)
     * Note: This doesn't affect player balance, just for tracking
     * @param {number} amount - Platform fee amount (10% of stake)
     */
    recordPlatformFee(amount) {
        const transaction = {
            type: 'platform_fee',
            amount: amount,
            timestamp: Date.now()
        };
        
        this.transactionHistory.push(transaction);
    }

    /**
     * Deposit money (for testing/alpha)
     * @param {number} amount - Amount to deposit
     */
    deposit(amount) {
        this.balance += amount;
        
        const transaction = {
            type: 'deposit',
            amount: amount,
            balanceAfter: this.balance,
            timestamp: Date.now()
        };
        
        this.transactionHistory.push(transaction);
    }

    /**
     * Withdraw money (cash out)
     * @param {number} amount - Amount to withdraw
     * @returns {boolean} - True if successful, false if insufficient funds
     */
    withdraw(amount) {
        if (!this.canAfford(amount)) {
            return false;
        }

        if (this.currentWager > 0) {
            return false; // Cannot withdraw while in a match
        }

        this.balance -= amount;
        
        const transaction = {
            type: 'withdrawal',
            amount: amount,
            balanceAfter: this.balance,
            timestamp: Date.now()
        };
        
        this.transactionHistory.push(transaction);
        
        return true;
    }

    /**
     * Get transaction history
     * @param {number} limit - Maximum number of transactions to return
     * @returns {array} - Array of transactions
     */
    getTransactionHistory(limit = 50) {
        return this.transactionHistory.slice(-limit).reverse(); // Most recent first
    }

    /**
     * Get current wager amount
     */
    getCurrentWager() {
        return this.currentWager;
    }

    /**
     * Check if player is currently in a match (has active wager)
     */
    isInMatch() {
        return this.currentWager > 0;
    }

    /**
     * Set balance directly (for server updates)
     * @param {number} amount - New balance amount
     */
    setBalance(amount) {
        this.balance = amount;
    }

    /**
     * Refund wager (full refund, for server-side refunds)
     * @param {number} amount - Amount to refund
     */
    refundWager(amount) {
        this.balance += amount;
        this.currentWager = 0;
        
        const transaction = {
            type: 'refund',
            amount: amount,
            balanceAfter: this.balance,
            timestamp: Date.now()
        };
        
        this.transactionHistory.push(transaction);
    }

    /**
     * Reset economy (for testing/new game)
     */
    reset(initialBalance = GameConfig.ECONOMY.INITIAL_BALANCE) {
        this.balance = initialBalance;
        this.initialBalance = initialBalance;
        this.currentWager = 0;
        this.wagerHistory = [];
        this.transactionHistory = [];
    }
}

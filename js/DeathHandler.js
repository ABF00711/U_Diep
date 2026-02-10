// Death Handler - Handles player death logic

class DeathHandler {
    constructor(game) {
        this.game = game;
    }

    /**
     * Handle player death (lose entire stake)
     * @param {string} reason - Reason for death (e.g., 'bullet', 'bot', 'tank_collision')
     */
    handlePlayerDeath(reason = 'unknown') {
        if (!this.game.economy.isInMatch()) {
            return; // Not in a match, no stake to lose
        }

        const lostWager = this.game.economy.getCurrentWager();
        
        // Clear wager (player lost it all)
        this.game.economy.currentWager = 0;
        
        console.log(`Player died (${reason})! Lost entire wager: $${lostWager}`);
        this.game.showMessage(`You died! Lost $${lostWager}`, GameConfig.UI.MESSAGE_DURATION_LONG);
        this.game.updateBalanceDisplay();
        
        // Exit game
        this.game.killSelf();
    }

    /**
     * Handle kill button exit (10% fee, 90% refund)
     */
    handleKillButtonExit() {
        if (!this.game.economy.isInMatch()) {
            return;
        }

        const refund = this.game.economy.refundKillButton();
        console.log(`Kill button: Refunded $${refund.refunded.toFixed(2)}, Fee: $${refund.fee.toFixed(2)}`);
        
        this.game.showMessage(
            `Exited match. Refunded: $${refund.refunded.toFixed(2)} (Fee: $${refund.fee.toFixed(2)})`,
            GameConfig.UI.MESSAGE_DURATION_LONG
        );
        this.game.updateBalanceDisplay();
    }
}

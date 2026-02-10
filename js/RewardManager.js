// Reward Manager - Handles all reward calculations and distributions

class RewardManager {
    constructor(economy) {
        this.economy = economy;
    }

    /**
     * Calculate kill reward (90% of victim's stake)
     * @param {number} victimStake - Victim's wager amount
     * @returns {object} - { reward: number, platformFee: number }
     */
    calculateKillReward(victimStake) {
        const reward = victimStake * GameConfig.ECONOMY.KILL_REWARD_PERCENT;
        const platformFee = victimStake * GameConfig.ECONOMY.PLATFORM_FEE_PERCENT;
        
        return {
            reward: reward,
            platformFee: platformFee,
            victimStake: victimStake
        };
    }

    /**
     * Give kill reward to player
     * @param {number} victimStake - Victim's wager amount
     */
    giveKillReward(victimStake) {
        const calculation = this.calculateKillReward(victimStake);
        
        this.economy.addKillReward(calculation.reward);
        this.economy.recordPlatformFee(calculation.platformFee);
        
        return calculation;
    }

    /**
     * Get default victim stake (for testing - will be replaced with actual stake from victim)
     * @returns {number}
     */
    getDefaultVictimStake() {
        return GameConfig.ECONOMY.DEFAULT_VICTIM_STAKE;
    }
}

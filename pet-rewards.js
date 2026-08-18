// Rewards use Taiwan local dates so midnight does not shift across UTC.
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const DAILY_REWARD = 'dailyWorkCompleted';
    const HATCH_COST = 7;
    const signatureFor = parts => Object.keys(parts || {}).sort().map(key => `${key}:${parts[key] || ''}`).join('|');

    function taiwanDateKey(date = new Date()) {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(date);
    }

    function hasReward(state, date, rewardType = DAILY_REWARD) {
        return state.rewards.some(reward => reward.date === date && reward.rewardType === rewardType);
    }

    function grantDailyFragment(state, date = taiwanDateKey()) {
        if (hasReward(state, date)) return { state, granted: false };
        const reward = { date, rewardType: DAILY_REWARD, amount: 1, source: DAILY_REWARD, grantedAt: new Date().toISOString() };
        return {
            granted: true,
            state: {
                ...state,
                resources: { ...state.resources, eggFragments: state.resources.eggFragments + 1 },
                rewards: [...state.rewards, reward],
            },
        };
    }

    function canHatch(state) {
        return state.resources.eggFragments >= HATCH_COST;
    }

    function duplicateReward(rarity) {
        return { common: 10, rare: 20, epic: 50, hidden: 100 }[rarity] || 10;
    }

    function commitHatch(state, pet) {
        if (!canHatch(state)) throw new Error('Not enough egg fragments');
        const signature = signatureFor(pet.parts);
        const duplicate = state.pets.some(existing => signatureFor(existing.parts) === signature);
        const next = {
            ...state,
            resources: { ...state.resources, eggFragments: state.resources.eggFragments - HATCH_COST },
            hatchState: { ...state.hatchState, totalHatches: state.hatchState.totalHatches + 1, firstHatchCompleted: true },
        };
        if (duplicate) {
            return { duplicate: true, dust: duplicateReward(pet.rarity), state: { ...next, resources: { ...next.resources, crystalDust: next.resources.crystalDust + duplicateReward(pet.rarity) } } };
        }
        return { duplicate: false, dust: 0, state: { ...next, pets: [...next.pets, pet], activePetId: next.activePetId || pet.petId } };
    }

    return { HATCH_COST, DAILY_REWARD, taiwanDateKey, hasReward, grantDailyFragment, canHatch, duplicateReward, commitHatch };
});

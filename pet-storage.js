// Persistent state for the companion system. This key is separate from timecard data.
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const STORAGE_KEY = 'time8hcf_pet_system';
    const SCHEMA_VERSION = 1;

    function emptyState() {
        return {
            schemaVersion: SCHEMA_VERSION,
            resources: { eggFragments: 0, crystalDust: 0 },
            pets: [],
            activePetId: null,
            rewards: [],
            hatchState: { totalHatches: 0, firstHatchCompleted: false, firstHatchRerollUsed: false },
        };
    }

    function readPetSystem() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return emptyState();
            const parsed = JSON.parse(raw);
            return {
                ...emptyState(),
                ...parsed,
                resources: { ...emptyState().resources, ...(parsed.resources || {}) },
                hatchState: { ...emptyState().hatchState, ...(parsed.hatchState || {}) },
                pets: Array.isArray(parsed.pets) ? parsed.pets : [],
                rewards: Array.isArray(parsed.rewards) ? parsed.rewards : [],
            };
        } catch (error) {
            console.warn('[pet-storage] invalid state, reset in memory', error);
            return emptyState();
        }
    }

    function writePetSystem(state) {
        const next = { ...state, schemaVersion: SCHEMA_VERSION };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
    }

    function updatePetSystem(mutator) {
        const current = readPetSystem();
        const next = mutator(current);
        if (!next || typeof next !== 'object') throw new Error('Invalid pet system state');
        return writePetSystem(next);
    }

    function activePet(state = readPetSystem()) {
        return state.pets.find(pet => pet.petId === state.activePetId) || null;
    }

    function partSignature(parts = {}) {
        return Object.keys(parts).sort().map(key => `${key}:${parts[key] || ''}`).join('|');
    }

    return { PET_STORAGE_KEY: STORAGE_KEY, readPetSystem, writePetSystem, updatePetSystem, activePet, partSignature };
});

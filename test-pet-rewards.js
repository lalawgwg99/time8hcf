const assert = require('node:assert/strict');
const { grantDailyFragment, canHatch, commitHatch, HATCH_COST, taiwanDateKey } = require('./pet-rewards.js');

let state = {
  schemaVersion: 1,
  resources: { eggFragments: 0, crystalDust: 0 },
  pets: [],
  activePetId: null,
  rewards: [],
  hatchState: { totalHatches: 0, firstHatchCompleted: false, firstHatchRerollUsed: false }
};

const day = '2026-08-18';
let reward = grantDailyFragment(state, day);
assert.equal(reward.granted, true);
state = reward.state;
assert.equal(state.resources.eggFragments, 1);
reward = grantDailyFragment(state, day);
assert.equal(reward.granted, false);
assert.equal(reward.state.resources.eggFragments, 1);

state = { ...state, resources: { ...state.resources, eggFragments: HATCH_COST } };
const pet = { petId: 'pet-a', rarity: 'rare', parts: { body: 'body-a', eyes: 'eyes-a' } };
assert.equal(canHatch(state), true);
const result = commitHatch(state, pet);
assert.equal(result.duplicate, false);
assert.equal(result.state.resources.eggFragments, 0);
assert.equal(result.state.pets.length, 1);
assert.equal(result.state.activePetId, 'pet-a');

const duplicateState = { ...result.state, resources: { ...result.state.resources, eggFragments: HATCH_COST } };
const duplicate = commitHatch(duplicateState, { ...pet, petId: 'pet-b' });
assert.equal(duplicate.duplicate, true);
assert.equal(duplicate.state.pets.length, 1);
assert.equal(duplicate.state.resources.crystalDust, 20);
assert.equal(duplicate.state.resources.eggFragments, 0);

assert.match(taiwanDateKey(new Date('2026-08-18T16:00:00Z')), /^2026-08-19$/);
console.log('pet-rewards tests: ok');

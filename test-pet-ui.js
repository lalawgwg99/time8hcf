const assert = require('node:assert/strict');
const { eggProgressStage, updateDailyPetReward } = require('./pet-ui.js');
for (const [input, expected] of [[0, 0], [1, 1], [2, 1], [3, 3], [4, 3], [5, 5], [6, 6], [7, 7], [9, 7]]) {
  assert.equal(eggProgressStage(input), expected, `${input} -> ${expected}`);
}

const globalNames = ['readPetSystem', 'grantDailyFragment', 'writePetSystem', 'document', 'setTimeout', 'clearTimeout'];
const originalGlobals = Object.fromEntries(globalNames.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
const messages = [];
let state = { resources: { eggFragments: 0 } };
let grantCalls = 0;
let writeCalls = 0;
const toast = {
  textContent: '',
  classList: {
    add: () => messages.push(toast.textContent),
    remove: () => {},
  },
};
globalThis.readPetSystem = () => state;
globalThis.grantDailyFragment = current => {
  grantCalls += 1;
  return grantCalls === 1
    ? { granted: true, state: { ...current, resources: { eggFragments: 1 } } }
    : { granted: false, state: current };
};
globalThis.writePetSystem = next => { state = next; writeCalls += 1; };
globalThis.document = { getElementById: () => toast, createElement: () => toast, body: { appendChild: () => {} } };
globalThis.setTimeout = () => 1;
globalThis.clearTimeout = () => {};
try {
  updateDailyPetReward(false);
  assert.equal(grantCalls, 0, 'incomplete workday does not check or grant a reward');

  updateDailyPetReward(true);
  assert.equal(writeCalls, 1);
  assert.deepEqual(messages, ['🌱 今日工時達成 · 獲得星軌碎片 ×1']);

  updateDailyPetReward(true);
  assert.equal(writeCalls, 1, 'duplicate daily reward must not write state again');
  assert.deepEqual(messages, ['🌱 今日工時達成 · 獲得星軌碎片 ×1'], 'duplicate daily reward must stay silent');
} finally {
  for (const name of globalNames) {
    if (originalGlobals[name]) Object.defineProperty(globalThis, name, originalGlobals[name]);
    else delete globalThis[name];
  }
}

console.log('pet-ui egg progress tests: ok');

const assert = require('node:assert/strict');
const { eggProgressStage } = require('./pet-ui.js');
for (const [input, expected] of [[0, 0], [1, 1], [2, 1], [3, 3], [4, 3], [5, 5], [6, 6], [7, 7], [9, 7]]) {
  assert.equal(eggProgressStage(input), expected, `${input} -> ${expected}`);
}
console.log('pet-ui egg progress tests: ok');

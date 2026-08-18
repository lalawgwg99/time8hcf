const assert = require('node:assert/strict');
const core = require('./pet-generator.js');
const catalog = require('./pet-parts.js');

const validation = core.validatePetParts(catalog.petParts);
assert.equal(validation.valid, true, validation.errors.join('\n'));

for (let i = 0; i < 300; i += 1) {
    const first = core.generateBestPet({ isFirstHatch: true }, 3);
    assert.equal(first.schemaVersion, 1);
    assert.match(first.petId, /^pet_/);
    assert.equal(typeof first.parts, 'object');
    assert.ok(Object.values(first.parts).every(id => id === null || typeof id === 'string'));
    assert.ok(['rare', 'epic', 'hidden'].includes(first.rarity), `first rarity=${first.rarity}`);

    const normal = core.generateBestPet({}, 3);
    assert.ok(['common', 'rare', 'epic', 'hidden'].includes(normal.rarity));

    const resolved = core.resolveParts(first.parts);
    const selected = Object.values(resolved).filter(Boolean);
    const mainAccessories = selected.filter(part => part.accessoryType === 'main');
    const effects = selected.filter(part => part.accessoryType === 'effect');
    assert.ok(mainAccessories.length <= 1);
    assert.ok(effects.length <= 1);
    assert.equal(core.findHighestRarity(resolved), first.rarity);

    for (const part of selected) assert.equal(core.hasConflict(part, resolved), false, `self conflict on ${part.id}`);
}

const legacy = core.migratePet({ petId: 'legacy', parts: { body: { id: 'body_crystal_round_purple_01' } } });
assert.equal(legacy.schemaVersion, 1);
assert.equal(legacy.parts.body, 'body_crystal_round_purple_01');

const fallback = core.resolveParts({ body: 'missing-body-id', eyes: 'missing-eye-id' });
assert.equal(fallback.body.rarity, 'common');
assert.equal(fallback.eyes.rarity, 'common');

const symmetricConflict = core.hasConflict(
    { id: 'candidate', conflicts: [] },
    { body: { id: 'selected', conflicts: ['candidate'] } }
);
assert.equal(symmetricConflict, true);

console.log('pet-generator tests: ok');

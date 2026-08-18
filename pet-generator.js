// Controlled random pet generation and persistence helpers.
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        const catalog = require('./pet-parts.js');
        module.exports = factory(catalog.petParts, catalog.rarityWeights);
        return;
    }
    const api = factory(root.petParts || [], root.rarityWeights || {});
    Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (petParts, rarityWeights) {
    const RARITY_ORDER = { common: 0, rare: 1, epic: 2, hidden: 3 };
    const DRAW_CATEGORIES = ['eyes', 'mouth', 'ears', 'tail', 'feet', 'arms', 'head', 'headAccessory', 'bodyAccessory', 'effectBack', 'effectFront'];
    const FIRST_HATCH_WEIGHTS = { rare: 75, epic: 22, hidden: 3 };
    const PART_CATEGORIES = new Set(['body', ...DRAW_CATEGORIES]);

    function weightedRandom(items, weightKey = 'weight', random = Math.random) {
        if (!Array.isArray(items) || items.length === 0) return null;
        const normalized = items.map(item => ({ ...item, [weightKey]: Math.max(Number(item[weightKey]) || 0, 0) }));
        const total = normalized.reduce((sum, item) => sum + item[weightKey], 0);
        if (total <= 0) return normalized[Math.floor(Math.min(random(), 0.999999) * normalized.length)];
        let roll = random() * total;
        for (const item of normalized) {
            roll -= item[weightKey];
            if (roll <= 0) return item;
        }
        return normalized[normalized.length - 1];
    }

    function randomId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `pet_${crypto.randomUUID()}`;
        return `pet_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }

    function rollRarity(isFirstHatch, random = Math.random) {
        const weights = isFirstHatch ? FIRST_HATCH_WEIGHTS : rarityWeights;
        return weightedRandom(Object.entries(weights).map(([rarity, weight]) => ({ rarity, weight })), 'weight', random)?.rarity || 'common';
    }

    function isRarityAllowed(partRarity, targetRarity) {
        return partRarity === 'common' || RARITY_ORDER[partRarity] === RARITY_ORDER[targetRarity];
    }

    function selectedIds(selectedParts) {
        return Object.values(selectedParts).filter(Boolean).map(part => part.id);
    }

    function hasConflict(candidate, selectedParts) {
        if (!candidate) return false;
        const ids = new Set(selectedIds(selectedParts));
        if ((candidate.conflicts || []).some(id => ids.has(id))) return true;
        return Object.values(selectedParts).filter(Boolean).some(selected => (selected.conflicts || []).includes(candidate.id));
    }

    function isBodyCompatible(part, body) {
        if (!part || !body) return false;
        const allowed = part.compatibleBodies;
        return !Array.isArray(allowed) || allowed.length === 0 || allowed.includes('*') || allowed.includes(body.id) || allowed.includes(body.style);
    }

    function selectSeries(targetRarity, random = Math.random) {
        const eligible = petParts.filter(part => isRarityAllowed(part.rarity, targetRarity));
        const series = [...new Set(eligible.map(part => part.series))];
        if (!series.length) throw new Error(`No pet series available for rarity: ${targetRarity}`);
        return series[Math.floor(random() * series.length)];
    }

    function selectBody(series, targetRarity, random = Math.random) {
        let candidates = petParts.filter(part => part.category === 'body' && part.series === series && isRarityAllowed(part.rarity, targetRarity));
        if (!candidates.length) candidates = petParts.filter(part => part.category === 'body' && part.series === series && part.rarity === 'common');
        const body = weightedRandom(candidates, 'weight', random);
        if (!body) throw new Error(`No body available for series: ${series}`);
        return body;
    }

    function hasVisualConflict(candidate, selectedParts) {
        if (hasConflict(candidate, selectedParts)) return true;
        const selected = Object.values(selectedParts).filter(Boolean);
        if (candidate.accessoryType === 'main' && selected.some(part => part.accessoryType === 'main')) return true;
        if (candidate.accessoryType === 'effect' && selected.some(part => part.accessoryType === 'effect')) return true;
        if (candidate.category === 'headAccessory' && selected.some(part => part.category === 'ears' && part.large) && candidate.compatibleWithLargeEars !== true) return true;
        if (candidate.category === 'ears' && candidate.large && selected.some(part => part.category === 'headAccessory' && part.compatibleWithLargeEars !== true)) return true;
        return false;
    }

    function candidatesFor(category, series, targetRarity, body, selectedParts, isFirstHatch) {
        let candidates = petParts.filter(part =>
            part.category === category && part.series === series && isRarityAllowed(part.rarity, targetRarity) &&
            isBodyCompatible(part, body) && !hasVisualConflict(part, selectedParts)
        );
        if (isFirstHatch && ['feet', 'arms', 'tail'].includes(category)) {
            const nonEmpty = candidates.filter(part => part.style !== 'none');
            if (nonEmpty.length) candidates = nonEmpty;
        }
        return candidates;
    }

    function ensureTargetRarity(selectedParts, series, body, targetRarity, random = Math.random) {
        if (targetRarity === 'common' || Object.values(selectedParts).some(part => part?.rarity === targetRarity)) return selectedParts;
        let replaceable = DRAW_CATEGORIES.flatMap(category => petParts.filter(part =>
            part.category === category && part.series === series && part.rarity === targetRarity &&
            isBodyCompatible(part, body) && !hasVisualConflict(part, selectedParts)
        ));
        if (!replaceable.length) replaceable = DRAW_CATEGORIES.flatMap(category => petParts.filter(part =>
            part.category === category && part.rarity === targetRarity &&
            isBodyCompatible(part, body) && !hasVisualConflict(part, selectedParts)
        ));
        const forced = weightedRandom(replaceable, 'weight', random);
        if (forced) selectedParts[forced.category] = forced;
        return selectedParts;
    }

    function findHighestRarity(parts) {
        return Object.values(parts).filter(Boolean).reduce((highest, part) =>
            (RARITY_ORDER[part.rarity] || 0) > (RARITY_ORDER[highest] || 0) ? part.rarity : highest, 'common');
    }

    function toPartIds(parts) {
        return Object.fromEntries([...PART_CATEGORIES].map(category => [category, parts[category]?.id || null]));
    }

    function scorePetAppearance(pet) {
        const parts = Object.values(pet.resolvedParts || {}).filter(Boolean);
        if (!parts.length) return -Infinity;
        const colors = new Set(parts.map(part => part.colorFamily).filter(Boolean));
        const accessories = parts.filter(part => part.accessoryType === 'main');
        const hasHandsOrFeet = Boolean(pet.resolvedParts.arms || pet.resolvedParts.feet);
        let score = 0;
        if (parts.every(part => !part.colorFamily || part.colorFamily === pet.colorFamily)) score += 3;
        if (parts.every(part => !part.series || part.series === pet.series)) score += 3;
        if (pet.resolvedParts.eyes) score += 2;
        if (hasHandsOrFeet) score += 1;
        if (accessories.length <= 1) score += 2;
        if (!(pet.resolvedParts.effectBack && pet.resolvedParts.effectFront)) score += 2;
        if (pet.resolvedParts.ears?.large && pet.resolvedParts.headAccessory && pet.resolvedParts.headAccessory.compatibleWithLargeEars !== true) score -= 3;
        if (colors.size > 3) score -= 4;
        if (!pet.resolvedParts.arms && !pet.resolvedParts.feet && !pet.resolvedParts.tail) score -= 3;
        return score;
    }

    function resolveParts(parts, catalog = petParts) {
        const byId = new Map(catalog.map(part => [part.id, part]));
        return Object.fromEntries([...PART_CATEGORIES].map(category => {
            const id = parts?.[category];
            const exact = id ? byId.get(id) : null;
            if (exact) return [category, exact];
            const fallback = catalog.find(part => part.category === category && part.rarity === 'common') || null;
            return [category, fallback];
        }));
    }

    function generatePet({ isFirstHatch = false, random = Math.random, maxRetries = 8 } = {}) {
        let lastError = null;
        for (let attempt = 0; attempt < maxRetries; attempt += 1) {
            try {
                return generatePetOnce({ isFirstHatch, random });
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError || new Error('Pet generation failed');
    }

    function generatePetOnce({ isFirstHatch = false, random = Math.random } = {}) {
        const targetRarity = rollRarity(isFirstHatch, random);
        const series = selectSeries(targetRarity, random);
        const body = selectBody(series, targetRarity, random);
        const selected = { body };
        for (const category of DRAW_CATEGORIES) {
            selected[category] = weightedRandom(candidatesFor(category, series, targetRarity, body, selected, isFirstHatch), 'weight', random);
        }
        ensureTargetRarity(selected, series, body, targetRarity, random);
        if (!selected.eyes) throw new Error(`No compatible eyes found for series: ${series}`);
        if (isFirstHatch && !Object.values(selected).some(part => part?.rarity === targetRarity)) {
            throw new Error(`Target rarity unavailable: ${targetRarity}`);
        }
        const actualRarity = findHighestRarity(selected);
        return {
            schemaVersion: 1,
            petId: randomId(),
            name: `${series} Seiki`,
            series,
            rarity: actualRarity,
            colorFamily: body.colorFamily,
            parts: toPartIds(selected),
            obtainedFrom: 'rhythm_egg',
            generatedAt: new Date().toISOString(),
            isFavorite: false,
        };
    }

    function generateBestPet(options = {}, attempts = 3) {
        const count = Math.max(1, Number(attempts) || 3);
        const candidates = Array.from({ length: count }, () => {
            const pet = generatePet(options);
            return { pet, score: scorePetAppearance({ ...pet, resolvedParts: resolveParts(pet.parts) }) };
        });
        return candidates.sort((a, b) => b.score - a.score)[0].pet;
    }

    function migratePet(pet) {
        if (!pet || typeof pet !== 'object') return null;
        if (pet.schemaVersion === 1 && pet.parts && !Array.isArray(pet.parts)) return pet;
        const legacyParts = pet.parts || {};
        const parts = Object.fromEntries([...PART_CATEGORIES].map(category => [category, legacyParts[category]?.id || legacyParts[category] || null]));
        return { ...pet, schemaVersion: 1, petId: pet.petId || randomId(), parts, generatedAt: pet.generatedAt || new Date().toISOString() };
    }

    function validatePetParts(catalog = petParts) {
        const errors = [];
        const ids = new Set();
        catalog.forEach((part, index) => {
            if (!part.id || typeof part.id !== 'string') errors.push(`part[${index}] invalid id`);
            if (ids.has(part.id)) errors.push(`duplicate id: ${part.id}`);
            ids.add(part.id);
            for (const key of ['category', 'series', 'rarity', 'style', 'assetPath']) if (!part[key]) errors.push(`${part.id || index} missing ${key}`);
            if (!PART_CATEGORIES.has(part.category)) errors.push(`${part.id || index} invalid category`);
            if (!Object.hasOwn(RARITY_ORDER, part.rarity)) errors.push(`${part.id || index} invalid rarity`);
            if (!Array.isArray(part.compatibleBodies)) errors.push(`${part.id || index} invalid compatibleBodies`);
            if (!Array.isArray(part.conflicts)) errors.push(`${part.id || index} invalid conflicts`);
            if (typeof part.weight !== 'number' || part.weight < 0) errors.push(`${part.id || index} invalid weight`);
        });
        return { valid: errors.length === 0, errors };
    }

    return { RARITY_ORDER, DRAW_CATEGORIES, FIRST_HATCH_WEIGHTS, weightedRandom, rollRarity, isRarityAllowed, hasConflict, isBodyCompatible, selectSeries, selectBody, ensureTargetRarity, findHighestRarity, toPartIds, resolveParts, scorePetAppearance, generatePet, generateBestPet, migratePet, validatePetParts };
});

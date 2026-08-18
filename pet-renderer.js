// Render persisted Part IDs in a stable layer order.
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const LAYER_ORDER = ['effectBack', 'tail', 'body', 'feet', 'arms', 'head', 'eyes', 'mouth', 'ears', 'headAccessory', 'bodyAccessory', 'effectFront'];
    const CLASS_BY_CATEGORY = Object.fromEntries(LAYER_ORDER.map(category => [category, `pet-layer ${category}`]));

    function renderPet(container, pet, resolvedParts) {
        if (!container) return;
        container.innerHTML = '';
        container.setAttribute('role', 'img');
        container.setAttribute('aria-label', `${pet.name || '夥伴'}，${pet.rarity || 'common'} 稀有度`);
        const art = document.createElement('div');
        art.className = 'partner-art';
        for (const category of LAYER_ORDER) {
            if (!resolvedParts?.[category]) continue;
            const layer = document.createElement('div');
            layer.className = CLASS_BY_CATEGORY[category];
            layer.dataset.partId = resolvedParts[category].id;
            layer.dataset.assetPath = resolvedParts[category].assetPath || '';
            layer.title = resolvedParts[category].style || category;
            art.appendChild(layer);
        }
        container.appendChild(art);
    }

    return { PET_LAYER_ORDER: LAYER_ORDER, renderPet };
});

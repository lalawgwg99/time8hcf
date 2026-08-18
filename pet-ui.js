// Partner room UI and hatch transaction orchestration.
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const HATCH_COST = 7;
    const RARITY_LABELS = { common: '一般', rare: '稀有', epic: '珍稀', hidden: '隱藏' };
    let hatchLocked = false;

    function byId(id) { return document.getElementById(id); }

    function showNotice(id, message) {
        const el = byId(id);
        if (!el) return;
        el.textContent = message;
        el.classList.toggle('visible', Boolean(message));
    }

    function eggProgressStage(fragmentCount) {
        const progress = Math.min(Math.max(Number(fragmentCount) || 0, 0), HATCH_COST);
        return progress >= 7 ? 7 : progress >= 6 ? 6 : progress >= 5 ? 5 : progress >= 3 ? 3 : progress >= 1 ? 1 : 0;
    }

    function renderMysteryEgg(container, fragmentCount) {
        if (!container) return;
        const progress = Math.min(Math.max(Number(fragmentCount) || 0, 0), HATCH_COST);
        const stage = eggProgressStage(progress);
        container.className = `partner-egg-stage egg-progress-${stage}`;
        container.setAttribute('aria-label', `神秘晶核蛋，蛋殼碎片 ${progress}/${HATCH_COST}`);
        container.innerHTML = `
            <div class="mystery-egg" aria-hidden="true">
                <div class="egg-shadow"></div>
                <div class="egg-shell">
                    <div class="egg-facet facet-a"></div>
                    <div class="egg-facet facet-b"></div>
                    <div class="egg-facet facet-c"></div>
                    <div class="egg-facet facet-d"></div>
                    <div class="egg-glint"></div>
                    <div class="egg-crack crack-a"></div>
                    <div class="egg-crack crack-b"></div>
                </div>
            </div>`;
    }

    function renderEmptyPartner(fragmentCount = 0) {
        renderMysteryEgg(byId('partnerEggVisual'), fragmentCount);
        const currentArt = byId('partnerPetArt');
        if (currentArt) currentArt.innerHTML = '';
        if (byId('partnerPetName')) byId('partnerPetName').textContent = '尚未取得夥伴';
        if (byId('partnerPetSeries')) byId('partnerPetSeries').textContent = '第一顆節奏蛋保證稀有以上';
        if (byId('partnerPetRarity')) byId('partnerPetRarity').textContent = '';
        if (byId('partnerPetRarity')) byId('partnerPetRarity').classList.add('partner-badge-hidden');
        if (byId('partnerPetStatus')) byId('partnerPetStatus').textContent = '尚未取得夥伴';
    }

    function renderPartnerRoom() {
        const state = readPetSystem();
        const pet = activePet(state);
        const count = Math.min(state.resources.eggFragments, HATCH_COST);
        renderMysteryEgg(byId('partnerEggVisual'), count);
        if (pet) {
            renderPet(byId('partnerPetArt'), pet, resolveParts(pet.parts));
            byId('partnerPetName').textContent = pet.name || '未命名夥伴';
            byId('partnerPetSeries').textContent = `${pet.series} 系列 · ${pet.colorFamily || '協調色系'}`;
            byId('partnerPetRarity').textContent = RARITY_LABELS[pet.rarity] || pet.rarity;
            byId('partnerPetRarity').classList.remove('partner-badge-hidden');
            byId('partnerPetStatus').textContent = pet.isFavorite ? '最愛夥伴' : '目前陪伴中';
        } else {
            renderEmptyPartner(count);
        }
        byId('partnerFragmentCount').textContent = `${count} / ${HATCH_COST}`;
        byId('partnerFragmentProgress').style.width = `${(count / HATCH_COST) * 100}%`;
        byId('partnerHatchHint').textContent = count >= HATCH_COST ? '節奏蛋準備完成' : `再完成 ${HATCH_COST - count} 個正常工作日`;
        byId('partnerHatchStatus').textContent = count >= HATCH_COST ? '裂紋已經亮起，可以開蛋' : '尚未達到開啟條件';
        const button = byId('hatchPetButton');
        if (button) {
            button.disabled = hatchLocked || !canHatch(state);
            button.hidden = !canHatch(state) && !hatchLocked;
        }

        const collection = byId('partnerCollection');
        if (collection) {
            collection.innerHTML = state.pets.length ? state.pets.map(item => `<div class="partner-collection-item"><strong>${item.name || '未命名夥伴'}</strong><small>${RARITY_LABELS[item.rarity] || item.rarity} · ${item.generatedAt.slice(0, 10)}</small></div>`).join('') : '<div class="partner-subtitle">尚未收藏夥伴</div>';
        }
    }

    function hatchPartnerEgg() {
        if (hatchLocked) return;
        const before = readPetSystem();
        if (!canHatch(before)) {
            showNotice('partnerHatchNotice', `蛋殼碎片不足，目前 ${before.resources.eggFragments} / ${HATCH_COST}`);
            return;
        }
        hatchLocked = true;
        const button = byId('hatchPetButton');
        if (button) { button.disabled = true; button.textContent = '生成中…'; }
        try {
            const pet = generateBestPet({ isFirstHatch: !before.hatchState.firstHatchCompleted }, 3);
            const validation = validatePetParts();
            if (!validation.valid) throw new Error('Invalid part data');
            const result = commitHatch(before, pet);
            writePetSystem(result.state);
            showNotice('partnerHatchNotice', result.duplicate ? `遇到重複夥伴，轉換晶體粉塵 ×${result.dust}` : `發現新夥伴：${pet.name} · ${RARITY_LABELS[pet.rarity] || pet.rarity}`);
            renderPartnerRoom();
        } catch (error) {
            console.error('[partner-hatch]', error);
            showNotice('partnerHatchNotice', '生成失敗，碎片未扣除，請重新嘗試');
        } finally {
            hatchLocked = false;
            if (button) { button.textContent = '開啟節奏蛋'; button.disabled = !canHatch(readPetSystem()); button.hidden = !canHatch(readPetSystem()); }
        }
    }

    function updateDailyPetReward(completed) {
        if (!completed) return;
        const before = readPetSystem();
        const result = grantDailyFragment(before);
        if (result.granted) {
            writePetSystem(result.state);
            showNotice('dailyPetRewardNotice', '今日工作完成 · 獲得蛋殼碎片 ×1 · 前往夥伴');
        } else {
            showNotice('dailyPetRewardNotice', '今日碎片已取得 · 可前往夥伴查看進度');
        }
    }

    return { eggProgressStage, renderPartnerRoom, hatchPartnerEgg, updateDailyPetReward };
});

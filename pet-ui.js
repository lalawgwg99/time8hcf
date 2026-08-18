// Time8 Zen Orbital Companion Stage and Codex Orchestration.
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    Object.assign(root, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const HATCH_COST = 7;
    const RARITY_LABELS = { common: '一般', rare: '稀有', epic: '珍稀', hidden: '隱藏' };

    const CODEX_SPECIES = [
        { id: 'crystal_starter', name: '紫晶幼靈', series: 'crystal', rarity: 'common', icon: '💎', desc: '初生紫晶靈體，能感應專注的心流波動。' },
        { id: 'moss_starter', name: '碧苔石精', series: 'moss', rarity: 'common', icon: '🌿', desc: '生長於靜心土壤，散發自然安寧氣息。' },
        { id: 'ember_starter', name: '熾焰火精', series: 'ember', rarity: 'common', icon: '🔥', desc: '工時熱忱凝聚而成，充滿朝氣與動力。' },
        { id: 'crystal_moon', name: '幻月晶靈', series: 'crystal', rarity: 'rare', icon: '🌙', desc: '吸收月光精華，陪伴深邃無擾的夜間專注。' },
        { id: 'moss_vine', name: '翠蔓石靈', series: 'moss', rarity: 'rare', icon: '🍃', desc: '藤蔓綿延不息，代表持之以恆的工作節奏。' },
        { id: 'ember_smirk', name: '幻火行者', series: 'ember', rarity: 'rare', icon: '⚡', desc: '敏捷靈動，激發源源不絕的靈感與熱情。' },
        { id: 'crystal_epic', name: '紫耀天晶', series: 'crystal', rarity: 'epic', icon: '✨', desc: '珍稀晶靈，體內流動著純粹的星辰結晶。' },
        { id: 'ember_crown', name: '熾皇晶魄', series: 'ember', rarity: 'hidden', icon: '👑', desc: '傳說級隱藏靈獸，唯有極致專注方能召喚。' },
    ];

    let hatchLocked = false;
    let toastTimer = null;

    function byId(id) { return document.getElementById(id); }

    function showToast(message) {
        let toast = byId('partnerToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'partnerToast';
            toast.className = 'partner-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2600);
    }

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

    function polarToCartesian(cx, cy, r, angleInDegrees) {
        const rad = ((angleInDegrees - 90) * Math.PI) / 180.0;
        return {
            x: Number((cx + (r * Math.cos(rad))).toFixed(2)),
            y: Number((cy + (r * Math.sin(rad))).toFixed(2))
        };
    }

    function describeArc(cx, cy, r, startAngle, endAngle) {
        const start = polarToCartesian(cx, cy, r, endAngle);
        const end = polarToCartesian(cx, cy, r, startAngle);
        const arcSweep = endAngle - startAngle <= 180 ? '0' : '1';
        return `M ${start.x} ${start.y} A ${r} ${r} 0 ${arcSweep} 0 ${end.x} ${end.y}`;
    }

    function renderOrbitalHalo(progress, activePetData) {
        const cx = 110;
        const cy = 110;
        const r = 94;
        const totalSegments = HATCH_COST;
        const step = 360 / totalSegments;
        const gap = 6;

        let pathsHtml = '';
        let starNodeHtml = '';

        for (let i = 0; i < totalSegments; i++) {
            const startAngle = -90 + (i * step) + (gap / 2);
            const endAngle = -90 + ((i + 1) * step) - (gap / 2);
            const d = describeArc(cx, cy, r, startAngle, endAngle);

            if (i < progress) {
                pathsHtml += `<path d="${d}" class="orbital-active-segment" />`;
                if (i === progress - 1) {
                    const nodePos = polarToCartesian(cx, cy, r, endAngle);
                    starNodeHtml = `<circle class="orbital-star-node" cx="${nodePos.x}" cy="${nodePos.y}" r="4.5" />`;
                }
            } else {
                pathsHtml += `<path d="${d}" class="orbital-track-segment" />`;
            }
        }

        const stage = eggProgressStage(progress);
        const centerVisualHtml = activePetData 
            ? `<div class="orbital-center-pet" id="partnerPetArt"></div>`
            : `
            <div class="orbital-center-egg egg-progress-${stage}" aria-hidden="true">
                <div class="egg-shadow"></div>
                <div class="egg-shell">
                    <div class="egg-sheen"></div>
                    <div class="egg-core-glow"></div>
                    <div class="egg-facet facet-a"></div>
                    <div class="egg-facet facet-b"></div>
                    <div class="egg-glint"></div>
                    <div class="egg-crack crack-a"></div>
                    <div class="egg-crack crack-b"></div>
                    <div class="egg-crack crack-c"></div>
                </div>
            </div>`;

        return `
            <div class="partner-orbital-container" aria-label="7 段工時星軌光環，進度 ${progress} / ${totalSegments}">
                <div class="orbital-stage-bg"></div>
                <svg class="orbital-svg" viewBox="0 0 220 220">
                    <defs>
                        <linearGradient id="orbitalGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stop-color="#C4A87A" />
                            <stop offset="50%" stop-color="#9A78B4" />
                            <stop offset="100%" stop-color="#7A5A8A" />
                        </linearGradient>
                    </defs>
                    ${pathsHtml}
                    ${starNodeHtml}
                </svg>
                ${centerVisualHtml}
            </div>`;
    }

    function renderCodex(pets) {
        const codexGrid = byId('partnerCodexGrid');
        if (!codexGrid) return;

        let unlockedCount = 0;
        const petList = Array.isArray(pets) ? pets : [];

        const itemsHtml = CODEX_SPECIES.map((spec, index) => {
            const isUnlocked = petList.some(p => p.series === spec.series && (p.rarity === spec.rarity || spec.rarity === 'common'));
            if (isUnlocked) unlockedCount++;

            return `
                <div class="codex-item ${isUnlocked ? 'unlocked' : 'locked'}" 
                     onclick="window.onCodexClick(${index})" 
                     title="${spec.name} · ${RARITY_LABELS[spec.rarity]}">
                    <div class="codex-badge-icon">
                        ${isUnlocked ? spec.icon : '🔒'}
                    </div>
                    <div class="codex-item-name">${spec.name}</div>
                    <div class="codex-item-rarity">${RARITY_LABELS[spec.rarity]}</div>
                </div>`;
        }).join('');

        codexGrid.innerHTML = itemsHtml;
        const countEl = byId('partnerCodexCount');
        if (countEl) countEl.textContent = `已解鎖 ${unlockedCount} / ${CODEX_SPECIES.length}`;
    }

    function onCodexClick(index) {
        const spec = CODEX_SPECIES[index];
        if (!spec) return;
        const state = typeof readPetSystem === 'function' ? readPetSystem() : { pets: [] };
        const isUnlocked = state.pets && state.pets.some(p => p.series === spec.series && (p.rarity === spec.rarity || spec.rarity === 'common'));
        
        if (isUnlocked) {
            showToast(`✨ ${spec.name}（${RARITY_LABELS[spec.rarity]}）\n${spec.desc}`);
        } else {
            showToast(`🔒 未解鎖 · ${spec.name}（${RARITY_LABELS[spec.rarity]}）\n累積每日碎片開啟節奏蛋即可解鎖`);
        }
    }
    if (typeof window !== 'undefined') {
        window.onCodexClick = onCodexClick;
    }

    function renderPartnerRoom() {
        const state = typeof readPetSystem === 'function' ? readPetSystem() : { resources: { eggFragments: 0 }, pets: [] };
        const pet = typeof activePet === 'function' ? activePet(state) : null;
        const count = Math.min(state.resources?.eggFragments || 0, HATCH_COST);
        const isReady = count >= HATCH_COST;

        // Render Hero Orbital Stage
        const stageContainer = byId('partnerStageContainer');
        if (stageContainer) {
            stageContainer.innerHTML = renderOrbitalHalo(count, pet);
        }

        // If pet is active, render its SVG layers inside stage
        if (pet) {
            const petArtContainer = byId('partnerPetArt');
            if (petArtContainer && typeof renderPet === 'function' && typeof resolveParts === 'function') {
                renderPet(petArtContainer, pet, resolveParts(pet.parts));
            }
        }

        // Header Pill Badge
        const stageBadge = byId('partnerStageBadge');
        if (stageBadge) {
            if (pet) {
                stageBadge.textContent = pet.isFavorite ? '最愛夥伴' : '陪伴中';
                stageBadge.className = 'partner-pill-badge active';
            } else if (isReady) {
                stageBadge.textContent = '已可破殼';
                stageBadge.className = 'partner-pill-badge active';
            } else {
                stageBadge.textContent = `凝聚中 (${count}/${HATCH_COST})`;
                stageBadge.className = 'partner-pill-badge';
            }
        }

        // Hero Typography
        const heroTitle = byId('partnerHeroTitle');
        if (heroTitle) {
            if (pet) {
                heroTitle.textContent = pet.name || '工時晶靈';
            } else {
                heroTitle.textContent = `${count} / ${HATCH_COST} 蛋殼碎片`;
            }
        }

        const heroSub = byId('partnerHeroSub');
        if (heroSub) {
            if (pet) {
                heroSub.textContent = `${pet.series} 系列 · ${RARITY_LABELS[pet.rarity] || '一般'} · 伴隨日常心流專注`;
            } else if (isReady) {
                heroSub.textContent = '✨ 7 顆星軌碎片已滿載，隨時可喚醒專屬晶靈';
            } else if (count === 0) {
                heroSub.textContent = '完成今日標準工時，即可凝聚第 1 顆星軌碎片';
            } else {
                heroSub.textContent = `今日工時已凝聚 · 還需專注 ${HATCH_COST - count} 天破殼`;
            }
        }

        // Action Area
        const actionArea = byId('partnerActionArea');
        if (actionArea) {
            if (isReady) {
                actionArea.innerHTML = `
                    <button class="partner-primary-btn" onclick="hatchPartnerEgg()">
                        ✨ 開啟節奏蛋 · 喚醒晶靈
                    </button>`;
            } else {
                actionArea.innerHTML = `
                    <div class="partner-status-box">
                        <span>🔒 每日達成 8 小時標準工時即可獲 1 顆碎片</span>
                    </div>`;
            }
        }

        // Codex Grid
        renderCodex(state.pets);
    }

    function hatchPartnerEgg() {
        if (hatchLocked) return;
        const before = readPetSystem();
        if (!canHatch(before)) {
            showToast(`蛋殼碎片不足，目前 ${before.resources.eggFragments} / ${HATCH_COST}`);
            return;
        }
        hatchLocked = true;
        showToast('🌱 正在引導心流力量，孵化晶靈中…');

        try {
            const pet = generateBestPet({ isFirstHatch: !before.hatchState.firstHatchCompleted }, 3);
            const validation = validatePetParts();
            if (!validation.valid) throw new Error('Invalid part data');
            const result = commitHatch(before, pet);
            writePetSystem(result.state);
            
            showToast(result.duplicate 
                ? `遇到重複夥伴，已轉換晶體粉塵 ×${result.dust}` 
                : `🎉 恭喜喚醒：${pet.name}（${RARITY_LABELS[pet.rarity] || pet.rarity}）！`);
            
            renderPartnerRoom();
        } catch (error) {
            console.error('[partner-hatch]', error);
            showToast('生成失敗，碎片未扣除，請重新嘗試');
        } finally {
            hatchLocked = false;
            renderPartnerRoom();
        }
    }

    function updateDailyPetReward(completed) {
        if (!completed) return;
        const before = readPetSystem();
        const result = grantDailyFragment(before);
        if (result.granted) {
            writePetSystem(result.state);
            showToast('🌱 今日工時達成 · 獲得星軌碎片 ×1');
        } else {
            showToast('今日碎片已凝聚 · 持續專注中');
        }
    }

    return { eggProgressStage, renderPartnerRoom, hatchPartnerEgg, updateDailyPetReward };
});

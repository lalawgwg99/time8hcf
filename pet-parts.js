// Seiki pet part catalog. Persisted pets store only these IDs.
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.petParts = api.petParts;
    root.rarityWeights = api.rarityWeights;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const part = (id, category, series, rarity, colorFamily, style, assetPath, extra = {}) => ({
        id, category, series, rarity, colorFamily, style, assetPath,
        weight: 1,
        compatibleBodies: ['*'],
        conflicts: [],
        ...extra,
    });

    const petParts = [
        part('body_crystal_round_purple_01', 'body', 'crystal', 'common', 'purple', 'round', 'assets/pets/crystal/body-round-purple.svg'),
        part('body_crystal_round_purple_rare_01', 'body', 'crystal', 'rare', 'purple', 'round', 'assets/pets/crystal/body-round-purple-rare.svg'),
        part('body_crystal_round_purple_epic_01', 'body', 'crystal', 'epic', 'purple', 'round', 'assets/pets/crystal/body-round-purple-epic.svg'),
        part('body_moss_round_green_01', 'body', 'moss', 'common', 'green', 'round', 'assets/pets/moss/body-round-green.svg'),
        part('body_moss_round_green_rare_01', 'body', 'moss', 'rare', 'green', 'round', 'assets/pets/moss/body-round-green-rare.svg'),
        part('body_ember_round_red_01', 'body', 'ember', 'common', 'red', 'round', 'assets/pets/ember/body-round-red.svg'),
        part('body_ember_round_red_epic_01', 'body', 'ember', 'epic', 'red', 'round', 'assets/pets/ember/body-round-red-epic.svg'),

        part('eye_crystal_moon_purple_01', 'eyes', 'crystal', 'common', 'purple', 'moon', 'assets/pets/crystal/eyes-moon-purple.svg'),
        part('eye_crystal_moon_purple_rare_01', 'eyes', 'crystal', 'rare', 'purple', 'moon', 'assets/pets/crystal/eyes-moon-purple-rare.svg'),
        part('eye_moss_leaf_green_01', 'eyes', 'moss', 'common', 'green', 'leaf', 'assets/pets/moss/eyes-leaf-green.svg'),
        part('eye_ember_spark_red_epic_01', 'eyes', 'ember', 'epic', 'red', 'spark', 'assets/pets/ember/eyes-spark-red-epic.svg'),

        part('mouth_crystal_line_01', 'mouth', 'crystal', 'common', 'purple', 'line', 'assets/pets/crystal/mouth-line.svg'),
        part('mouth_moss_smile_01', 'mouth', 'moss', 'common', 'green', 'smile', 'assets/pets/moss/mouth-smile.svg'),
        part('mouth_ember_smirk_rare_01', 'mouth', 'ember', 'rare', 'red', 'smirk', 'assets/pets/ember/mouth-smirk-rare.svg'),

        part('ears_crystal_horn_purple_01', 'ears', 'crystal', 'rare', 'purple', 'horn', 'assets/pets/crystal/ears-horn-purple.svg', { large: true }),
        part('ears_moss_leaf_green_01', 'ears', 'moss', 'common', 'green', 'leaf', 'assets/pets/moss/ears-leaf-green.svg'),
        part('ears_ember_flame_red_01', 'ears', 'ember', 'common', 'red', 'flame', 'assets/pets/ember/ears-flame-red.svg'),

        part('tail_crystal_drop_purple_01', 'tail', 'crystal', 'common', 'purple', 'drop', 'assets/pets/crystal/tail-drop-purple.svg'),
        part('tail_crystal_drop_purple_epic_01', 'tail', 'crystal', 'epic', 'purple', 'drop', 'assets/pets/crystal/tail-drop-purple-epic.svg'),
        part('tail_moss_vine_green_01', 'tail', 'moss', 'common', 'green', 'vine', 'assets/pets/moss/tail-vine-green.svg'),
        part('tail_ember_flame_red_rare_01', 'tail', 'ember', 'rare', 'red', 'flame', 'assets/pets/ember/tail-flame-red-rare.svg'),

        part('feet_crystal_short_purple_01', 'feet', 'crystal', 'common', 'purple', 'short', 'assets/pets/crystal/feet-short-purple.svg'),
        part('feet_moss_root_green_01', 'feet', 'moss', 'common', 'green', 'root', 'assets/pets/moss/feet-root-green.svg'),
        part('feet_ember_boot_red_rare_01', 'feet', 'ember', 'rare', 'red', 'boot', 'assets/pets/ember/feet-boot-red-rare.svg'),

        part('arms_crystal_float_purple_01', 'arms', 'crystal', 'common', 'purple', 'float', 'assets/pets/crystal/arms-float-purple.svg'),
        part('arms_moss_vine_green_01', 'arms', 'moss', 'common', 'green', 'vine', 'assets/pets/moss/arms-vine-green.svg'),
        part('arms_ember_paw_red_epic_01', 'arms', 'ember', 'epic', 'red', 'paw', 'assets/pets/ember/arms-paw-red-epic.svg'),

        part('head_crystal_crown_purple_01', 'head', 'crystal', 'hidden', 'purple', 'crown', 'assets/pets/crystal/head-crown-purple.svg'),
        part('accessory_badge_gray_01', 'bodyAccessory', 'crystal', 'common', 'gray', 'badge', 'assets/pets/shared/accessory-badge-gray.svg', { accessoryType: 'main' }),
        part('accessory_leaf_green_rare_01', 'bodyAccessory', 'moss', 'rare', 'green', 'leaf', 'assets/pets/moss/accessory-leaf-green-rare.svg', { accessoryType: 'main' }),
        part('accessory_star_red_epic_01', 'bodyAccessory', 'ember', 'epic', 'red', 'star', 'assets/pets/ember/accessory-star-red-epic.svg', { accessoryType: 'main' }),
        part('accessory_headband_purple_rare_01', 'headAccessory', 'crystal', 'rare', 'purple', 'headband', 'assets/pets/crystal/accessory-headband-purple.svg', { accessoryType: 'main', compatibleWithLargeEars: false }),
        part('effect_back_crystal_rare_01', 'effectBack', 'crystal', 'rare', 'purple', 'sparkle', 'assets/pets/crystal/effect-back.svg', { accessoryType: 'effect' }),
        part('effect_front_crystal_epic_01', 'effectFront', 'crystal', 'epic', 'purple', 'glow', 'assets/pets/crystal/effect-front.svg', { accessoryType: 'effect', conflicts: ['effect_back_crystal_rare_01'] }),
        part('effect_back_moss_rare_01', 'effectBack', 'moss', 'rare', 'green', 'leaf-fall', 'assets/pets/moss/effect-back.svg', { accessoryType: 'effect' }),
        part('effect_front_ember_epic_01', 'effectFront', 'ember', 'epic', 'red', 'flame', 'assets/pets/ember/effect-front.svg', { accessoryType: 'effect' }),
    ];

    const rarityWeights = { common: 60, rare: 28, epic: 10, hidden: 2 };

    return { petParts, rarityWeights };
});

// ガチャ排出テーブル (v2.0) - Cosmic Academy theme
// Step 4 ではクライアント完結。サーバ権威化は後続ステップで GachaSystem の中身を差し替える想定。

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const RARITY_COLORS = {
  common:    '#9ca3af',
  uncommon:  '#10b981',
  rare:      '#3b82f6',
  epic:      '#a855f7',
  legendary: '#f59e0b'
};

const RARITY_LABEL_JP = {
  common:    'コモン',
  uncommon:  'アンコモン',
  rare:      'レア',
  epic:      'エピック',
  legendary: 'レジェンド'
};

const GACHA_ITEM_POOL = [
  // --- WEAPONS ---
  { id: 'w_ion_dagger',    itemType: 'weapon',    rarity: 'common',    name: 'さびたイオン・ダガー',     stats: { atk: 2 } },
  { id: 'w_pulse_baton',   itemType: 'weapon',    rarity: 'uncommon',  name: 'パルス・バトン',           stats: { atk: 5 } },
  { id: 'w_pulsar_blade',  itemType: 'weapon',    rarity: 'rare',      name: 'パルサー・ブレード',       stats: { atk: 10 } },
  { id: 'w_nebula_lance',  itemType: 'weapon',    rarity: 'epic',      name: 'ネビュラ・ランス',         stats: { atk: 18 } },
  { id: 'w_singularity',   itemType: 'weapon',    rarity: 'legendary', name: 'シンギュラリティ・クリーヴァー', stats: { atk: 32 } },

  // --- ARMOR ---
  { id: 'a_cadet_vest',    itemType: 'armor',     rarity: 'common',    name: '訓練用ベスト',             stats: { def: 2, hp: 4 } },
  { id: 'a_plasma_plate',  itemType: 'armor',     rarity: 'uncommon',  name: 'プラズマ・プレート',       stats: { def: 5, hp: 8 } },
  { id: 'a_stella_shield', itemType: 'armor',     rarity: 'rare',      name: 'ステラ・シールド',         stats: { def: 10, hp: 14 } },
  { id: 'a_graviton',      itemType: 'armor',     rarity: 'epic',      name: 'グラビトン・アーマー',     stats: { def: 18, hp: 22 } },
  { id: 'a_cosmos_aegis',  itemType: 'armor',     rarity: 'legendary', name: 'コスモス・イージス',       stats: { def: 30, hp: 40 } },

  // --- ACCESSORIES ---
  { id: 'c_cadet_badge',   itemType: 'accessory', rarity: 'common',    name: '見習いバッジ',             stats: { hp: 5 } },
  { id: 'c_warp_boots',    itemType: 'accessory', rarity: 'uncommon',  name: 'ワープ・ブーツ',           stats: { atk: 2, def: 2 } },
  { id: 'c_quantum_goggle', itemType: 'accessory', rarity: 'rare',     name: 'クォンタム・ゴーグル',     stats: { atk: 6, def: 3 } },
  { id: 'c_chronos_ring',  itemType: 'accessory', rarity: 'epic',      name: 'クロノス・リング',         stats: { atk: 10, def: 6, hp: 10 } },
  { id: 'c_infinity_amulet', itemType: 'accessory', rarity: 'legendary', name: 'インフィニティ・アミュレット', stats: { atk: 15, def: 12, hp: 20 } },

  // --- BUDDIES ---
  { id: 'b_slime_droid',   itemType: 'buddy',     rarity: 'common',    name: 'スライム型ドロイド・α',    stats: { atk: 1, hp: 5 } },
  { id: 'b_nav_droid',     itemType: 'buddy',     rarity: 'uncommon',  name: '小型ナビドロイド',         stats: { atk: 3, def: 2 } },
  { id: 'b_photon_pixie',  itemType: 'buddy',     rarity: 'rare',      name: '光のピクシー',             stats: { atk: 7, hp: 10 } },
  { id: 'b_astral_fox',    itemType: 'buddy',     rarity: 'epic',      name: 'アストラル・フォックス',   stats: { atk: 12, def: 8, hp: 15 } },
  { id: 'b_celestial',     itemType: 'buddy',     rarity: 'legendary', name: 'セレスチャル・ドラゴン',   stats: { atk: 22, def: 15, hp: 30 } },
];

// 排出重み (合計は自動計算)
const GACHA_TABLES = {
  standard: {
    label: 'スタンダード',
    sub:   'チケット ×1',
    hint:  '★ 〜 ★★★★★',
    weights: { common: 50, uncommon: 30, rare: 15, epic: 4, legendary: 1 }
  },
  premium: {
    label: 'プレミアム',
    sub:   'プレミアム ×1',
    hint:  '★★ 〜 ★★★★★',
    weights: { common: 0, uncommon: 20, rare: 50, epic: 25, legendary: 5 }
  },
  daily_free: {
    label: '無料デイリー',
    sub:   '1日1回',
    hint:  '★ 〜 ★★★',
    weights: { common: 70, uncommon: 25, rare: 5, epic: 0, legendary: 0 }
  }
};

const ITEM_TYPE_LABEL_JP = {
  weapon:    '武器',
  armor:     '装甲',
  accessory: 'アクセサリ',
  buddy:     'バディ',
};

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const db = admin.firestore();

// ======== ガチャテーブル (サーバ正典) ========

const GACHA_TABLES = {
  standard: {
    weights: { common: 50, uncommon: 30, rare: 15, epic: 4, legendary: 1 }
  },
  premium: {
    weights: { common: 0, uncommon: 20, rare: 50, epic: 25, legendary: 5 }
  },
  daily_free: {
    weights: { common: 70, uncommon: 25, rare: 5, epic: 0, legendary: 0 }
  }
};

const GACHA_ITEM_POOL = [
  // WEAPONS
  { id: 'w_ion_dagger',    itemType: 'weapon',    rarity: 'common',    name: 'さびたイオン・ダガー',     stats: { atk: 2 } },
  { id: 'w_pulse_baton',   itemType: 'weapon',    rarity: 'uncommon',  name: 'パルス・バトン',           stats: { atk: 5 } },
  { id: 'w_pulsar_blade',  itemType: 'weapon',    rarity: 'rare',      name: 'パルサー・ブレード',       stats: { atk: 10 } },
  { id: 'w_nebula_lance',  itemType: 'weapon',    rarity: 'epic',      name: 'ネビュラ・ランス',         stats: { atk: 18 } },
  { id: 'w_singularity',   itemType: 'weapon',    rarity: 'legendary', name: 'シンギュラリティ・クリーヴァー', stats: { atk: 32 } },
  // ARMOR
  { id: 'a_cadet_vest',    itemType: 'armor',     rarity: 'common',    name: '訓練用ベスト',             stats: { def: 2, hp: 4 } },
  { id: 'a_plasma_plate',  itemType: 'armor',     rarity: 'uncommon',  name: 'プラズマ・プレート',       stats: { def: 5, hp: 8 } },
  { id: 'a_stella_shield', itemType: 'armor',     rarity: 'rare',      name: 'ステラ・シールド',         stats: { def: 10, hp: 14 } },
  { id: 'a_graviton',      itemType: 'armor',     rarity: 'epic',      name: 'グラビトン・アーマー',     stats: { def: 18, hp: 22 } },
  { id: 'a_cosmos_aegis',  itemType: 'armor',     rarity: 'legendary', name: 'コスモス・イージス',       stats: { def: 30, hp: 40 } },
  // ACCESSORIES
  { id: 'c_cadet_badge',   itemType: 'accessory', rarity: 'common',    name: '見習いバッジ',             stats: { hp: 5 } },
  { id: 'c_warp_boots',    itemType: 'accessory', rarity: 'uncommon',  name: 'ワープ・ブーツ',           stats: { atk: 2, def: 2 } },
  { id: 'c_quantum_goggle', itemType: 'accessory', rarity: 'rare',     name: 'クォンタム・ゴーグル',     stats: { atk: 6, def: 3 } },
  { id: 'c_chronos_ring',  itemType: 'accessory', rarity: 'epic',      name: 'クロノス・リング',         stats: { atk: 10, def: 6, hp: 10 } },
  { id: 'c_infinity_amulet', itemType: 'accessory', rarity: 'legendary', name: 'インフィニティ・アミュレット', stats: { atk: 15, def: 12, hp: 20 } },
  // BUDDIES
  { id: 'b_slime_droid',   itemType: 'buddy',     rarity: 'common',    name: 'スライム型ドロイド・α',    stats: { atk: 1, hp: 5 } },
  { id: 'b_nav_droid',     itemType: 'buddy',     rarity: 'uncommon',  name: '小型ナビドロイド',         stats: { atk: 3, def: 2 } },
  { id: 'b_photon_pixie',  itemType: 'buddy',     rarity: 'rare',      name: '光のピクシー',             stats: { atk: 7, hp: 10 } },
  { id: 'b_astral_fox',    itemType: 'buddy',     rarity: 'epic',      name: 'アストラル・フォックス',   stats: { atk: 12, def: 8, hp: 15 } },
  { id: 'b_celestial',     itemType: 'buddy',     rarity: 'legendary', name: 'セレスチャル・ドラゴン',   stats: { atk: 22, def: 15, hp: 30 } },
];

// ======== 抽選ロジック ========

function rollRarity(weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [rarity, w] of entries) {
    r -= w;
    if (r <= 0) return rarity;
  }
  return entries[entries.length - 1][0];
}

function pickItem(rarity) {
  const pool = GACHA_ITEM_POOL.filter(it => it.rarity === rarity);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ======== Cloud Function ========

/**
 * rollGacha
 *
 * RPGクライアントからガチャを引く際に呼ぶ。
 * サーバ側でチケット消費 + 抽選 + インベントリ追加を一括処理。
 *
 * 入力: { gachaType: 'standard' | 'premium' | 'daily_free' }
 * 出力: { gachaType, rarity, item: { id, name, itemType, rarity, stats } }
 */
module.exports = onCall(async (request) => {
  // --- 認証 ---
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login required.');
  }
  const uid = request.auth.uid;
  const data = request.data || {};

  // --- バリデーション ---
  const { gachaType } = data;
  if (!gachaType || !GACHA_TABLES[gachaType]) {
    throw new HttpsError('invalid-argument', 'Invalid gachaType.');
  }

  const ticketsRef = db.collection('rpg_gacha_tickets').doc(uid);

  // --- 抽選 (トランザクション外で先に決める — 結果はトランザクション成功時のみ返す) ---
  const rarity = rollRarity(GACHA_TABLES[gachaType].weights);
  const item = pickItem(rarity);
  if (!item) {
    throw new HttpsError('internal', 'Failed to pick item.');
  }

  // --- トランザクション: チケット消費 + インベントリ追加 + ログ ---
  const inventoryRef = db.collection('rpg_inventory').doc(uid)
    .collection('items').doc(item.id);

  await db.runTransaction(async (tx) => {
    // === ALL READS FIRST ===
    const ticketsDoc = await tx.get(ticketsRef);
    const invDoc = await tx.get(inventoryRef);

    if (!ticketsDoc.exists) {
      throw new HttpsError('failed-precondition', 'No ticket record found.');
    }

    const tickets = ticketsDoc.data();

    // チケット残数チェック
    if (gachaType === 'standard' && (tickets.standard || 0) < 1) {
      throw new HttpsError('failed-precondition', 'Not enough standard tickets.');
    }
    if (gachaType === 'premium' && (tickets.premium || 0) < 1) {
      throw new HttpsError('failed-precondition', 'Not enough premium tickets.');
    }
    if (gachaType === 'daily_free' && tickets.daily_free_available === false) {
      throw new HttpsError('failed-precondition', 'Daily free already used.');
    }

    // === ALL WRITES AFTER ===

    // チケット消費
    if (gachaType === 'standard') {
      tx.update(ticketsRef, {
        standard: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else if (gachaType === 'premium') {
      tx.update(ticketsRef, {
        premium: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else if (gachaType === 'daily_free') {
      tx.update(ticketsRef, {
        daily_free_available: false,
        daily_free_last_used: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // インベントリ追加 (重複時は quantity +1)
    if (invDoc.exists) {
      tx.update(inventoryRef, {
        quantity: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      tx.set(inventoryRef, {
        ...item,
        quantity: 1,
        acquiredAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // 監査ログ
    const txRef = db.collection('rpg_transactions').doc();
    tx.set(txRef, {
      uid,
      type: 'gacha_roll',
      gachaType,
      rarity,
      itemId: item.id,
      itemName: item.name,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  return {
    gachaType,
    rarity,
    item: {
      id: item.id,
      name: item.name,
      itemType: item.itemType,
      rarity: item.rarity,
      stats: item.stats
    }
  };
});

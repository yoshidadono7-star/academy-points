const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * awardSessionResult
 *
 * ミニゲーム終了時にクライアントが呼び出す。
 * 報酬確定はサーバ権威（クライアントは結果申請のみ）。
 *
 * 入力: { session_id, subject, correct, total, time_ms, difficulty, monster }
 * 出力: { xp_gained, gold_gained, damage_dealt, level_up, new_profile }
 */
module.exports = onCall(async (request) => {
  // --- 認証チェック ---
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login required.');
  }
  const uid = request.auth.uid;
  const data = request.data;

  // --- 入力バリデーション ---
  const { session_id, subject, correct, total, time_ms, difficulty, monster } = data;

  if (typeof correct !== 'number' || typeof total !== 'number' || typeof time_ms !== 'number') {
    throw new HttpsError('invalid-argument', 'Invalid result data.');
  }
  if (correct < 0 || total < 0 || correct > total) {
    throw new HttpsError('invalid-argument', 'Invalid correct/total values.');
  }
  if (total > 50) {
    throw new HttpsError('invalid-argument', 'Suspicious: too many answers.');
  }
  if (time_ms < 1000) {
    throw new HttpsError('invalid-argument', 'Suspicious: completed too fast.');
  }
  if (time_ms > 120000) {
    throw new HttpsError('invalid-argument', 'Suspicious: session too long.');
  }

  const validSubjects = ['math', 'english', 'japanese', 'science', 'social', 'speed_reading'];
  if (!validSubjects.includes(subject)) {
    throw new HttpsError('invalid-argument', 'Invalid subject.');
  }

  // --- プロフィール取得 ---
  const profileRef = db.collection('rpg_profiles').doc(uid);
  const profileDoc = await profileRef.get();

  if (!profileDoc.exists) {
    throw new HttpsError('not-found', 'RPG profile not found.');
  }
  const profile = profileDoc.data();

  // --- ダメージ計算（CLAUDE.md準拠） ---
  const baseDamage = correct * (profile.atk * 0.5 + profile.level);

  // イベントブースター取得
  let eventMultiplier = 1.0;
  let eventBonus = 0;
  const now = admin.firestore.Timestamp.now();
  const eventsSnap = await db.collection('events')
    .where('active', '==', true)
    .get();

  eventsSnap.forEach(doc => {
    const ev = doc.data();
    // 有効期限チェック
    if (ev.end_time && ev.end_time.toMillis() < now.toMillis()) return;
    if (ev.type === 'multiplier' && ev.multiplier) {
      eventMultiplier = Math.max(eventMultiplier, ev.multiplier);
    }
    if (ev.type === 'bonus' && ev.bonus_points) {
      eventBonus += ev.bonus_points;
    }
  });

  // レイドボス属性相性
  let affinity = 1.0;
  // Phase 0ではレイドボス省略（Phase 1で接続）

  const damageDelt = Math.max(1, Math.round(baseDamage * affinity * eventMultiplier)) + eventBonus;

  // --- XP / Gold 計算 ---
  const accuracy = total > 0 ? correct / total : 0;
  const baseXp = correct * 2 + Math.floor(accuracy * 5);
  const baseGold = correct + Math.floor(accuracy * 3);

  const monsterXp = (monster && monster.xpReward) ? monster.xpReward : 0;
  const monsterGold = (monster && monster.goldReward) ? monster.goldReward : 0;

  // 勝利報酬 = ミニゲーム報酬 + モンスター報酬
  const xpGained = Math.round((baseXp + monsterXp) * eventMultiplier) + eventBonus;
  const goldGained = Math.round((baseGold + monsterGold) * eventMultiplier);

  // --- レベルアップ判定 ---
  let newXp = profile.xp + xpGained;
  let newLevel = profile.level;
  let levelUp = false;

  // level_n しきい値 = 100 × 1.2^(level-1)
  let xpThreshold = Math.floor(100 * Math.pow(1.2, newLevel - 1));
  while (newXp >= xpThreshold) {
    newXp -= xpThreshold;
    newLevel++;
    levelUp = true;
    xpThreshold = Math.floor(100 * Math.pow(1.2, newLevel - 1));
  }

  // --- ステータス更新 ---
  const newHpMax = 100 + newLevel * 10;
  const profileUpdate = {
    xp: newXp,
    gold: profile.gold + goldGained,
    level: newLevel,
    hp_max: newHpMax,
  };
  // レベルアップ時はHP全回復
  if (levelUp) {
    profileUpdate.hp = newHpMax;
  }

  // --- Firestoreトランザクション ---
  await db.runTransaction(async (tx) => {
    // 1. rpg_minigame_results に記録
    const resultRef = db.collection('rpg_minigame_results').doc();
    tx.set(resultRef, {
      uid,
      session_id: session_id || '',
      subject,
      correct,
      total,
      time_ms,
      difficulty: difficulty || 1,
      damage_dealt: damageDelt,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. rpg_profiles 更新
    tx.update(profileRef, profileUpdate);

    // 3. rpg_transactions に記録
    if (goldGained > 0) {
      const txRef = db.collection('rpg_transactions').doc();
      tx.set(txRef, {
        uid,
        delta_gold: goldGained,
        reason: 'battle_reward',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // 4. rpg_skill_rates 更新（直近20回の正答率で算出）
    const skillRef = db.collection('rpg_skill_rates').doc(uid)
      .collection('subjects').doc(subject);
    const skillDoc = await tx.get(skillRef);

    let newRate;
    if (skillDoc.exists) {
      const oldRate = skillDoc.data().rate || 0;
      // 指数移動平均: new = old × 0.85 + current × 0.15
      newRate = oldRate * 0.85 + accuracy * 100 * 0.15;
    } else {
      newRate = accuracy * 100;
    }

    tx.set(skillRef, {
      rate: Math.round(newRate * 10) / 10,
      last_updated: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  // --- レスポンス ---
  const newProfile = {
    ...profile,
    ...profileUpdate,
  };

  return {
    xp_gained: xpGained,
    gold_gained: goldGained,
    damage_dealt: damageDelt,
    level_up: levelUp,
    new_level: newLevel,
    combos_triggered: [], // Phase 1で実装
    raid_defeated: false,  // Phase 1で実装
    new_profile: newProfile,
  };
});

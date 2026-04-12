const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const db = admin.firestore();

// ポモドーロあたりの報酬レート (awardStudyReward.js と同一)
const XP_PER_POMODORO = 20;
const GOLD_PER_POMODORO = 10;
const TICKETS_PER_POMODORO = 1;

const MAX_POMODOROS_PER_CALL = 20;
const MAX_MINUTES_PER_CALL = 600;

function getTodayJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = jst.getUTCFullYear();
  const mm = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(jst.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function computeLevelUp(startXp, startLevel, xpGained) {
  let xp = startXp + xpGained;
  let level = startLevel;
  let levelUp = false;
  let threshold = Math.floor(100 * Math.pow(1.2, level - 1));
  while (xp >= threshold) {
    xp -= threshold;
    level += 1;
    levelUp = true;
    threshold = Math.floor(100 * Math.pow(1.2, level - 1));
  }
  return { newXp: xp, newLevel: level, levelUp };
}

function buildDefaultProfile(displayName) {
  return {
    displayName: displayName || 'Hero',
    level: 1,
    xp: 0,
    atk: 1,
    def: 1,
    mag: 1,
    hp: 100,
    hp_max: 100,
    sp: 10,
    sp_max: 10,
    job: '',
    avatar: { hair: 0, color: 0, outfit: 0 },
    guild_id: '',
    rank: 'rookie',
    free_mode: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

/**
 * awardStudyRewardByPin
 *
 * 塾アプリ (PIN認証、Firebase Auth なし) からポモドーロ報酬を付与する。
 * createRpgAuthToken と同じ方式で nickname + pin をサーバ側で検証し、
 * 該当生徒に報酬を付与する。
 *
 * 入力: { nickname, pin, pomodoroCount, totalMinutes, subject? }
 * 出力: { xp_gained, gold_gained, tickets_gained, new_xp, new_level, level_up }
 */
module.exports = onCall(async (request) => {
  const data = request.data || {};
  const { nickname, pin, pomodoroCount, totalMinutes, subject } = data;

  // --- PIN 認証 ---
  if (!nickname || typeof nickname !== 'string') {
    throw new HttpsError('invalid-argument', 'nickname is required');
  }
  if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    throw new HttpsError('invalid-argument', 'pin must be 4 digits');
  }

  const snap = await db.collection('students')
    .where('nickname', '==', nickname.trim())
    .where('pin', '==', pin.trim())
    .limit(1)
    .get();

  if (snap.empty) {
    throw new HttpsError('not-found', 'Invalid nickname or PIN');
  }

  const student = snap.docs[0];
  const uid = student.id;
  const displayName = student.data().callsign || student.data().nickname || student.data().name || 'Hero';

  // --- バリデーション ---
  if (typeof pomodoroCount !== 'number' || !Number.isInteger(pomodoroCount)) {
    throw new HttpsError('invalid-argument', 'pomodoroCount must be an integer.');
  }
  if (pomodoroCount < 1 || pomodoroCount > MAX_POMODOROS_PER_CALL) {
    throw new HttpsError('invalid-argument', `pomodoroCount must be between 1 and ${MAX_POMODOROS_PER_CALL}.`);
  }
  if (typeof totalMinutes !== 'number' || totalMinutes < 0 || totalMinutes > MAX_MINUTES_PER_CALL) {
    throw new HttpsError('invalid-argument', `totalMinutes must be between 0 and ${MAX_MINUTES_PER_CALL}.`);
  }
  const subjectStr = (typeof subject === 'string' && subject.length > 0 && subject.length <= 32)
    ? subject : '';

  // --- 報酬計算 ---
  const xpGained = pomodoroCount * XP_PER_POMODORO;
  const goldGained = pomodoroCount * GOLD_PER_POMODORO;
  const ticketsGained = pomodoroCount * TICKETS_PER_POMODORO;
  const dateKey = getTodayJST();

  const profileRef = db.collection('rpg_profiles').doc(uid);
  const walletRef  = db.collection('rpg_wallet').doc(uid);
  const ticketsRef = db.collection('rpg_gacha_tickets').doc(uid);
  const dailyRef   = db.collection('rpg_daily_stats').doc(uid).collection('days').doc(dateKey);
  const txRef      = db.collection('rpg_transactions').doc();

  const outcome = { newXp: 0, newLevel: 1, levelUp: false };

  await db.runTransaction(async (tx) => {
    const profileDoc = await tx.get(profileRef);
    const walletDoc  = await tx.get(walletRef);
    const ticketsDoc = await tx.get(ticketsRef);
    const dailyDoc   = await tx.get(dailyRef);

    const startXp    = profileDoc.exists ? (profileDoc.data().xp || 0) : 0;
    const startLevel = profileDoc.exists ? (profileDoc.data().level || 1) : 1;
    const lvlResult  = computeLevelUp(startXp, startLevel, xpGained);
    const newHpMax   = 100 + lvlResult.newLevel * 10;

    outcome.newXp    = lvlResult.newXp;
    outcome.newLevel = lvlResult.newLevel;
    outcome.levelUp  = lvlResult.levelUp;

    if (profileDoc.exists) {
      const update = {
        xp: lvlResult.newXp,
        level: lvlResult.newLevel,
        hp_max: newHpMax,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      if (lvlResult.levelUp) update.hp = newHpMax;
      tx.update(profileRef, update);
    } else {
      const base = buildDefaultProfile(displayName);
      tx.set(profileRef, {
        ...base,
        xp: lvlResult.newXp,
        level: lvlResult.newLevel,
        hp_max: newHpMax,
        hp: newHpMax
      });
    }

    if (walletDoc.exists) {
      tx.update(walletRef, {
        gold: admin.firestore.FieldValue.increment(goldGained),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      tx.set(walletRef, {
        gold: goldGained, gems: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    if (ticketsDoc.exists) {
      tx.update(ticketsRef, {
        standard: admin.firestore.FieldValue.increment(ticketsGained),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      tx.set(ticketsRef, {
        standard: ticketsGained, premium: 0,
        daily_free_available: true, daily_free_last_used: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    if (dailyDoc.exists) {
      tx.update(dailyRef, {
        minutes: admin.firestore.FieldValue.increment(totalMinutes),
        pomodoros: admin.firestore.FieldValue.increment(pomodoroCount),
        last_subject: subjectStr,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      tx.set(dailyRef, {
        date: dateKey,
        minutes: totalMinutes,
        pomodoros: pomodoroCount,
        last_subject: subjectStr,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    tx.set(txRef, {
      uid, type: 'study_reward',
      pomodoroCount, totalMinutes, subject: subjectStr,
      xpGained, goldGained, ticketsGained,
      date: dateKey,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  return {
    xp_gained: xpGained,
    gold_gained: goldGained,
    tickets_gained: ticketsGained,
    new_xp: outcome.newXp,
    new_level: outcome.newLevel,
    level_up: outcome.levelUp
  };
});

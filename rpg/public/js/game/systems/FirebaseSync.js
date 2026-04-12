const FirebaseSync = (() => {
  let currentUser = null;
  let studentMeta = null; // { studentId, studentName, studentNickname, studentCallsign }
  const db = firebase.firestore();

  // JST の YYYY-MM-DD を返す (Cloud Function 側と同じキー生成)
  function getTodayJST() {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const yyyy = jst.getUTCFullYear();
    const mm = String(jst.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(jst.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return {
    setUser(user) {
      currentUser = user;
    },

    getUser() {
      return currentUser;
    },

    getUid() {
      return currentUser ? currentUser.uid : null;
    },

    // PIN ログイン後、生徒メタ情報 (callsign/nickname/name) を保持
    setStudentMeta(meta) {
      studentMeta = meta || null;
    },

    getStudentMeta() {
      return studentMeta;
    },

    // HUD などで使う表示名 (callsign > nickname > name > 'Hero')
    getDisplayName() {
      if (studentMeta) {
        return studentMeta.studentCallsign
          || studentMeta.studentNickname
          || studentMeta.studentName
          || 'Hero';
      }
      return 'Hero';
    },

    getTodayJST,

    // RPGプロフィール取得
    async getProfile(uid) {
      const doc = await db.collection('rpg_profiles').doc(uid).get();
      return doc.exists ? doc.data() : null;
    },

    // RPGプロフィール作成（初回のみ）
    async createProfile(uid, data) {
      const meta = studentMeta || {};
      const displayName = meta.studentCallsign
        || meta.studentNickname
        || meta.studentName
        || 'Hero';

      const defaultProfile = {
        displayName,
        studentNickname: meta.studentNickname || '',
        studentCallsign: meta.studentCallsign || '',
        level: 1,
        xp: 0,
        gold: 0,
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
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        ...data
      };
      await db.collection('rpg_profiles').doc(uid).set(defaultProfile);
      return defaultProfile;
    },

    // プロフィールのリアルタイムリスナー
    onProfileChange(uid, callback) {
      return db.collection('rpg_profiles').doc(uid).onSnapshot((doc) => {
        if (doc.exists) {
          callback(doc.data());
        }
      });
    },

    // Wallet のリアルタイムリスナー (gold の正典)
    onWalletChange(uid, callback) {
      return db.collection('rpg_wallet').doc(uid).onSnapshot((doc) => {
        const data = doc.exists ? doc.data() : { gold: 0, gems: 0 };
        callback(data);
      });
    },

    // ガチャチケットのリアルタイムリスナー
    onTicketsChange(uid, callback) {
      return db.collection('rpg_gacha_tickets').doc(uid).onSnapshot((doc) => {
        const data = doc.exists ? doc.data() : {
          standard: 0,
          premium: 0,
          daily_free_available: true
        };
        callback(data);
      });
    },

    // 今日の勉強統計のリアルタイムリスナー (JST)
    onTodayStatsChange(uid, callback) {
      const dateKey = getTodayJST();
      return db.collection('rpg_daily_stats').doc(uid)
        .collection('days').doc(dateKey)
        .onSnapshot((doc) => {
          const data = doc.exists
            ? doc.data()
            : { minutes: 0, pomodoros: 0, date: dateKey };
          callback(data);
        });
    },

    // インベントリ取得
    async getInventory(uid) {
      const snapshot = await db.collection('rpg_inventory').doc(uid)
        .collection('items').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    // ミニゲーム結果取得（直近N件）
    async getRecentResults(uid, limit = 20) {
      const snapshot = await db.collection('rpg_minigame_results')
        .where('uid', '==', uid)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    // スキルレート取得
    async getSkillRate(uid, subject) {
      const doc = await db.collection('rpg_skill_rates').doc(uid)
        .collection('subjects').doc(subject).get();
      return doc.exists ? doc.data() : { rate: 0 };
    },

    // 全科目のスキルレート取得
    async getAllSkillRates(uid) {
      const snapshot = await db.collection('rpg_skill_rates').doc(uid)
        .collection('subjects').get();
      const rates = {};
      snapshot.docs.forEach(doc => {
        rates[doc.id] = doc.data();
      });
      return rates;
    },

    // Cloud Functions 呼び出し: awardSessionResult
    async awardSessionResult(params) {
      const fn = firebase.functions().httpsCallable('awardSessionResult');
      const result = await fn(params);
      return result.data;
    }
  };
})();

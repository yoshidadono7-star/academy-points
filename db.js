// ============================================
// データ層 - Firestore CRUD
// ============================================

// --- 生徒 ---
const StudentsDB = {
  async getAll() {
    const snap = await db.collection('students').orderBy('name').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getById(id) {
    const doc = await db.collection('students').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },
  async getByNicknameAndPin(nickname, pin) {
    const snap = await db.collection('students')
      .where('nickname', '==', nickname)
      .where('pin', '==', pin)
      .limit(1).get();
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
  },
  async add(data) {
    const ref = await db.collection('students').add({
      ...data,
      totalPoints: data.totalPoints || 0,
      currentPoints: data.currentPoints || 0,
      totalEarned: data.totalEarned || 0,
      totalSpent: data.totalSpent || 0,
      streak: data.streak || 0,
      bestStreak: data.bestStreak || 0,
      level: data.level || 1,
      rank: data.rank || 'rookie', // rookie, crew, senior, captain
      guildId: data.guildId || null,
      enrollDate: data.enrollDate || firebase.firestore.FieldValue.serverTimestamp(),
      freePassUsed: false,
      buddyId: data.buddyId || null,
      pomodoroTotal: data.pomodoroTotal || 0,
      callsign: data.callsign || data.nickname || '', // コールサイン
      // --- PROJECT: ORBIT 拡張 ---
      testType: data.testType || 'midterm',    // 'midterm'(中間テストあり) | 'no_midterm'(なし)
      weakSubject: data.weakSubject || null,    // 苦手科目（コンボ・ミッション判定用）
      targetStation: data.targetStation || null, // 志望校（マップ終着点、本人のみ表示）
      role: data.role || 'student',             // 'student' | 'supporter'(私立合格後)
      missionStreak: data.missionStreak || 0,   // デイリーミッション連続達成数
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async update(id, data) {
    await db.collection('students').doc(id).update(data);
  },
  async delete(id) {
    await db.collection('students').doc(id).delete();
  },
  async addPoints(id, points) {
    await db.collection('students').doc(id).update({
      totalPoints: firebase.firestore.FieldValue.increment(points),
      currentPoints: firebase.firestore.FieldValue.increment(points)
    });
  },
  async spendPoints(id, points) {
    await db.collection('students').doc(id).update({
      currentPoints: firebase.firestore.FieldValue.increment(-points)
    });
  }
};

// --- 学習ログ ---
const StudyLogsDB = {
  async add(data) {
    const ref = await db.collection('studyLogs').add({
      studentId: data.studentId,
      studentName: data.studentName || '',
      subject: data.subject,
      duration: data.duration, // 分
      points: data.points,
      location: data.location || '塾', // 塾/自宅/Zoom
      method: data.method || 'normal', // normal/pomodoro
      pomodoroCount: data.pomodoroCount || 0,
      date: data.date || new Date().toISOString().split('T')[0],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async getByStudent(studentId, limitCount = 50) {
    const snap = await db.collection('studyLogs')
      .where('studentId', '==', studentId)
      .orderBy('createdAt', 'desc')
      .limit(limitCount).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getByDate(date) {
    const snap = await db.collection('studyLogs')
      .where('date', '==', date).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getByDateRange(startDate, endDate) {
    const snap = await db.collection('studyLogs')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getRecent(days = 7) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const startStr = start.toISOString().split('T')[0];
    const snap = await db.collection('studyLogs')
      .where('date', '>=', startStr)
      .orderBy('date', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

// --- タスク ---
const TasksDB = {
  async getAll() {
    const snap = await db.collection('tasks').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getActive() {
    const snap = await db.collection('tasks')
      .where('active', '==', true)
      .orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async add(data) {
    const ref = await db.collection('tasks').add({
      title: data.title,
      description: data.description || '',
      points: data.points || 10,
      category: data.category || 'general',
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async update(id, data) {
    await db.collection('tasks').doc(id).update(data);
  },
  async delete(id) {
    await db.collection('tasks').doc(id).delete();
  },
  async complete(taskId, studentId, studentName) {
    await db.collection('taskCompletions').add({
      taskId, studentId, studentName,
      completedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },
  async getCompletions(studentId) {
    const snap = await db.collection('taskCompletions')
      .where('studentId', '==', studentId)
      .orderBy('completedAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

// --- 景品 ---
const PrizesDB = {
  async getAll() {
    const snap = await db.collection('prizes').orderBy('cost').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async add(data) {
    const ref = await db.collection('prizes').add({
      name: data.name,
      description: data.description || '',
      cost: data.cost,
      stock: data.stock || -1, // -1 = 無制限
      icon: data.icon || '🎁',
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async update(id, data) {
    await db.collection('prizes').doc(id).update(data);
  },
  async exchange(prizeId, studentId, studentName, cost) {
    await db.collection('prizeHistory').add({
      prizeId, studentId, studentName, cost,
      exchangedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await StudentsDB.spendPoints(studentId, cost);
  },
  async getHistory(studentId) {
    const snap = await db.collection('prizeHistory')
      .where('studentId', '==', studentId)
      .orderBy('exchangedAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getAllHistory() {
    const snap = await db.collection('prizeHistory')
      .orderBy('exchangedAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

// --- コンディション ---
const ConditionsDB = {
  async add(data) {
    const ref = await db.collection('conditions').add({
      studentId: data.studentId,
      studentName: data.studentName || '',
      mood: data.mood, // 1-5
      energy: data.energy, // 1-5
      motivation: data.motivation, // 1-5
      note: data.note || '',
      date: data.date || new Date().toISOString().split('T')[0],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async getByStudent(studentId, limitCount = 30) {
    const snap = await db.collection('conditions')
      .where('studentId', '==', studentId)
      .orderBy('createdAt', 'desc')
      .limit(limitCount).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getToday() {
    const today = new Date().toISOString().split('T')[0];
    const snap = await db.collection('conditions')
      .where('date', '==', today).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getByDateRange(startDate, endDate) {
    const snap = await db.collection('conditions')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

// --- バッジ ---
const BADGE_DEFINITIONS = [
  { id: 'first_study', name: '初めの一歩', icon: '👣', desc: '初めて学習を記録した' },
  { id: 'streak_3', name: '3日連続', icon: '🔥', desc: '3日連続で学習した' },
  { id: 'streak_7', name: '1週間マスター', icon: '⭐', desc: '7日連続で学習した' },
  { id: 'streak_14', name: '2週間チャンピオン', icon: '🏆', desc: '14日連続で学習した' },
  { id: 'streak_30', name: '月間レジェンド', icon: '👑', desc: '30日連続で学習した' },
  { id: 'points_100', name: 'ポイントハンター', icon: '💰', desc: '累計100ポイント獲得' },
  { id: 'points_500', name: 'ポイントマスター', icon: '💎', desc: '累計500ポイント獲得' },
  { id: 'points_1000', name: 'ポイントキング', icon: '🏅', desc: '累計1000ポイント獲得' },
  { id: 'study_10h', name: '学習者', icon: '📖', desc: '累計10時間学習した' },
  { id: 'study_50h', name: '勉強家', icon: '📚', desc: '累計50時間学習した' },
  { id: 'study_100h', name: '学習マスター', icon: '🎓', desc: '累計100時間学習した' },
  { id: 'pomodoro_10', name: 'ポモドーロ入門', icon: '🍅', desc: 'ポモドーロ10回達成' },
  { id: 'pomodoro_50', name: 'ポモドーロ達人', icon: '🍅', desc: 'ポモドーロ50回達成' },
  { id: 'multi_subject', name: 'マルチタレント', icon: '🌟', desc: '3科目以上を学習した' },
  { id: 'early_bird', name: '早起き学習', icon: '🌅', desc: '朝6時台に学習した' },
  { id: 'night_owl', name: '夜型学習', icon: '🦉', desc: '22時以降に学習した' },
  { id: 'home_study', name: '自宅学習マスター', icon: '🏠', desc: '自宅で10回以上学習した' },
  { id: 'zoom_study', name: 'オンライン学習者', icon: '💻', desc: 'Zoomで5回以上学習した' },
  { id: 'raid_killer', name: 'レイドボス討伐', icon: '⚔️', desc: 'レイドボス討伐に貢献した' }
];

const BadgesDB = {
  async getByStudent(studentId) {
    const snap = await db.collection('badges')
      .where('studentId', '==', studentId).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async award(studentId, badgeId) {
    const existing = await db.collection('badges')
      .where('studentId', '==', studentId)
      .where('badgeId', '==', badgeId).get();
    if (!existing.empty) return null;
    const def = BADGE_DEFINITIONS.find(b => b.id === badgeId);
    if (!def) return null;
    const ref = await db.collection('badges').add({
      studentId, badgeId,
      name: def.name, icon: def.icon, desc: def.desc,
      awardedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async checkAndAward(studentId, stats) {
    const awarded = [];
    const checks = [
      { id: 'first_study', cond: stats.totalStudySessions >= 1 },
      { id: 'streak_3', cond: stats.streak >= 3 },
      { id: 'streak_7', cond: stats.streak >= 7 },
      { id: 'streak_14', cond: stats.streak >= 14 },
      { id: 'streak_30', cond: stats.streak >= 30 },
      { id: 'points_100', cond: stats.totalPoints >= 100 },
      { id: 'points_500', cond: stats.totalPoints >= 500 },
      { id: 'points_1000', cond: stats.totalPoints >= 1000 },
      { id: 'study_10h', cond: stats.totalMinutes >= 600 },
      { id: 'study_50h', cond: stats.totalMinutes >= 3000 },
      { id: 'study_100h', cond: stats.totalMinutes >= 6000 },
      { id: 'pomodoro_10', cond: stats.totalPomodoros >= 10 },
      { id: 'pomodoro_50', cond: stats.totalPomodoros >= 50 },
      { id: 'multi_subject', cond: stats.subjectCount >= 3 },
      { id: 'home_study', cond: stats.homeStudyCount >= 10 },
      { id: 'zoom_study', cond: stats.zoomStudyCount >= 5 },
    ];
    for (const c of checks) {
      if (c.cond) {
        const id = await this.award(studentId, c.id);
        if (id) awarded.push(c.id);
      }
    }
    return awarded;
  }
};

// --- メッセージ ---
const MessagesDB = {
  async send(data) {
    const ref = await db.collection('messages').add({
      fromType: data.fromType || 'teacher', // teacher/student
      toStudentId: data.toStudentId,
      toStudentName: data.toStudentName || '',
      content: data.content,
      read: false,
      replyTo: data.replyTo || null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async getByStudent(studentId) {
    const snap = await db.collection('messages')
      .where('toStudentId', '==', studentId)
      .orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getAll() {
    const snap = await db.collection('messages')
      .orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async markRead(id) {
    await db.collection('messages').doc(id).update({ read: true });
  },
  async getUnreadCount(studentId) {
    const snap = await db.collection('messages')
      .where('toStudentId', '==', studentId)
      .where('read', '==', false).get();
    return snap.size;
  }
};

// --- ギルド ---
const GUILD_THEMES = [
  { id: 'fire', name: '炎のギルド', icon: '🔥', color: '#ef4444' },
  { id: 'water', name: '水のギルド', icon: '💧', color: '#3b82f6' },
  { id: 'wind', name: '風のギルド', icon: '🌪️', color: '#10b981' },
  { id: 'earth', name: '大地のギルド', icon: '🏔️', color: '#f59e0b' },
  { id: 'light', name: '光のギルド', icon: '✨', color: '#8b5cf6' },
  { id: 'dark', name: '闇のギルド', icon: '🌙', color: '#6366f1' }
];

const GuildsDB = {
  async getAll() {
    const snap = await db.collection('guilds').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getById(id) {
    const doc = await db.collection('guilds').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },
  async create(data) {
    const theme = GUILD_THEMES.find(t => t.id === data.themeId) || GUILD_THEMES[0];
    const ref = await db.collection('guilds').add({
      name: data.name || theme.name,
      themeId: theme.id,
      icon: theme.icon,
      color: theme.color,
      members: data.members || [],
      totalPoints: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async update(id, data) {
    await db.collection('guilds').doc(id).update(data);
  },
  async addMember(guildId, studentId) {
    await db.collection('guilds').doc(guildId).update({
      members: firebase.firestore.FieldValue.arrayUnion(studentId)
    });
    await StudentsDB.update(studentId, { guildId });
  },
  async removeMember(guildId, studentId) {
    await db.collection('guilds').doc(guildId).update({
      members: firebase.firestore.FieldValue.arrayRemove(studentId)
    });
    await StudentsDB.update(studentId, { guildId: null });
  },
  async addPoints(guildId, points) {
    await db.collection('guilds').doc(guildId).update({
      totalPoints: firebase.firestore.FieldValue.increment(points)
    });
  },
  async getRanking() {
    const snap = await db.collection('guilds').orderBy('totalPoints', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  // 一蓮托生ボーナス: ギルド全員が学習した日はボーナスポイント
  async checkAllStudiedBonus(guildId, date) {
    const guild = await this.getById(guildId);
    if (!guild || !guild.members || guild.members.length === 0) return false;
    const logs = await StudyLogsDB.getByDate(date);
    const studiedMembers = new Set(logs.map(l => l.studentId));
    return guild.members.every(m => studiedMembers.has(m));
  }
};

// --- レイドボス ---
const RaidBossDB = {
  async getAll() {
    const snap = await db.collection('raidBosses').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getActive() {
    const snap = await db.collection('raidBosses')
      .where('defeated', '==', false)
      .orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async create(data) {
    const ref = await db.collection('raidBosses').add({
      name: data.name,
      icon: data.icon || '👹',
      maxHp: data.maxHp,
      currentHp: data.maxHp,
      reward: data.reward || 50,
      defeated: false,
      defeatedAt: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async damage(bossId, studentId, studentName, amount) {
    const boss = await db.collection('raidBosses').doc(bossId).get();
    if (!boss.exists || boss.data().defeated) return null;

    const newHp = Math.max(0, boss.data().currentHp - amount);
    const defeated = newHp <= 0;

    await db.collection('raidBosses').doc(bossId).update({
      currentHp: newHp,
      defeated,
      defeatedAt: defeated ? firebase.firestore.FieldValue.serverTimestamp() : null
    });

    await db.collection('raidDamage').add({
      bossId, studentId, studentName, amount,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return { newHp, defeated, reward: defeated ? boss.data().reward : 0 };
  },
  async getDamageLog(bossId) {
    const snap = await db.collection('raidDamage')
      .where('bossId', '==', bossId)
      .orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

// --- テスト結果 ---
const ExamResultsDB = {
  async add(data) {
    const ref = await db.collection('examResults').add({
      studentId: data.studentId,
      studentName: data.studentName || '',
      examName: data.examName,
      date: data.date,
      subjects: data.subjects, // [{name, score, maxScore}]
      totalScore: data.totalScore,
      maxTotalScore: data.maxTotalScore,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async getByStudent(studentId) {
    const snap = await db.collection('examResults')
      .where('studentId', '==', studentId)
      .orderBy('date', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getAll() {
    const snap = await db.collection('examResults')
      .orderBy('date', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

// --- 通知 ---
const NotificationsDB = {
  async add(data) {
    const ref = await db.collection('notifications').add({
      type: data.type, // badge, raid, streak, risk, guild
      title: data.title,
      message: data.message,
      studentId: data.studentId || null,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async getRecent(limitCount = 50) {
    const snap = await db.collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(limitCount).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getUnread() {
    const snap = await db.collection('notifications')
      .where('read', '==', false)
      .orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async markRead(id) {
    await db.collection('notifications').doc(id).update({ read: true });
  },
  async markAllRead() {
    const unread = await this.getUnread();
    const batch = db.batch();
    unread.forEach(n => batch.update(db.collection('notifications').doc(n.id), { read: true }));
    await batch.commit();
  }
};

// --- コーチング分析 (アドラー心理学 3×6モデル) ---
const CoachingDB = {
  // 3つの柱 × 6つの指標 = 18指標
  PILLARS: [
    {
      id: 'self_acceptance', name: '自己受容',
      indicators: [
        { id: 'sa_effort', name: '努力の継続性' },
        { id: 'sa_challenge', name: '挑戦意欲' },
        { id: 'sa_recovery', name: '失敗からの回復力' },
        { id: 'sa_self_eval', name: '自己評価の安定性' },
        { id: 'sa_growth', name: '成長実感' },
        { id: 'sa_autonomy', name: '自律的学習' }
      ]
    },
    {
      id: 'trust_others', name: '他者信頼',
      indicators: [
        { id: 'to_collab', name: '協力行動' },
        { id: 'to_comm', name: 'コミュニケーション' },
        { id: 'to_empathy', name: '共感性' },
        { id: 'to_respect', name: '他者尊重' },
        { id: 'to_help', name: '援助要請力' },
        { id: 'to_feedback', name: 'フィードバック受容' }
      ]
    },
    {
      id: 'contribution', name: '他者貢献',
      indicators: [
        { id: 'co_teach', name: '教え合い' },
        { id: 'co_encourage', name: '励まし行動' },
        { id: 'co_role', name: '役割意識' },
        { id: 'co_guild', name: 'ギルド貢献' },
        { id: 'co_initiative', name: '率先行動' },
        { id: 'co_gratitude', name: '感謝表現' }
      ]
    }
  ],

  async analyze(studentId) {
    const [logs, conditions, badges, completions] = await Promise.all([
      StudyLogsDB.getByStudent(studentId, 100),
      ConditionsDB.getByStudent(studentId, 30),
      BadgesDB.getByStudent(studentId),
      TasksDB.getCompletions(studentId)
    ]);

    const student = await StudentsDB.getById(studentId);
    if (!student) return null;

    // 自己受容の分析
    const streak = student.streak || 0;
    const totalSessions = logs.length;
    const avgMotivation = conditions.length > 0
      ? conditions.reduce((s, c) => s + (c.motivation || 3), 0) / conditions.length : 3;

    // 各指標のスコア (1-5)
    const scores = {
      sa_effort: Math.min(5, Math.max(1, Math.round(streak / 6) + 1)),
      sa_challenge: Math.min(5, Math.max(1, Math.round(new Set(logs.map(l => l.subject)).size / 1.5))),
      sa_recovery: Math.min(5, Math.max(1, Math.round(avgMotivation))),
      sa_self_eval: Math.min(5, Math.max(1, Math.round(conditions.length > 0
        ? conditions.reduce((s, c) => s + (c.mood || 3), 0) / conditions.length : 3))),
      sa_growth: Math.min(5, Math.max(1, Math.round(badges.length / 3) + 1)),
      sa_autonomy: Math.min(5, Math.max(1, Math.round(logs.filter(l => l.location === '自宅').length / 5) + 1)),
      to_collab: Math.min(5, Math.max(1, student.guildId ? 3 : 1)),
      to_comm: Math.min(5, Math.max(1, 3)),
      to_empathy: Math.min(5, Math.max(1, 3)),
      to_respect: Math.min(5, Math.max(1, 3)),
      to_help: Math.min(5, Math.max(1, completions.length > 3 ? 4 : 2)),
      to_feedback: Math.min(5, Math.max(1, 3)),
      co_teach: Math.min(5, Math.max(1, 2)),
      co_encourage: Math.min(5, Math.max(1, 3)),
      co_role: Math.min(5, Math.max(1, student.guildId ? 3 : 1)),
      co_guild: Math.min(5, Math.max(1, student.guildId ? 3 : 1)),
      co_initiative: Math.min(5, Math.max(1, Math.round(totalSessions / 10) + 1)),
      co_gratitude: Math.min(5, Math.max(1, 3))
    };

    // 柱ごとの平均スコア
    const pillarScores = this.PILLARS.map(p => ({
      ...p,
      score: Math.round(p.indicators.reduce((s, i) => s + (scores[i.id] || 3), 0) / p.indicators.length * 10) / 10,
      indicators: p.indicators.map(i => ({ ...i, score: scores[i.id] || 3 }))
    }));

    return { studentId, studentName: student.name, pillarScores, scores };
  },

  // 14日ヒートマップデータ
  async getHeatmap(studentId) {
    const days = 14;
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const logs = await StudyLogsDB.getByDate(dateStr);
      const studentLogs = logs.filter(l => l.studentId === studentId);
      const totalMin = studentLogs.reduce((s, l) => s + (l.duration || 0), 0);
      data.push({ date: dateStr, minutes: totalMin, sessions: studentLogs.length });
    }
    return data;
  }
};

// --- 離脱リスク検知 ---
const RiskDetector = {
  async checkAll() {
    const students = await StudentsDB.getAll();
    const risks = [];
    const today = new Date();
    const recentLogs = await StudyLogsDB.getRecent(14);

    for (const s of students) {
      const studentLogs = recentLogs.filter(l => l.studentId === s.id);
      const conditions = await ConditionsDB.getByStudent(s.id, 7);

      const riskFactors = [];

      // 7日間学習なし
      const last7days = studentLogs.filter(l => {
        const d = new Date(l.date);
        return (today - d) / 86400000 <= 7;
      });
      if (last7days.length === 0) {
        riskFactors.push({ type: 'no_study_7days', label: '7日間学習なし', severity: 'high' });
      }

      // 連続途切れ（ストリークが0に落ちた）
      if (s.streak === 0 && studentLogs.length > 0) {
        riskFactors.push({ type: 'streak_broken', label: '連続記録が途切れた', severity: 'medium' });
      }

      // モチベーション低下
      if (conditions.length >= 3) {
        const avgMotivation = conditions.slice(0, 3).reduce((s, c) => s + (c.motivation || 3), 0) / 3;
        if (avgMotivation <= 2) {
          riskFactors.push({ type: 'low_motivation', label: 'モチベーション低下', severity: 'high' });
        }
      }

      // 気分落ち込み
      if (conditions.length >= 3) {
        const avgMood = conditions.slice(0, 3).reduce((s, c) => s + (c.mood || 3), 0) / 3;
        if (avgMood <= 2) {
          riskFactors.push({ type: 'low_mood', label: '気分の落ち込み', severity: 'medium' });
        }
      }

      // 学習時間減少
      if (studentLogs.length >= 2) {
        const recent = studentLogs.filter(l => {
          const d = new Date(l.date);
          return (today - d) / 86400000 <= 7;
        });
        const older = studentLogs.filter(l => {
          const d = new Date(l.date);
          const diff = (today - d) / 86400000;
          return diff > 7 && diff <= 14;
        });
        if (older.length > 0 && recent.length > 0) {
          const recentAvg = recent.reduce((s, l) => s + l.duration, 0) / recent.length;
          const olderAvg = older.reduce((s, l) => s + l.duration, 0) / older.length;
          if (recentAvg < olderAvg * 0.5) {
            riskFactors.push({ type: 'study_decrease', label: '学習時間が半減', severity: 'medium' });
          }
        }
      }

      if (riskFactors.length > 0) {
        risks.push({
          studentId: s.id,
          studentName: s.name,
          riskLevel: riskFactors.some(r => r.severity === 'high') ? 'high' : 'medium',
          factors: riskFactors
        });
      }
    }

    return risks.sort((a, b) => (a.riskLevel === 'high' ? -1 : 1));
  }
};

// --- ミッション（月次） ---
const MissionsDB = {
  async getAll() {
    const snap = await db.collection('missions').orderBy('startDate', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getActive() {
    const today = getToday();
    const snap = await db.collection('missions')
      .where('status', '==', 'active').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getById(id) {
    const doc = await db.collection('missions').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },
  async create(data) {
    const ref = await db.collection('missions').add({
      title: data.title,
      metric: data.metric || 'total_hours', // total_hours, total_pomodoros, teaching_count, ai_problems, all_streak
      targetValue: data.targetValue,
      currentValue: 0,
      startDate: data.startDate,
      endDate: data.endDate,
      status: 'active', // active, completed, failed
      bonusCoins: data.bonusCoins || 50,
      milestones: [
        { stage: 1, percent: 25, name: data.milestone1 || '大気圏突破', reached: false, coins: 10 },
        { stage: 2, percent: 50, name: data.milestone2 || '宇宙空間到達', reached: false, coins: 10 },
        { stage: 3, percent: 75, name: data.milestone3 || '月軌道到達', reached: false, coins: 10 },
        { stage: 4, percent: 100, name: data.milestone4 || '月面着陸', reached: false, coins: 50 }
      ],
      teamMode: data.teamMode || false, // チーム制ミッション
      teams: data.teams || [], // [{name, members:[], score:0}]
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async update(id, data) {
    await db.collection('missions').doc(id).update(data);
  },
  async addProgress(id, amount) {
    const mission = await this.getById(id);
    if (!mission || mission.status !== 'active') return null;
    const newValue = mission.currentValue + amount;
    const percent = (newValue / mission.targetValue) * 100;
    const milestones = mission.milestones.map(m => ({
      ...m,
      reached: percent >= m.percent ? true : m.reached
    }));
    const newlyReached = milestones.filter((m, i) => m.reached && !mission.milestones[i].reached);
    const status = percent >= 100 ? 'completed' : 'active';
    await this.update(id, { currentValue: newValue, milestones, status });
    return { newValue, percent, milestones, newlyReached, status };
  },
  async complete(id) {
    await this.update(id, {
      status: 'completed',
      completedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },
  async fail(id) {
    await this.update(id, { status: 'failed' });
  }
};

// --- ポイント取引履歴 ---
const CoinsDB = {
  async addTransaction(data) {
    const ref = await db.collection('coins').add({
      studentId: data.studentId,
      amount: data.amount, // +獲得 / -消費
      type: data.type || 'earn', // earn, spend, bonus, gift
      category: data.category || 'manual', // attendance, pomodoro, review, teaching, streak, mission, event, reward, gift
      description: data.description || '',
      grantedBy: data.grantedBy || 'coach', // coach_id, system
      eventId: data.eventId || null,
      approvalStatus: data.approvalStatus || 'confirmed', // confirmed, pending
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async getByStudent(studentId, limitCount = 100) {
    const snap = await db.collection('coins')
      .where('studentId', '==', studentId)
      .orderBy('timestamp', 'desc')
      .limit(limitCount).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getPending() {
    const snap = await db.collection('coins')
      .where('approvalStatus', '==', 'pending')
      .orderBy('timestamp', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async approve(id) {
    await db.collection('coins').doc(id).update({ approvalStatus: 'confirmed' });
  },
  async reject(id) {
    await db.collection('coins').doc(id).update({ approvalStatus: 'rejected' });
  },
  async getByDateRange(startDate, endDate) {
    const snap = await db.collection('coins')
      .where('timestamp', '>=', new Date(startDate))
      .where('timestamp', '<=', new Date(endDate + 'T23:59:59'))
      .orderBy('timestamp', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getDailySummary(date) {
    const start = new Date(date);
    const end = new Date(date + 'T23:59:59');
    const snap = await db.collection('coins')
      .where('timestamp', '>=', start)
      .where('timestamp', '<=', end)
      .where('approvalStatus', '==', 'confirmed').get();
    const txns = snap.docs.map(d => d.data());
    const totalIssued = txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalSpent = txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    return { totalIssued, totalSpent, transactionCount: txns.length };
  },
  // 月間経済サマリー
  async getMonthlySummary(year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${endDay}`;
    const txns = await this.getByDateRange(startDate, endDate);
    const confirmed = txns.filter(t => t.approvalStatus === 'confirmed');
    const totalIssued = confirmed.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalSpent = confirmed.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const outflowRatio = totalIssued > 0 ? Math.round((totalSpent / totalIssued) * 100) : 0;
    return { totalIssued, totalSpent, outflowRatio, transactionCount: confirmed.length };
  }
};

// --- イベントエンジン ---
const EventsDB = {
  async getAll() {
    const snap = await db.collection('events').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getActive() {
    const now = new Date();
    const snap = await db.collection('events')
      .where('active', '==', true).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => {
      if (!e.activatedAt) return false;
      const activated = e.activatedAt.toDate ? e.activatedAt.toDate() : new Date(e.activatedAt);
      const endTime = new Date(activated.getTime() + (e.durationMinutes || 30) * 60000);
      return now < endTime;
    });
  },
  async create(data) {
    const ref = await db.collection('events').add({
      name: data.name,
      type: data.type || 'multiplier', // multiplier, bonus, challenge, surprise
      multiplier: data.multiplier || 2.0,
      durationMinutes: data.durationMinutes || 30,
      bonusCoins: data.bonusCoins || 0,
      description: data.description || '',
      active: false,
      activatedAt: null,
      probability: data.probability || 0.15, // 参考値（手動トリガーでは使用しない）
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async activate(id) {
    await db.collection('events').doc(id).update({
      active: true,
      activatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },
  async deactivate(id) {
    await db.collection('events').doc(id).update({ active: false });
  },
  async getHistory(days = 30) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const snap = await db.collection('events')
      .where('activatedAt', '>=', start)
      .orderBy('activatedAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

// --- 報酬カタログ（設計書準拠） ---
const RewardsDB = {
  async getAll() {
    const snap = await db.collection('rewards').orderBy('level').orderBy('cost').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getByLevel(level) {
    const snap = await db.collection('rewards')
      .where('level', '==', level).orderBy('cost').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async create(data) {
    const ref = await db.collection('rewards').add({
      name: data.name,
      category: data.category || 'goods', // goods, experience, privilege, regional
      cost: data.cost,
      stock: data.stock !== undefined ? data.stock : -1, // -1 = 無制限
      level: data.level || 1, // 1-4
      cooldownDays: data.cooldownDays || 0,
      rankRequired: data.rankRequired || 'rookie', // rookie, crew, senior, captain
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async update(id, data) {
    await db.collection('rewards').doc(id).update(data);
  },
  async exchange(rewardId, studentId, studentName, cost) {
    await db.collection('rewardHistory').add({
      rewardId, studentId, studentName, cost,
      exchangedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // ポイント消費
    await StudentsDB.spendPoints(studentId, cost);
    // 取引履歴に記録
    await CoinsDB.addTransaction({
      studentId, amount: -cost, type: 'spend',
      category: 'reward', description: `報酬交換`,
      grantedBy: 'system'
    });
  }
};

// --- クルーランク制度 ---
const RANK_DEFINITIONS = [
  {
    id: 'rookie', name: 'ルーキー', icon: '🌱', order: 1,
    requirements: { days: 0, totalCoins: 0, streak: 0 },
    perks: ['1.5倍ブースト（7日間）', 'Lv1報酬のみ']
  },
  {
    id: 'crew', name: 'クルー', icon: '🚀', order: 2,
    requirements: { days: 30, totalCoins: 150, streak: 0 },
    perks: ['ランキング参加', 'Lv1〜2報酬', 'ギフト機能', '貯蓄機能']
  },
  {
    id: 'senior', name: 'シニアクルー', icon: '⭐', order: 3,
    requirements: { days: 90, totalCoins: 1000, streak: 10, coachApproval: true },
    perks: ['バディ資格', 'Lv3報酬', '教え合い+15', 'イベント提案権']
  },
  {
    id: 'captain', name: 'キャプテン', icon: '👑', order: 4,
    requirements: { days: 180, totalCoins: 3000, streak: 10, buddyComplete: 1, coachApproval: true },
    perks: ['ミッション設計参加', '教室ルール提案権', '月末MC', '新入生メンター']
  }
];

const RankSystem = {
  RANKS: RANK_DEFINITIONS,
  getRank(rankId) {
    return RANK_DEFINITIONS.find(r => r.id === rankId) || RANK_DEFINITIONS[0];
  },
  getNextRank(currentRankId) {
    const current = RANK_DEFINITIONS.find(r => r.id === currentRankId);
    if (!current) return RANK_DEFINITIONS[1];
    return RANK_DEFINITIONS.find(r => r.order === current.order + 1) || null;
  },
  canAccessRewardLevel(rankId, rewardLevel) {
    const rank = this.getRank(rankId);
    if (rewardLevel <= 1) return true; // ルーキーでもLv1はOK
    if (rewardLevel <= 2) return rank.order >= 2; // クルー以上
    if (rewardLevel <= 3) return rank.order >= 3; // シニア以上
    return rank.order >= 4; // キャプテンのみ
  },
  // 昇格チェック（コーチ推薦は別途確認）
  async checkPromotion(studentId) {
    const student = await StudentsDB.getById(studentId);
    if (!student) return null;
    const currentRank = student.rank || 'rookie';
    const nextRank = this.getNextRank(currentRank);
    if (!nextRank) return null;

    const enrollDate = student.enrollDate ? (student.enrollDate.toDate ? student.enrollDate.toDate() : new Date(student.enrollDate)) : student.createdAt?.toDate?.() || new Date();
    const daysSinceEnroll = Math.floor((new Date() - enrollDate) / 86400000);
    const reqs = nextRank.requirements;

    return {
      nextRank: nextRank.id,
      nextRankName: nextRank.name,
      met: {
        days: daysSinceEnroll >= reqs.days,
        totalCoins: (student.totalEarned || student.totalPoints || 0) >= reqs.totalCoins,
        streak: (student.bestStreak || student.streak || 0) >= (reqs.streak || 0),
        coachApproval: !reqs.coachApproval // コーチ推薦は手動確認
      },
      current: {
        days: daysSinceEnroll,
        totalCoins: student.totalEarned || student.totalPoints || 0,
        streak: student.bestStreak || student.streak || 0
      }
    };
  }
};

// --- ストリーク管理（フリーパス対応） ---
const StreakManager = {
  // フリーパスの使用
  async useFreePass(studentId) {
    const student = await StudentsDB.getById(studentId);
    if (!student || student.freePassUsed) return false;
    await StudentsDB.update(studentId, { freePassUsed: true });
    return true;
  },
  // 月初にフリーパスをリセット
  async resetMonthlyFreePass() {
    const students = await StudentsDB.getAll();
    const batch = db.batch();
    students.forEach(s => {
      batch.update(db.collection('students').doc(s.id), { freePassUsed: false });
    });
    await batch.commit();
  },
  // ストリークボーナス計算
  getStreakBonus(streakDays) {
    if (streakDays >= 20) return 50;
    if (streakDays >= 10) return 30;
    if (streakDays >= 5) return 15;
    if (streakDays >= 3) return 5;
    return 0;
  },
  // ストリーク更新（bestStreak保存）
  async updateStreak(studentId, newStreak) {
    const student = await StudentsDB.getById(studentId);
    if (!student) return;
    const updates = { streak: newStreak };
    if (newStreak > (student.bestStreak || 0)) {
      updates.bestStreak = newStreak;
    }
    await StudentsDB.update(studentId, updates);
  }
};

// --- アノマリー検知（設計書準拠5カテゴリ） ---
const AnomalyDetector = {
  async scan() {
    const students = await StudentsDB.getAll();
    const alerts = [];
    const today = new Date();

    for (const s of students) {
      // ルーキーウィーク中は除外
      const enrollDate = s.enrollDate ? (s.enrollDate.toDate ? s.enrollDate.toDate() : new Date(s.enrollDate)) : null;
      const isRookie = enrollDate && ((today - enrollDate) / 86400000) <= 8;

      // 1. 獲得量の急増
      const recentCoins = await CoinsDB.getByStudent(s.id, 50);
      const last7 = recentCoins.filter(t => {
        if (!t.timestamp) return false;
        const ts = t.timestamp.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
        return (today - ts) / 86400000 <= 7 && t.amount > 0;
      });
      const prev7 = recentCoins.filter(t => {
        if (!t.timestamp) return false;
        const ts = t.timestamp.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
        const days = (today - ts) / 86400000;
        return days > 7 && days <= 14 && t.amount > 0;
      });
      if (!isRookie && prev7.length > 0) {
        const recentAvg = last7.reduce((s, t) => s + t.amount, 0) / Math.max(last7.length, 1);
        const prevAvg = prev7.reduce((s, t) => s + t.amount, 0) / prev7.length;
        if (recentAvg > prevAvg * 2) {
          alerts.push({ studentId: s.id, studentName: s.name || s.nickname, type: 'earning_spike', label: '獲得量急増（7日平均の2倍超）', severity: 'info' });
        }
      }

      // 2. 貯め込み（残高1500超＋消費ゼロ30日間）
      const balance = s.currentPoints || 0;
      if (balance > 1500) {
        const spent = recentCoins.filter(t => t.amount < 0);
        const recentSpent = spent.filter(t => {
          if (!t.timestamp) return false;
          const ts = t.timestamp.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
          return (today - ts) / 86400000 <= 30;
        });
        if (recentSpent.length === 0) {
          alerts.push({ studentId: s.id, studentName: s.name || s.nickname, type: 'hoarding', label: '貯め込み（残高1500超・消費なし30日）', severity: 'info' });
        }
      }
    }

    // 3. ギフト非対称性（A→B 3回以上、B→A 0回）
    const giftSnap = await db.collection('coins')
      .where('category', '==', 'gift')
      .where('approvalStatus', '==', 'confirmed').get();
    const gifts = giftSnap.docs.map(d => d.data());
    const giftPairs = {};
    gifts.forEach(g => {
      const key = `${g.grantedBy}→${g.studentId}`;
      giftPairs[key] = (giftPairs[key] || 0) + 1;
    });
    for (const [pair, count] of Object.entries(giftPairs)) {
      if (count >= 3) {
        const [from, to] = pair.split('→');
        const reverse = `${to}→${from}`;
        if (!giftPairs[reverse] || giftPairs[reverse] === 0) {
          alerts.push({ studentId: to, type: 'gift_asymmetry', label: `ギフト非対称性（${pair}: ${count}回, 逆方向: 0回）`, severity: 'info' });
        }
      }
    }

    return alerts;
  }
};

// --- ポイント経済パラメータ ---
const COIN_PARAMS = {
  // 基本収入
  attendance: 10,         // 通塾（入室＋目標設定）
  pomodoro: 5,            // ポモドーロ1セット
  pomodoroTriple: 10,     // ポモドーロ3連続ボーナス
  review: 5,              // 振り返りノート
  reviewPlan: 3,          // 振り返り＋翌日計画
  aiProblems10: 3,        // AI教材10問
  // 社会的行動
  teaching: 10,           // 教え合い（双方）
  newStudentSupport: 15,  // 新入生サポート
  trialSupport: 20,       // 体験授業生サポート
  socialMonthlyMax: 200,  // 社会的ボーナス月間上限
  // ストリーク: StreakManager.getStreakBonusで管理
  // ミッション連動
  milestoneBonus: 10,     // マイルストーン到達
  missionComplete: 50,    // ミッション達成
  // 経済制御
  coinExpiry: 180,        // 有効期限（日）= 6ヶ月
  balanceCap: 2000,       // 残高上限
  giftDailyMax: 20,       // ギフト1日上限
  giftPerMax: 10,         // ギフト1回上限
  // オンボーディング
  starterPack: 20,        // 体験授業スターターパック
  welcomeBonus: 30,       // 入塾ウェルカムボーナス
  rookieMultiplier: 1.5,  // ルーキーウィーク倍率
  // イベント
  eventMultiplier: 2.0    // イベントブースト倍率
};

// --- ユーティリティ ---
function formatDate(date) {
  if (!date) return '';
  if (date.toDate) date = date.toDate();
  if (typeof date === 'string') date = new Date(date);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateTime(date) {
  if (!date) return '';
  if (date.toDate) date = date.toDate();
  if (typeof date === 'string') date = new Date(date);
  return `${formatDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function calcLevel(totalPoints) {
  if (totalPoints >= 5000) return 10;
  if (totalPoints >= 3000) return 9;
  if (totalPoints >= 2000) return 8;
  if (totalPoints >= 1500) return 7;
  if (totalPoints >= 1000) return 6;
  if (totalPoints >= 700) return 5;
  if (totalPoints >= 400) return 4;
  if (totalPoints >= 200) return 3;
  if (totalPoints >= 50) return 2;
  return 1;
}

function getRankInfo(rankId) {
  return RANK_DEFINITIONS.find(r => r.id === rankId) || RANK_DEFINITIONS[0];
}

function getRankDisplay(rankId) {
  const r = getRankInfo(rankId);
  return `${r.icon} ${r.name}`;
}

// ポイント残高上限チェック
function checkBalanceCap(currentPoints) {
  if (currentPoints > COIN_PARAMS.balanceCap) {
    return { overflow: currentPoints - COIN_PARAMS.balanceCap, capped: COIN_PARAMS.balanceCap };
  }
  return { overflow: 0, capped: currentPoints };
}

// ============================================
// Game Design v2.0 — 5つの新モジュール
// ============================================

// ===== 宇宙マップ (Space Map) =====
const SPACE_STATIONS = [
  { id: 'earth',    level: 1,  points: 0,    name: '地球',           icon: '🌍', desc: '冒険の始まり' },
  { id: 'moon',     level: 2,  points: 50,   name: '月面基地',       icon: '🌙', desc: '宇宙への第一歩' },
  { id: 'mars',     level: 3,  points: 200,  name: '火星コロニー',   icon: '🔴', desc: '赤い星の開拓者' },
  { id: 'asteroid', level: 4,  points: 400,  name: '小惑星帯',       icon: '☄️', desc: '混沌を泳ぐ' },
  { id: 'jupiter',  level: 5,  points: 700,  name: '木星ステーション', icon: '🟤', desc: 'ガス巨星の前哨' },
  { id: 'saturn',   level: 6,  points: 1000, name: '土星の輪',       icon: '💫', desc: 'リングランナー' },
  { id: 'uranus',   level: 7,  points: 1500, name: '天王星基地',     icon: '🧊', desc: '氷の世界の探検家' },
  { id: 'neptune',  level: 8,  points: 2000, name: '海王星深部',     icon: '🔵', desc: '深宇宙ダイバー' },
  { id: 'pluto',    level: 9,  points: 3000, name: '冥王星前線',     icon: '⚫', desc: '既知宇宙の果て' },
  { id: 'galaxy',   level: 10, points: 5000, name: '銀河の果て',     icon: '🌌', desc: '宇宙の伝説' },
];

const HIDDEN_AREAS = [
  { id: 'comet_cave',    name: '彗星の洞窟',   icon: '☄️', afterStation: 'mars',
    condition: 'comboDiscoveryCount >= 5', conditionFn: (s) => s.comboDiscoveryCount >= 5,
    reward: { title: 'コンボハンター' } },
  { id: 'wormhole',      name: 'ワームホール', icon: '🕳️', afterStation: 'asteroid',
    condition: 'bestStreak >= 14', conditionFn: (s) => s.bestStreak >= 14,
    reward: { title: '時空の旅人' } },
  { id: 'alien_ruins',   name: '異星人の遺跡', icon: '👽', afterStation: 'jupiter',
    condition: 'allTimeSubjectCount >= 5', conditionFn: (s) => s.allTimeSubjectCount >= 5,
    reward: { title: 'マルチスペシャリスト' } },
  { id: 'meteor_shower', name: '流星群エリア', icon: '🌠', afterStation: 'saturn',
    condition: 'totalPomodoros >= 50', conditionFn: (s) => s.totalPomodoros >= 50,
    reward: { title: 'ポモドーロの星' } },
  { id: 'pirate_base',   name: '宇宙海賊基地', icon: '🏴‍☠️', afterStation: 'uranus',
    condition: 'legendaryMissionCleared >= 1', conditionFn: (s) => s.legendaryMissionCleared >= 1,
    reward: { title: '伝説の冒険者' } },
  { id: 'observatory',   name: '観測所オメガ', icon: '🔭', afterStation: 'neptune',
    condition: 'raidBossKills >= 3', conditionFn: (s) => s.raidBossKills >= 3,
    reward: { title: '宇宙の観測者' } },
];

function getStation(totalPoints) {
  for (let i = SPACE_STATIONS.length - 1; i >= 0; i--) {
    if (totalPoints >= SPACE_STATIONS[i].points) return SPACE_STATIONS[i];
  }
  return SPACE_STATIONS[0];
}

function getStationProgress(totalPoints) {
  const current = getStation(totalPoints);
  const idx = SPACE_STATIONS.findIndex(s => s.id === current.id);
  if (idx >= SPACE_STATIONS.length - 1) return { current, next: null, percent: 100, remaining: 0 };
  const next = SPACE_STATIONS[idx + 1];
  const range = next.points - current.points;
  const progress = totalPoints - current.points;
  return { current, next, percent: Math.floor(progress / range * 100), remaining: next.points - totalPoints };
}

const SpaceMapDB = {
  async getDiscoveries(studentId) {
    const snap = await db.collection('hiddenAreaDiscoveries')
      .where('studentId', '==', studentId).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async checkAndUnlock(studentId, stats) {
    const existing = await this.getDiscoveries(studentId);
    const existingIds = existing.map(e => e.areaId);
    const newlyUnlocked = [];
    for (const area of HIDDEN_AREAS) {
      if (existingIds.includes(area.id)) continue;
      if (area.conditionFn(stats)) {
        await db.collection('hiddenAreaDiscoveries').add({
          studentId, areaId: area.id,
          unlockedAt: firebase.firestore.FieldValue.serverTimestamp(),
          titleEquipped: false
        });
        newlyUnlocked.push(area);
      }
    }
    return newlyUnlocked;
  },
  async equipTitle(discoveryId) {
    await db.collection('hiddenAreaDiscoveries').doc(discoveryId).update({ titleEquipped: true });
  }
};

// ===== コンボシステム (Combo System) =====
const COMBO_DEFINITIONS = [
  // 公開コンボ
  { id: 'fire_starter', name: 'ファイアースターター', icon: '🔥',
    desc: '3日連続で出席して学習', hidden: false, cooldown: 'weekly', category: 'streak',
    conditionFn: (ctx) => ctx.currentStreak >= 3,
    reward: { type: 'bonus', points: 30 } },
  { id: 'multi_talent', name: 'マルチタレント', icon: '📚',
    desc: '1日に3教科以上学習', hidden: false, cooldown: 'daily', category: 'variety',
    conditionFn: (ctx) => ctx.todaySubjects.length >= 3,
    reward: { type: 'multiplier', value: 1.5 } },
  { id: 'perfect_day', name: 'パーフェクトデイ', icon: '💎',
    desc: 'コンディション記録 + 学習 + タスク完了', hidden: false, cooldown: 'daily', category: 'completeness',
    conditionFn: (ctx) => ctx.conditionToday && ctx.studiedToday && ctx.taskCompletedToday,
    reward: { type: 'bonus', points: 50 } },
  // 隠しコンボ
  { id: 'early_sword', name: '早起きの剣', icon: '🌅',
    desc: '16時台に学習開始 + ポモドーロ完走', hidden: true, cooldown: 'daily', category: 'timing',
    conditionFn: (ctx) => ctx.sessionStartHour === 16 && ctx.pomodoroCount >= 1,
    reward: { type: 'bonus', points: 20 } },
  { id: 'pomodoro_master', name: 'ポモドーロマスター', icon: '🍅',
    desc: '1日にポモドーロ5回完走', hidden: true, cooldown: 'daily', category: 'focus',
    conditionFn: (ctx) => ctx.todayPomodoros >= 5,
    reward: { type: 'bonus', points: 40 } },
  { id: 'sniper', name: 'スナイパー', icon: '🎯',
    desc: '苦手科目を60分以上学習', hidden: true, cooldown: 'daily', category: 'challenge',
    conditionFn: (ctx) => ctx.weakSubjectMinutes >= 60,
    reward: { type: 'bonus', points: 35 } },
  { id: 'night_walker', name: 'ナイトウォーカー', icon: '🌙',
    desc: '20時以降に2教科以上学習', hidden: true, cooldown: 'daily', category: 'timing',
    conditionFn: (ctx) => ctx.sessionStartHour >= 20 && ctx.todaySubjects.length >= 2,
    reward: { type: 'bonus', points: 25 } },
  { id: 'bookworm', name: '読書家', icon: '📖',
    desc: '国語と英語を同じ日に学習', hidden: true, cooldown: 'daily', category: 'variety',
    conditionFn: (ctx) => ctx.todaySubjects.includes('国語') && ctx.todaySubjects.includes('英語'),
    reward: { type: 'bonus', points: 20 } },
  { id: 'thunder_chain', name: 'サンダーチェイン', icon: '⚡',
    desc: '5日連続でデイリーミッションクリア', hidden: true, cooldown: 'weekly', category: 'mission',
    conditionFn: (ctx) => ctx.missionStreak >= 5,
    reward: { type: 'bonus', points: 80 } },
  { id: 'home_hero', name: 'ホームヒーロー', icon: '🏠',
    desc: '自宅学習 + ポモドーロ3回', hidden: true, cooldown: 'daily', category: 'location',
    conditionFn: (ctx) => ctx.location === '自宅' && ctx.pomodoroCount >= 3,
    reward: { type: 'bonus', points: 30 } },
  { id: 'weekly_king', name: 'ウィークリーキング', icon: '👑',
    desc: '週7日中6日以上出席', hidden: true, cooldown: 'weekly', category: 'attendance',
    conditionFn: (ctx) => ctx.weeklyAttendance >= 6,
    reward: { type: 'bonus', points: 100 } },
  { id: 'dragon_killer', name: 'ドラゴンキラー', icon: '🐉',
    desc: 'ボス弱点科目 + ポモドーロ3回', hidden: true, cooldown: 'daily', category: 'boss',
    conditionFn: (ctx) => ctx.isWeaknessSubject && ctx.pomodoroCount >= 3,
    reward: { type: 'boss_multiplier', value: 2.0 } },
  // --- PROJECT: ORBIT 追加コンボ ---
  { id: 'indomitable_engine', name: '不屈のエンジン', icon: '🔧',
    desc: '疲れている時に来て学習した', hidden: true, cooldown: 'daily', category: 'grit',
    conditionFn: (ctx) => ctx.conditionEnergyLow && ctx.studiedToday,
    reward: { type: 'bonus', points: 40 } },
];

const ComboDB = {
  async buildContext(studentId, session) {
    const today = getToday();
    const todayLogs = await StudyLogsDB.getByDate(today);
    const myTodayLogs = todayLogs.filter(l => l.studentId === studentId);
    const student = await StudentsDB.getById(studentId);
    const todayConditions = await ConditionsDB.getToday();
    const taskCompletions = await TasksDB.getCompletions(studentId);
    const activeBosses = await RaidBossDB.getActive();
    const boss = activeBosses.length > 0 ? activeBosses[0] : null;

    // 今週の出席日数
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekLogs = await StudyLogsDB.getByDateRange(weekStartStr, today);
    const weekDays = new Set(weekLogs.filter(l => l.studentId === studentId).map(l => l.date)).size;

    return {
      subject: session.subject,
      duration: session.duration,
      location: session.location || '塾',
      method: session.method || 'normal',
      pomodoroCount: session.pomodoroCount || 0,
      sessionStartHour: session.startHour || new Date().getHours(),
      todaySubjects: [...new Set(myTodayLogs.map(l => l.subject))],
      todayPomodoros: myTodayLogs.reduce((s, l) => s + (l.pomodoroCount || 0), 0),
      studiedToday: myTodayLogs.length > 0,
      conditionToday: todayConditions.some(c => c.studentId === studentId),
      conditionEnergyLow: todayConditions.some(c => c.studentId === studentId && (c.energy <= 2 || c.motivation <= 2)),
      taskCompletedToday: taskCompletions.some(t => t.date === today),
      currentStreak: student.streak || 0,
      missionStreak: student.missionStreak || 0,
      weeklyAttendance: weekDays,
      weakSubjectMinutes: student.weakSubject
        ? myTodayLogs.filter(l => l.subject === student.weakSubject).reduce((s, l) => s + (l.duration || 0), 0)
        : 0,
      isWeaknessSubject: boss && session.subject === boss.weakness,
    };
  },

  async isOnCooldown(studentId, combo) {
    const today = getToday();
    const snap = await db.collection('comboTriggers')
      .where('studentId', '==', studentId)
      .where('comboId', '==', combo.id)
      .orderBy('createdAt', 'desc').limit(1).get();
    if (snap.empty) return false;
    const last = snap.docs[0].data();
    if (combo.cooldown === 'daily') return last.date === today;
    if (combo.cooldown === 'weekly') {
      const lastDate = new Date(last.date);
      const now = new Date();
      const diffDays = Math.floor((now - lastDate) / (24 * 60 * 60 * 1000));
      return diffDays < 7;
    }
    return false;
  },

  async checkAll(studentId, session) {
    const ctx = await this.buildContext(studentId, session);
    const triggered = [];
    for (const combo of COMBO_DEFINITIONS) {
      try {
        if (!combo.conditionFn(ctx)) continue;
        if (await this.isOnCooldown(studentId, combo)) continue;
        const isNew = await this.recordDiscovery(studentId, combo.id);
        await db.collection('comboTriggers').add({
          studentId, comboId: combo.id,
          points: combo.reward.points || 0,
          multiplier: combo.reward.value || 1.0,
          date: getToday(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        triggered.push({ ...combo, isFirstDiscovery: isNew });
      } catch (e) { console.warn('Combo check error:', combo.id, e); }
    }
    return triggered;
  },

  async recordDiscovery(studentId, comboId) {
    const existing = await db.collection('comboDiscoveries')
      .where('studentId', '==', studentId)
      .where('comboId', '==', comboId).limit(1).get();
    if (!existing.empty) {
      await db.collection('comboDiscoveries').doc(existing.docs[0].id).update({
        triggerCount: firebase.firestore.FieldValue.increment(1),
        lastTriggeredAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return false;
    }
    await db.collection('comboDiscoveries').add({
      studentId, comboId,
      discoveredAt: firebase.firestore.FieldValue.serverTimestamp(),
      triggerCount: 1,
      lastTriggeredAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  },

  async getDiscoveries(studentId) {
    const snap = await db.collection('comboDiscoveries')
      .where('studentId', '==', studentId).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async getClassDiscoveryRate() {
    const students = await StudentsDB.getAll();
    if (students.length === 0) return 0;
    let qualified = 0;
    for (const st of students) {
      const discoveries = await this.getDiscoveries(st.id);
      if (discoveries.length >= 3) qualified++;
    }
    return Math.floor(qualified / students.length * 100);
  }
};

// ===== デイリーミッション (Daily Random Missions) =====
const DAILY_MISSION_POOL = [
  // Common (50%)
  { id: 'dm_pomo2', name: 'ポモドーロ2回', desc: 'ポモドーロを2回完走', rarity: 'common', points: 15, icon: '🍅',
    checkType: 'auto_daily', conditionFn: (ds) => ds.totalPomodoros >= 2 },
  { id: 'dm_30min', name: '30分学習', desc: '合計30分以上学習', rarity: 'common', points: 10, icon: '⏱️',
    checkType: 'auto_daily', conditionFn: (ds) => ds.totalMinutes >= 30 },
  { id: 'dm_condition', name: 'コンディション記録', desc: 'コンディションを記録', rarity: 'common', points: 5, icon: '😊',
    checkType: 'auto_daily', conditionFn: (ds) => ds.conditionRecorded },
  { id: 'dm_task1', name: 'タスク1つ', desc: 'タスクを1つ完了', rarity: 'common', points: 10, icon: '✅',
    checkType: 'auto_daily', conditionFn: (ds) => ds.tasksCompleted >= 1 },
  { id: 'dm_review', name: '振り返りノート', desc: '学習を振り返って記録', rarity: 'common', points: 10, icon: '📝',
    checkType: 'manual', conditionFn: null },
  { id: 'dm_preview', name: '予習チャレンジ', desc: '翌日の授業科目を予習', rarity: 'common', points: 10, icon: '📖',
    checkType: 'manual', conditionFn: null },
  // Uncommon (30%)
  { id: 'dm_weak20', name: '苦手科目20分', desc: '苦手科目を20分以上', rarity: 'uncommon', points: 25, icon: '💪',
    checkType: 'auto_daily', conditionFn: (ds) => ds.weakSubjectMinutes >= 20 },
  { id: 'dm_pomo3', name: 'ポモドーロ3連続', desc: 'ポモドーロ3回連続完走', rarity: 'uncommon', points: 30, icon: '🍅',
    checkType: 'auto_daily', conditionFn: (ds) => ds.totalPomodoros >= 3 },
  { id: 'dm_2subj', name: '2教科学習', desc: '2教科以上学習', rarity: 'uncommon', points: 20, icon: '📚',
    checkType: 'auto_daily', conditionFn: (ds) => ds.subjectCount >= 2 },
  { id: 'dm_60min', name: '60分マラソン', desc: '60分以上学習', rarity: 'uncommon', points: 30, icon: '⏱️',
    checkType: 'auto_daily', conditionFn: (ds) => ds.totalMinutes >= 60 },
  { id: 'dm_home', name: '自宅学習', desc: '自宅から学習セッション完了', rarity: 'uncommon', points: 20, icon: '🏠',
    checkType: 'auto_daily', conditionFn: (ds) => ds.homeStudied },
  // Rare (15%)
  { id: 'dm_3subj', name: '3教科チャレンジ', desc: '3教科以上学習', rarity: 'rare', points: 50, icon: '🌟',
    checkType: 'auto_daily', conditionFn: (ds) => ds.subjectCount >= 3 },
  { id: 'dm_morning', name: '早朝ミッション', desc: '12時前に学習開始', rarity: 'rare', points: 40, icon: '🌅',
    checkType: 'auto_daily', conditionFn: (ds) => ds.earliestHour < 12 },
  { id: 'dm_pomo5', name: 'ポモドーロ5回', desc: 'ポモドーロ5回完走', rarity: 'rare', points: 60, icon: '🍅',
    checkType: 'auto_daily', conditionFn: (ds) => ds.totalPomodoros >= 5 },
  { id: 'dm_boss_weak', name: 'ボス弱点攻撃', desc: 'ボスの弱点科目を45分', rarity: 'rare', points: 55, icon: '🎯',
    checkType: 'auto_daily', conditionFn: (ds) => ds.bossWeaknessMinutes >= 45 },
  // Epic (4%)
  { id: 'dm_5day_clear', name: '5日連続クリア', desc: 'ミッション5日連続達成', rarity: 'epic', points: 100, icon: '🔥',
    checkType: 'auto_daily', conditionFn: (ds) => ds.missionStreak >= 5 },
  { id: 'dm_perfect', name: 'パーフェクトデイ', desc: '全活動を完了', rarity: 'epic', points: 80, icon: '💎',
    checkType: 'auto_daily', conditionFn: (ds) => ds.conditionRecorded && ds.totalMinutes >= 30 && ds.tasksCompleted >= 1 },
  // Legendary (1%)
  { id: 'dm_weekly_king', name: 'ウィークリーキング', desc: '週6日以上出席', rarity: 'legendary', points: 200, icon: '👑',
    checkType: 'auto_daily', conditionFn: (ds) => ds.weeklyAttendance >= 6 },
  { id: 'dm_hidden1', name: '???', desc: '???', rarity: 'legendary', points: 150, icon: '🌌',
    checkType: 'auto_daily', hidden: true, conditionFn: (ds) => ds.totalPomodoros >= 7 && ds.subjectCount >= 4 },
];

const DailyMissionsDB = {
  rollRarity() {
    const r = Math.random() * 100;
    if (r < 1) return 'legendary';
    if (r < 5) return 'epic';
    if (r < 20) return 'rare';
    if (r < 50) return 'uncommon';
    return 'common';
  },

  async draw(studentId) {
    const today = getToday();
    const existing = await db.collection('dailyMissionDraws')
      .where('studentId', '==', studentId)
      .where('date', '==', today).limit(1).get();
    if (!existing.empty) return { id: existing.docs[0].id, ...existing.docs[0].data() };

    const drawn = [];
    for (let i = 0; i < 3; i++) {
      const rarity = this.rollRarity();
      const pool = DAILY_MISSION_POOL.filter(
        m => m.rarity === rarity && !drawn.some(d => d.missionId === m.id)
      );
      const fallback = pool.length > 0 ? pool : DAILY_MISSION_POOL.filter(
        m => m.rarity === 'common' && !drawn.some(d => d.missionId === m.id)
      );
      if (fallback.length === 0) continue;
      const pick = fallback[Math.floor(Math.random() * fallback.length)];
      drawn.push({ missionId: pick.id, rarity: pick.rarity });
    }

    const doc = {
      studentId, date: today, missions: drawn,
      accepted: null, completed: false, completedAt: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const ref = await db.collection('dailyMissionDraws').add(doc);
    return { id: ref.id, ...doc };
  },

  async accept(drawId, missionId) {
    await db.collection('dailyMissionDraws').doc(drawId).update({ accepted: missionId });
  },

  async buildDayStats(studentId) {
    const today = getToday();
    const todayLogs = await StudyLogsDB.getByDate(today);
    const myLogs = todayLogs.filter(l => l.studentId === studentId);
    const student = await StudentsDB.getById(studentId);
    const conditions = await ConditionsDB.getToday();
    const taskCompletions = await TasksDB.getCompletions(studentId);
    const activeBosses = await RaidBossDB.getActive();
    const boss = activeBosses.length > 0 ? activeBosses[0] : null;

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekLogs = await StudyLogsDB.getByDateRange(weekStart.toISOString().split('T')[0], today);
    const weekDays = new Set(weekLogs.filter(l => l.studentId === studentId).map(l => l.date)).size;

    return {
      totalMinutes: myLogs.reduce((s, l) => s + (l.duration || 0), 0),
      totalPomodoros: myLogs.reduce((s, l) => s + (l.pomodoroCount || 0), 0),
      subjectCount: new Set(myLogs.map(l => l.subject)).size,
      conditionRecorded: conditions.some(c => c.studentId === studentId),
      tasksCompleted: taskCompletions.filter(t => t.date === today).length,
      homeStudied: myLogs.some(l => l.location === '自宅'),
      earliestHour: myLogs.length > 0 ? Math.min(...myLogs.map(l => {
        const d = l.createdAt?.toDate ? l.createdAt.toDate() : new Date();
        return d.getHours();
      })) : 24,
      weeklyAttendance: weekDays,
      missionStreak: student.missionStreak || 0,
      weakSubjectMinutes: student.weakSubject
        ? myLogs.filter(l => l.subject === student.weakSubject).reduce((s, l) => s + (l.duration || 0), 0)
        : 0,
      bossWeaknessMinutes: boss
        ? myLogs.filter(l => l.subject === boss.weakness).reduce((s, l) => s + (l.duration || 0), 0)
        : 0,
    };
  },

  async checkCompletion(studentId) {
    const today = getToday();
    const drawSnap = await db.collection('dailyMissionDraws')
      .where('studentId', '==', studentId)
      .where('date', '==', today).limit(1).get();
    if (drawSnap.empty) return null;

    const draw = { id: drawSnap.docs[0].id, ...drawSnap.docs[0].data() };
    if (!draw.accepted || draw.completed) return draw;

    const mission = DAILY_MISSION_POOL.find(m => m.id === draw.accepted);
    if (!mission || mission.checkType === 'manual') return draw;

    const dayStats = await this.buildDayStats(studentId);
    if (mission.conditionFn && mission.conditionFn(dayStats)) {
      await db.collection('dailyMissionDraws').doc(draw.id).update({
        completed: true,
        completedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await StudentsDB.addPoints(studentId, mission.points);
      // missionStreak更新
      await StudentsDB.update(studentId, {
        missionStreak: firebase.firestore.FieldValue.increment(1)
      });
      return { ...draw, completed: true, mission };
    }
    return draw;
  },

  async manualComplete(drawId) {
    const doc = await db.collection('dailyMissionDraws').doc(drawId).get();
    if (!doc.exists) return;
    const draw = doc.data();
    if (draw.completed) return;
    const mission = DAILY_MISSION_POOL.find(m => m.id === draw.accepted);
    await db.collection('dailyMissionDraws').doc(drawId).update({
      completed: true, completedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    if (mission) await StudentsDB.addPoints(draw.studentId, mission.points);
  },

  async getHistory(studentId, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];
    const snap = await db.collection('dailyMissionDraws')
      .where('studentId', '==', studentId)
      .where('date', '>=', sinceStr)
      .orderBy('date', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  getMissionDef(missionId) {
    return DAILY_MISSION_POOL.find(m => m.id === missionId) || null;
  }
};

// ===== 戦略レイドボス拡張 (Strategic Raid Boss) =====
function calculateBossDamage(session, boss, comboResults) {
  let damage = session.duration || 0;

  // 属性倍率
  if (boss.weakness && session.subject === boss.weakness) {
    damage *= 2.0;
  } else if (boss.resistance && session.subject === boss.resistance) {
    damage *= 0.5;
  }

  // コンボ倍率 (boss_multiplier)
  const bossCombo = (comboResults || []).find(c => c.reward && c.reward.type === 'boss_multiplier');
  if (bossCombo) damage *= bossCombo.reward.value;

  // ポモドーロボーナス
  damage += (session.pomodoroCount || 0) * 10;

  // サポート艦隊バフ（supporterBuffが渡された場合に適用）
  if (session._supporterBuff && session._supporterBuff > 1.0) {
    damage *= session._supporterBuff;
  }

  // 特殊能力補正
  if (boss.specialAbility) {
    switch (boss.specialAbility.type) {
      case 'min_duration':
        if (session.duration < boss.specialAbility.value) return 0;
        break;
      case 'enrage':
        if (boss.maxHp > 0 && (boss.currentHp / boss.maxHp * 100) <= boss.specialAbility.value)
          damage *= 0.5;
        break;
      case 'night_boost':
        if (new Date().getHours() >= 20) damage *= (boss.specialAbility.value || 1.5);
        break;
    }
  }

  return Math.floor(damage);
}

// ===== 分岐ストーリー (Branching Story) =====
const StoryDB = {
  async getActive() {
    const snap = await db.collection('storyChapters')
      .where('status', '==', 'active').limit(1).get();
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
  },

  async create(data) {
    const routes = (data.routes || []).map(r => ({
      id: r.id,
      name: r.name,
      icon: r.icon || '⚔️',
      desc: r.desc || '',
      metric: r.metric,
      targetValue: r.targetValue || 0,
      currentValue: 0,
      reward: r.reward || { points: 0 },
      ending: r.ending || { title: '', text: '' }
    }));
    const ref = await db.collection('storyChapters').add({
      title: data.title,
      month: data.month,
      status: 'active',
      routes,
      weeklyTexts: data.weeklyTexts || [],
      achievedRoute: null,
      completedAt: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },

  async updateProgress() {
    const chapter = await this.getActive();
    if (!chapter) return null;

    const monthStart = chapter.month + '-01';
    const today = getToday();

    for (const route of chapter.routes) {
      if (route.metric === 'fallback') continue;

      let currentValue = 0;
      switch (route.metric) {
        case 'total_pomodoros': {
          const logs = await StudyLogsDB.getByDateRange(monthStart, today);
          currentValue = logs.reduce((s, l) => s + (l.pomodoroCount || 0), 0);
          break;
        }
        case 'combo_discovery_rate': {
          currentValue = await ComboDB.getClassDiscoveryRate();
          break;
        }
        case 'total_study_hours': {
          const logs = await StudyLogsDB.getByDateRange(monthStart, today);
          currentValue = Math.floor(logs.reduce((s, l) => s + (l.duration || 0), 0) / 60);
          break;
        }
        case 'boss_defeated': {
          const bosses = await RaidBossDB.getAll();
          currentValue = bosses.some(b => b.month === chapter.month && b.status === 'defeated') ? 1 : 0;
          break;
        }
      }
      route.currentValue = currentValue;
    }

    await db.collection('storyChapters').doc(chapter.id).update({ routes: chapter.routes });
    return chapter;
  },

  async resolveChapter() {
    const chapter = await this.getActive();
    if (!chapter) return null;

    let achievedRoute = null;
    for (const route of chapter.routes) {
      if (route.metric === 'fallback') continue;
      if (route.targetValue > 0 && route.currentValue >= route.targetValue) {
        achievedRoute = route.id;
        break;
      }
    }
    if (!achievedRoute) {
      const fallback = chapter.routes.find(r => r.metric === 'fallback');
      if (fallback) achievedRoute = fallback.id;
    }

    await db.collection('storyChapters').doc(chapter.id).update({
      status: 'completed', achievedRoute,
      completedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 報酬配布
    const route = chapter.routes.find(r => r.id === achievedRoute);
    if (route && route.reward && route.reward.points) {
      const students = await StudentsDB.getAll();
      for (const st of students) {
        await StudentsDB.addPoints(st.id, route.reward.points);
      }
    }

    return { chapter, achievedRoute, route };
  },

  async getAll() {
    const snap = await db.collection('storyChapters').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  getWeeklyText(chapter) {
    if (!chapter || !chapter.weeklyTexts) return '';
    const monthStart = new Date(chapter.month + '-01');
    const now = new Date();
    const weekNum = Math.min(Math.ceil((now - monthStart) / (7 * 24 * 60 * 60 * 1000)), 4);
    const wt = chapter.weeklyTexts.find(w => w.week === weekNum);
    return wt ? wt.text : '';
  }
};

// ============================================
// PROJECT: ORBIT — 延岡ローカライズ拡張
// ============================================

// ===== 志望校ステーション（マップ終着点） =====
// ※ student.html の本人画面にのみ表示。monitor.htmlには非公開（匿名性の原則）
const TARGET_STATIONS = {
  nobeoka_h:     { name: '延岡高校',   icon: '🌟', code: 'プラネット・アルファ' },
  nobeoka_seiun: { name: '延岡星雲高校', icon: '🌀', code: 'ノースクラウド星雲' },
  nobeoka_sho:   { name: '延岡商業',   icon: '📊', code: 'セクター・コマース' },
  nobeoka_ko:    { name: '延岡工業',   icon: '⚙️', code: 'インダストリアル・プラント' },
  gakuen:        { name: '延岡学園',   icon: '🏛️', code: 'ステーション・アカデミア' },
  ursula:        { name: '聖心ウルスラ', icon: '✝️', code: 'サンクチュアリ・ウルスラ' },
  other:         { name: 'その他',     icon: '🚀', code: 'カスタム・ステーション' },
};

function getTargetStationDisplay(targetStationId) {
  const ts = TARGET_STATIONS[targetStationId];
  if (!ts) return null;
  return { ...ts, id: targetStationId };
}

// ===== サポート艦隊（私立合格者のクラスチェンジ） =====
const SupportFleetDB = {
  // 生徒をサポーターに変更（私立合格後）
  async promoteToSupporter(studentId) {
    await StudentsDB.update(studentId, { role: 'supporter' });
  },

  // サポーターを通常に戻す
  async revertToStudent(studentId) {
    await StudentsDB.update(studentId, { role: 'student' });
  },

  // 現在のサポーター一覧
  async getSupporters() {
    const snap = await db.collection('students')
      .where('role', '==', 'supporter').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // サポーターバフ倍率の計算
  // サポーターが今日学習していれば、県立組のボスダメージにバフが乗る
  async calculateBuff() {
    const supporters = await this.getSupporters();
    if (supporters.length === 0) return 1.0;

    const today = getToday();
    const todayLogs = await StudyLogsDB.getByDate(today);
    let activeSupporters = 0;
    for (const sup of supporters) {
      if (todayLogs.some(l => l.studentId === sup.id)) {
        activeSupporters++;
      }
    }

    // バフ計算: 基本1.0 + アクティブサポーター1人につき+0.15（最大1.0+0.6=1.6倍）
    const buff = 1.0 + Math.min(activeSupporters * 0.15, 0.6);
    return buff;
  },

  // サポーターの支援行動を記録（先生が手動で評価）
  async logSupportAction(supporterId, actionType) {
    // actionType: 'quiet_study'(静かに自習), 'teaching'(後輩に教える), 'encouragement'(声掛け)
    const pointMap = { quiet_study: 5, teaching: 15, encouragement: 10 };
    const points = pointMap[actionType] || 5;
    await db.collection('supportActions').add({
      supporterId,
      actionType,
      points,
      date: getToday(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // サポーター自身にもポイント付与
    await StudentsDB.addPoints(supporterId, points);
    return points;
  },
};

// ===== テスト有無によるミッション分岐 =====
// DailyMissionsDB.draw() の拡張版
// testType='no_midterm' の生徒には「シールド防衛型」ミッションを優先的に出す
const SHIELD_DEFENSE_MISSIONS = [
  // テストがない月に出現する「毎日コツコツ型」ミッション
  { id: 'dm_shield_1pomo', name: 'シールド維持', desc: '今日1ポモドーロで船を守れ',
    rarity: 'common', points: 12, icon: '🛡️',
    checkType: 'auto_daily', conditionFn: (ds) => ds.totalPomodoros >= 1 },
  { id: 'dm_shield_review', name: '単元テスト復習', desc: '直近の単元テスト範囲を15分復習',
    rarity: 'uncommon', points: 20, icon: '🛡️',
    checkType: 'manual', conditionFn: null },
  { id: 'dm_shield_streak', name: '鉄壁防御', desc: '3日連続で来塾して学習',
    rarity: 'rare', points: 45, icon: '🛡️',
    checkType: 'auto_daily', conditionFn: (ds) => ds.missionStreak >= 3 },
];

// テスト月かどうかを判定
function isExamMonth() {
  const month = new Date().getMonth() + 1; // 1-12
  // 6月(期末), 9月(実力①), 10月(中間/実力②), 11月(期末/実力③), 1月(私立), 2月(県立推薦), 3月(県立一般)
  return [6, 9, 10, 11, 1, 2, 3].includes(month);
}

// 5月・10月など「中間テストなし組」にシールドミッションを追加で抽選する月
function isNoMidtermShieldMonth() {
  const month = new Date().getMonth() + 1;
  return [5, 10].includes(month); // 中間テストがある月
}

// ===== 月次ストーリーテーマ（年間シナリオ） =====
const STORY_THEMES = {
  '04': { code: 'LAUNCH',           name: '発進と軌道投入',       icon: '🚀', desc: 'ソロ文化確立。1日1ポモドーロの習慣化。' },
  '05': { code: 'BRANCHING_PATH',   name: '特異宙域でのルート分岐', icon: '🔀', desc: '中間テスト有無による分岐。テストなし組はシールド防衛戦。' },
  '06': { code: 'CONVERGENCE',      name: '全機合流と期末要塞',    icon: '🏰', desc: '中体連の疲労 → 全員共通の期末テスト。不屈のエンジン発動月。' },
  '07': { code: 'RENDEZVOUS',       name: '艦隊結成',             icon: '⚔️', desc: 'Phase 2移行。ギルド解禁。夏休み突入。' },
  '08': { code: 'SUMMER_LEVIATHAN', name: '巨大星雲の死闘',       icon: '🐙', desc: '夏期講習。超巨大レイドボス。全教室の総力戦。' },
  '09': { code: 'REALITY_RADAR_1',  name: '第1次レーダー観測',    icon: '📡', desc: '地区実力テスト①②。偏差値＝現在座標の確認。' },
  '10': { code: 'DISTORTION_FIELD', name: '幻惑の星雲',           icon: '🌫️', desc: '文化祭・合唱コンクール。集中力の維持。' },
  '11': { code: 'LOCK_ON',          name: '最終座標の確定',       icon: '🎯', desc: '地区実力③。三者面談。志望校確定→マップ終着点ロック。' },
  '12': { code: 'WINTER_HYPER',     name: '絶対零度空間',         icon: '❄️', desc: '冬期講習。私立過去問。Legendaryミッション頻出。' },
  '01': { code: 'FIRST_TOUCHDOWN',  name: '前衛星系着陸',         icon: '🛬', desc: '私立入試。合格者→サポート艦隊にクラスチェンジ。' },
  '02': { code: 'FINAL_VANGUARD',   name: '最終防衛線',           icon: '🛡️', desc: '県立推薦入試。サポート艦隊のバフが最大出力。' },
  '03': { code: 'MISSION_COMPLETE', name: '目標星着陸',           icon: '🏁', desc: '県立一般入試。フライトレコーダーのエンドロール。卒業。' },
};

function getStoryTheme(month) {
  // month: 1-12 or '01'-'12'
  const key = String(month).padStart(2, '0');
  return STORY_THEMES[key] || null;
}

function getCurrentStoryTheme() {
  return getStoryTheme(new Date().getMonth() + 1);
}

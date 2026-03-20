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
      streak: data.streak || 0,
      level: data.level || 1,
      guildId: data.guildId || null,
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

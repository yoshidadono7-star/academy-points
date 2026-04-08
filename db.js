// ============================================
// データ層 - Firestore CRUD
// ============================================

// --- 現在の教室ID（マルチ教室土台） ---
// 将来的に複数教室を切り替える想定。現状は 'default' を返す。
// オーナーが owner.html から教室切替すると localStorage.currentClassroomId が変わる。
function currentClassroomId() {
  try {
    const saved = (typeof localStorage !== 'undefined') ? localStorage.getItem('currentClassroomId') : null;
    return saved || 'default';
  } catch (e) {
    return 'default';
  }
}
if (typeof window !== 'undefined') {
  window.currentClassroomId = currentClassroomId;
}

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
      classroomId: data.classroomId || currentClassroomId(),
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
      school: data.school || null,               // 在籍中学校（JUNIOR_HIGH_SCHOOLS キー）
      targetStation: data.targetStation || null, // 志望高校（中学生用、TARGET_STATIONS キー）
      // --- 小学生受験用 ---
      examCandidate: data.examCandidate || false,         // 受験組かどうか
      targetJuniorHighs: data.targetJuniorHighs || [],    // [{id, faculty, memo}] 志望中学校（最大3件）
      // --- 高校生用 ---
      targetUniversities: data.targetUniversities || [],  // [{id, faculty, memo}] 志望大学（第1〜第3志望）
      // --- コース設定 ---
      courseType: data.courseType || null,        // COURSE_TYPES キー
      courseKoma: data.courseKoma || null,         // 標準コースのコマ数（1-8）
      // --- 検定・資格 ---
      certGoals: data.certGoals || [],             // [{examId, targetLevel}] 検定目標（全学年共通）
      targetQualifications: data.targetQualifications || [], // [{name, memo}] 目標資格（社会人用）
      role: data.role || 'student',             // 'student' | 'supporter'(私立合格後)
      missionStreak: data.missionStreak || 0,   // デイリーミッション連続達成数
      // --- AI バディ設定 ---
      aiModel: data.aiModel || null,            // null=デフォルト, 'claude-haiku-4-5-20251001'|'claude-sonnet-4-6'|'claude-opus-4-6'
      responseLength: data.responseLength || null, // null=デフォルト, 'short'|'medium'|'long' 返答の長さ
      learningModeControl: data.learningModeControl || 'both',  // 'student'|'teacher'|'both' 学習モード切替権限
      currentLearningMode: data.currentLearningMode || 'normal', // 'normal'|'tutor' 現在のモード
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
  // Feature 11 Phase F1: meta 引数で監査ログ (coins コレクション) に自動記録する
  // meta = { category, description, grantedBy, eventId, type } を任意で渡せる。
  // 未指定なら category='unknown', grantedBy='system' で記録する。
  async addPoints(id, points, meta = null) {
    await db.collection('students').doc(id).update({
      totalPoints: firebase.firestore.FieldValue.increment(points),
      currentPoints: firebase.firestore.FieldValue.increment(points)
    });
    // 監査ログ書き込み（失敗しても本体は継続）
    try {
      if (typeof CoinsDB !== 'undefined' && points !== 0) {
        await CoinsDB.addTransaction({
          studentId: id,
          amount: points,
          type: (meta && meta.type) || (points > 0 ? 'earn' : 'spend'),
          category: (meta && meta.category) || 'unknown',
          description: (meta && meta.description) || '',
          grantedBy: (meta && meta.grantedBy) || 'system',
          eventId: (meta && meta.eventId) || null,
        });
      }
    } catch (e) { console.warn('[addPoints] coin log failed:', e); }
  },
  async spendPoints(id, points, meta = null) {
    await db.collection('students').doc(id).update({
      currentPoints: firebase.firestore.FieldValue.increment(-points)
    });
    try {
      if (typeof CoinsDB !== 'undefined' && points !== 0) {
        await CoinsDB.addTransaction({
          studentId: id,
          amount: -Math.abs(points),
          type: 'spend',
          category: (meta && meta.category) || 'spend',
          description: (meta && meta.description) || '',
          grantedBy: (meta && meta.grantedBy) || 'system',
        });
      }
    } catch (e) { console.warn('[spendPoints] coin log failed:', e); }
  }
};

// --- 学習ログ ---
const StudyLogsDB = {
  async add(data) {
    const location = data.location || '塾';
    // 塾/Zoom = confirmed(即時付与), 自宅 = pending(講師承認待ち)
    const approvalStatus = (location === '塾' || location === 'Zoom') ? 'confirmed' : 'pending';
    const ref = await db.collection('studyLogs').add({
      classroomId: data.classroomId || currentClassroomId(),
      studentId: data.studentId,
      studentName: data.studentName || '',
      subject: data.subject,
      duration: data.duration, // 分
      points: data.points,
      location: location,
      method: data.method || 'normal', // normal/pomodoro
      pomodoroCount: data.pomodoroCount || 0,
      material: data.material || null,
      materialName: data.materialName || null,
      materialNote: data.materialNote || null,
      // --- 家庭学習検証 ---
      approvalStatus: data.approvalStatus || approvalStatus, // pending/confirmed/rejected
      pauseCount: data.pauseCount || 0,
      pauseLog: data.pauseLog || [],
      photoUrl: data.photoUrl || null,        // 写真提出URL
      parentConfirmed: data.parentConfirmed || false, // 保護者確認済み
      approvedBy: data.approvedBy || null,    // 承認者
      approvedAt: data.approvedAt || null,    // 承認日時
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
  },
  async update(id, data) {
    await db.collection('studyLogs').doc(id).update(data);
  },
  async getPending() {
    const snap = await db.collection('studyLogs')
      .where('approvalStatus', '==', 'pending')
      .orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async approve(id, approvedBy) {
    await db.collection('studyLogs').doc(id).update({
      approvalStatus: 'confirmed',
      approvedBy: approvedBy,
      approvedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },
  async reject(id, approvedBy, reason) {
    await db.collection('studyLogs').doc(id).update({
      approvalStatus: 'rejected',
      approvedBy: approvedBy,
      approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      rejectionReason: reason || ''
    });
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
      classroomId: data.classroomId || currentClassroomId(),
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
      classroomId: data.classroomId || currentClassroomId(),
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
  async getByStudentRecent(studentId, limit = 5) {
    const snap = await db.collection('messages')
      .where('toStudentId', '==', studentId)
      .orderBy('createdAt', 'desc')
      .limit(limit).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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

// ===== リーグ（年齢別競争単位） =====
const LEAGUES = {
  E: { name: 'エレメンタリー・リー���', icon: '🌱', color: '#f59e0b', grades: ['小1','小2','��3','小4','小5','小6'] },
  M: { name: 'ミドル・リー��',         icon: '⚔️', color: '#3b82f6', grades: ['中1','中2','中3'] },
  H: { name: 'ハイ・リーグ',           icon: '🔥', color: '#7c3aed', grades: ['高1','高2','高3','既卒生','社会人'] }
};

function getLeague(grade) {
  if (!grade) return null;
  for (const [id, league] of Object.entries(LEAGUES)) {
    if (league.grades.includes(grade)) return id;
  }
  return null;
}

// ギルドマイルストーン定義
const GUILD_MILESTONES = [
  { threshold: 5000,   name: '始動の証', icon: '🏁' },
  { threshold: 20000,  name: '結束の証', icon: '🤝' },
  { threshold: 50000,  name: '覚醒の証', icon: '⚡' },
  { threshold: 100000, name: '伝説の証', icon: '👑' }
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
      milestones: GUILD_MILESTONES.map(m => ({ ...m, unlocked: false })),
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
    // マイルストーン到達チェック
    try {
      const guild = await this.getById(guildId);
      if (guild && guild.milestones) {
        let updated = false;
        const ms = guild.milestones.map(m => {
          if (!m.unlocked && guild.totalPoints >= m.threshold) { updated = true; return { ...m, unlocked: true }; }
          return m;
        });
        if (updated) await this.update(guildId, { milestones: ms });
      }
    } catch(e) { console.error('Milestone check error:', e); }
  },
  async getProgress() {
    const snap = await db.collection('guilds').orderBy('totalPoints', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getRanking() {
    return this.getProgress(); // 後方互換
  },
  // リーグ別個人ランキング
  async getLeagueRanking(league) {
    const students = await StudentsDB.getAll();
    return students
      .filter(s => getLeague(s.grade) === league)
      .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
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
  async getDefeated() {
    const snap = await db.collection('raidBosses')
      .where('defeated', '==', true)
      .orderBy('createdAt', 'desc').get();
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
      category: data.category || 'privilege', // privilege(特権), title(称号), study(学習体験), goods(物品)
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
    // ポイント消費 + coins 監査ログ (spendPoints が自動記録)
    await StudentsDB.spendPoints(studentId, cost, {
      category: 'reward',
      description: '報酬交換',
      grantedBy: 'system',
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
  // Phase 10: ストリークボーナス改定
  getStreakBonus(streakDays) {
    if (streakDays >= 20) return 60;
    if (streakDays >= 10) return 40;
    if (streakDays >= 5) return 20;
    if (streakDays >= 3) return 10;
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
  balanceCap: 3500,       // Phase 10: 残高上限 2000→3500
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

// Phase 10: レベル閾値改定
function calcLevel(totalPoints) {
  if (totalPoints >= 7000) return 10;
  if (totalPoints >= 4500) return 9;
  if (totalPoints >= 3000) return 8;
  if (totalPoints >= 2200) return 7;
  if (totalPoints >= 1500) return 6;
  if (totalPoints >= 1000) return 5;
  if (totalPoints >= 600) return 4;
  if (totalPoints >= 300) return 3;
  if (totalPoints >= 100) return 2;
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
  getStation,
  getStationProgress,
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
    desc: '朝7時台までに学習開始 + ポモドーロ完走', hidden: true, cooldown: 'daily', category: 'timing',
    conditionFn: (ctx) => ctx.sessionStartHour <= 7 && ctx.pomodoroCount >= 1,
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
      await StudentsDB.addPoints(studentId, mission.points, {
        category: 'mission',
        description: `デイリーミッション: ${mission.title || mission.id || ''}`,
        grantedBy: 'system',
      });
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
    if (mission) await StudentsDB.addPoints(draw.studentId, mission.points, {
      category: 'mission',
      description: `デイリーミッション達成: ${mission.title || mission.id || ''}`,
      grantedBy: 'system',
    });
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
        await StudentsDB.addPoints(st.id, route.reward.points, {
          category: 'story',
          description: `ストーリー報酬: ${chapter.title || ''} (${route.name || ''})`,
          grantedBy: 'system',
        });
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
  nobeoka_h:     { name: '延岡高校',     icon: '🌟', code: 'プラネット・アルファ',
                   hensachi: 58, bairitsu: 1.15, teiin: 280, subjects: ['国語','数学','英語','理科','社会'], memo: '普通科・MS科' },
  nobeoka_seiun: { name: '延岡星雲高校', icon: '🌀', code: 'ノースクラウド星雲',
                   hensachi: 50, bairitsu: 1.05, teiin: 240, subjects: ['国語','数学','英語','理科','社会'], memo: 'フロンティア科・普通科' },
  nobeoka_sho:   { name: '延岡商業',     icon: '📊', code: 'セクター・コマース',
                   hensachi: 44, bairitsu: 1.02, teiin: 160, subjects: ['国語','数学','英語','理科','社会'], memo: '商業科・情報ビジネス科' },
  nobeoka_ko:    { name: '延岡工業',     icon: '⚙️', code: 'インダストリアル・プラント',
                   hensachi: 44, bairitsu: 1.03, teiin: 200, subjects: ['国語','数学','英語','理科','社会'], memo: '機械科・電気電子科・土木科・情報技術科' },
  gakuen:        { name: '延岡学園',     icon: '🏛️', code: 'ステーション・アカデミア',
                   hensachi: 42, bairitsu: 1.1, teiin: 200, subjects: ['国語','数学','英語'], memo: '普通科・調理科（私立）' },
  ursula:        { name: '聖心ウルスラ', icon: '✝️', code: 'サンクチュアリ・ウルスラ',
                   hensachi: 52, bairitsu: 1.2, teiin: 120, subjects: ['国語','数学','英語'], memo: '特進・普通科（私立）' },
  other_hs:      { name: 'その他',       icon: '🚀', code: 'カスタム・ステーション',
                   hensachi: null, bairitsu: null, teiin: null, subjects: [], memo: '' },
  other:         { name: 'その他',       icon: '🚀', code: 'カスタム・ステーション',
                   hensachi: null, bairitsu: null, teiin: null, subjects: [], memo: '' }, // 後方互換
};

function getTargetStationDisplay(targetStationId) {
  const ts = TARGET_STATIONS[targetStationId];
  if (!ts) return null;
  return { ...ts, id: targetStationId };
}

// ===== 検定試験マスタ（全学年共通） =====
const CERTIFICATION_EXAMS = {
  eiken:  { name: '英語検定（英検）', icon: '🇬🇧', levels: ['5級','4級','3級','準2級','2級','準1級','1級'] },
  suken:  { name: '数学検定（数検）', icon: '🔢', levels: ['5級','4級','3級','準2級','2級','準1級','1級'] },
  kanken: { name: '漢字検定（漢検）', icon: '✍️', levels: ['10級','9級','8級','7級','6級','5級','4級','3級','準2級','2級','準1級','1級'] },
  toeic:  { name: 'TOEIC',           icon: '🌐', levels: ['〜400','400〜500','500〜600','600〜700','700〜800','800〜900','900〜'] },
  toefl:  { name: 'TOEFL',           icon: '🌐', levels: ['〜60','60〜80','80〜100','100〜'] }
};

// ===== コース・料金マスタ =====
const COURSE_TYPES = {
  all_free:     { name: '①週6日オールフリー', icon: '🌟', desc: '毎日通える最上位コース。受験生や本気で成績を上げたい方に。夏期・冬期講習含む（中学生）' },
  '2day_free':  { name: '②週2日フリー',       icon: '⭐', desc: '週2日通い放題。SRJ速読＋Monoxer込み。部活との両立に最適' },
  daytime_free: { name: '②昼間フリー',        icon: '☀️', desc: '昼間通い放題（小学生向け）' },
  study_room:   { name: '③自習室使用',        icon: '📖', desc: '自習室のみのリーズナブルなプラン（高校生向け）' },
  standard:     { name: '④標準コース',        icon: '📝', desc: '週1〜8コマから選べるコマ制' }
};

// 各コース付属サービス（◎=基本料金に含む, △=オプション/別途）
const COURSE_SERVICES = {
  all_free:  { srj: '◎（小〜中3）', monoxer: '◎', jishuushitsu: '◎', manabieido: '◎（高校生）', kaki_touki: '◎（中学生）', coaching: '◎（高校生）' },
  '2day_free': { srj: '◎（小〜中3）', monoxer: '◎', jishuushitsu: '△/◎', manabieido: '◎（高校生）', kaki_touki: '△', coaching: '◎（高校生）' },
  daytime_free: { srj: '◎（小〜中3）', monoxer: '◎', jishuushitsu: '△', manabieido: '△', kaki_touki: '△', coaching: '△' },
  study_room: { srj: '△', monoxer: '△', jishuushitsu: '◎', manabieido: '△', kaki_touki: '△', coaching: '△/◎' },
  standard:   { srj: '△', monoxer: '△', jishuushitsu: '△', manabieido: '△', kaki_touki: '△', coaching: '△' }
};

const SERVICE_LABELS = {
  srj: 'SRJ速読速解力講座', monoxer: 'Monoxer', jishuushitsu: '自習室使い放題',
  manabieido: '学びエイド（高校生）', kaki_touki: '夏期・冬期講習（中学生）', coaching: 'コーチング（高校生）'
};

// 学年グループ別の料金テーブル
// monthly = 基本授業料 + 諸経費2,860  /  initial = 36,300 + monthly
const COURSE_PRICING = {
  elem_low: {
    label: '小学生（低学年・非受験）',
    available: ['2day_free', 'daytime_free', 'standard'],
    monthly: { '2day_free': 18260, daytime_free: 22660 },
    standard: { base: 5060, perKoma: 2200 }  // monthly = base + perKoma * koma
  },
  elem_exam: {
    label: '小学生（受験）',
    available: ['all_free', '2day_free', 'daytime_free', 'standard'],
    monthly: { all_free: 31460, '2day_free': 18260, daytime_free: 22660 },
    standard: { base: 5060, perKoma: 2200 }
  },
  jh1: {
    label: '中学1年生',
    available: ['2day_free', 'all_free', 'standard'],
    monthly: { '2day_free': 23760, all_free: 28160 },
    standard: { base: 6160, perKoma: 4400 }
  },
  jh2: {
    label: '中学2年生',
    available: ['2day_free', 'all_free', 'standard'],
    monthly: { '2day_free': 27280, all_free: 32560 },
    standard: { base: 6160, perKoma: 5280 }
  },
  jh3: {
    label: '中学3年生',
    available: ['2day_free', 'all_free', 'standard'],
    monthly: { '2day_free': 33660, all_free: 40260 },
    standard: { base: 7260, perKoma: 6600 }
  },
  hs12: {
    label: '高校1・2年生',
    available: ['2day_free', 'all_free', 'study_room', 'standard'],
    monthly: { '2day_free': 34760, all_free: 41360, study_room: 21560 },
    standard: { base: 7260, perKoma: 6875 }
  },
  hs3: {
    label: '高校3年生',
    available: ['2day_free', 'all_free', 'study_room', 'standard'],
    monthly: { '2day_free': 43560, all_free: 52360, study_room: 25960 },
    standard: { base: 7260, perKoma: 9075 }
  },
  kisotsu: {
    label: '既卒生',
    available: ['2day_free', 'all_free', 'study_room', 'standard'],
    monthly: { '2day_free': 43560, all_free: 52360, study_room: 25960 },
    standard: { base: 7260, perKoma: 9075 }
  },
  shakaijin: {
    label: '社会人',
    available: ['2day_free', 'all_free', 'study_room', 'standard'],
    monthly: { '2day_free': 43560, all_free: 52360, study_room: 25960 },
    standard: { base: 7260, perKoma: 9075 }
  }
};

function getGradeGroup(grade, examCandidate) {
  if (['小1','小2','小3'].includes(grade)) return 'elem_low';
  if (['小4','小5','小6'].includes(grade)) return examCandidate ? 'elem_exam' : 'elem_low';
  if (grade === '中1') return 'jh1';
  if (grade === '中2') return 'jh2';
  if (grade === '中3') return 'jh3';
  if (['高1','高2'].includes(grade)) return 'hs12';
  if (grade === '高3') return 'hs3';
  if (grade === '既卒生') return 'kisotsu';
  if (grade === '社会人') return 'shakaijin';
  return null;
}

function calcMonthly(gradeGroup, courseType, koma) {
  const p = COURSE_PRICING[gradeGroup];
  if (!p) return null;
  if (courseType === 'standard' && p.standard) return p.standard.base + p.standard.perKoma * (koma || 1);
  return p.monthly[courseType] || null;
}

function calcInitial(monthly) {
  return monthly != null ? 36300 + monthly : null;
}

// ===== 中学校マスタ =====
const JUNIOR_HIGH_SCHOOLS = {
  nobeoka:    { name: '延岡中' },
  tsunetomi:  { name: '恒富中' },
  tokai:      { name: '東海中' },
  okatomi:    { name: '岡富中' },
  minami:     { name: '南中' },
  nishishina: { name: '西階中' },
  totoro:     { name: '土々呂中' },
  minamikata: { name: '南方中' },
  kitagata:   { name: '北方学園' },
  asahi:      { name: '旭中' },
  other_jh:   { name: 'その他中学校' }
};

// ===== 志望中学校マスタ（小学生受験用） =====
const TARGET_JUNIOR_HIGHS = {
  miyazaki_nichidai_jh: { name: '宮崎日大中',     hensachi: 52, bairitsu: 1.8, teiin: 120, subjects: ['国語','算数','理科','社会'], memo: '奨学生制度あり' },
  ursula_jh:            { name: '聖心ウルスラ中', hensachi: 48, bairitsu: 1.5, teiin: 80,  subjects: ['国語','算数','面接'], memo: '' },
  miyazaki_gakuen_jh:   { name: '宮崎学園中',     hensachi: 50, bairitsu: 1.6, teiin: 100, subjects: ['国語','算数','理科','社会'], memo: '' },
  houou_jh:             { name: '鵬翔中',         hensachi: 45, bairitsu: 1.3, teiin: 80,  subjects: ['国語','算数'], memo: '' },
  nobeoka_gakuen_jh:    { name: '延岡学園中',     hensachi: 44, bairitsu: 1.2, teiin: 60,  subjects: ['国語','算数','面接'], memo: '' },
  miyazaki_nishi_jh:    { name: '宮崎西高附属中', hensachi: 58, bairitsu: 3.5, teiin: 80,  subjects: ['適性検査','作文','面接'], memo: '県立中高一貫' },
  miyazaki_fuzoku_jh:   { name: '宮大附属中',     hensachi: 55, bairitsu: 2.8, teiin: 120, subjects: ['国語','算数','理科','社会'], memo: '国立' },
  other_jh_exam:        { name: 'その他',         hensachi: null, bairitsu: null, teiin: null, subjects: [], memo: '' }
};

// ===== 大学マスタ（高校生用） =====
const TARGET_UNIVERSITIES = {
  // --- 国公立（九州） ---
  miyazaki_u:     { name: '宮崎大学',       area: '宮崎', type: 'national', hensachi: 50, bairitsu: 2.5, subjects: ['共通テスト','二次(学部別)'], memo: '' },
  miyazaki_korit: { name: '宮崎公立大学',   area: '宮崎', type: 'public',   hensachi: 48, bairitsu: 2.2, subjects: ['共通テスト','小論文'], memo: '' },
  kyushu_u:       { name: '九州大学',       area: '福岡', type: 'national', hensachi: 65, bairitsu: 3.2, subjects: ['共通テスト','二次(学部別)'], memo: '旧帝大' },
  kumamoto_u:     { name: '熊本大学',       area: '熊本', type: 'national', hensachi: 55, bairitsu: 2.8, subjects: ['共通テスト','二次(学部別)'], memo: '' },
  kagoshima_u:    { name: '鹿児島大学',     area: '鹿児島', type: 'national', hensachi: 52, bairitsu: 2.3, subjects: ['共通テスト','二次(学部別)'], memo: '' },
  oita_u:         { name: '大分大学',       area: '大分', type: 'national', hensachi: 50, bairitsu: 2.1, subjects: ['共通テスト','二次(学部別)'], memo: '' },
  nagasaki_u:     { name: '長崎大学',       area: '長崎', type: 'national', hensachi: 53, bairitsu: 2.6, subjects: ['共通テスト','二次(学部別)'], memo: '' },
  saga_u:         { name: '佐賀大学',       area: '佐賀', type: 'national', hensachi: 48, bairitsu: 2.0, subjects: ['共通テスト','二次(学部別)'], memo: '' },
  fukuoka_kyo:    { name: '福岡教育大学',   area: '福岡', type: 'national', hensachi: 50, bairitsu: 2.4, subjects: ['共通テスト','二次(学部別)'], memo: '' },
  kitakyushu_u:   { name: '北九州市立大学', area: '福岡', type: 'public',   hensachi: 50, bairitsu: 2.5, subjects: ['共通テスト','二次(学部別)'], memo: '' },
  hiroshima_u:    { name: '広島大学',       area: '広島', type: 'national', hensachi: 57, bairitsu: 2.7, subjects: ['共通テスト','二次(学部別)'], memo: '' },
  // --- 国公立（全国主要） ---
  tokyo_u:        { name: '東京大学',       area: '東京', type: 'national', hensachi: 72, bairitsu: 3.5, subjects: ['共通テスト','二次(学部別)'], memo: '' },
  kyoto_u:        { name: '京都大学',       area: '京都', type: 'national', hensachi: 70, bairitsu: 3.3, subjects: ['共通テスト','二次(学部別)'], memo: '' },
  osaka_u:        { name: '大阪大学',       area: '大阪', type: 'national', hensachi: 65, bairitsu: 3.0, subjects: ['共通テスト','二次(学部別)'], memo: '' },
  nagoya_u:       { name: '名古屋大学',     area: '愛知', type: 'national', hensachi: 63, bairitsu: 2.9, subjects: ['共通テスト','二次(学部別)'], memo: '' },
  tohoku_u:       { name: '東北大学',       area: '宮城', type: 'national', hensachi: 63, bairitsu: 3.0, subjects: ['共通テスト','二次(学部別)'], memo: '' },
  hokkaido_u:     { name: '北海道大学',     area: '北海道', type: 'national', hensachi: 62, bairitsu: 2.8, subjects: ['共通テスト','二次(学部別)'], memo: '' },
  kobe_u:         { name: '神戸大学',       area: '兵庫', type: 'national', hensachi: 62, bairitsu: 3.1, subjects: ['共通テスト','二次(学部別)'], memo: '' },
  // --- 私立（九州） ---
  fukuoka_u:      { name: '福岡大学',       area: '福岡', type: 'private',  hensachi: 50, bairitsu: 3.5, subjects: ['個別試験(学部別)'], memo: '' },
  seinan_u:       { name: '西南学院大学',   area: '福岡', type: 'private',  hensachi: 55, bairitsu: 3.8, subjects: ['個別試験(学部別)'], memo: '' },
  kurume_u:       { name: '久留米大学',     area: '福岡', type: 'private',  hensachi: 48, bairitsu: 2.5, subjects: ['個別試験(学部別)'], memo: '医学部あり' },
  miyazaki_sangyo:  { name: '宮崎産業経営大学', area: '宮崎', type: 'private', hensachi: 40, bairitsu: 1.2, subjects: ['個別試験'], memo: '' },
  miyazaki_kokusai: { name: '宮崎国際大学', area: '宮崎', type: 'private',  hensachi: 42, bairitsu: 1.3, subjects: ['個別試験','面接'], memo: '' },
  // --- 私立（全国主要） ---
  waseda_u:       { name: '早稲田大学',     area: '東京', type: 'private',  hensachi: 67, bairitsu: 5.0, subjects: ['個別試験(学部別)'], memo: '' },
  keio_u:         { name: '慶應義塾大学',   area: '東京', type: 'private',  hensachi: 68, bairitsu: 4.5, subjects: ['個別試験(学部別)'], memo: '' },
  meiji_u:        { name: '明治大学',       area: '東京', type: 'private',  hensachi: 62, bairitsu: 4.0, subjects: ['個別試験(学部別)'], memo: '' },
  ritsumeikan_u:  { name: '立命館大学',     area: '京都', type: 'private',  hensachi: 58, bairitsu: 3.5, subjects: ['個別試験(学部別)'], memo: '' },
  // --- その他 ---
  other_u:        { name: 'その他',         area: '', type: 'other', hensachi: null, bairitsu: null, subjects: [], memo: '' }
};

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
    await StudentsDB.addPoints(supporterId, points, {
      category: 'support',
      description: `サポート行動: ${actionType}`,
      grantedBy: 'teacher',
    });
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

// ============================================
// MULTIVERSE（マルチバース）翻訳システム
// ============================================

// 6つの世界観定義
const WORLD_THEMES = {
  legend: {
    id: 'legend', name: '伝説の冒険者', icon: '⚔️', colorPrimary: '#d97706', colorBg: '#fffbeb',
    roles: {
      player: '勇者', teacher: '導きの大賢者', friendMulti: 'パーティメンバー',
      friendSolo: '精霊の相棒', parent: '故郷の王'
    },
    terms: {
      points: 'EXP', pomodoro: '修行', mission: 'クエスト', boss: '大魔王',
      combo: '隠しスキル', streak: '連戦記録', condition: '体力チェック',
      station: '新しい街', hiddenArea: '秘密のダンジョン', complete: '勝利！',
      damage: '剣技ダメージ', buff: '神の加護', storyIntro: 'が現れた！'
    }
  },
  tactical: {
    id: 'tactical', name: '特殊部隊作戦', icon: '🎯', colorPrimary: '#38bdf8', colorBg: '#0f172a',
    roles: {
      player: 'エージェント', teacher: '司令官(HQ)', friendMulti: '戦術分隊',
      friendSolo: 'サポートAI', parent: '後方支援部隊'
    },
    terms: {
      points: 'CREDITS', pomodoro: 'ミッション遂行', mission: '極秘指令', boss: '敵セキュリティ',
      combo: '戦術コード解析', streak: '連続作戦日数', condition: 'バイタルチェック',
      station: '新たな宙域', hiddenArea: '未確認エリア', complete: 'ミッション完了',
      damage: '精密射撃', buff: '戦術支援', storyIntro: 'を検知。迎撃せよ。'
    }
  },
  heroine: {
    id: 'heroine', name: 'ヒロインの物語', icon: '👑', colorPrimary: '#f43f5e', colorBg: '#fff1f2',
    roles: {
      player: 'ヒロイン', teacher: '敏腕プロデューサー', friendMulti: 'ユニット仲間',
      friendSolo: '鏡の妖精', parent: 'ファン第一号'
    },
    terms: {
      points: 'SP(シャイン度)', pomodoro: 'レッスン', mission: 'オーディション課題', boss: '運命の試練',
      combo: '新しい魔法', streak: '輝き連続日数', condition: 'コンディションチェック',
      station: '次のステージ', hiddenArea: '秘密の衣装部屋', complete: '合格！おめでとう！',
      damage: '輝きのパワー', buff: '声援パワー', storyIntro: 'が始まります！'
    }
  },
  academia: {
    id: 'academia', name: '真理の探究者', icon: '📜', colorPrimary: '#57534e', colorBg: '#fafaf9',
    roles: {
      player: '研究生', teacher: '主任教授', friendMulti: '共同研究チーム',
      friendSolo: '使い魔のフクロウ', parent: 'パトロン'
    },
    terms: {
      points: 'INT(知性)', pomodoro: '集中研究', mission: '研究課題', boss: '未解明の謎',
      combo: '隠された法則', streak: '研究継続日数', condition: '精神状態記録',
      station: '新たな書庫', hiddenArea: '禁書の間', complete: '解明完了。',
      damage: '知性の一撃', buff: '叡智の結集', storyIntro: 'が浮上した。調査せよ。'
    }
  },
  cozy: {
    id: 'cozy', name: '星の庭師', icon: '🌱', colorPrimary: '#4ade80', colorBg: '#f0fdf4',
    roles: {
      player: '庭師', teacher: '見守りの大樹', friendMulti: 'お隣の庭師たち',
      friendSolo: '森の小動物たち', parent: 'お日様と大地'
    },
    terms: {
      points: '光のしずく', pomodoro: 'お水やり', mission: '今日のお手入れ', boss: '大きな黒い雲',
      combo: '新しいお花', streak: 'お手入れ連続日数', condition: '今日のきもち',
      station: '新しい花壇', hiddenArea: '妖精の泉', complete: 'きれいに咲いたよ！',
      damage: '光のチカラ', buff: 'みんなの光', storyIntro: 'が近づいてきたよ。'
    }
  },
  space: {
    id: 'space', name: '星海の探検家', icon: '🚀', colorPrimary: '#818cf8', colorBg: '#0c0a20',
    roles: {
      player: '飛行士', teacher: '管制塔', friendMulti: '艦隊クルー',
      friendSolo: 'ナビ・ドロイド', parent: '地球の通信基地'
    },
    terms: {
      points: 'ポイント', pomodoro: '船外活動', mission: '本日の指令', boss: '宇宙怪獣',
      combo: '推進装置の隠し機能', streak: '連続航行日数', condition: 'バイタルサイン',
      station: '新ステーション', hiddenArea: '未知の宙域', complete: '帰還成功！',
      damage: 'ダメージ', buff: '支援バフ', storyIntro: 'が出現！全機警戒せよ。'
    }
  }
};

// 翻訳関数: 共通テキストを生徒の世界観に変換
function translateTerm(worldId, termKey) {
  const world = WORLD_THEMES[worldId];
  if (!world || !world.terms[termKey]) return termKey;
  return world.terms[termKey];
}

// ボス名の翻訳: 「中間テスト」→ 各世界観に変換
function translateBossName(worldId, baseName) {
  const world = WORLD_THEMES[worldId];
  if (!world) return baseName;
  return `${world.terms.boss}「${baseName}」${world.terms.storyIntro}`;
}

// ストーリーテキストの翻訳
function translateStoryText(worldId, baseText) {
  const world = WORLD_THEMES[worldId];
  if (!world) return baseText;
  // 共通キーワードを世界観の言葉に置換
  let text = baseText;
  text = text.replace(/ポイント/g, world.terms.points);
  text = text.replace(/ポモドーロ/g, world.terms.pomodoro);
  text = text.replace(/ミッション/g, world.terms.mission);
  text = text.replace(/ボス/g, world.terms.boss);
  text = text.replace(/コンボ/g, world.terms.combo);
  return text;
}

// 世界観の取得
function getWorldTheme(worldId) {
  return WORLD_THEMES[worldId] || WORLD_THEMES['space']; // デフォルトは宇宙
}

// ===== 教材マスタ (Materials) =====
const MATERIALS = {
  srj: [
    { id: 'srj_sokudoku', name: 'SRJ速読速解力講座', icon: '📚', phase: 'speedReading',
      metrics: [
        { key: 'readingSpeed', label: '読書速度', unit: '文字/分', type: 'number' },
        { key: 'comprehension', label: '短文理解度', unit: '/10問', type: 'number', max: 10 }
      ]},
    { id: 'srj_eigo', name: 'SRJ速読聴英語講座', icon: '🔤', phase: 'speedReading',
      metrics: [
        { key: 'wpm', label: 'WPM', unit: '語/分', type: 'number' },
        { key: 'listeningPlays', label: 'リスニング再生回数', unit: '回', type: 'number' }
      ]},
    { id: 'srj_sansu', name: 'SRJ算数的思考力', icon: '🔢', phase: 'speedReading',
      metrics: [
        { key: 'calcAccuracy', label: '計算正答率', unit: '%', type: 'number', max: 100 },
        { key: 'thinkingAccuracy', label: '思考力問題正答率', unit: '%', type: 'number', max: 100 }
      ]},
    { id: 'srj_kokugo', name: 'SRJ新国語講座', icon: '📕', phase: 'speedReading',
      metrics: [
        { key: 'monthlyTestScore', label: '月次確認テスト正答率', unit: '/11問', type: 'number', max: 11 },
        { key: 'weakCategory', label: '弱点カテゴリ', unit: '', type: 'select',
          options: ['係り受け','指示語・照応','同義文','推理・推論','図表の読解','定義と具体例'] }
      ]},
  ],
  digital: [
    { id: 'atama_plus',  name: 'atama+',    icon: '💡', subjects: true },
    { id: 'edu_plus',    name: 'edu+',      icon: '📱', subjects: true },
    { id: 'manabi_aid',  name: '学びエイド', icon: '🎓', subjects: true },
    { id: 'monoxer',     name: 'Monoxer',   icon: '🧠' },
  ],
  test: [
    { id: 'ikushin',        name: '育伸社学力テスト', icon: '📝' },
    { id: 'miyazaki_moshi', name: '宮崎県統一模試',   icon: '📋' },
  ],
  paper: [
    { id: 'paper_other', name: 'その他紙教材', icon: '📄', freeText: true },
  ]
};

function getMaterialById(id) {
  for (const cat of Object.values(MATERIALS)) {
    const found = cat.find(m => m.id === id);
    if (found) return found;
  }
  return null;
}

function getAllMaterials() {
  return Object.entries(MATERIALS).flatMap(([cat, items]) =>
    items.map(m => ({ ...m, category: cat }))
  );
}

// ===== 教材進捗管理 (Material Progress) =====
const MaterialProgressDB = {
  async add(data) {
    const record = {
      studentId: data.studentId,
      materialId: data.materialId,
      subject: data.subject || null,
      unit: data.unit || null,
      progress: data.progress != null ? data.progress : null,
      accuracy: data.accuracy != null ? data.accuracy : null,
      metrics: data.metrics || {},
      memo: data.memo || null,
      collectedBy: data.collectedBy || 'teacher',
      collectedAt: data.collectedAt || getToday(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const ref = await db.collection('materialProgress').add(record);
    return ref.id;
  },
  async getByStudent(studentId, limit) {
    let q = db.collection('materialProgress')
      .where('studentId', '==', studentId)
      .orderBy('createdAt', 'desc');
    if (limit) q = q.limit(limit);
    const snap = await q.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getLatest(studentId, materialId) {
    const snap = await db.collection('materialProgress')
      .where('studentId', '==', studentId)
      .where('materialId', '==', materialId)
      .orderBy('createdAt', 'desc')
      .limit(1).get();
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
  },
  async getByStudentAndMaterial(studentId, materialId, limit) {
    let q = db.collection('materialProgress')
      .where('studentId', '==', studentId)
      .where('materialId', '==', materialId)
      .orderBy('createdAt', 'desc');
    if (limit) q = q.limit(limit);
    const snap = await q.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async addBulk(records) {
    const results = [];
    for (const r of records) {
      const id = await this.add(r);
      results.push({ studentId: r.studentId, id });
    }
    return results;
  }
};

// 次元シフト（世界観変更）の可否判定
// 年4回: 7月上旬, 9月上旬, 11月下旬, 1月下旬
function isDimensionShiftOpen() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();
  // 各月の1-7日（1週間限定）を解放期間とする
  const shiftWindows = [
    { month: 7, startDay: 1, endDay: 7 },   // 覚醒の夏
    { month: 9, startDay: 1, endDay: 7 },   // 軌道修正
    { month: 11, startDay: 20, endDay: 27 }, // 最終形態
    { month: 1, startDay: 20, endDay: 27 },  // 次代への継承
  ];
  return shiftWindows.some(w => month === w.month && day >= w.startDay && day <= w.endDay);
}

// 世界観の変更（シフト期間中のみ）
async function changeWorld(studentId, newWorldId) {
  if (!isDimensionShiftOpen()) return { success: false, reason: '次元ゲートは現在閉鎖中です' };
  if (!WORLD_THEMES[newWorldId]) return { success: false, reason: '不明な世界です' };
  await StudentsDB.update(studentId, { worldId: newWorldId });
  return { success: true, world: WORLD_THEMES[newWorldId] };
}

// ===== アクティブセッション（現在学習中トラッキング） =====
const ActiveSessionsDB = {
  async start(studentId, subject, material) {
    await db.collection('activeSessions').doc(studentId).set({
      studentId,
      subject: subject || '',
      material: material || null,
      startedAt: firebase.firestore.FieldValue.serverTimestamp(),
      active: true
    });
  },
  async end(studentId) {
    try { await db.collection('activeSessions').doc(studentId).delete(); } catch(e) {}
  },
  async getAll() {
    const snap = await db.collection('activeSessions').where('active', '==', true).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

// ===== 出席管理 (Attendance) =====
const AttendanceDB = {
  async checkIn(studentId) {
    const today = getToday();
    const existing = await db.collection('attendance')
      .where('studentId', '==', studentId)
      .where('date', '==', today).limit(1).get();
    if (!existing.empty) return { id: existing.docs[0].id, alreadyCheckedIn: true };
    const ref = await db.collection('attendance').add({
      studentId, date: today,
      arrivedAt: firebase.firestore.FieldValue.serverTimestamp(),
      departedAt: null
    });
    return { id: ref.id, alreadyCheckedIn: false };
  },
  async checkOut(studentId) {
    const today = getToday();
    const snap = await db.collection('attendance')
      .where('studentId', '==', studentId)
      .where('date', '==', today).limit(1).get();
    if (snap.empty) return null;
    await db.collection('attendance').doc(snap.docs[0].id).update({
      departedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return snap.docs[0].id;
  },
  async getTodayAttendance() {
    const today = getToday();
    const snap = await db.collection('attendance')
      .where('date', '==', today).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async isCheckedIn(studentId) {
    const today = getToday();
    const snap = await db.collection('attendance')
      .where('studentId', '==', studentId)
      .where('date', '==', today).limit(1).get();
    return !snap.empty;
  }
};

// ===== 日次プラン管理 (Daily Plans) =====
const DailyPlansDB = {
  async create(studentId, phases, createdBy) {
    const today = getToday();
    // 既存プランがあれば上書き
    const existing = await db.collection('dailyPlans')
      .where('studentId', '==', studentId)
      .where('date', '==', today).limit(1).get();
    if (!existing.empty) {
      await db.collection('dailyPlans').doc(existing.docs[0].id).update({
        phases, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return existing.docs[0].id;
    }
    const ref = await db.collection('dailyPlans').add({
      studentId, date: today, phases,
      createdBy: createdBy || 'teacher',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async getForStudent(studentId) {
    const today = getToday();
    const snap = await db.collection('dailyPlans')
      .where('studentId', '==', studentId)
      .where('date', '==', today).limit(1).get();
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
  },
  async updatePhaseStatus(planId, phaseIndex, status, actualDuration) {
    const doc = await db.collection('dailyPlans').doc(planId).get();
    if (!doc.exists) return;
    const phases = doc.data().phases;
    if (phases[phaseIndex]) {
      phases[phaseIndex].status = status;
      if (actualDuration !== undefined) phases[phaseIndex].actualDuration = actualDuration;
    }
    await db.collection('dailyPlans').doc(planId).update({ phases });
  },
  async getTodayAll() {
    const today = getToday();
    const snap = await db.collection('dailyPlans')
      .where('date', '==', today).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async createBulk(studentIds, phases, createdBy) {
    const results = [];
    for (const sid of studentIds) {
      const id = await this.create(sid, JSON.parse(JSON.stringify(phases)), createdBy);
      results.push({ studentId: sid, planId: id });
    }
    return results;
  }
};

// ===== テスト日程管理 (Exam Schedules) =====
const EXAM_TYPES = {
  // 中学校別テスト（学校フィルタ対象）
  midterm:        { label: '中間テスト',         icon: '📝', color: '#3b82f6', category: 'school' },
  final:          { label: '期末テスト',         icon: '📝', color: '#8b5cf6', category: 'school' },
  // 全学年共通テスト
  jitsuryoku:     { label: '実力テスト',         icon: '💪', color: '#06b6d4', category: 'common' },
  ikushin:        { label: '育伸社テスト',       icon: '📋', color: '#10b981', category: 'common' },
  miyazaki_moshi: { label: '宮崎県統一模試',     icon: '📊', color: '#f59e0b', category: 'common' },
  entrance:       { label: '入試本番',           icon: '🎯', color: '#ef4444', category: 'common' },
  // 高校生対外模試
  kawai_kyotsu:   { label: '全統共通テスト模試', icon: '🏛️', color: '#7c3aed', category: 'high_mock' },
  kawai_kijutsu:  { label: '全統記述模試',       icon: '🏛️', color: '#7c3aed', category: 'high_mock' },
  sundai:         { label: '駿台模試',           icon: '🔵', color: '#2563eb', category: 'high_mock' },
  shinken:        { label: '進研模試',           icon: '🟢', color: '#16a34a', category: 'high_mock' },
  toshin:         { label: '東進模試',           icon: '🟠', color: '#ea580c', category: 'high_mock' },
  kyotsu_honban:  { label: '共通テスト本番',     icon: '🎯', color: '#dc2626', category: 'high_mock' },
  // その他
  other:          { label: 'その他',             icon: '📌', color: '#6b7280', category: 'other' }
};

const ExamSchedulesDB = {
  async add(data) {
    const ref = await db.collection('examSchedules').add({
      examType: data.examType || 'other',
      examName: data.examName || '',
      date: data.date,
      targetGrades: data.targetGrades || [],
      targetStudentIds: data.targetStudentIds || [],
      targetSchools: data.targetSchools || [],
      subjects: data.subjects || [],
      memo: data.memo || '',
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async update(id, data) {
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('examSchedules').doc(id).update(data);
  },
  async delete(id) { await db.collection('examSchedules').doc(id).delete(); },
  async getAll() {
    const snap = await db.collection('examSchedules').where('active', '==', true).orderBy('date', 'asc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getUpcoming(limit) {
    const today = getToday();
    let q = db.collection('examSchedules').where('active', '==', true).where('date', '>=', today).orderBy('date', 'asc');
    if (limit) q = q.limit(limit);
    const snap = await q.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getByStudent(studentId, student) {
    const upcoming = await this.getUpcoming(10);
    return upcoming.filter(e => {
      if (e.targetStudentIds && e.targetStudentIds.length > 0) return e.targetStudentIds.includes(studentId);
      let gradeMatch = true;
      let schoolMatch = true;
      if (e.targetGrades && e.targetGrades.length > 0 && student.grade) gradeMatch = e.targetGrades.includes(student.grade);
      if (e.targetSchools && e.targetSchools.length > 0) schoolMatch = student.school ? e.targetSchools.includes(student.school) : false;
      if ((e.targetGrades && e.targetGrades.length > 0) || (e.targetSchools && e.targetSchools.length > 0)) return gradeMatch && schoolMatch;
      return true;
    });
  }
};

function calcDaysUntil(dateStr) {
  const target = new Date(dateStr + 'T00:00:00');
  const today = new Date(getToday() + 'T00:00:00');
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

// ===== 学習ルート管理 (Study Routes) =====
const StudyRoutesDB = {
  async add(data) {
    const ref = await db.collection('studyRoutes').add({
      studentId: data.studentId, routeName: data.routeName || '', subject: data.subject || '',
      targetDate: data.targetDate || null, status: 'active', memo: data.memo || '',
      createdBy: data.createdBy || 'teacher',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async getByStudent(studentId) {
    const snap = await db.collection('studyRoutes').where('studentId', '==', studentId).orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getActive(studentId) {
    const all = await this.getByStudent(studentId);
    return all.filter(r => r.status === 'active');
  },
  async update(id, data) {
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('studyRoutes').doc(id).update(data);
  },
  async delete(id) {
    const tasks = await RouteTasksDB.getByRoute(id);
    for (const t of tasks) await db.collection('routeTasks').doc(t.id).delete();
    await db.collection('studyRoutes').doc(id).delete();
  }
};

const RouteTasksDB = {
  async add(data) {
    const ref = await db.collection('routeTasks').add({
      routeId: data.routeId, studentId: data.studentId, order: data.order || 0,
      materialId: data.materialId || null, materialName: data.materialName || '',
      taskName: data.taskName || '', startDate: data.startDate || null, endDate: data.endDate || null,
      dailyAmount: data.dailyAmount || '', dependsOn: data.dependsOn || null,
      status: 'pending', actualStartDate: null, actualEndDate: null, progress: 0,
      memo: data.memo || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async getByRoute(routeId) {
    const snap = await db.collection('routeTasks').where('routeId', '==', routeId).orderBy('order', 'asc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getByStudent(studentId) {
    const snap = await db.collection('routeTasks').where('studentId', '==', studentId).orderBy('endDate', 'asc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async update(id, data) {
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('routeTasks').doc(id).update(data);
  },
  async updateProgress(id, progress) {
    const doc = await db.collection('routeTasks').doc(id).get();
    const updates = { progress, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (progress > 0 && !doc.data().actualStartDate) { updates.actualStartDate = getToday(); updates.status = 'in_progress'; }
    if (progress >= 100) { updates.status = 'completed'; updates.actualEndDate = getToday(); }
    await db.collection('routeTasks').doc(id).update(updates);
  },
  async delete(id) { await db.collection('routeTasks').doc(id).delete(); },
  async getOverdue(studentId) {
    const today = getToday();
    const all = await this.getByStudent(studentId);
    return all.filter(t => t.endDate && t.endDate < today && t.status !== 'completed');
  }
};

// ============================================
// Phase 8: スケジュール管理 + 講師管理
// ============================================

// --- 塾設定 ---
const AcademyConfigDB = {
  async get() {
    const doc = await db.collection('academyConfig').doc('main').get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },
  async set(data) {
    await db.collection('academyConfig').doc('main').set({
      academyName: data.academyName || '個別指導学院ヒーローズ延岡校',
      rent: data.rent || 0,           // 家賃
      utilities: data.utilities || 0,  // 光熱費
      otherFixed: data.otherFixed || 0, // その他固定費
      fixedCostMemo: data.fixedCostMemo || '',
      rewardBudgetPercent: data.rewardBudgetPercent || 2, // 月謝に対する報酬予算%
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
};

// --- 講師管理 ---
const TeachersDB = {
  async getAll() {
    const snap = await db.collection('teachers').orderBy('name').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getById(id) {
    const doc = await db.collection('teachers').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },
  async getActive() {
    const snap = await db.collection('teachers').where('active', '==', true).orderBy('name').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async add(data) {
    const ref = await db.collection('teachers').add({
      classroomId: data.classroomId || currentClassroomId(),
      name: data.name,
      email: data.email || '',
      phone: data.phone || '',
      subjects: data.subjects || [],    // 担当科目
      hourlyRate: data.hourlyRate || 0, // 時給
      role: data.role || 'teacher',     // 'director'(教室長) / 'teacher'(講師)
      maxStudents: data.maxStudents || 3, // 最大同時担当数
      currentStudents: data.currentStudents || 0,
      pin: data.pin || String(Math.floor(1000 + Math.random() * 9000)),
      active: true,
      memo: data.memo || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async update(id, data) {
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('teachers').doc(id).update(data);
  },
  async delete(id) {
    await db.collection('teachers').doc(id).update({ active: false });
  },
  async getByPin(pin) {
    const snap = await db.collection('teachers')
      .where('pin', '==', pin).where('active', '==', true).limit(1).get();
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
  }
};

// --- 講師シフト ---
const ShiftsDB = {
  async getByDate(date) {
    const snap = await db.collection('shifts').where('date', '==', date).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getByTeacher(teacherId, startDate, endDate) {
    let q = db.collection('shifts').where('teacherId', '==', teacherId);
    if (startDate) q = q.where('date', '>=', startDate);
    if (endDate) q = q.where('date', '<=', endDate);
    const snap = await q.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getByDateRange(startDate, endDate) {
    const snap = await db.collection('shifts')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async add(data) {
    const ref = await db.collection('shifts').add({
      classroomId: data.classroomId || currentClassroomId(),
      teacherId: data.teacherId,
      teacherName: data.teacherName || '',
      date: data.date,
      startTime: data.startTime,  // "16:00"
      endTime: data.endTime,      // "21:00"
      memo: data.memo || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async update(id, data) {
    await db.collection('shifts').doc(id).update(data);
  },
  async delete(id) {
    await db.collection('shifts').doc(id).delete();
  }
};

// --- 講師出勤可能時間 ---
const AvailabilityDB = {
  async getByTeacher(teacherId) {
    const snap = await db.collection('availability')
      .where('teacherId', '==', teacherId).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async set(teacherId, dayOfWeek, slots) {
    // slots: [{startTime, endTime}]
    const docId = `${teacherId}_${dayOfWeek}`;
    await db.collection('availability').doc(docId).set({
      teacherId, dayOfWeek, slots,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },
  async getAll() {
    const snap = await db.collection('availability').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

// --- スケジュールテンプレート（週固定パターン） ---
const ScheduleTemplatesDB = {
  async getAll() {
    const snap = await db.collection('scheduleTemplates').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getActive() {
    const snap = await db.collection('scheduleTemplates').where('active', '==', true).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async add(data) {
    const ref = await db.collection('scheduleTemplates').add({
      classroomId: data.classroomId || currentClassroomId(),
      name: data.name || '',
      dayOfWeek: data.dayOfWeek,   // 0=日, 1=月, ..., 6=土
      timeSlot: data.timeSlot,     // "16:00-17:00"
      studentId: data.studentId || null,
      studentName: data.studentName || '',
      teacherId: data.teacherId || null,
      teacherName: data.teacherName || '',
      subject: data.subject || '',
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async update(id, data) {
    await db.collection('scheduleTemplates').doc(id).update(data);
  },
  async delete(id) {
    await db.collection('scheduleTemplates').doc(id).update({ active: false });
  },
  async getByDay(dayOfWeek) {
    const snap = await db.collection('scheduleTemplates')
      .where('dayOfWeek', '==', dayOfWeek)
      .where('active', '==', true).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

// --- 授業スロット（日別の実際のスケジュール） ---
const ScheduleSlotsDB = {
  async getByDate(date) {
    const snap = await db.collection('scheduleSlots').where('date', '==', date).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getByDateRange(startDate, endDate) {
    const snap = await db.collection('scheduleSlots')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getByStudent(studentId, startDate, endDate) {
    let q = db.collection('scheduleSlots').where('studentId', '==', studentId);
    if (startDate) q = q.where('date', '>=', startDate);
    if (endDate) q = q.where('date', '<=', endDate);
    const snap = await q.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async add(data) {
    const ref = await db.collection('scheduleSlots').add({
      classroomId: data.classroomId || currentClassroomId(),
      date: data.date,
      timeSlot: data.timeSlot,         // "16:00-17:00"
      studentId: data.studentId || null,
      studentName: data.studentName || '',
      teacherId: data.teacherId || null,
      teacherName: data.teacherName || '',
      subject: data.subject || '',
      status: data.status || 'scheduled', // scheduled/completed/cancelled/absent
      templateId: data.templateId || null,
      memo: data.memo || '',
      memoBuddyVisible: data.memoBuddyVisible || false, // メモを生徒バディに共有するか
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async update(id, data) {
    await db.collection('scheduleSlots').doc(id).update(data);
  },
  async delete(id) {
    await db.collection('scheduleSlots').doc(id).delete();
  },
  async generateFromTemplates(startDate, endDate) {
    // テンプレートから指定期間のスロットを自動生成
    const templates = await ScheduleTemplatesDB.getActive();
    const generated = [];
    const current = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    while (current <= end) {
      const dow = current.getDay();
      const dateStr = current.toISOString().split('T')[0];
      const dayTemplates = templates.filter(t => t.dayOfWeek === dow);
      // 既存スロットと重複チェック
      const existing = await this.getByDate(dateStr);
      for (const tmpl of dayTemplates) {
        const dup = existing.find(e =>
          e.timeSlot === tmpl.timeSlot && e.studentId === tmpl.studentId);
        if (!dup) {
          const id = await this.add({
            date: dateStr,
            timeSlot: tmpl.timeSlot,
            studentId: tmpl.studentId,
            studentName: tmpl.studentName,
            teacherId: tmpl.teacherId,
            teacherName: tmpl.teacherName,
            subject: tmpl.subject,
            templateId: tmpl.id
          });
          generated.push(id);
        }
      }
      current.setDate(current.getDate() + 1);
    }
    return generated;
  }
};

// --- 面談記録 ---
const InterviewRecordsDB = {
  async getAll() {
    const snap = await db.collection('interviewRecords').orderBy('date', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getByStudent(studentId) {
    const snap = await db.collection('interviewRecords')
      .where('studentId', '==', studentId)
      .orderBy('date', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async add(data) {
    const ref = await db.collection('interviewRecords').add({
      studentId: data.studentId,
      studentName: data.studentName || '',
      type: data.type || 'regular',  // regular/emergency/tripartite/phone/online
      date: data.date || new Date().toISOString().split('T')[0],
      attendees: data.attendees || '',
      content: data.content || '',
      nextAction: data.nextAction || '',
      followUpDate: data.followUpDate || null,
      conductedBy: data.conductedBy || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async update(id, data) {
    await db.collection('interviewRecords').doc(id).update(data);
  },
  async delete(id) {
    await db.collection('interviewRecords').doc(id).delete();
  }
};

// --- 講師コメント（レポート用） ---
const TeacherCommentsDB = {
  async getByStudent(studentId, limit = 20) {
    // composite index 回避: studentId で where し、orderBy は JS で行う
    // (Firestore の複合インデックス未登録のため)
    const snap = await db.collection('teacherComments')
      .where('studentId', '==', studentId)
      .limit(limit * 3).get();
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      })
      .slice(0, limit);
  },
  async getByDate(date) {
    const snap = await db.collection('teacherComments')
      .where('date', '==', date).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async add(data) {
    const ref = await db.collection('teacherComments').add({
      classroomId: data.classroomId || currentClassroomId(),
      studentId: data.studentId,
      studentName: data.studentName || '',
      teacherId: data.teacherId || '',
      teacherName: data.teacherName || '',
      date: data.date || new Date().toISOString().split('T')[0],
      attitude: data.attitude || '',       // 学習態度
      understanding: data.understanding || '', // 理解度
      note: data.note || '',               // 特記事項
      subjects: data.subjects || [],
      buddyVisible: data.buddyVisible || false, // 生徒バディ（ルカ）にこのコメントを共有するか
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async update(id, data) {
    await db.collection('teacherComments').doc(id).update(data);
  },
  async delete(id) {
    await db.collection('teacherComments').doc(id).delete();
  }
};

// --- 業務タスク ---
const OperationTasksDB = {
  async getAll() {
    const snap = await db.collection('operationTasks').orderBy('dueDate', 'asc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getActive() {
    const snap = await db.collection('operationTasks')
      .where('status', '!=', 'completed').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async add(data) {
    const ref = await db.collection('operationTasks').add({
      title: data.title,
      description: data.description || '',
      assigneeId: data.assigneeId || null,
      assigneeName: data.assigneeName || '',
      dueDate: data.dueDate || null,
      priority: data.priority || 'normal', // low/normal/high/urgent
      status: 'pending', // pending/in_progress/completed
      category: data.category || 'general',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async update(id, data) {
    await db.collection('operationTasks').doc(id).update(data);
  },
  async delete(id) {
    await db.collection('operationTasks').doc(id).delete();
  }
};

// --- レポートログ ---
const ReportLogsDB = {
  async add(data) {
    const ref = await db.collection('reportLogs').add({
      studentId: data.studentId,
      studentName: data.studentName || '',
      type: data.type || 'daily',   // daily/weekly/monthly
      period: data.period || '',
      sentTo: data.sentTo || '',
      sentAt: firebase.firestore.FieldValue.serverTimestamp(),
      content: data.content || ''
    });
    return ref.id;
  },
  async getByStudent(studentId) {
    const snap = await db.collection('reportLogs')
      .where('studentId', '==', studentId)
      .orderBy('sentAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getAll() {
    const snap = await db.collection('reportLogs').orderBy('sentAt', 'desc').limit(50).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

// ============================================
// Phase 14: バディチャットシステム
// ============================================
// データモデル:
// chats/{studentId}: { studentId, studentName, lastMessage, lastSender, updatedAt, unreadByTeacher }
// chats/{studentId}/messages/{messageId}: { sender, senderName, text, type, createdAt }
//   sender: 'student' | 'buddy' | 'teacher'
//   type: 'text' | 'voice'
const ChatDB = {
  async sendMessage(studentId, studentName, sender, senderName, text, type, extra) {
    if (!studentId || !text) return;
    type = type || 'text';
    extra = extra || {};
    const messageData = {
      sender,
      senderName: senderName || '',
      text,
      type,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (extra.imageUrl) messageData.imageUrl = extra.imageUrl;
    const messageRef = await db.collection('chats').doc(studentId)
      .collection('messages').add(messageData);
    // 親ドキュメント更新
    const update = {
      studentId,
      studentName: studentName || '',
      lastMessage: text,
      lastSender: sender,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (sender === 'student') {
      update.unreadByTeacher = firebase.firestore.FieldValue.increment(1);
    } else if (sender === 'teacher') {
      update.unreadByTeacher = 0;
    }
    await db.collection('chats').doc(studentId).set(update, { merge: true });
    return messageRef.id;
  },

  async getMessages(studentId, limit) {
    limit = limit || 50;
    const snap = await db.collection('chats').doc(studentId)
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .limit(limit).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
  },

  // 全アクティブチャット一覧（講師用）
  async getAllChats() {
    const snap = await db.collection('chats')
      .orderBy('updatedAt', 'desc').limit(50).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // リアルタイム購読（生徒側）
  subscribeMessages(studentId, callback) {
    return db.collection('chats').doc(studentId)
      .collection('messages')
      .orderBy('createdAt', 'desc').limit(50)
      .onSnapshot(snap => {
        const messages = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
        callback(messages);
      });
  },

  // リアルタイム購読（講師側 - 全チャット一覧）
  subscribeAllChats(callback) {
    return db.collection('chats')
      .orderBy('updatedAt', 'desc').limit(50)
      .onSnapshot(snap => {
        const chats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(chats);
      });
  },

  // 既読化
  async markReadByTeacher(studentId) {
    await db.collection('chats').doc(studentId).update({
      unreadByTeacher: 0
    });
  }
};

// ============================================
// Phase 14c: デジタル拠点（宇宙基地）
// ============================================
// データモデル: bases/{studentId}
// {
//   studentId, name, level, defenseRating,
//   buildings: [{ type, level, position }],
//   totalInvested, createdAt
// }

const BUILDING_TYPES = [
  {
    type: 'shield',
    name: 'エネルギーシールド',
    icon: '🛡️',
    desc: '防御力を上げる。学習中の集中力を守る',
    color: '#3b82f6',
    costs: [50, 100, 200, 400, 800],
    statName: '防御力',
    statPerLevel: [10, 25, 50, 100, 200]
  },
  {
    type: 'cannon',
    name: 'レーザーキャノン',
    icon: '🔫',
    desc: '攻撃力を上げる。レイドボスへの追加ダメージ',
    color: '#ef4444',
    costs: [80, 150, 300, 600, 1200],
    statName: '攻撃力',
    statPerLevel: [15, 35, 70, 150, 300]
  },
  {
    type: 'radar',
    name: 'レーダー施設',
    icon: '📡',
    desc: 'ミッション報酬+5%/レベル。隠しクエスト発見率UP',
    color: '#10b981',
    costs: [60, 120, 250, 500, 1000],
    statName: '探知力',
    statPerLevel: [5, 10, 20, 40, 80]
  },
  {
    type: 'lab',
    name: '研究ラボ',
    icon: '🔬',
    desc: 'ポイント獲得時に微量ボーナス',
    color: '#8b5cf6',
    costs: [100, 200, 400, 800, 1600],
    statName: '研究力',
    statPerLevel: [2, 5, 10, 20, 50]
  },
  {
    type: 'hangar',
    name: '格納庫',
    icon: '🚀',
    desc: 'ストリーク維持力アップ',
    color: '#f59e0b',
    costs: [40, 80, 160, 320, 640],
    statName: '収容数',
    statPerLevel: [5, 10, 20, 40, 80]
  },
  {
    type: 'observatory',
    name: '天体観測所',
    icon: '🔭',
    desc: 'マップ情報の精度UP',
    color: '#06b6d4',
    costs: [70, 140, 280, 560, 1120],
    statName: '視界',
    statPerLevel: [10, 20, 40, 80, 160]
  }
];

function getBuildingType(typeId) {
  return BUILDING_TYPES.find(b => b.type === typeId);
}

const BasesDB = {
  async getOrCreate(studentId, studentName) {
    const ref = db.collection('bases').doc(studentId);
    const doc = await ref.get();
    if (doc.exists) return { id: doc.id, ...doc.data() };
    const data = {
      studentId,
      name: (studentName || 'クルー') + 'の基地',
      level: 1,
      defenseRating: 0,
      buildings: [],
      totalInvested: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await ref.set(data);
    return { id: studentId, ...data };
  },

  async update(studentId, data) {
    await db.collection('bases').doc(studentId).update(data);
  },

  async addBuilding(studentId, buildingType, position) {
    const ref = db.collection('bases').doc(studentId);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const base = doc.data();
    const buildings = base.buildings || [];
    // 同じpositionに既に建物があればエラー
    if (buildings.some(b => b.position === position)) return null;
    buildings.push({ type: buildingType, level: 1, position });
    await ref.update({ buildings });
    return buildings;
  },

  async upgradeBuilding(studentId, position) {
    const ref = db.collection('bases').doc(studentId);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const base = doc.data();
    const buildings = base.buildings || [];
    const idx = buildings.findIndex(b => b.position === position);
    if (idx < 0) return null;
    if (buildings[idx].level >= 5) return null; // max
    buildings[idx].level++;
    await ref.update({ buildings });
    return buildings;
  },

  async demolishBuilding(studentId, position) {
    const ref = db.collection('bases').doc(studentId);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const base = doc.data();
    const buildings = (base.buildings || []).filter(b => b.position !== position);
    await ref.update({ buildings });
    return buildings;
  },

  async renameBase(studentId, name) {
    await db.collection('bases').doc(studentId).update({ name });
  },

  // 拠点全体の総合スコア計算
  calculateScore(base) {
    if (!base || !base.buildings) return { defense: 0, attack: 0, radar: 0, lab: 0, total: 0 };
    let defense = 0, attack = 0, radar = 0, lab = 0;
    base.buildings.forEach(b => {
      const def = getBuildingType(b.type);
      if (!def) return;
      const stat = def.statPerLevel[Math.min(b.level - 1, 4)] || 0;
      if (b.type === 'shield') defense += stat;
      else if (b.type === 'cannon') attack += stat;
      else if (b.type === 'radar') radar += stat;
      else if (b.type === 'lab') lab += stat;
    });
    return { defense, attack, radar, lab, total: defense + attack + radar + lab };
  }
};

// ============================================
// Feature 9: 階層型コーチングシステム
// ============================================

// --- 教室（マルチテナント土台） ---
const ClassroomsDB = {
  async getAll() {
    const snap = await db.collection('classrooms').orderBy('createdAt', 'asc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getById(id) {
    const doc = await db.collection('classrooms').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },
  async ensureDefault() {
    // default 教室が存在しなければ作成（起動時に呼ぶ）
    const ref = db.collection('classrooms').doc('default');
    const doc = await ref.get();
    if (!doc.exists) {
      await ref.set({
        name: '本校',
        ownerId: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    return 'default';
  },
  async add(data) {
    const ref = db.collection('classrooms').doc(data.id || undefined);
    const docRef = data.id
      ? (await ref.set({
          name: data.name || '新規教室',
          ownerId: data.ownerId || null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }), ref)
      : (await db.collection('classrooms').add({
          name: data.name || '新規教室',
          ownerId: data.ownerId || null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }));
    return docRef.id;
  },
  async update(id, data) {
    await db.collection('classrooms').doc(id).update(data);
  }
};

// --- 申し送り（階層間の情報伝達） ---
// 各バディ（生徒/講師/教室長/オーナー）が話した内容・決定事項をここに記録
// 全ロールが自分宛のエントリを読み、夕会等でアクションする
const HandoffLogDB = {
  async add(data) {
    const ref = await db.collection('handoffLog').add({
      classroomId: data.classroomId || currentClassroomId(),
      studentId: data.studentId || null,           // 生徒固有なら ID、教室全体なら null
      studentName: data.studentName || '',
      sourceRole: data.sourceRole || 'unknown',     // 'student-buddy'|'teacher-buddy'|'director-buddy'|'owner-buddy'|'teacher-manual'|'director-manual'
      sourceId: data.sourceId || '',                // teacher/student ID
      sourceName: data.sourceName || '',
      type: data.type || 'observation',             // 'observation'|'decision'|'request'|'alert'
      summary: data.summary || '',
      details: data.details || '',
      decidedActions: data.decidedActions || [],    // [{who, what}]
      visibleTo: data.visibleTo || ['teacher', 'director'], // ['student-buddy'|'teacher'|'director'|'owner']
      read: data.read || {},                        // {teacher: false, director: false, owner: false}
      actionTaken: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },
  async getByStudent(studentId, limitCount = 10) {
    // composite index 回避: orderBy のみで取得 → JS で studentId フィルタ
    // (where + orderBy の組み合わせは Firestore の複合インデックスが必要だが、
    //  handoffLog は小規模コレクションなので JS フィルタで十分)
    const snap = await db.collection('handoffLog')
      .orderBy('createdAt', 'desc')
      .limit(200).get();
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(e => e.studentId === studentId)
      .slice(0, limitCount);
  },
  async getRecent(role, limitCount = 20) {
    // composite index 回避: orderBy のみで取得 → JS で classroomId + visibleTo フィルタ
    const snap = await db.collection('handoffLog')
      .orderBy('createdAt', 'desc')
      .limit(limitCount * 4).get();
    const currentClass = currentClassroomId();
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(e => !e.classroomId || e.classroomId === currentClass)
      .filter(e => Array.isArray(e.visibleTo) && e.visibleTo.includes(role))
      .slice(0, limitCount);
  },
  async getUnread(role, limitCount = 20) {
    const recent = await HandoffLogDB.getRecent(role, limitCount * 2);
    return recent.filter(e => !(e.read && e.read[role])).slice(0, limitCount);
  },
  async markRead(id, role) {
    const ref = db.collection('handoffLog').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return;
    const read = doc.data().read || {};
    read[role] = true;
    await ref.update({ read });
  },
  async markActionTaken(id) {
    await db.collection('handoffLog').doc(id).update({ actionTaken: true });
  },
  async delete(id) {
    await db.collection('handoffLog').doc(id).delete();
  }
};

// --- ユーザー（Firebase Auth ユーザーのロール管理） ---
// owner / admin の区別のため。既存の admin ログインは継続。
const UsersDB = {
  async getByUid(uid) {
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists ? { uid: doc.id, ...doc.data() } : null;
  },
  async upsert(uid, data) {
    await db.collection('users').doc(uid).set({
      email: data.email || '',
      displayName: data.displayName || '',
      role: data.role || 'admin',                  // 'owner' | 'admin'
      classroomIds: data.classroomIds || ['default'],
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  },
  async setRole(uid, role) {
    await db.collection('users').doc(uid).update({ role });
  },
  async getAll() {
    const snap = await db.collection('users').get();
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  }
};

// --- マイグレーション: 既存データに classroomId を付与 ---
// 起動時に1回だけ実行（settings/migrations で完了フラグ管理）
async function migrateClassroomId() {
  try {
    const flagRef = db.collection('settings').doc('migrations');
    const flagDoc = await flagRef.get();
    if (flagDoc.exists && flagDoc.data().classroomIdAdded) {
      return { skipped: true };
    }

    // default 教室を保証
    await ClassroomsDB.ensureDefault();

    // マイグレーション対象コレクション
    const targets = [
      'students', 'teachers', 'studyLogs', 'tasks', 'taskCompletions',
      'shifts', 'scheduleTemplates', 'scheduleSlots', 'teacherComments',
      'messages', 'badges', 'conditions', 'examResults', 'examSchedules',
      'prizes', 'purchases', 'interviewRecords', 'operationTasks', 'reportLogs'
    ];

    let migrated = 0;
    for (const coll of targets) {
      try {
        const snap = await db.collection(coll).get();
        const batch = db.batch();
        let batchCount = 0;
        for (const doc of snap.docs) {
          if (!doc.data().classroomId) {
            batch.update(doc.ref, { classroomId: 'default' });
            batchCount++;
            migrated++;
            // Firestore バッチは500件まで
            if (batchCount >= 400) {
              await batch.commit();
              batchCount = 0;
            }
          }
        }
        if (batchCount > 0) await batch.commit();
      } catch (e) {
        console.warn('[migrateClassroomId] collection skipped:', coll, e.message);
      }
    }

    await flagRef.set({ classroomIdAdded: true, migratedCount: migrated, migratedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    console.log(`[migrateClassroomId] completed: ${migrated} documents migrated`);
    return { migrated };
  } catch (e) {
    console.error('[migrateClassroomId] failed:', e);
    return { error: e.message };
  }
}

if (typeof window !== 'undefined') {
  window.ClassroomsDB = ClassroomsDB;
  window.HandoffLogDB = HandoffLogDB;
  window.UsersDB = UsersDB;
  window.migrateClassroomId = migrateClassroomId;
}

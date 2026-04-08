// ============================================
// Feature 9 / Phase 2: TeacherContextResolver
// ============================================
// 講師バディ・教室長バディが「今の現場」を把握するためのヘルパー。
// js/student-context.js に依存（getStudentContext を使う）。
// ============================================

(function() {
  'use strict';

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function weekRange() {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() + 1); // 月曜
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // 日曜
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }

  // ----- 講師バディ用: 自分の今日の現場を取得 -----
  // teacherId: 担当講師の ID
  async function getTeacherContext(teacherId) {
    if (!teacherId) return null;
    const today = todayStr();

    const safe = async (fn, fb) => {
      try { return await fn(); } catch (e) {
        console.warn('[getTeacherContext] fetch failed:', e.message);
        return fb;
      }
    };

    const [teacher, todaySlots, recentHandoffs] = await Promise.all([
      safe(() => TeachersDB.getById(teacherId), null),
      safe(() => ScheduleSlotsDB.getByDate(today), []),
      safe(() => HandoffLogDB.getRecent('teacher', 10), []),
    ]);

    // 自分が担当する今日のスロットだけ抽出
    const mySlots = todaySlots
      .filter(s => s.teacherId === teacherId)
      .sort((a, b) => (a.timeSlot || '').localeCompare(b.timeSlot || ''));

    // 担当生徒 ID を抽出（重複排除）
    const myStudentIds = [...new Set(mySlots.map(s => s.studentId).filter(Boolean))];

    // 各担当生徒の context を並列取得（viewerRole='teacher'）
    const studentContexts = await Promise.all(
      myStudentIds.map(id => safe(
        () => StudentContext.getStudentContext(id, 'teacher'),
        null
      ))
    );

    return {
      teacher,
      today,
      todaySlots: mySlots,
      studentContexts: studentContexts.filter(Boolean),
      recentHandoffs,
    };
  }

  // ----- 教室長バディ用: 教室全体の現場を取得 -----
  async function getDirectorContext(directorId) {
    const today = todayStr();
    const week = weekRange();

    const safe = async (fn, fb) => {
      try { return await fn(); } catch (e) {
        console.warn('[getDirectorContext] fetch failed:', e.message);
        return fb;
      }
    };

    const [
      director,
      allTeachers,
      allStudents,
      todaySlots,
      pendingLogs,
      recentHandoffs,
      todayComments,
    ] = await Promise.all([
      safe(() => directorId ? TeachersDB.getById(directorId) : null, null),
      safe(() => TeachersDB.getActive(), []),
      safe(() => StudentsDB.getAll(), []),
      safe(() => ScheduleSlotsDB.getByDate(today), []),
      safe(() => StudyLogsDB.getPending(), []),
      safe(() => HandoffLogDB.getRecent('director', 15), []),
      safe(() => TeacherCommentsDB.getByDate(today), []),
    ]);

    // KPI 計算
    const todayComplete = todaySlots.filter(s => s.status === 'completed').length;
    const todayAbsent = todaySlots.filter(s => s.status === 'absent').length;

    return {
      director,
      today,
      week,
      teachers: allTeachers,
      students: allStudents,
      todaySlots,
      pendingLogs,
      recentHandoffs,
      todayComments,
      kpi: {
        studentCount: allStudents.length,
        teacherCount: allTeachers.length,
        todaySlotCount: todaySlots.length,
        todayCompleteCount: todayComplete,
        todayAbsentCount: todayAbsent,
        pendingHomeStudyCount: pendingLogs.length,
      },
    };
  }

  // ----- プロンプト埋め込み用テキスト化 (講師向け) -----
  function formatTeacherContextForPrompt(ctx) {
    if (!ctx) return '';
    const lines = [];
    const t = ctx.teacher || {};
    lines.push(`【あなたが支援している講師】`);
    lines.push(`  名前: ${t.name || '不明'}`);
    if (t.subjects && t.subjects.length) lines.push(`  担当科目: ${t.subjects.join(', ')}`);
    if (t.maxStudents) lines.push(`  最大担当生徒数: ${t.maxStudents}`);

    if (ctx.todaySlots && ctx.todaySlots.length > 0) {
      lines.push('');
      lines.push(`【今日の担当授業 (${ctx.today})】`);
      ctx.todaySlots.forEach(s => {
        lines.push(`  ・${s.timeSlot || ''} ${s.subject || ''} - ${s.studentName || ''}${s.status && s.status !== 'scheduled' ? ' [' + s.status + ']' : ''}${s.memo ? ' / ' + s.memo : ''}`);
      });
    } else {
      lines.push('');
      lines.push('【今日の担当授業】 なし');
    }

    if (ctx.studentContexts && ctx.studentContexts.length > 0) {
      lines.push('');
      lines.push('【担当生徒の状況サマリー】');
      ctx.studentContexts.forEach(sc => {
        if (!sc || !sc.student) return;
        const s = sc.student;
        const name = s.callsign || s.nickname || s.name || '生徒';
        lines.push(`  ◆ ${name}（${s.grade || '?'}）${s.weakSubject ? ' - 苦手: ' + s.weakSubject : ''}`);
        // 最近の講師コメント (1-2件)
        if (sc.recentComments && sc.recentComments.length > 0) {
          sc.recentComments.slice(0, 2).forEach(c => {
            lines.push(`    最近のコメント (${c.date || ''}): 態度=${c.attitude || '?'} 理解=${c.understanding || '?'}${c.note ? ' / ' + c.note : ''}`);
          });
        }
        // 未完了の宿題 (1件)
        if (sc.pendingTasks && sc.pendingTasks.length > 0) {
          lines.push(`    未完了タスク: ${sc.pendingTasks[0].title}${sc.pendingTasks.length > 1 ? ` 他${sc.pendingTasks.length - 1}件` : ''}`);
        }
      });
    }

    if (ctx.recentHandoffs && ctx.recentHandoffs.length > 0) {
      lines.push('');
      lines.push('【最近の申し送り（教室長/他講師から）】');
      ctx.recentHandoffs.slice(0, 5).forEach(h => {
        const isUnread = !(h.read && h.read.teacher);
        lines.push(`  ${isUnread ? '🆕' : ' '} [${h.type || '?'}] ${h.summary || ''}${h.studentName ? '（' + h.studentName + '）' : ''}`);
      });
    }

    return lines.join('\n');
  }

  // ----- プロンプト埋め込み用テキスト化 (教室長向け) -----
  function formatDirectorContextForPrompt(ctx) {
    if (!ctx) return '';
    const lines = [];
    lines.push(`【教室全体の状況 (${ctx.today})】`);
    lines.push(`  在籍生徒数: ${ctx.kpi.studentCount}名`);
    lines.push(`  講師数: ${ctx.kpi.teacherCount}名`);
    lines.push(`  今日の授業数: ${ctx.kpi.todaySlotCount}コマ（完了: ${ctx.kpi.todayCompleteCount} / 欠席: ${ctx.kpi.todayAbsentCount}）`);
    lines.push(`  家庭学習の承認待ち: ${ctx.kpi.pendingHomeStudyCount}件`);

    if (ctx.teachers && ctx.teachers.length > 0) {
      lines.push('');
      lines.push('【今日のシフト・担当】');
      ctx.teachers.forEach(t => {
        const mySlots = ctx.todaySlots.filter(s => s.teacherId === t.id);
        if (mySlots.length > 0) {
          lines.push(`  ${t.name}（${t.role === 'director' ? '教室長' : '講師'}）: ${mySlots.length}コマ`);
        }
      });
    }

    if (ctx.todayComments && ctx.todayComments.length > 0) {
      lines.push('');
      lines.push('【今日の講師コメント (最新 5 件)】');
      ctx.todayComments.slice(0, 5).forEach(c => {
        lines.push(`  ・${c.teacherName || '?'} → ${c.studentName || '?'}: ${c.note || '(なし)'}`);
      });
    }

    if (ctx.recentHandoffs && ctx.recentHandoffs.length > 0) {
      lines.push('');
      lines.push('【最近の申し送り】');
      ctx.recentHandoffs.slice(0, 7).forEach(h => {
        const isUnread = !(h.read && h.read.director);
        lines.push(`  ${isUnread ? '🆕' : ' '} [${h.type || '?'}] ${h.summary || ''}${h.studentName ? '（' + h.studentName + '）' : ''} - by ${h.sourceRole || '?'}`);
      });
    }

    return lines.join('\n');
  }

  // ----- 公開 API -----
  window.TeacherContext = {
    getTeacherContext,
    getDirectorContext,
    formatTeacherContextForPrompt,
    formatDirectorContextForPrompt,
  };
})();

// ============================================
// Feature 9: StudentContextResolver
// ============================================
// 生徒の「今の状況」を1つのオブジェクトにまとめるヘルパー。
// 各バディ（生徒/講師/教室長/オーナー）の buildSystemPrompt から呼ばれ、
// プロンプトに埋め込むコンテキストを提供する。
// viewerRole によってフィルタ（生徒バディ向けは buddyVisible なメモのみ等）。
// ============================================

(function() {
  'use strict';

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function weekLaterStr(fromStr) {
    const d = new Date(fromStr + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }

  // viewerRole: 'student' | 'teacher' | 'director' | 'owner'
  async function getStudentContext(studentId, viewerRole) {
    if (!studentId) return null;
    viewerRole = viewerRole || 'student';
    const today = todayStr();

    // 必要なデータを並列取得
    const safeCall = async (fn, fallback) => {
      try { return await fn(); } catch (e) {
        console.warn('[getStudentContext] fetch failed:', e.message);
        return fallback;
      }
    };

    const [student, todaySlots, weekSlots, activeTasks, completions, comments, messages, personalGoals] = await Promise.all([
      safeCall(() => StudentsDB.getById(studentId), null),
      safeCall(() => ScheduleSlotsDB.getByStudent(studentId, today, today), []),
      safeCall(() => ScheduleSlotsDB.getByStudent(studentId, today, weekLaterStr(today)), []),
      safeCall(() => TasksDB.getActive(), []),
      safeCall(() => TasksDB.getCompletions(studentId), []),
      safeCall(() => TeacherCommentsDB.getByStudent(studentId, 5), []),
      safeCall(() => (MessagesDB.getByStudentRecent ? MessagesDB.getByStudentRecent(studentId, 5) : []), []),
      // Phase X5: 個人目標の進捗をコンテキストに含める
      safeCall(() => (typeof PersonalGoalsDB !== 'undefined' ? PersonalGoalsDB.getCurrentWeekByStudent(studentId) : []), []),
    ]);

    // 生徒バディには buddyVisible フラグによるフィルタ適用
    const visibleComments = (viewerRole === 'student')
      ? comments.filter(c => c.buddyVisible === true)
      : comments;

    const visibleSlots = todaySlots.map(s => ({
      ...s,
      memo: (viewerRole === 'student' && !s.memoBuddyVisible) ? '' : (s.memo || '')
    }));

    const visibleWeekSlots = weekSlots.map(s => ({
      ...s,
      memo: (viewerRole === 'student' && !s.memoBuddyVisible) ? '' : (s.memo || '')
    }));

    // 未完了タスクを抽出（全アクティブタスクから完了済みを除く）
    const completedTaskIds = new Set(completions.map(c => c.taskId));
    const pendingTasks = activeTasks.filter(t => !completedTaskIds.has(t.id));

    // Phase X5: 個人目標の進捗を計算
    let goalsWithProgress = [];
    try {
      if (personalGoals.length > 0 && typeof PersonalGoalsDB !== 'undefined') {
        goalsWithProgress = await Promise.all(personalGoals.map(async g => ({
          ...g,
          _progress: await PersonalGoalsDB.calculateProgress(g),
        })));
      }
    } catch(e) { console.warn('[getStudentContext] goals progress failed:', e); }

    return {
      student,
      today,
      viewerRole,
      todaySchedule: visibleSlots,
      weekSchedule: visibleWeekSlots,
      pendingTasks,
      recentComments: visibleComments,
      recentMessages: messages,
      personalGoals: goalsWithProgress,
    };
  }

  // ----- プロンプト埋め込み用にテキスト化 -----
  // 生徒バディ向け: 生徒に配慮した書き方（直接的な機微情報は避ける）
  // 講師/教室長向け: 詳細情報を含む
  function formatContextForPrompt(ctx, viewerRole) {
    if (!ctx) return '';
    viewerRole = viewerRole || ctx.viewerRole || 'student';
    const name = (ctx.student && (ctx.student.callsign || ctx.student.nickname || ctx.student.name)) || '生徒';
    const lines = [`【本日 ${ctx.today} の${name}の状況】`];

    // 今日の授業
    if (ctx.todaySchedule && ctx.todaySchedule.length > 0) {
      lines.push('■ 今日の授業予定');
      ctx.todaySchedule.forEach(s => {
        let line = `  ・${s.timeSlot || ''} ${s.subject || ''}`;
        if (s.teacherName) line += `（${s.teacherName}先生）`;
        if (s.status && s.status !== 'scheduled') line += ` [${s.status}]`;
        if (s.memo) line += ` / ${s.memo}`;
        lines.push(line);
      });
    } else {
      lines.push('■ 今日は授業の予定なし');
    }

    // 今週の残りの授業（簡略）
    if (ctx.weekSchedule && ctx.weekSchedule.length > ctx.todaySchedule.length && viewerRole !== 'student') {
      const future = ctx.weekSchedule.filter(s => s.date > ctx.today).slice(0, 5);
      if (future.length > 0) {
        lines.push('■ 今週の残り授業');
        future.forEach(s => {
          lines.push(`  ・${s.date} ${s.timeSlot || ''} ${s.subject || ''}${s.teacherName ? '（'+s.teacherName+'）' : ''}`);
        });
      }
    }

    // 未完了タスク
    if (ctx.pendingTasks && ctx.pendingTasks.length > 0) {
      lines.push('■ 取り組める宿題・チャレンジ');
      ctx.pendingTasks.slice(0, 5).forEach(t => {
        lines.push(`  ・${t.title}${t.points ? '（+' + t.points + 'pt）' : ''}`);
      });
    }

    // 講師コメント
    if (ctx.recentComments && ctx.recentComments.length > 0) {
      lines.push(viewerRole === 'student' ? '■ 講師からの最近のメッセージ' : '■ 最近の講師コメント');
      ctx.recentComments.slice(0, 3).forEach(c => {
        let line = `  ${c.date || ''} ${c.teacherName || '講師'}:`;
        if (c.subjects && c.subjects.length > 0) line += ` [${c.subjects.join('/')}]`;
        if (c.attitude) line += ` 態度=${c.attitude}`;
        if (c.understanding) line += ` 理解度=${c.understanding}`;
        if (c.note) line += ` / ${c.note}`;
        lines.push(line);
      });
    }

    // 志望校
    if (ctx.student && ctx.student.targetUniversities && ctx.student.targetUniversities.length > 0) {
      const targets = ctx.student.targetUniversities.map(u => u.faculty || u.id || '').filter(Boolean).join('、');
      if (targets) lines.push(`■ 志望大学: ${targets}`);
    }
    if (ctx.student && ctx.student.targetJuniorHighs && ctx.student.targetJuniorHighs.length > 0) {
      const targets = ctx.student.targetJuniorHighs.map(u => u.faculty || u.id || '').filter(Boolean).join('、');
      if (targets) lines.push(`■ 志望中学: ${targets}`);
    }
    if (ctx.student && ctx.student.targetStation) {
      lines.push(`■ 志望高校: ${ctx.student.targetStation}`);
    }

    // Phase X5: 個人目標の進捗 (バディの励ましに使用)
    if (ctx.personalGoals && ctx.personalGoals.length > 0) {
      lines.push('■ 今週の個人目標');
      ctx.personalGoals.forEach(g => {
        const pct = g._progress ? Math.round(g._progress.pct || 0) : 0;
        const statusLabel = g.status === 'pending_approval' ? '承認待ち'
          : g.status === 'achieved' ? '🎉達成!'
          : g.status === 'missed' ? '😢未達成'
          : `進捗${pct}%`;
        const remaining = g._progress ? `(現在 ${(Math.round((g._progress.current || 0) * 10) / 10)} / 目標 ${g.target} ${g.unit || ''})` : '';
        lines.push(`  ・${g.title || g.type}: ${statusLabel} ${remaining}`);
        if (g.consecutiveMisses >= 2 && viewerRole !== 'student') {
          lines.push(`    ⚠️ ${g.consecutiveMisses}週連続未達成 — コーチング介入推奨`);
        }
      });
      // 生徒向け: 進捗が低い場合は励ましヒントを追加
      if (viewerRole === 'student') {
        const activeGoals = ctx.personalGoals.filter(g => g.status === 'active');
        const lowProgress = activeGoals.filter(g => g._progress && g._progress.pct < 50);
        if (lowProgress.length > 0) {
          lines.push('  → まだ半分に達していない目標があります。この生徒にポジティブに励ましの声をかけてください。');
        }
      }
    }

    // 講師からの直接メッセージ（未読）
    if (ctx.recentMessages && ctx.recentMessages.length > 0) {
      const unread = ctx.recentMessages.filter(m => !m.read && m.fromType === 'teacher');
      if (unread.length > 0) {
        lines.push('■ 講師からの未読メッセージ');
        unread.slice(0, 2).forEach(m => {
          lines.push(`  ・${m.content || ''}`);
        });
      }
    }

    return lines.join('\n');
  }

  // ----- HandoffLog 書き込みプロンプトの指示テキスト -----
  // 各バディの system prompt に追加する。返答の末尾に <<HANDOFF>> ブロックを
  // 混ぜさせ、サーバ側で抽出して HandoffLogDB.add() する。
  function getHandoffInstructionForRole(role) {
    const visibleTargets = {
      'student': 'teacher,director',              // 生徒バディ → 講師・教室長に申し送り
      'teacher': 'director',                       // 講師バディ → 教室長に申し送り
      'director': 'owner',                         // 教室長バディ → オーナーに申し送り
      'owner': 'director',                         // オーナーバディ → 教室長へ指示
    };
    const targets = visibleTargets[role] || 'teacher,director';
    return `

【重要事項の申し送り】
会話の中で「大人（講師・教室長・オーナー）に伝えるべき重要事項」を察知した場合のみ、返答の末尾に以下の形式で記録してください。この部分は相手には見えません（システムが抽出します）:

<<HANDOFF type="alert|observation|request|decision" visibleTo="${targets}">
ここに 1-2 文の要約。何が起きたか、何を提案するか。
</HANDOFF>>

使うべきタイミング:
- alert: 緊急度高。生徒の心身・家庭・学習に要注意な兆候を感じた時
- observation: 重要だが緊急ではない気付き。成長・変化の記録
- request: 具体的な要望（「次回〇〇してあげて」等）
- decision: 話し合いで決まった方針・約束

使わないタイミング:
- 雑談・軽い質問への普通の返答
- 既に handoffLog に記録されている内容

複数ある場合は複数ブロックを並べて OK。使う必要がなければ書かないでください。`;
  }

  // ----- バディ返答から <<HANDOFF>> ブロックを抽出 + 生徒表示から除去 -----
  // 戻り値: { cleanText: '...', handoffs: [{type, visibleTo, summary}] }
  function parseAndStripHandoffs(text) {
    if (!text) return { cleanText: text || '', handoffs: [] };
    const handoffs = [];
    const pattern = /<<HANDOFF\s+type="([^"]+)"\s+visibleTo="([^"]+)">([\s\S]*?)<\/HANDOFF>>/g;
    let cleanText = text.replace(pattern, (m, type, visibleTo, body) => {
      handoffs.push({
        type: type.trim(),
        visibleTo: visibleTo.split(',').map(s => s.trim()).filter(Boolean),
        summary: body.trim(),
      });
      return ''; // 表示テキストから除去
    });
    // 末尾の余分な改行を整理
    cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();
    return { cleanText, handoffs };
  }

  // ----- HandoffLog へ書き込むヘルパー -----
  async function writeHandoffs(handoffs, meta) {
    if (!handoffs || handoffs.length === 0) return;
    if (typeof HandoffLogDB === 'undefined') return;
    for (const h of handoffs) {
      try {
        await HandoffLogDB.add({
          studentId: meta.studentId || null,
          studentName: meta.studentName || '',
          sourceRole: meta.sourceRole || 'student-buddy',
          sourceId: meta.sourceId || '',
          sourceName: meta.sourceName || '',
          type: h.type || 'observation',
          summary: h.summary || '',
          visibleTo: h.visibleTo || ['teacher', 'director'],
        });
      } catch (e) {
        console.warn('[writeHandoffs] failed:', e);
      }
    }
  }

  // ----- 公開 API -----
  window.StudentContext = {
    getStudentContext,
    formatContextForPrompt,
    getHandoffInstructionForRole,
    parseAndStripHandoffs,
    writeHandoffs,
  };
})();

/**
 * 初期データ投入スクリプト
 *
 * 使い方:
 *   1. https://hero-s-points.web.app にアクセス（管理者としてログイン済みの状態で）
 *   2. ブラウザのDevTools（F12）→ Consoleタブを開く
 *   3. 以下のコードをコピペして実行
 *
 * 注意: 各関数は1回だけ実行してください（重複データが作られます）
 */

// ===== 4月ストーリーチャプター =====
async function seedAprilStory() {
  const id = await StoryDB.create({
    title: 'LAUNCH: 発進と軌道投入',
    month: '2026-04',
    routes: [
      {
        id: 'ideal',
        name: '理想ルート: 完全発進',
        icon: '🚀',
        desc: 'クラス全体でポモドーロ200回達成',
        metric: 'total_pomodoros',
        targetValue: 200,
        reward: { points: 100 },
        ending: { title: '完全発進成功！', text: '全クルーが一丸となり、宇宙船は完璧な軌道に乗った。この勢いで5月の探索フェーズへ突入だ！' }
      },
      {
        id: 'standard',
        name: '標準ルート: 軌道到達',
        icon: '🛸',
        desc: 'クラス全体で学習100時間達成',
        metric: 'total_study_hours',
        targetValue: 100,
        reward: { points: 50 },
        ending: { title: '軌道投入成功', text: '若干の遅れはあったが、宇宙船は無事に軌道に乗った。次のミッションに向けて準備を進めよう。' }
      },
      {
        id: 'fallback',
        name: 'フォールバック: 緊急発進',
        icon: '⚠️',
        desc: '上記未達成の場合',
        metric: 'fallback',
        targetValue: 0,
        reward: { points: 20 },
        ending: { title: '緊急発進', text: '予定通りとはいかなかったが、なんとか宇宙へ飛び出すことはできた。5月で巻き返そう！' }
      }
    ],
    weeklyTexts: [
      '第1週: 発進準備 — 全クルー、持ち場につけ！エンジン点火まであと少しだ。',
      '第2週: カウントダウン — 3, 2, 1... メインエンジン始動！学習ポモドーロを積み上げろ！',
      '第3週: 大気圏突破 — 重力に負けるな！ここが正念場だ。コンボを発動して加速せよ！',
      '第4週: 軌道投入判定 — 最終週。目標達成なるか？全クルーの力を結集せよ！'
    ]
  });
  console.log('✅ 4月ストーリーチャプター作成完了 ID:', id);
  return id;
}

// ===== 4月レイドボス =====
async function seedAprilBoss() {
  const id = await RaidBossDB.create({
    name: '重力の番人ガルヴァトン',
    icon: '🌑',
    maxHp: 5000,
    reward: 100
  });
  // 弱点・耐性・特殊能力を追加
  await db.collection('raidBosses').doc(id).update({
    weakness: '数学',
    resistance: '英語',
    specialAbility: {
      type: 'minDuration',
      value: 15,
      desc: '15分未満の学習ではダメージを与えられない'
    },
    month: '2026-04'
  });
  console.log('✅ 4月レイドボス作成完了 ID:', id);
  console.log('   名前: 重力の番人ガルヴァトン');
  console.log('   HP: 5000 / 弱点: 数学 / 耐性: 英語');
  console.log('   特殊能力: 15分未満の学習無効');
  return id;
}

// ===== テスト生徒20名一括登録 =====
async function seedStudents() {
  const students = [
    { name: '田中 太郎',   nickname: 'たろう',   callsign: 'Taro-1',    pin: '1001', grade: '中1', school: 'nobeoka_east' },
    { name: '佐藤 花子',   nickname: 'はなこ',   callsign: 'Hana-2',    pin: '1002', grade: '中1', school: 'nobeoka_east' },
    { name: '鈴木 一郎',   nickname: 'いちろう', callsign: 'Ichi-3',    pin: '1003', grade: '中2', school: 'nobeoka_west' },
    { name: '高橋 美咲',   nickname: 'みさき',   callsign: 'Misa-4',    pin: '1004', grade: '中2', school: 'nobeoka_west' },
    { name: '渡辺 大輝',   nickname: 'だいき',   callsign: 'Daiki-5',   pin: '1005', grade: '中3', school: 'nobeoka_east', targetStation: 'nobeoka_h' },
    { name: '伊藤 さくら', nickname: 'さくら',   callsign: 'Sakura-6',  pin: '1006', grade: '中3', school: 'nobeoka_east', targetStation: 'nobeoka_seiun' },
    { name: '山本 健太',   nickname: 'けんた',   callsign: 'Kenta-7',   pin: '1007', grade: '中3', school: 'nobeoka_west', targetStation: 'nobeoka_h' },
    { name: '中村 あおい', nickname: 'あおい',   callsign: 'Aoi-8',     pin: '1008', grade: '小5', school: null },
    { name: '小林 翔太',   nickname: 'しょうた', callsign: 'Shota-9',   pin: '1009', grade: '小6', school: null, examCandidate: true },
    { name: '加藤 ひなた', nickname: 'ひなた',   callsign: 'Hina-10',   pin: '1010', grade: '小4', school: null },
    { name: '吉田 蓮',     nickname: 'れん',     callsign: 'Ren-11',    pin: '1011', grade: '高1', school: null },
    { name: '山田 結衣',   nickname: 'ゆい',     callsign: 'Yui-12',    pin: '1012', grade: '高2', school: null },
    { name: '松本 悠真',   nickname: 'ゆうま',   callsign: 'Yuma-13',   pin: '1013', grade: '中1', school: 'nobeoka_east' },
    { name: '井上 凛',     nickname: 'りん',     callsign: 'Rin-14',    pin: '1014', grade: '中2', school: 'nobeoka_west' },
    { name: '木村 陸',     nickname: 'りく',     callsign: 'Riku-15',   pin: '1015', grade: '中3', school: 'nobeoka_east', targetStation: 'nobeoka_seiun' },
    { name: '林 七海',     nickname: 'ななみ',   callsign: 'Nana-16',   pin: '1016', grade: '小6', school: null },
    { name: '清水 颯太',   nickname: 'そうた',   callsign: 'Sota-17',   pin: '1017', grade: '中1', school: 'nobeoka_west' },
    { name: '森 楓',       nickname: 'かえで',   callsign: 'Kaede-18',  pin: '1018', grade: '中2', school: 'nobeoka_east' },
    { name: '阿部 陽菜',   nickname: 'はるな',   callsign: 'Haru-19',   pin: '1019', grade: '高1', school: null },
    { name: '藤田 大地',   nickname: 'だいち',   callsign: 'Dai-20',    pin: '1020', grade: '中3', school: 'nobeoka_west', targetStation: 'nobeoka_ko' },
  ];

  console.log('👥 テスト生徒20名を登録します...');
  for (const s of students) {
    try {
      const id = await StudentsDB.add({
        name: s.name,
        nickname: s.nickname,
        callsign: s.callsign,
        pin: s.pin,
        grade: s.grade || null,
        school: s.school || null,
        targetStation: s.targetStation || null,
        examCandidate: s.examCandidate || false,
        totalPoints: 0,
        currentPoints: 0,
        totalEarned: 0,
        totalSpent: 0,
        streak: 0,
        bestStreak: 0,
        level: 1,
        rank: 'rookie',
      });
      console.log(`  ✅ ${s.callsign} (${s.name}) PIN:${s.pin} → ${id}`);
    } catch (e) {
      console.error(`  ❌ ${s.name}: ${e.message}`);
    }
  }
  console.log('🎉 生徒登録完了！');
}

// ===== まとめて実行 =====
async function seedAll() {
  console.log('🌟 初期データ投入を開始します...');
  await seedAprilStory();
  await seedAprilBoss();
  console.log('🎉 全ての初期データ投入が完了しました！');
}

// ============================================
// テスト用ヘルパー関数（Phase 12演出確認用）
// ============================================

// 指定生徒のポイントを99にセット → 1分学習でレベルアップ演出が見られる
async function setupLevelUpTest(nickname) {
  const all = await StudentsDB.getAll();
  const student = all.find(s => s.nickname === nickname || s.callsign === nickname);
  if (!student) {
    console.error(`❌ 生徒「${nickname}」が見つかりません`);
    return;
  }
  await StudentsDB.update(student.id, {
    totalPoints: 99,
    currentPoints: 99,
    level: 1
  });
  console.log(`✅ ${student.callsign || student.nickname} のポイントを99にセットしました`);
  console.log('   → 1分以上学習すると Lv.2 へのレベルアップ演出が見られます');
}

// 弱いレイドボスを作成 → 1分学習で討伐演出
async function setupBossDefeatTest() {
  const id = await RaidBossDB.create({
    name: 'テスト用スライム',
    icon: '👾',
    maxHp: 1,        // HP1なので1ダメージで討伐
    reward: 50
  });
  console.log(`✅ テスト用ボスを作成しました (HP:1)`);
  console.log('   → 1分以上学習すれば討伐演出が見られます');
  return id;
}

// 全テスト生徒のポイントをリセット
async function resetAllPoints() {
  const all = await StudentsDB.getAll();
  for (const s of all) {
    await StudentsDB.update(s.id, {
      totalPoints: 0, currentPoints: 0, totalEarned: 0,
      level: 1, streak: 0
    });
  }
  console.log(`✅ ${all.length}名のポイントをリセットしました`);
}

// アクティブなボスを全て削除
async function clearAllBosses() {
  const bosses = await RaidBossDB.getActive();
  for (const b of bosses) {
    await db.collection('raidBosses').doc(b.id).delete();
  }
  console.log(`✅ ${bosses.length}体のボスを削除しました`);
}

// 全機能テスト用セットアップ（おすすめ）
async function setupAllTests(nickname) {
  console.log('🧪 全機能テスト用セットアップを開始...');
  console.log(`   対象生徒: ${nickname}`);

  // 1. ポイントを99にセット → レベルアップテスト用
  await setupLevelUpTest(nickname);

  // 2. 弱いボスを作成 → 討伐テスト用
  await setupBossDefeatTest();

  // 3. オープニングを再表示するためフラグリセット
  const all = await StudentsDB.getAll();
  const student = all.find(s => s.nickname === nickname || s.callsign === nickname);
  if (student) {
    await StudentsDB.update(student.id, { seenOpening: false });
    console.log(`✅ ${student.callsign} のオープニング表示フラグをリセット`);
  }

  console.log('\n🎬 確認できる演出:');
  console.log('   1. ログイン → オープニング演出');
  console.log('   2. ホーム画面 → ガイドスポットライト (3ステップ)');
  console.log('   3. コンディション記録 → SE');
  console.log('   4. クエスト選択 → ⚔️ SE');
  console.log('   5. 1分以上学習して終了 → ');
  console.log('       - 紙吹雪 + ポイント獲得SE');
  console.log('       - レベルアップ演出 (リング+星バースト+音)');
  console.log('       - ボス討伐演出 (爆発+VICTORY!)');
  console.log('\n🚀 ' + nickname + ' でログインして試してください！');
  console.log('\n⚠️  ガイドを再表示したい場合は localStorage.clear() も実行してください');
}

// 実行: seedAll()

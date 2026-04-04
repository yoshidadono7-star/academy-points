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

// ===== まとめて実行 =====
async function seedAll() {
  console.log('🌟 初期データ投入を開始します...');
  await seedAprilStory();
  await seedAprilBoss();
  console.log('🎉 全ての初期データ投入が完了しました！');
}

// 実行: seedAll()

// MiniResult - ミニゲーム共通の結果画面オーバーレイ
//
// 使い方:
//   MiniResult.show(this, {
//     title: 'リザルト',
//     titleColor: '#a78bfa',
//     lines: ['せいかい数  7 / 12', 'せいかい率  58%'],
//     rank: 'A',
//     rankColor: '#10b981',
//     gold: 40,
//     flavor: CaptainMichael.rankLine('A'),
//     onBack: () => this.returnHub(result),
//   });

const MiniResult = {
  show(scene, opts) {
    const title = opts.title || 'リザルト';
    const titleColor = opts.titleColor || Style.colors.accent;
    const lines = opts.lines || [];
    const rank = opts.rank || 'C';
    const rankColor = opts.rankColor || Style.colors.textDim;
    const gold = typeof opts.gold === 'number' ? opts.gold : 0;
    const flavor = opts.flavor || '';
    const onBack = opts.onBack || (() => {});

    const depthBase = 500;

    const overlay = scene.add.graphics().setDepth(depthBase);
    overlay.fillStyle(Style.intColors.bgDeep, 0.88);
    overlay.fillRect(0, 0, 800, 600);

    // 星の散りばめ
    const rng = new Phaser.Math.RandomDataGenerator(['result-stars', Date.now().toString()]);
    const stars = scene.add.graphics().setDepth(depthBase + 1);
    for (let i = 0; i < 60; i++) {
      stars.fillStyle(rng.pick([0x9ca3af, 0xfde68a, 0xffffff]), rng.realInRange(0.4, 0.9));
      stars.fillRect(rng.between(0, 800), rng.between(0, 600), rng.pick([1, 1, 2]), rng.pick([1, 1, 2]));
    }

    const container = scene.add.container(0, 0).setDepth(depthBase + 2);

    // カード背景
    const cardX = 200, cardY = 90;
    const cardW = 400, cardH = 420;
    const rankInt = Phaser.Display.Color.HexStringToColor(rankColor).color;

    // 外側グロー
    const outerGlow = scene.add.graphics();
    outerGlow.fillStyle(rankInt, 0.15);
    outerGlow.fillRoundedRect(cardX - 14, cardY - 14, cardW + 28, cardH + 28, 20);
    container.add(outerGlow);

    const cardBg = scene.add.graphics();
    cardBg.fillStyle(Style.intColors.panel, 0.98);
    cardBg.fillRoundedRect(cardX, cardY, cardW, cardH, 16);
    cardBg.lineStyle(3, rankInt, 0.95);
    cardBg.strokeRoundedRect(cardX, cardY, cardW, cardH, 16);
    container.add(cardBg);

    // タイトル
    const titleText = scene.add.text(400, cardY + 30, title, {
      fontFamily: Style.fonts.jp, fontSize: '22px',
      color: titleColor, fontStyle: '700'
    }).setOrigin(0.5);
    container.add(titleText);

    // ディバイダー
    const divider = scene.add.graphics();
    divider.lineStyle(1, rankInt, 0.4);
    divider.lineBetween(cardX + 40, cardY + 58, cardX + cardW - 40, cardY + 58);
    container.add(divider);

    // スコア行
    const scoreText = scene.add.text(400, cardY + 90, lines.join('\n'), {
      fontFamily: Style.fonts.jp, fontSize: '14px',
      color: Style.colors.textMuted, align: 'center', lineSpacing: 8,
    }).setOrigin(0.5, 0);
    container.add(scoreText);

    // ランク
    const rankText = scene.add.text(400, cardY + 180, rank, {
      fontFamily: Style.fonts.en, fontSize: '90px',
      color: rankColor, fontStyle: '900'
    }).setOrigin(0.5);
    rankText.setScale(0);
    scene.tweens.add({
      targets: rankText, scale: 1, duration: 420, ease: 'Back.easeOut'
    });
    container.add(rankText);

    // ゴールド獲得
    const goldText = scene.add.text(400, cardY + 260, `+ ${gold} ゴールド`, {
      fontFamily: Style.fonts.jp, fontSize: '22px',
      color: Style.colors.accent, fontStyle: '700'
    }).setOrigin(0.5);
    container.add(goldText);

    // 艦長マイケルフレーバー
    if (flavor) {
      const flavorBg = scene.add.graphics();
      flavorBg.fillStyle(Style.intColors.bgDeep, 0.85);
      flavorBg.fillRoundedRect(cardX + 20, cardY + 290, cardW - 40, 54, 8);
      flavorBg.lineStyle(1, Style.intColors.accent, 0.5);
      flavorBg.strokeRoundedRect(cardX + 20, cardY + 290, cardW - 40, 54, 8);
      container.add(flavorBg);

      const badge = scene.add.text(cardX + 32, cardY + 298, '★ 艦長マイケル', {
        fontFamily: Style.fonts.jp, fontSize: '10px',
        color: Style.colors.accent, fontStyle: '700'
      });
      container.add(badge);

      const flavorText = scene.add.text(cardX + 32, cardY + 316, flavor, {
        fontFamily: Style.fonts.jp, fontSize: '12px',
        color: Style.colors.textMuted,
        wordWrap: { width: cardW - 60 }
      });
      container.add(flavorText);
    }

    // 戻るボタン
    const backBtn = Style.button(scene, 400, cardY + cardH - 38, 'アーケードに戻る', {
      variant: 'primary', size: 'md'
    });
    backBtn.on('pointerdown', () => {
      scene.input.keyboard.off('keydown-SPACE', spaceHandler);
      scene.input.keyboard.off('keydown-ENTER', enterHandler);
      onBack();
    });
    container.add(backBtn);

    // カード全体の登場アニメ
    container.setAlpha(0);
    scene.tweens.add({
      targets: container, alpha: 1, duration: 280, ease: 'Quad.easeOut'
    });

    const spaceHandler = () => onBack();
    const enterHandler = () => onBack();
    scene.input.keyboard.once('keydown-SPACE', spaceHandler);
    scene.input.keyboard.once('keydown-ENTER', enterHandler);
  },
};

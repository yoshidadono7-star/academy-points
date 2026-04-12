// MinigameQuit - ミニゲーム共通「やめる」ボタン + 確認モーダル
//
// 使い方:
//   MinigameQuit.attach(this, {
//     returnScene: this.returnScene,
//     onConfirm: () => { /* 任意のクリーンアップ */ },
//   });

const MinigameQuit = {
  attach(scene, opts = {}) {
    const returnScene = opts.returnScene || 'MinigameHubScene';
    const onConfirm = opts.onConfirm || (() => {});

    // 右上 (ヘッダーの下) に小さな [✕ やめる] ボタン
    const btn = scene.add.text(790, 70, '✕ やめる', {
      fontFamily: Style.fonts.jp, fontSize: '12px',
      color: Style.colors.textDim, backgroundColor: '#1f2937',
      padding: { x: 10, y: 5 }
    }).setOrigin(1, 0.5).setDepth(400).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => {
      btn.setColor(Style.colors.error);
      btn.setBackgroundColor('#3f1d1d');
    });
    btn.on('pointerout', () => {
      btn.setColor(Style.colors.textDim);
      btn.setBackgroundColor('#1f2937');
    });
    btn.on('pointerdown', () => this.showConfirm(scene, returnScene, onConfirm));

    return btn;
  },

  showConfirm(scene, returnScene, onConfirm) {
    const depthBase = 800;

    const overlay = scene.add.graphics().setDepth(depthBase);
    overlay.fillStyle(0x000000, 0.72);
    overlay.fillRect(0, 0, 800, 600);

    const boxW = 380, boxH = 170;
    const boxX = 400 - boxW / 2, boxY = 300 - boxH / 2;

    const box = scene.add.graphics().setDepth(depthBase + 1);
    box.fillStyle(Style.intColors.bgDeep, 0.98);
    box.fillRoundedRect(boxX, boxY, boxW, boxH, 14);
    box.lineStyle(2, Style.intColors.accent, 0.95);
    box.strokeRoundedRect(boxX, boxY, boxW, boxH, 14);

    const title = scene.add.text(400, boxY + 34, 'ゲームを中断しますか?', {
      fontFamily: Style.fonts.jp, fontSize: '17px',
      color: Style.colors.accent, fontStyle: '700'
    }).setOrigin(0.5).setDepth(depthBase + 2);

    const body = scene.add.text(400, boxY + 72, '途中でやめるとゴールドは獲得できません。', {
      fontFamily: Style.fonts.jp, fontSize: '12px',
      color: Style.colors.textMuted, align: 'center'
    }).setOrigin(0.5).setDepth(depthBase + 2);

    const cancelBtn = Style.button(scene, 320, boxY + boxH - 36, 'つづける', {
      variant: 'success', size: 'md'
    });
    cancelBtn.setDepth(depthBase + 2);

    const quitBtn = Style.button(scene, 480, boxY + boxH - 36, 'やめる', {
      variant: 'danger', size: 'md'
    });
    quitBtn.setDepth(depthBase + 2);

    const cleanup = () => {
      overlay.destroy();
      box.destroy();
      title.destroy();
      body.destroy();
      cancelBtn.destroy();
      quitBtn.destroy();
    };

    cancelBtn.on('pointerdown', cleanup);
    // オーバーレイタップでもキャンセル
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, 800, 600), Phaser.Geom.Rectangle.Contains);
    overlay.on('pointerdown', cleanup);

    quitBtn.on('pointerdown', () => {
      cleanup();
      try { onConfirm(); } catch (e) { console.error('[MinigameQuit] onConfirm error', e); }
      scene.cameras.main.fadeOut(250, 0, 0, 0);
      scene.cameras.main.once('camerafadeoutcomplete', () => {
        scene.scene.start(returnScene);
      });
    });
  },
};

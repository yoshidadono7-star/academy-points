// MinigameHowTo - 共通「あそびかた」オーバーレイ
//
// 各ミニゲームの create() からゲーム開始前に1回だけ呼ぶ:
//   MinigameHowTo.show(this, {
//     title: 'MATH FLASH — あそびかた',
//     lines: ['1. ...', '2. ...'],
//     accent: '#a78bfa',
//     onStart: () => this.startCountdown(),
//   });
//
// START ボタンをタップするか Enter/Space で閉じて onStart() を呼ぶ。

const MinigameHowTo = {
  show(scene, opts) {
    const title = opts.title || 'あそびかた';
    const lines = opts.lines || [];
    const accent = opts.accent || '#fbbf24';
    const onStart = opts.onStart || (() => {});

    const depthBase = 500;
    const overlay = scene.add.graphics().setDepth(depthBase);
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRect(0, 0, 800, 600);

    const box = scene.add.graphics().setDepth(depthBase + 1);
    const boxX = 120, boxY = 110, boxW = 560, boxH = 380;
    box.fillStyle(0x111827, 0.98);
    box.fillRoundedRect(boxX, boxY, boxW, boxH, 14);
    const accentInt = Phaser.Display.Color.HexStringToColor(accent).color;
    box.lineStyle(2, accentInt, 0.9);
    box.strokeRoundedRect(boxX, boxY, boxW, boxH, 14);

    const titleText = scene.add.text(400, boxY + 40, title, {
      fontFamily: (typeof Style !== 'undefined' ? Style.fonts.jp : 'sans-serif'),
      fontSize: '20px', color: accent, fontStyle: '700'
    }).setOrigin(0.5).setDepth(depthBase + 2);

    const divider = scene.add.graphics().setDepth(depthBase + 2);
    divider.lineStyle(1, accentInt, 0.4);
    divider.lineBetween(boxX + 40, boxY + 70, boxX + boxW - 40, boxY + 70);

    const body = scene.add.text(400, boxY + 180, lines.join('\n'), {
      fontFamily: (typeof Style !== 'undefined' ? Style.fonts.jp : 'sans-serif'),
      fontSize: '15px', color: '#e5e7eb',
      align: 'left', lineSpacing: 14
    }).setOrigin(0.5).setDepth(depthBase + 2);

    const startBtn = scene.add.text(400, boxY + boxH - 50, 'スタート', {
      fontFamily: (typeof Style !== 'undefined' ? Style.fonts.jp : 'sans-serif'),
      fontSize: '20px', color: '#1a1a3e',
      backgroundColor: '#fbbf24', padding: { x: 36, y: 12 }, fontStyle: '700'
    }).setOrigin(0.5).setDepth(depthBase + 2).setInteractive({ useHandCursor: true });

    startBtn.on('pointerover', () => startBtn.setBackgroundColor('#fde68a'));
    startBtn.on('pointerout',  () => startBtn.setBackgroundColor('#fbbf24'));

    const pulse = scene.tweens.add({
      targets: startBtn, scale: 1.06, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    const objs = [overlay, box, titleText, divider, body, startBtn];
    let closed = false;

    const close = () => {
      if (closed) return;
      closed = true;
      pulse.stop();
      scene.input.keyboard.off('keydown-ENTER', close);
      scene.input.keyboard.off('keydown-SPACE', close);
      objs.forEach(o => o.destroy());
      onStart();
    };

    startBtn.on('pointerdown', close);
    scene.input.keyboard.on('keydown-ENTER', close);
    scene.input.keyboard.on('keydown-SPACE', close);
  }
};

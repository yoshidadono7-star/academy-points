class MinigameHubScene extends Phaser.Scene {
  constructor() {
    super('MinigameHubScene');
  }

  init(data) {
    this.returnScene = (data && data.returnScene) || 'HomeTownScene';
    this.lastResult = (data && data.lastResult) || null;
  }

  create() {
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.starfield = Style.starfield(this, { seed: 'minigame-hub-stars', density: 200 });
    this.createHeader();
    this.createCards();
    this.showLastResult();
  }

  shutdown() {
    if (this.starfield && this.starfield.shootingStarTimer) {
      this.starfield.shootingStarTimer.remove();
      this.starfield.shootingStarTimer = null;
    }
  }

  createHeader() {
    Style.header(this, {
      title: 'アーケード',
      subtitle: '— ミニゲームで ゴールドを稼ごう —',
      onBack: () => this.returnHome(),
    });
  }

  createCards() {
    const cards = [
      {
        key: 'MathFlash',
        title: 'マスフラッシュ',
        subTitle: 'MATH FLASH',
        icon: '➗',
        duration: '30秒',
        desc: '瞬間計算',
        reward: '最大 75 G',
        color: 0x1e3a8a,
        accent: '#93c5fd',
      },
      {
        key: 'MemoryMatch',
        title: 'メモリーマッチ',
        subTitle: 'MEMORY MATCH',
        icon: '🪐',
        duration: '60秒',
        desc: '神経衰弱',
        reward: '最大 100 G',
        color: 0x4c1d95,
        accent: '#c4b5fd',
      },
      {
        key: 'TypingHero',
        title: 'タイピング勇者',
        subTitle: 'TYPING HERO',
        icon: '⌨',
        duration: '45秒',
        desc: '英単語タイプ',
        reward: '最大 60 G',
        color: 0x14532d,
        accent: '#86efac',
      },
    ];

    const startX = 140;
    const y = 330;
    const cardW = 160;
    const cardH = 260;
    const gap = 60;

    cards.forEach((c, i) => {
      const x = startX + i * (cardW + gap);
      this.createCard(x, y, cardW, cardH, c);
    });
  }

  createCard(x, y, w, h, data) {
    const container = this.add.container(x, y).setDepth(10);

    const gfx = this.add.graphics();
    this.drawCardBody(gfx, w, h, data, false);
    container.add(gfx);

    const icon = this.add.text(0, -h / 2 + 56, data.icon, {
      fontFamily: 'sans-serif', fontSize: '54px',
    }).setOrigin(0.5);
    container.add(icon);

    const title = this.add.text(0, -h / 2 + 116, data.title, {
      fontFamily: Style.fonts.jp, fontSize: '15px',
      color: data.accent, fontStyle: '700'
    }).setOrigin(0.5);
    container.add(title);

    const subTitle = this.add.text(0, -h / 2 + 136, data.subTitle, {
      fontFamily: Style.fonts.en, fontSize: '10px',
      color: Style.colors.textFaint
    }).setOrigin(0.5);
    container.add(subTitle);

    const desc = this.add.text(0, -h / 2 + 160, data.desc, {
      fontFamily: Style.fonts.jp, fontSize: '12px', color: Style.colors.textMuted
    }).setOrigin(0.5);
    container.add(desc);

    const duration = this.add.text(0, -h / 2 + 186, `⏱ ${data.duration}`, {
      fontFamily: Style.fonts.jp, fontSize: '11px', color: Style.colors.textDim
    }).setOrigin(0.5);
    container.add(duration);

    const reward = this.add.text(0, -h / 2 + 204, `◉ ${data.reward}`, {
      fontFamily: Style.fonts.jp, fontSize: '11px', color: Style.colors.accent
    }).setOrigin(0.5);
    container.add(reward);

    const playBtn = Style.button(this, 0, h / 2 - 28, 'プレイ', {
      variant: 'primary', size: 'md'
    });
    playBtn.disableInteractive(); // カード全体で反応するので個別は無効化
    container.add(playBtn);

    const hitRect = new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h);
    container.setInteractive({
      hitArea: hitRect,
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });

    container.on('pointerover', () => {
      gfx.clear();
      this.drawCardBody(gfx, w, h, data, true);
      container.setScale(1.03);
    });
    container.on('pointerout', () => {
      gfx.clear();
      this.drawCardBody(gfx, w, h, data, false);
      container.setScale(1.0);
    });
    container.on('pointerdown', () => this.launch(data.key));
  }

  drawCardBody(gfx, w, h, data, highlight) {
    const baseColor = highlight
      ? Phaser.Display.Color.IntegerToColor(data.color).brighten(20).color
      : data.color;
    const borderColor = Phaser.Display.Color.HexStringToColor(data.accent).color;

    gfx.fillStyle(0x000000, 0.4);
    gfx.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w, h, 10);

    gfx.fillStyle(baseColor, 0.95);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    gfx.lineStyle(2, borderColor, highlight ? 1 : 0.6);
    gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
  }

  showLastResult() {
    if (!this.lastResult) return;
    const r = this.lastResult;
    const text = `${r.title}  +${r.gold} G   [${r.rank}]`;
    const label = this.add.text(400, 580, text, {
      fontFamily: Style.fonts.jp, fontSize: '13px',
      color: Style.colors.accent, backgroundColor: '#1f2937',
      padding: { x: 14, y: 7 }, fontStyle: '700'
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({
      targets: label, alpha: 0.4, duration: 900, yoyo: true, repeat: 2,
      onComplete: () => label.setAlpha(1)
    });
  }

  launch(sceneKey) {
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneKey, { returnScene: 'MinigameHubScene' });
    });
  }

  returnHome() {
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(this.returnScene);
    });
  }
}

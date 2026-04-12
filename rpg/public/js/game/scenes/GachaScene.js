class GachaScene extends Phaser.Scene {
  constructor() {
    super('GachaScene');
  }

  init(data) {
    this.returnScene = (data && data.returnScene) || 'HomeTownScene';
    this.resultShown = false;
    this.skipRequested = false;
    this.shakeTimer = null;
    this.animStage = null;
    this.rarityBeams = null;
    this.skipBtn = null;
    this.resultCard = null;
  }

  create() {
    this.cameras.main.fadeIn(300, 0, 0, 0);

    this.drawBackground();
    this.createHeader();
    this.createTicketsDisplay();
    this.createGachaCards();

    // Firestore -> GachaTickets の更新を HUD に反映
    this._onTicketsUpdate = () => this.updateTicketsDisplay();
    GachaTickets.addListener(this._onTicketsUpdate);
  }

  shutdown() {
    if (this._onTicketsUpdate) {
      GachaTickets.removeListener(this._onTicketsUpdate);
      this._onTicketsUpdate = null;
    }
    if (this.starfield && this.starfield.shootingStarTimer) {
      this.starfield.shootingStarTimer.remove();
      this.starfield.shootingStarTimer = null;
    }
  }

  drawBackground() {
    this.starfield = Style.starfield(this, { seed: 'gacha-stars', density: 220 });
  }

  createHeader() {
    Style.header(this, {
      title: 'ショップ',
      subtitle: '— 星の宝箱より星物資を入手せよ —',
      onBack: () => this.returnHome(),
    });
  }

  createTicketsDisplay() {
    this.ticketsText = this.add.text(788, 34, '', {
      fontFamily: Style.fonts.jp, fontSize: '11px',
      color: Style.colors.textMuted, align: 'right'
    }).setOrigin(1, 0.5).setDepth(95);
    this.updateTicketsDisplay();
  }

  updateTicketsDisplay() {
    const t = GachaTickets;
    const daily = t.daily_free_available ? '◯' : '×';
    this.ticketsText.setText(
      `標準 ${t.standard}   /   プレミアム ${t.premium}   /   無料 ${daily}`
    );
  }

  createGachaCards() {
    this.cards = [];
    const defs = [
      { type: 'standard',   x: 160, color: 0xb45309, accent: '#fbbf24' },
      { type: 'premium',    x: 400, color: 0x7c3aed, accent: '#c4b5fd' },
      { type: 'daily_free', x: 640, color: 0x0d9488, accent: '#6ee7b7' },
    ];
    defs.forEach(def => {
      const tbl = GACHA_TABLES[def.type] || {};
      def.label = tbl.label || def.type;
      def.sub = tbl.sub || '';
      def.hint = tbl.hint || '';
      this.cards.push(this.createCard(def));
    });
  }

  createCard(def) {
    const y = 340;
    const w = 200;
    const h = 300;
    const container = this.add.container(def.x, y).setDepth(20);

    // 影
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.45);
    shadow.fillRoundedRect(-w / 2 + 4, -h / 2 + 6, w, h, 14);
    container.add(shadow);

    const bg = this.add.graphics();
    bg.fillStyle(0x0b0b1f, 0.96);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    const accentInt = Phaser.Display.Color.HexStringToColor(def.accent).color;
    bg.lineStyle(3, accentInt, 0.9);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    bg.lineStyle(1, accentInt, 0.35);
    bg.strokeRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 16);
    container.add(bg);

    const header = this.add.graphics();
    header.fillStyle(def.color, 0.9);
    header.fillRoundedRect(-w / 2, -h / 2, w, 48, { tl: 14, tr: 14, bl: 0, br: 0 });
    header.lineStyle(1, accentInt, 0.5);
    header.lineBetween(-w / 2 + 12, -h / 2 + 48, w / 2 - 12, -h / 2 + 48);
    container.add(header);

    const title = this.add.text(0, -h / 2 + 24, def.label, {
      fontFamily: Style.fonts.jp, fontSize: '18px',
      color: '#ffffff', fontStyle: '700'
    }).setOrigin(0.5);
    container.add(title);

    // スタープレビューアイコン (chest → cosmic pod)
    const podContainer = this.add.container(0, 20);
    this.drawCosmicPod(podContainer, def);
    container.add(podContainer);

    const cost = this.add.text(0, 72, def.sub, {
      fontFamily: Style.fonts.jp, fontSize: '12px', color: Style.colors.textMuted
    }).setOrigin(0.5);
    container.add(cost);

    const hint = this.add.text(0, 94, def.hint, {
      fontFamily: Style.fonts.en, fontSize: '13px', color: Style.colors.accentDim
    }).setOrigin(0.5);
    container.add(hint);

    const btn = Style.button(this, 0, 126, 'ガチャを引く', {
      variant: 'primary', size: 'md'
    });
    btn.on('pointerdown', () => this.attemptDraw(def.type));
    container.add(btn);

    // 軽い浮遊
    this.tweens.add({
      targets: podContainer, y: podContainer.y - 3,
      duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    return { container, def, btn };
  }

  drawCosmicPod(parent, def) {
    // 星のポッド (六角形 + コア)
    const scene = this;
    const body = scene.add.graphics();
    const accentInt = Phaser.Display.Color.HexStringToColor(def.accent).color;

    // 外枠 (ダイヤモンド)
    body.fillStyle(0x000000, 0.35);
    body.fillCircle(3, 4, 30);

    body.fillStyle(def.color, 1);
    body.beginPath();
    body.moveTo(0, -28);
    body.lineTo(26, 0);
    body.lineTo(0, 28);
    body.lineTo(-26, 0);
    body.closePath();
    body.fillPath();

    body.lineStyle(2, accentInt, 1);
    body.beginPath();
    body.moveTo(0, -28);
    body.lineTo(26, 0);
    body.lineTo(0, 28);
    body.lineTo(-26, 0);
    body.closePath();
    body.strokePath();

    // 中央コア (脈動)
    const core = scene.add.graphics();
    core.fillStyle(accentInt, 0.9);
    core.fillCircle(0, 0, 7);
    core.fillStyle(0xffffff, 0.6);
    core.fillCircle(0, 0, 3);

    parent.add(body);
    parent.add(core);

    scene.tweens.add({
      targets: core, scale: 1.3, duration: 900,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
  }

  attemptDraw(gachaType) {
    if (!GachaTickets.canRoll(gachaType)) {
      this.showToast('チケットが足りません、クルー。');
      return;
    }
    GachaTickets.consume(gachaType);
    this.updateTicketsDisplay();
    const result = GachaSystem.roll(gachaType);
    this.playDrawAnimation(result);
  }

  showToast(text) {
    const t = this.add.text(400, 150, text, {
      fontFamily: Style.fonts.jp, fontSize: '13px',
      color: Style.colors.text, backgroundColor: '#7f1d1d',
      padding: { x: 14, y: 8 }, fontStyle: '700'
    }).setOrigin(0.5).setDepth(500);
    this.tweens.add({
      targets: t,
      alpha: 0,
      duration: 1400,
      delay: 800,
      onComplete: () => t.destroy()
    });
  }

  playDrawAnimation(result) {
    this.resultShown = false;
    this.skipRequested = false;
    this.cards.forEach(c => c.container.setVisible(false));

    this.skipBtn = this.add.text(780, 28, 'スキップ ▸', {
      fontFamily: Style.fonts.jp, fontSize: '12px',
      color: Style.colors.accentDim, backgroundColor: '#1f2937',
      padding: { x: 12, y: 6 }
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true }).setDepth(300);
    this.skipBtn.on('pointerover', () => this.skipBtn.setColor('#ffffff'));
    this.skipBtn.on('pointerout',  () => this.skipBtn.setColor(Style.colors.accentDim));
    this.skipBtn.on('pointerdown', () => {
      this.skipRequested = true;
      this.showResult(result);
    });

    const stage = this.add.container(400, 340).setDepth(200);
    this.animStage = stage;

    const glow = this.add.circle(0, 0, 90, 0xfde68a, 0);
    stage.add(glow);
    this.glow = glow;

    const chest = this.createChestSprite();
    stage.add(chest.container);
    this.chest = chest;

    chest.container.setScale(0);
    this.tweens.add({
      targets: chest.container,
      scale: 1,
      duration: 400,
      ease: 'Back.Out',
      onComplete: () => {
        if (!this.resultShown) this.runChestBuildup(chest, glow, result);
      }
    });
  }

  createChestSprite() {
    const container = this.add.container(0, 0);

    const base = this.add.rectangle(0, 22, 140, 74, 0x8b4513).setStrokeStyle(3, 0x451a03);
    const baseTrim = this.add.rectangle(0, 24, 128, 6, 0xfbbf24);

    const lidContainer = this.add.container(0, -22);
    const lidBody = this.add.rectangle(0, 0, 140, 38, 0x7c2d12).setStrokeStyle(3, 0x451a03);
    const lidTrim = this.add.rectangle(0, 10, 128, 6, 0xfbbf24);
    lidContainer.add([lidBody, lidTrim]);

    const lock = this.add.rectangle(0, 8, 18, 24, 0xfbbf24).setStrokeStyle(2, 0x78350f);
    const lockDot = this.add.rectangle(0, 10, 4, 8, 0x78350f);

    container.add([base, baseTrim, lidContainer, lock, lockDot]);
    return { container, lid: lidContainer, lock };
  }

  runChestBuildup(chest, glow, result) {
    if (this.resultShown) return;

    const shakeAmp = { v: 1 };
    this.tweens.add({
      targets: shakeAmp, v: 6, duration: 1800, ease: 'Quad.In'
    });
    this.shakeTimer = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        if (!chest.container.active) return;
        chest.container.setX(Phaser.Math.Between(-shakeAmp.v, shakeAmp.v));
        chest.container.setY(Phaser.Math.Between(-shakeAmp.v, shakeAmp.v));
      }
    });

    // Glow pulse build-up
    this.tweens.add({
      targets: glow,
      fillAlpha: { from: 0, to: 0.55 },
      scale: { from: 1, to: 1.4 },
      duration: 900,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.InOut'
    });

    this.time.delayedCall(2000, () => {
      if (this.resultShown) return;
      if (this.shakeTimer) { this.shakeTimer.remove(); this.shakeTimer = null; }
      chest.container.setPosition(0, 0);
      this.openChest(chest, glow, result);
    });
  }

  openChest(chest, glow, result) {
    if (this.resultShown) return;

    // Camera shake + flash
    this.cameras.main.shake(150, 0.004);
    const flash = this.add.rectangle(400, 300, 800, 600, 0xffffff, 0).setDepth(250);
    this.tweens.add({
      targets: flash,
      alpha: 0.85,
      duration: 120,
      yoyo: true,
      onComplete: () => flash.destroy()
    });

    // Lid opens
    this.tweens.add({
      targets: chest.lid,
      y: -52,
      angle: -28,
      duration: 400,
      ease: 'Back.Out'
    });

    // Glow burst
    this.tweens.add({
      targets: glow,
      fillAlpha: 0.85,
      scale: 3.2,
      duration: 600,
      ease: 'Quad.Out'
    });

    const isRarePlus = GachaSystem.isRareOrAbove(result.rarity);
    if (isRarePlus) this.playRarityShowcase(result);

    const waitMs = isRarePlus ? 2200 : 700;
    this.time.delayedCall(waitMs, () => {
      if (!this.resultShown) this.showResult(result);
    });
  }

  playRarityShowcase(result) {
    const color = GachaSystem.rarityColorInt(result.rarity);

    const beams = this.add.container(400, 340).setDepth(210);
    this.rarityBeams = beams;
    for (let i = 0; i < 8; i++) {
      const beam = this.add.rectangle(0, 0, 700, 16, color, 0.38);
      beam.rotation = (Math.PI / 8) * i;
      beams.add(beam);
    }
    beams.setScale(0);
    this.tweens.add({
      targets: beams, scale: 1, duration: 400, ease: 'Back.Out'
    });
    this.tweens.add({
      targets: beams,
      rotation: Math.PI * 2,
      duration: 2400,
      repeat: -1,
      ease: 'Linear'
    });

    // Sparkles
    for (let i = 0; i < 24; i++) {
      const sx = Phaser.Math.Between(220, 580);
      const sy = Phaser.Math.Between(200, 480);
      const sparkle = this.add.circle(sx, sy, Phaser.Math.Between(2, 5), 0xffffff, 1).setDepth(220);
      this.tweens.add({
        targets: sparkle,
        alpha: 0,
        y: sy - 50,
        scale: 0.3,
        duration: Phaser.Math.Between(700, 1500),
        delay: Phaser.Math.Between(0, 900),
        onComplete: () => sparkle.destroy()
      });
    }
  }

  showResult(result) {
    if (this.resultShown) return;
    this.resultShown = true;

    // Cleanup animation artifacts
    if (this.shakeTimer) { this.shakeTimer.remove(); this.shakeTimer = null; }
    if (this.animStage) { this.animStage.destroy(); this.animStage = null; }
    if (this.rarityBeams) { this.rarityBeams.destroy(); this.rarityBeams = null; }
    if (this.skipBtn) { this.skipBtn.destroy(); this.skipBtn = null; }

    const colorHex = GachaSystem.rarityColorHex(result.rarity);
    const colorInt = GachaSystem.rarityColorInt(result.rarity);

    const card = this.add.container(400, 320).setDepth(260);
    this.resultCard = card;

    // 外側の淡いグロー
    const outerGlow = this.add.graphics();
    outerGlow.fillStyle(colorInt, 0.12);
    outerGlow.fillRoundedRect(-218, -168, 436, 336, 20);
    card.add(outerGlow);

    const bg = this.add.graphics();
    bg.fillStyle(Style.intColors.bgDeep, 0.98);
    bg.fillRoundedRect(-200, -150, 400, 300, 16);
    bg.lineStyle(4, colorInt, 1);
    bg.strokeRoundedRect(-200, -150, 400, 300, 16);
    bg.lineStyle(1, colorInt, 0.5);
    bg.strokeRoundedRect(-206, -156, 412, 312, 18);
    card.add(bg);

    const stars = this.add.text(0, -115, GachaSystem.rarityStars(result.rarity), {
      fontFamily: Style.fonts.en, fontSize: '24px', color: colorHex
    }).setOrigin(0.5);
    card.add(stars);

    const rarityLbl = this.add.text(0, -86, Style.rarityLabel(result.rarity), {
      fontFamily: Style.fonts.jp, fontSize: '13px',
      color: colorHex, fontStyle: '700'
    }).setOrigin(0.5);
    card.add(rarityLbl);

    const name = this.add.text(0, -48, result.item.name, {
      fontFamily: Style.fonts.jp, fontSize: '20px',
      color: Style.colors.text, fontStyle: '700',
      align: 'center', wordWrap: { width: 360 }
    }).setOrigin(0.5);
    card.add(name);

    const typeJp = (typeof ITEM_TYPE_LABEL_JP !== 'undefined'
      && ITEM_TYPE_LABEL_JP[result.item.itemType]) || result.item.itemType;
    const typeLabel = this.add.text(0, -8, `— ${typeJp} —`, {
      fontFamily: Style.fonts.jp, fontSize: '11px', color: Style.colors.textDim
    }).setOrigin(0.5);
    card.add(typeLabel);

    const statsText = this.formatStats(result.item);
    if (statsText) {
      const stats = this.add.text(0, 22, statsText, {
        fontFamily: Style.fonts.en, fontSize: '13px',
        color: Style.colors.textMuted, align: 'center', fontStyle: '700'
      }).setOrigin(0.5);
      card.add(stats);
    }

    const drawAgainBtn = Style.button(this, -94, 110, 'もう一度', {
      variant: 'success', size: 'md'
    });
    drawAgainBtn.on('pointerdown', () => {
      this.resetToSelection();
      this.attemptDraw(result.gachaType);
    });
    card.add(drawAgainBtn);

    const closeBtn = Style.button(this, 94, 110, 'とじる', {
      variant: 'primary', size: 'md'
    });
    closeBtn.on('pointerdown', () => this.resetToSelection());
    card.add(closeBtn);

    card.setScale(0.6);
    card.setAlpha(0);
    this.tweens.add({
      targets: card,
      scale: 1,
      alpha: 1,
      duration: 400,
      ease: 'Back.Out'
    });
  }

  formatStats(item) {
    if (!item.stats) return '';
    const parts = [];
    if (item.stats.atk) parts.push(`ATK +${item.stats.atk}`);
    if (item.stats.def) parts.push(`DEF +${item.stats.def}`);
    if (item.stats.hp)  parts.push(`HP +${item.stats.hp}`);
    return parts.join('   ');
  }

  resetToSelection() {
    if (this.resultCard) { this.resultCard.destroy(); this.resultCard = null; }
    if (this.animStage) { this.animStage.destroy(); this.animStage = null; }
    if (this.rarityBeams) { this.rarityBeams.destroy(); this.rarityBeams = null; }
    if (this.skipBtn) { this.skipBtn.destroy(); this.skipBtn = null; }
    if (this.shakeTimer) { this.shakeTimer.remove(); this.shakeTimer = null; }
    this.resultShown = false;
    this.skipRequested = false;
    this.cards.forEach(c => c.container.setVisible(true));
    this.updateTicketsDisplay();
  }

  returnHome() {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(this.returnScene);
    });
  }
}

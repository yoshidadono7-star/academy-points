class HomeTownScene extends Phaser.Scene {
  constructor() {
    super('HomeTownScene');
  }

  init(data) {
    this.playerProfile = (data && data.profile) || null;
    this.playerWallet = { gold: 0, gems: 0 };
    this.todayStats = { minutes: 0, pomodoros: 0 };
    this.profileUnsubscribe = null;
    this.walletUnsubscribe = null;
    this.statsUnsubscribe = null;
  }

  create() {
    const mapWidth = 800;
    const mapHeight = 600;

    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.fadeIn(300, 0, 0, 0);

    this.drawTownMap(mapWidth, mapHeight);
    this.createBuildings(mapWidth, mapHeight);
    this.createCenterPlayer(mapWidth, mapHeight);
    this.createHUD();
    this.createFooterHint();
    this.showCaptainGreeting();

    const uid = FirebaseSync.getUid();
    if (uid) {
      this.profileUnsubscribe = FirebaseSync.onProfileChange(uid, (profile) => {
        this.playerProfile = profile;
        this.updateHUD();
      });
      this.walletUnsubscribe = FirebaseSync.onWalletChange(uid, (wallet) => {
        this.playerWallet = wallet;
        this.updateHUD();
      });
      this.statsUnsubscribe = FirebaseSync.onTodayStatsChange(uid, (stats) => {
        this.todayStats = stats;
        this.updateStudyStats();
      });
    }
  }

  drawTownMap(w, h) {
    // 1) 星空背景 (ネビュラ + 星 + 流れ星)
    this.starfield = Style.starfield(this, { seed: 'hometown-stars', density: 200 });

    const gfx = this.add.graphics().setDepth(0);

    // 2) ステーションフロア (中央の暗いプラットフォーム)
    const padX = 40;
    const padY = 70;
    const floorX = padX;
    const floorY = padY;
    const floorW = w - padX * 2;
    const floorH = h - padY - 50;

    // フロアベース (半透明で星空が透ける)
    gfx.fillStyle(0x0f172a, 0.82);
    gfx.fillRoundedRect(floorX, floorY, floorW, floorH, 18);

    // パネルグリッド
    gfx.lineStyle(1, 0x1e293b, 0.8);
    for (let x = floorX + 40; x < floorX + floorW; x += 40) {
      gfx.lineBetween(x, floorY + 20, x, floorY + floorH - 20);
    }
    for (let y = floorY + 40; y < floorY + floorH; y += 40) {
      gfx.lineBetween(floorX + 20, y, floorX + floorW - 20, y);
    }

    // フロア外枠のエネルギーライン (金色グロー)
    gfx.lineStyle(2, 0xfbbf24, 0.85);
    gfx.strokeRoundedRect(floorX, floorY, floorW, floorH, 18);
    gfx.lineStyle(1, 0xfde68a, 0.35);
    gfx.strokeRoundedRect(floorX - 3, floorY - 3, floorW + 6, floorH + 6, 20);

    // コーナーアクセント
    const corners = [
      [floorX,        floorY],
      [floorX+floorW, floorY],
      [floorX,        floorY+floorH],
      [floorX+floorW, floorY+floorH],
    ];
    gfx.fillStyle(0xfbbf24, 1);
    corners.forEach(([cx, cy]) => gfx.fillCircle(cx, cy, 4));
    gfx.fillStyle(0xfde68a, 0.5);
    corners.forEach(([cx, cy]) => gfx.fillCircle(cx, cy, 9));

    // 3) 中央プラザ (星章)
    const cx = w / 2;
    const cy = h / 2 + 20;
    gfx.lineStyle(2, 0xfbbf24, 0.6);
    gfx.strokeCircle(cx, cy, 72);
    gfx.lineStyle(1, 0xfbbf24, 0.25);
    gfx.strokeCircle(cx, cy, 86);

    // 中央のアカデミーエンブレム (4方向の星線)
    gfx.lineStyle(2, 0xfbbf24, 0.7);
    gfx.lineBetween(cx - 22, cy, cx + 22, cy);
    gfx.lineBetween(cx, cy - 22, cx, cy + 22);
    gfx.lineStyle(1, 0xfde68a, 0.45);
    gfx.lineBetween(cx - 16, cy - 16, cx + 16, cy + 16);
    gfx.lineBetween(cx - 16, cy + 16, cx + 16, cy - 16);

    // 中央の明るいコア
    const core = this.add.graphics().setDepth(1);
    core.fillStyle(0xfde68a, 0.9);
    core.fillCircle(cx, cy, 5);
    core.fillStyle(0xfbbf24, 0.4);
    core.fillCircle(cx, cy, 11);
    this.tweens.add({
      targets: core, alpha: 0.55, duration: 1600,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
  }

  createBuildings(w, h) {
    const buildings = [
      { x: 130,     y: 170, w: 78, h: 62, color: 0x065f46, label: 'アーケード',     sub: 'ミニゲーム場', labelColor: '#86efac', facility: 'arcade' },
      { x: w / 2,   y: 155, w: 88, h: 62, color: 0xb45309, label: 'ミッションボード', sub: 'Mission',      labelColor: '#fbbf24', facility: 'mission_board' },
      { x: w - 130, y: 170, w: 78, h: 58, color: 0xb91c1c, label: 'ランキング',     sub: 'Ranking',      labelColor: '#fca5a5', facility: 'ranking' },
      { x: 130,     y: 360, w: 90, h: 70, color: 0x0369a1, label: 'クルールーム',   sub: 'Guild',        labelColor: '#7dd3fc', facility: 'guild' },
      { x: w - 130, y: 360, w: 86, h: 70, color: 0x7c3aed, label: 'ショップ',       sub: '宇宙商店',     labelColor: '#c4b5fd', facility: 'shop' },
    ];

    buildings.forEach(b => {
      const container = this.add.container(b.x, b.y).setDepth(4);

      // 影
      const shadow = this.add.graphics();
      shadow.fillStyle(0x000000, 0.4);
      shadow.fillEllipse(0, b.h / 2 + 4, b.w * 1.05, 10);
      container.add(shadow);

      const gfx = this.add.graphics();
      this.drawBuildingBody(gfx, b, false);
      container.add(gfx);

      // 日本語ラベル (看板)
      const label = this.add.text(0, -b.h / 2 - 22, b.label, {
        fontFamily: Style.fonts.jp, fontSize: '12px',
        color: b.labelColor, fontStyle: '700', align: 'center'
      }).setOrigin(0.5);
      container.add(label);

      // 英語サブラベル
      const sub = this.add.text(0, -b.h / 2 - 8, b.sub, {
        fontFamily: Style.fonts.en, fontSize: '8px',
        color: Style.colors.textFaint, align: 'center'
      }).setOrigin(0.5);
      container.add(sub);

      const hitRect = new Phaser.Geom.Rectangle(
        -b.w / 2 - 8, -b.h / 2 - 30, b.w + 16, b.h + 44
      );
      container.setInteractive({
        hitArea: hitRect,
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true
      });

      container.on('pointerover', () => {
        gfx.clear();
        this.drawBuildingBody(gfx, b, true);
        this.tweens.add({ targets: container, scale: 1.05, duration: 120, ease: 'Quad.easeOut' });
      });
      container.on('pointerout', () => {
        gfx.clear();
        this.drawBuildingBody(gfx, b, false);
        this.tweens.add({ targets: container, scale: 1.0, duration: 120, ease: 'Quad.easeOut' });
      });
      container.on('pointerdown', () => this.onFacilityTap(b.facility, b.label));
    });
  }

  drawBuildingBody(gfx, b, highlight) {
    const baseColor = highlight
      ? Phaser.Display.Color.IntegerToColor(b.color).brighten(25).color
      : b.color;
    const roofColor = Phaser.Display.Color.IntegerToColor(b.color).darken(35).color;
    const accentColor = Phaser.Display.Color.IntegerToColor(b.color).brighten(40).color;

    // 本体
    gfx.fillStyle(baseColor);
    gfx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);

    // 屋根 (ドーム型)
    gfx.fillStyle(roofColor);
    gfx.fillRect(-b.w / 2 - 4, -b.h / 2 - 8, b.w + 8, 12);

    // ハイライトライン
    gfx.lineStyle(1, accentColor, 0.8);
    gfx.lineBetween(-b.w / 2 + 2, -b.h / 2 + 2, b.w / 2 - 2, -b.h / 2 + 2);

    // 窓 (3 or 4 個)
    const winCount = b.w >= 84 ? 4 : 3;
    const winY = -b.h / 2 + 18;
    const winW = 10;
    const winH = 12;
    const totalW = winCount * winW + (winCount - 1) * 6;
    const startX = -totalW / 2;
    for (let i = 0; i < winCount; i++) {
      const wx = startX + i * (winW + 6);
      gfx.fillStyle(0x000000, 0.6);
      gfx.fillRect(wx, winY, winW, winH);
      gfx.fillStyle(highlight ? 0xfbbf24 : 0xfde68a, highlight ? 1 : 0.7);
      gfx.fillRect(wx + 1, winY + 1, winW - 2, winH - 2);
    }

    // 入口
    gfx.fillStyle(0x0b0b1f, 1);
    gfx.fillRect(-6, b.h / 2 - 14, 12, 14);
    gfx.fillStyle(accentColor, 0.6);
    gfx.fillRect(-6, b.h / 2 - 14, 12, 2);
  }

  createCenterPlayer(w, h) {
    const cx = w / 2;
    const cy = h / 2 + 20;

    // プレイヤーの影
    const shadow = this.add.ellipse(cx, cy + 22, 28, 6, 0x000000, 0.5).setDepth(4);

    // プレイヤー
    const player = this.add.image(cx, cy, 'player').setScale(2.4).setDepth(6);

    // 周囲のオーラリング
    const aura = this.add.graphics().setDepth(5);
    aura.lineStyle(2, 0xfbbf24, 0.6);
    aura.strokeCircle(cx, cy + 8, 22);
    this.tweens.add({
      targets: aura, alpha: 0.2, duration: 1400,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    // 上下浮遊
    this.tweens.add({
      targets: [player, shadow],
      y: '+=3',
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  createHUD() {
    this.hudContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(100);

    const hudBg = this.add.graphics();
    hudBg.fillStyle(Style.intColors.bgDeep, 0.88);
    hudBg.fillRect(0, 0, 800, 58);
    hudBg.lineStyle(1, Style.intColors.accent, 0.5);
    hudBg.lineBetween(0, 57, 800, 57);
    this.hudContainer.add(hudBg);

    const p = this.playerProfile || { level: 1, hp: 100, hp_max: 100, xp: 0 };
    const w = this.playerWallet || { gold: 0 };

    // Row 1
    this.hudLevel = this.add.text(12, 8, `Lv.${p.level}`, {
      fontFamily: Style.fonts.en, fontSize: '16px',
      color: Style.colors.accent, fontStyle: '700'
    });
    this.hudHP = this.add.text(78, 10, `HP ${p.hp}/${p.hp_max}`, {
      fontFamily: Style.fonts.en, fontSize: '12px', color: Style.colors.error
    });
    this.hudXP = this.add.text(210, 10, `EXP ${p.xp}`, {
      fontFamily: Style.fonts.en, fontSize: '12px', color: Style.colors.info
    });
    this.hudGold = this.add.text(320, 10, `◉ ${w.gold} G`, {
      fontFamily: Style.fonts.en, fontSize: '12px',
      color: Style.colors.accent, fontStyle: '700'
    });
    this.hudName = this.add.text(788, 10, FirebaseSync.getDisplayName(), {
      fontFamily: Style.fonts.jp, fontSize: '12px', color: Style.colors.textDim
    }).setOrigin(1, 0);

    // Row 2: 今日の勉強
    this.hudStudy = this.add.text(12, 34, '本日  0 分   /   0 ポモ', {
      fontFamily: Style.fonts.jp, fontSize: '11px', color: Style.colors.successDim
    });

    [this.hudLevel, this.hudHP, this.hudXP, this.hudGold, this.hudName, this.hudStudy].forEach(t => {
      this.hudContainer.add(t);
    });
  }

  updateHUD() {
    if (this.playerProfile) {
      const p = this.playerProfile;
      this.hudLevel.setText(`Lv.${p.level}`);
      this.hudHP.setText(`HP ${p.hp}/${p.hp_max}`);
      this.hudXP.setText(`EXP ${p.xp}`);
      const name = p.studentCallsign || p.studentNickname || p.displayName
        || FirebaseSync.getDisplayName();
      this.hudName.setText(name);
    }
    if (this.playerWallet) {
      this.hudGold.setText(`◉ ${this.playerWallet.gold || 0} G`);
    }
  }

  updateStudyStats() {
    const s = this.todayStats || { minutes: 0, pomodoros: 0 };
    const m = s.minutes || 0;
    const p = s.pomodoros || 0;
    this.hudStudy.setText(`本日  ${m} 分   /   ${p} ポモ`);
  }

  createFooterHint() {
    this.add.text(400, 580, '建物をタップして入る', {
      fontFamily: Style.fonts.jp, fontSize: '12px',
      color: Style.colors.accentDim
    }).setOrigin(0.5).setDepth(10);
  }

  showCaptainGreeting() {
    // 艦長マイケルからのワンライン挨拶 (画面下部から浮かび上がる)
    const line = CaptainMichael.greeting();

    const container = this.add.container(400, 560).setDepth(90).setAlpha(0);

    const boxW = 560, boxH = 46;
    const bg = this.add.graphics();
    bg.fillStyle(Style.intColors.bgDeep, 0.92);
    bg.fillRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 10);
    bg.lineStyle(1, Style.intColors.accent, 0.7);
    bg.strokeRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 10);
    container.add(bg);

    const badge = this.add.text(-boxW / 2 + 14, -6, '★ 艦長マイケル', {
      fontFamily: Style.fonts.jp, fontSize: '10px',
      color: Style.colors.accent, fontStyle: '700'
    });
    container.add(badge);

    const text = this.add.text(-boxW / 2 + 14, 8, line, {
      fontFamily: Style.fonts.jp, fontSize: '12px',
      color: Style.colors.textMuted
    });
    container.add(text);

    // 浮かび上がり → 滞在 → フェードアウト
    this.tweens.add({
      targets: container, alpha: 1, y: 548, duration: 500, ease: 'Quad.easeOut',
      onComplete: () => {
        this.time.delayedCall(4500, () => {
          this.tweens.add({
            targets: container, alpha: 0, y: 560, duration: 500,
            onComplete: () => container.destroy(),
          });
        });
      }
    });
  }

  onFacilityTap(facility, label) {
    if (facility === 'shop') {
      this.transitionTo('GachaScene');
      return;
    }
    if (facility === 'arcade') {
      this.transitionTo('MinigameHubScene');
      return;
    }
    // TODO(step-5+): Mission Board / Guild Hall / Ranking をそれぞれ実装
    this.showPopup(label, '準備中です、クルー。\n新しい星系への航路は近日開通予定。');
  }

  transitionTo(sceneKey) {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneKey, { returnScene: 'HomeTownScene' });
    });
  }

  showPopup(title, body) {
    if (this.popupContainer) this.popupContainer.destroy();

    const container = this.add.container(0, 0).setScrollFactor(0).setDepth(200);
    this.popupContainer = container;

    const overlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.65)
      .setInteractive();
    container.add(overlay);

    const boxW = 400, boxH = 190;
    const boxX = 400 - boxW / 2, boxY = 300 - boxH / 2;
    const box = this.add.graphics();
    box.fillStyle(0x0b0b1f, 0.98);
    box.fillRoundedRect(boxX, boxY, boxW, boxH, 14);
    box.lineStyle(2, Style.intColors.accent, 0.9);
    box.strokeRoundedRect(boxX, boxY, boxW, boxH, 14);
    container.add(box);

    const titleText = this.add.text(400, boxY + 32, title, {
      fontFamily: Style.fonts.jp, fontSize: '18px',
      color: Style.colors.accent, fontStyle: '700'
    }).setOrigin(0.5);
    container.add(titleText);

    const bodyText = this.add.text(400, boxY + 90, body, {
      fontFamily: Style.fonts.jp, fontSize: '13px',
      color: Style.colors.textMuted, align: 'center', lineSpacing: 6
    }).setOrigin(0.5);
    container.add(bodyText);

    const closeBtn = Style.button(this, 400, boxY + boxH - 32, 'とじる', {
      variant: 'primary', size: 'md'
    });
    closeBtn.on('pointerdown', () => this.closePopup());
    container.add(closeBtn);

    overlay.on('pointerdown', () => this.closePopup());
  }

  closePopup() {
    if (this.popupContainer) {
      this.popupContainer.destroy();
      this.popupContainer = null;
    }
  }

  shutdown() {
    if (this.profileUnsubscribe) { this.profileUnsubscribe(); this.profileUnsubscribe = null; }
    if (this.walletUnsubscribe)  { this.walletUnsubscribe();  this.walletUnsubscribe  = null; }
    if (this.statsUnsubscribe)   { this.statsUnsubscribe();   this.statsUnsubscribe   = null; }
    if (this.starfield && this.starfield.shootingStarTimer) {
      this.starfield.shootingStarTimer.remove();
      this.starfield.shootingStarTimer = null;
    }
  }
}

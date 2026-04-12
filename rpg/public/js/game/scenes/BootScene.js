class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    this.cameras.main.setBackgroundColor(Style.colors.bgDeep);

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(Style.intColors.panel, 0.85);
    progressBox.fillRect(width / 2 - 160, height / 2 - 15, 320, 30);
    progressBox.lineStyle(1, Style.intColors.accent, 0.5);
    progressBox.strokeRect(width / 2 - 160, height / 2 - 15, 320, 30);

    const loadingText = this.add.text(width / 2, height / 2 - 40, '読み込み中...', {
      fontFamily: Style.fonts.jp,
      fontSize: '16px',
      color: Style.colors.accent,
    }).setOrigin(0.5);

    const percentText = this.add.text(width / 2, height / 2, '0%', {
      fontFamily: Style.fonts.en,
      fontSize: '14px',
      color: Style.colors.text,
    }).setOrigin(0.5);

    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(Style.intColors.accent, 1);
      progressBar.fillRect(width / 2 - 155, height / 2 - 10, 310 * value, 20);
      percentText.setText(Math.round(value * 100) + '%');
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      percentText.destroy();
    });

    // --- Phase 0 アセット読み込み ---
    // プレースホルダーを生成（素材追加時にここを実際のファイルに差し替える）
    this.createPlaceholderTextures();
  }

  createPlaceholderTextures() {
    // プレイヤースプライト（16x16 キャラ風）
    const playerGfx = this.make.graphics({ x: 0, y: 0, add: false });
    // 体
    playerGfx.fillStyle(0x4ade80);
    playerGfx.fillRect(3, 5, 10, 11);
    // 頭
    playerGfx.fillStyle(0xfbbf24);
    playerGfx.fillRect(4, 0, 8, 6);
    // 目
    playerGfx.fillStyle(0x1a1a2e);
    playerGfx.fillRect(5, 2, 2, 2);
    playerGfx.fillRect(9, 2, 2, 2);
    playerGfx.generateTexture('player', 16, 16);
    playerGfx.destroy();

    // モンスタースプライト（16x16 モンスター風）
    const monsterGfx = this.make.graphics({ x: 0, y: 0, add: false });
    monsterGfx.fillStyle(0xef4444);
    monsterGfx.fillRect(2, 4, 12, 12);
    monsterGfx.fillStyle(0xb91c1c);
    monsterGfx.fillRect(0, 6, 3, 6);
    monsterGfx.fillRect(13, 6, 3, 6);
    monsterGfx.fillStyle(0xffffff);
    monsterGfx.fillRect(4, 6, 3, 3);
    monsterGfx.fillRect(9, 6, 3, 3);
    monsterGfx.fillStyle(0x000000);
    monsterGfx.fillRect(5, 7, 2, 2);
    monsterGfx.fillRect(10, 7, 2, 2);
    monsterGfx.generateTexture('monster', 16, 16);
    monsterGfx.destroy();

    // NPCスプライト（16x16 キャラ風）
    const npcGfx = this.make.graphics({ x: 0, y: 0, add: false });
    npcGfx.fillStyle(0x60a5fa);
    npcGfx.fillRect(3, 5, 10, 11);
    npcGfx.fillStyle(0xe2e8f0);
    npcGfx.fillRect(4, 0, 8, 6);
    npcGfx.fillStyle(0x1a1a2e);
    npcGfx.fillRect(5, 2, 2, 2);
    npcGfx.fillRect(9, 2, 2, 2);
    npcGfx.generateTexture('npc', 16, 16);
    npcGfx.destroy();

    // ダンジョン壁（16x16）
    const wallGfx = this.make.graphics({ x: 0, y: 0, add: false });
    wallGfx.fillStyle(0x374151);
    wallGfx.fillRect(0, 0, 16, 16);
    wallGfx.lineStyle(1, 0x1f2937);
    wallGfx.strokeRect(0, 0, 16, 16);
    wallGfx.fillStyle(0x4b5563);
    wallGfx.fillRect(2, 3, 5, 4);
    wallGfx.fillRect(9, 9, 5, 4);
    wallGfx.generateTexture('wall', 16, 16);
    wallGfx.destroy();

    // ダンジョン床（16x16）
    const floorGfx = this.make.graphics({ x: 0, y: 0, add: false });
    floorGfx.fillStyle(0x78716c);
    floorGfx.fillRect(0, 0, 16, 16);
    floorGfx.lineStyle(1, 0x57534e, 0.4);
    floorGfx.strokeRect(0, 0, 16, 16);
    floorGfx.generateTexture('floor', 16, 16);
    floorGfx.destroy();

    // 階段（16x16）
    const stairsGfx = this.make.graphics({ x: 0, y: 0, add: false });
    stairsGfx.fillStyle(0x78716c);
    stairsGfx.fillRect(0, 0, 16, 16);
    stairsGfx.fillStyle(0xfbbf24);
    for (let i = 0; i < 4; i++) {
      stairsGfx.fillRect(2 + i * 2, 2 + i * 3, 12 - i * 4, 3);
    }
    stairsGfx.generateTexture('stairs', 16, 16);
    stairsGfx.destroy();

    // 入口（16x16）
    const entranceGfx = this.make.graphics({ x: 0, y: 0, add: false });
    entranceGfx.fillStyle(0x78716c);
    entranceGfx.fillRect(0, 0, 16, 16);
    entranceGfx.fillStyle(0x4ade80);
    entranceGfx.fillTriangle(8, 2, 2, 14, 14, 14);
    entranceGfx.generateTexture('entrance', 16, 16);
    entranceGfx.destroy();
  }

  create() {
    // HTML側のローディング表示を消す
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }

    this.scene.start('LoginScene');
  }
}

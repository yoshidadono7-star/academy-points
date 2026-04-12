// StyleConfig - 共通UIスタイル定義 + 軽量ヘルパー
//
// カラーパレット・フォント・サイズを集約し、全シーンから参照する。
// Phaser の Text/Graphics に頻出するパターンをメソッド化して重複を減らす。

const Style = {
  // ==========================================================
  //  Color palette
  // ==========================================================
  colors: {
    bg:          '#0b0b1f',  // 画面ベース
    bgDeep:      '#050510',  // 宇宙の最奥
    panel:       '#111827',
    panelAlt:    '#1f2937',
    panelBorder: '#334155',

    accent:      '#fbbf24',  // 星の金色
    accentDim:   '#fde68a',
    success:     '#10b981',  // エメラルド
    successDim:  '#6ee7b7',
    warn:        '#f59e0b',
    error:       '#ef4444',
    info:        '#60a5fa',

    text:        '#ffffff',
    textMuted:   '#e5e7eb',
    textDim:     '#9ca3af',
    textFaint:   '#6b7280',

    rarity: {
      common:    '#9ca3af',
      uncommon:  '#10b981',
      rare:      '#3b82f6',
      epic:      '#a855f7',
      legendary: '#f59e0b',
    },
  },

  // Graphics 用 int カラー
  intColors: {
    bg:          0x0b0b1f,
    bgDeep:      0x050510,
    panel:       0x111827,
    panelAlt:    0x1f2937,
    panelBorder: 0x334155,
    accent:      0xfbbf24,
    success:     0x10b981,
    warn:        0xf59e0b,
    error:       0xef4444,
  },

  // ==========================================================
  //  Fonts
  // ==========================================================
  fonts: {
    jp:    '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif',
    en:    '"Orbitron", "Courier New", monospace',
    title: '"Orbitron", "Noto Sans JP", sans-serif',
    mono:  '"Courier New", monospace',
  },

  // ==========================================================
  //  Text style presets
  // ==========================================================
  textStyle: {
    title: (scene) => ({
      fontFamily: Style.fonts.title, fontSize: '32px',
      color: Style.colors.accent, fontStyle: 'bold',
    }),
    h1: {
      fontFamily: '"Orbitron", "Noto Sans JP", sans-serif', fontSize: '26px',
      color: '#fbbf24', fontStyle: 'bold',
    },
    h2: {
      fontFamily: '"Orbitron", "Noto Sans JP", sans-serif', fontSize: '18px',
      color: '#ffffff', fontStyle: 'bold',
    },
    body: {
      fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif',
      fontSize: '14px', color: '#e5e7eb',
    },
    bodyDim: {
      fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif',
      fontSize: '13px', color: '#9ca3af',
    },
    small: {
      fontFamily: '"Noto Sans JP", sans-serif', fontSize: '11px', color: '#9ca3af',
    },
    mono: {
      fontFamily: '"Courier New", monospace', fontSize: '14px', color: '#e5e7eb',
    },
    monoAccent: {
      fontFamily: '"Courier New", monospace', fontSize: '14px', color: '#fbbf24',
    },
  },

  // ==========================================================
  //  Rarity helpers
  // ==========================================================
  rarityLabel(rarity) {
    return ({
      common:    'コモン',
      uncommon:  'アンコモン',
      rare:      'レア',
      epic:      'エピック',
      legendary: 'レジェンド',
    })[rarity] || rarity;
  },

  rarityColorHex(rarity) {
    return Style.colors.rarity[rarity] || Style.colors.text;
  },

  rarityColorInt(rarity) {
    return Phaser.Display.Color.HexStringToColor(Style.rarityColorHex(rarity)).color;
  },

  // ==========================================================
  //  UI primitives
  // ==========================================================

  /**
   * 統一ヘッダー: 左[戻る] + 中央タイトル + (右はサブタイトル/空き)
   * @returns { container, backBtn, titleText, subText }
   */
  header(scene, opts) {
    const title = opts.title || '';
    const subtitle = opts.subtitle || '';
    const onBack = opts.onBack || null;
    const accent = opts.accent || Style.colors.accent;

    const container = scene.add.container(0, 0).setDepth(90);

    const bg = scene.add.graphics();
    bg.fillStyle(Style.intColors.bgDeep, 0.85);
    bg.fillRect(0, 0, 800, 54);
    bg.lineStyle(1, Phaser.Display.Color.HexStringToColor(accent).color, 0.4);
    bg.lineBetween(0, 53, 800, 53);
    container.add(bg);

    let backBtn = null;
    if (onBack) {
      backBtn = scene.add.text(20, 27, '◀  戻る', {
        fontFamily: Style.fonts.jp, fontSize: '13px', color: accent
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
      backBtn.on('pointerover', () => backBtn.setColor('#ffffff'));
      backBtn.on('pointerout',  () => backBtn.setColor(accent));
      backBtn.on('pointerdown', onBack);
      container.add(backBtn);
    }

    const titleText = scene.add.text(400, 20, title, {
      fontFamily: Style.fonts.title, fontSize: '20px',
      color: accent, fontStyle: 'bold'
    }).setOrigin(0.5, 0);
    container.add(titleText);

    let subText = null;
    if (subtitle) {
      subText = scene.add.text(400, 40, subtitle, {
        fontFamily: Style.fonts.jp, fontSize: '11px', color: Style.colors.textDim
      }).setOrigin(0.5, 0);
      container.add(subText);
    }

    return { container, backBtn, titleText, subText };
  },

  /**
   * 3スタイルのボタン:
   *   primary - 金色アクセント (重要アクション)
   *   success - 緑 (決定/スタート)
   *   ghost   - 透過 (キャンセル/副次)
   */
  button(scene, x, y, label, opts = {}) {
    const variant = opts.variant || 'success';
    const size = opts.size || 'md';

    const palette = {
      primary: { color: '#fbbf24', bg: '#78350f', hover: '#fde68a' },
      success: { color: '#6ee7b7', bg: '#064e3b', hover: '#a7f3d0' },
      ghost:   { color: '#cbd5e1', bg: '#1f2937', hover: '#ffffff' },
      danger:  { color: '#fca5a5', bg: '#7f1d1d', hover: '#fecaca' },
    };
    const p = palette[variant] || palette.success;

    const sizes = {
      sm: { fs: '12px', px: 10, py: 5 },
      md: { fs: '14px', px: 16, py: 8 },
      lg: { fs: '18px', px: 24, py: 10 },
    };
    const s = sizes[size] || sizes.md;

    const btn = scene.add.text(x, y, label, {
      fontFamily: Style.fonts.jp, fontSize: s.fs, color: p.color,
      backgroundColor: p.bg, padding: { x: s.px, y: s.py }, fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor(p.hover));
    btn.on('pointerout',  () => btn.setColor(p.color));
    return btn;
  },

  /**
   * 星空背景 + オプションで流れ星アニメ
   * 返り値: { gfx, shootingStarTimer } — shutdown で timer.remove() する
   */
  starfield(scene, opts = {}) {
    const seed = opts.seed || 'starfield';
    const density = opts.density || 180;
    const withShooting = opts.shootingStars !== false;
    const w = 800, h = 600;

    const gfx = scene.add.graphics().setDepth(-10);
    gfx.fillStyle(Style.intColors.bgDeep);
    gfx.fillRect(0, 0, w, h);

    const rng = new Phaser.Math.RandomDataGenerator([seed]);
    // ネビュラ雲
    for (let i = 0; i < 6; i++) {
      const color = rng.pick([0x1e1b4b, 0x312e81, 0x4c1d95, 0x1e3a8a, 0x2e1065]);
      gfx.fillStyle(color, 0.22);
      gfx.fillCircle(rng.between(0, w), rng.between(0, h), rng.between(70, 180));
    }
    // 星
    for (let i = 0; i < density; i++) {
      const color = rng.pick([0x9ca3af, 0xe5e7eb, 0xffffff, 0xfde68a, 0xbfdbfe, 0xc4b5fd]);
      gfx.fillStyle(color, rng.realInRange(0.4, 1.0));
      const size = rng.pick([1, 1, 1, 1, 2, 2, 3]);
      gfx.fillRect(rng.between(0, w), rng.between(0, h), size, size);
    }

    let shootingStarTimer = null;
    if (withShooting) {
      const spawn = () => {
        if (!scene.scene.isActive()) return;
        const startX = Phaser.Math.Between(-100, 400);
        const startY = Phaser.Math.Between(0, 250);
        const line = scene.add.graphics().setDepth(-5);
        line.lineStyle(2, 0xffffff, 0.9);
        line.lineBetween(0, 0, -60, -20);
        line.setPosition(startX, startY);

        scene.tweens.add({
          targets: line,
          x: startX + 260,
          y: startY + 90,
          alpha: 0,
          duration: 900,
          ease: 'Quad.easeIn',
          onComplete: () => line.destroy(),
        });
      };
      shootingStarTimer = scene.time.addEvent({
        delay: 3200, loop: true, callback: spawn,
      });
      // 初回少し早く
      scene.time.delayedCall(900, spawn);
    }

    return { gfx, shootingStarTimer };
  },
};

// 艦長マイケルのフレーバーライン (ランダム選択用)
const CaptainMichael = {
  greetings: [
    'ようこそ、諸君。今日もヒーローズ号で学びの航海に出よう。',
    '艦橋は開放中。何かあれば呼んでくれ、クルー。',
    'よく戻った。航路は星が示す、だが舵を握るのは君だ。',
    '諸君、今日の星空もまた美しい。出航の準備はいいか?',
  ],
  rank: {
    S: [
      'お見事だ、クルー。我がヒーローズ号の誇りだ。',
      '完璧な操艦だ、諸君。伝説に名を刻むにふさわしい。',
    ],
    A: [
      'よくやった。航海術が身についてきたな。',
      '見事だ、クルー。このまま突き進むがいい。',
    ],
    B: [
      'もう一息だ。もう一度挑戦してみろ。',
      '悪くない、だが君はまだ本気を出していない。',
    ],
    C: [
      '次はきっとやれる。諦めるな、クルー。',
      '航海は長い。失敗も経験の一つだ、顔を上げろ。',
    ],
  },

  greeting() {
    return this.greetings[Math.floor(Math.random() * this.greetings.length)];
  },

  rankLine(rank) {
    const pool = this.rank[rank] || this.rank.C;
    return pool[Math.floor(Math.random() * pool.length)];
  },
};

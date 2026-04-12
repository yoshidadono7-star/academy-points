// TypingHero - 落下英単語を撃退するタイピングミニゲーム (45秒)
//
// ルール:
//   - 画面上から英単語が降ってくる (最大4つ同時)
//   - 物理キーボードでタイプ → 単語を正しく打ち切ると爆発して撃退
//   - 底まで到達した単語はミス扱い
//   - 45秒後の撃破数 × 3 Gold を報酬として表示
//
// 入力モデル:
//   - 打鍵時、未ロックなら画面上で一致する prefix の最下単語をロック
//   - ロック中は次文字一致 → 進行、不一致 → ロック解除して再試行
//
// クライアント完結。
// TODO(step-D+): submitMinigameScore Cloud Function に置き換える。

class TypingHero extends Phaser.Scene {
  constructor() {
    super('TypingHero');
  }

  init(data) {
    this.returnScene = (data && data.returnScene) || 'MinigameHubScene';

    this.timeLimit = 45000;
    this.startTime = 0;
    this.gameActive = false;
    this.resultShown = false;

    this.defeated = 0;
    this.missed = 0;

    this.fallingWords = [];
    this.lockedWord = null;
    this.typedCount = 0;

    this.spawnTimer = null;
    this.gameTimer = null;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b0a18');
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.drawUI();
    this.setupKeyboardInput();
    MinigameQuit.attach(this, {
      returnScene: this.returnScene,
      onConfirm: () => { this.gameActive = false; },
    });
    this.showHowToPlay();
  }

  showHowToPlay() {
    MinigameHowTo.show(this, {
      title: 'TYPING HERO — あそびかた',
      lines: [
        '1. 画面の上から英単語が降ってきます',
        '2. キーボードで単語を正確にタイプすると撃退できます',
        '3. 45秒以内にできるだけ多く撃退しよう!',
        '4. 単語が画面下まで落ちるとミスになります',
      ],
      accent: '#86efac',
      onStart: () => this.startCountdown(),
    });
  }

  // ---------------------------------------------------------
  //  UI
  // ---------------------------------------------------------
  drawUI() {
    const gfx = this.add.graphics();
    gfx.fillStyle(Style.intColors.bgDeep, 0.9);
    gfx.fillRect(0, 0, 800, 50);
    gfx.lineStyle(1, Style.intColors.accent, 0.4);
    gfx.lineBetween(0, 49, 800, 49);

    // 左: タイマー
    this.timerText = this.add.text(12, 14, '45.0s', {
      fontFamily: Style.fonts.en, fontSize: '18px',
      color: Style.colors.accent, fontStyle: '700'
    });

    // 中央: タイトル
    this.add.text(400, 17, 'タイピング勇者', {
      fontFamily: Style.fonts.jp, fontSize: '14px',
      color: '#86efac', fontStyle: '700'
    }).setOrigin(0.5, 0);

    // 右: 撃破カウンタ
    this.hitsText = this.add.text(788, 14, '撃破: 0', {
      fontFamily: Style.fonts.jp, fontSize: '16px',
      color: '#86efac', fontStyle: '700'
    }).setOrigin(1, 0);

    this.timerBarBg = this.add.graphics();
    this.timerBarBg.fillStyle(0x1f2937);
    this.timerBarBg.fillRect(0, 46, 800, 4);
    this.timerBar = this.add.graphics();

    // 星背景
    const rng = new Phaser.Math.RandomDataGenerator(['typing-hero-stars']);
    const stars = this.add.graphics();
    for (let i = 0; i < 80; i++) {
      stars.fillStyle(rng.pick([0x374151, 0x4b5563, 0x6b7280]));
      stars.fillRect(rng.between(0, 800), rng.between(60, 500), 1, 1);
    }

    // 地面ライン (ミス判定ライン)
    this.groundY = 500;
    const ground = this.add.graphics();
    ground.lineStyle(2, 0xef4444, 0.6);
    ground.lineBetween(0, this.groundY, 800, this.groundY);
    ground.lineStyle(1, 0xef4444, 0.25);
    ground.lineBetween(0, this.groundY + 4, 800, this.groundY + 4);

    // 入力プロンプト (下部) — 大きく、done/rest を色分け
    const promptBg = this.add.graphics();
    promptBg.fillStyle(0x111827, 0.9);
    promptBg.fillRect(0, 525, 800, 75);
    promptBg.lineStyle(1, 0x374151);
    promptBg.lineBetween(0, 525, 800, 525);

    this.add.text(400, 540, '↓ 単語を正確にタイプせよ ↓', {
      fontFamily: Style.fonts.jp, fontSize: '11px', color: Style.colors.textFaint
    }).setOrigin(0.5, 0);

    // タイプ済み (金) + 残り (白) を別 Text で中央に並べる
    this.promptDoneText = this.add.text(0, 580, '', {
      fontFamily: Style.fonts.en, fontSize: '28px',
      color: Style.colors.accent, fontStyle: '900'
    }).setOrigin(0, 0.5);
    this.promptRestText = this.add.text(0, 580, '— 待機中 —', {
      fontFamily: Style.fonts.en, fontSize: '28px',
      color: Style.colors.textMuted, fontStyle: '700'
    }).setOrigin(0, 0.5);
    this.layoutPrompt();

    // HIT! / MISS! トースト用 text (初期は非表示)
    this.toastText = this.add.text(400, 300, '', {
      fontFamily: Style.fonts.en, fontSize: '64px',
      color: Style.colors.accent, fontStyle: '900'
    }).setOrigin(0.5).setDepth(150).setAlpha(0);
  }

  layoutPrompt() {
    // done + rest を中央揃えでレイアウト
    const doneW = this.promptDoneText.width;
    const restW = this.promptRestText.width;
    const totalW = doneW + restW;
    const startX = 400 - totalW / 2;
    this.promptDoneText.setX(startX);
    this.promptRestText.setX(startX + doneW);
  }

  showToast(text, color) {
    if (!this.toastText) return;
    this.toastText.setText(text).setColor(color).setAlpha(1).setScale(0.6);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({
      targets: this.toastText,
      scale: 1.2,
      alpha: 0,
      duration: 500,
      ease: 'Quad.easeOut',
    });
  }

  updateScore() {
    if (this.hitsText) this.hitsText.setText(`撃破: ${this.defeated}`);
  }

  // ---------------------------------------------------------
  //  Input
  // ---------------------------------------------------------
  setupKeyboardInput() {
    this.input.keyboard.on('keydown', (event) => {
      if (!this.gameActive) return;
      const key = event.key;
      if (key && key.length === 1 && /[a-zA-Z]/.test(key)) {
        this.onTypeChar(key.toLowerCase());
      } else if (key === 'Escape' || key === 'Backspace') {
        this.clearLock();
      }
    });
  }

  onTypeChar(ch) {
    if (!this.lockedWord) {
      // 画面上で ch から始まる単語を探す (底に近い順)
      const candidates = this.fallingWords
        .filter(w => !w.dead && w.word.startsWith(ch))
        .sort((a, b) => b.container.y - a.container.y);
      if (candidates.length === 0) return;
      this.lockedWord = candidates[0];
      this.typedCount = 1;
      this.highlightLocked(this.lockedWord);
      this.updatePrompt();
      return;
    }

    const w = this.lockedWord;
    const expected = w.word[this.typedCount];
    if (ch === expected) {
      this.typedCount++;
      this.highlightLocked(w);
      this.updatePrompt();
      if (this.typedCount >= w.word.length) {
        this.defeatWord(w);
        this.clearLock();
      }
    } else {
      // 不一致 → ロック解除 + 他単語に乗り換えを試みる
      this.clearLock();
      this.onTypeChar(ch);
    }
  }

  clearLock() {
    if (this.lockedWord && !this.lockedWord.dead) {
      this.resetWordVisual(this.lockedWord);
    }
    this.lockedWord = null;
    this.typedCount = 0;
    this.updatePrompt();
  }

  updatePrompt() {
    if (!this.lockedWord) {
      this.promptDoneText.setText('');
      this.promptRestText.setText('— 待機中 —').setColor(Style.colors.textFaint);
      this.layoutPrompt();
      return;
    }
    const w = this.lockedWord.word;
    const done = w.slice(0, this.typedCount);
    const rest = w.slice(this.typedCount);
    this.promptDoneText.setText(done);
    this.promptRestText.setText(rest).setColor(Style.colors.textMuted);
    this.layoutPrompt();
  }

  // ---------------------------------------------------------
  //  Words
  // ---------------------------------------------------------
  wordPool() {
    return [
      'cat','dog','sun','star','moon','hero','book','game','fish','run',
      'jump','swim','play','read','write','happy','sad','love','hope','fire',
      'ice','snow','rain','wind','tree','leaf','rock','city','road','home',
      'milk','rice','apple','music','magic','sword','armor','brave','quest','quiz',
      'space','planet','rocket','shield','forest','knight','wizard','dragon','castle','school'
    ];
  }

  spawnWord() {
    if (!this.gameActive) return;
    if (this.fallingWords.filter(w => !w.dead).length >= 4) return;

    const pool = this.wordPool();
    const word = pool[Phaser.Math.Between(0, pool.length - 1)];

    const container = this.add.container(0, 70);
    const text = this.add.text(0, 0, word, {
      fontFamily: 'monospace', fontSize: '22px', color: '#e5e7eb', fontStyle: 'bold',
      backgroundColor: '#111827', padding: { x: 10, y: 5 }
    }).setOrigin(0.5);
    container.add(text);

    const width = text.width;
    const x = Phaser.Math.Between(60 + width / 2, 800 - 60 - width / 2);
    container.setX(x);

    const speed = Phaser.Math.Between(38, 58); // px/sec
    const obj = { word, container, text, speed, dead: false };
    this.fallingWords.push(obj);
  }

  highlightLocked(w) {
    const done = w.word.slice(0, this.typedCount);
    const rest = w.word.slice(this.typedCount);
    w.text.setText(`${done}${rest}`);
    w.text.setColor('#fbbf24');
    w.text.setBackgroundColor('#1e3a2f');
  }

  resetWordVisual(w) {
    w.text.setText(w.word);
    w.text.setColor('#e5e7eb');
    w.text.setBackgroundColor('#111827');
  }

  defeatWord(w) {
    w.dead = true;
    this.defeated++;
    this.updateScore();

    const x = w.container.x;
    const y = w.container.y;
    this.explosion(x, y);
    this.showToast('撃破!', Style.colors.accent);

    this.tweens.add({
      targets: w.container, alpha: 0, scale: 1.4, duration: 200,
      onComplete: () => w.container.destroy()
    });
  }

  explosion(x, y) {
    const burst = this.add.graphics().setDepth(50);
    burst.fillStyle(0xfbbf24, 1);
    burst.fillCircle(x, y, 6);
    burst.fillStyle(0xfde68a, 0.8);
    burst.fillCircle(x, y, 14);
    this.tweens.add({
      targets: burst, alpha: 0, duration: 300, onComplete: () => burst.destroy()
    });

    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.3;
      const dist = 20 + Math.random() * 20;
      const px = this.add.graphics().setDepth(50);
      px.fillStyle(Phaser.Utils.Array.GetRandom([0xfbbf24, 0xfde68a, 0xf97316]));
      px.fillRect(x, y, 3, 3);
      this.tweens.add({
        targets: px,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        alpha: 0,
        duration: 400,
        onComplete: () => px.destroy(),
      });
    }
  }

  // ---------------------------------------------------------
  //  Game flow
  // ---------------------------------------------------------
  startCountdown() {
    const text = this.add.text(400, 300, '3', {
      fontFamily: 'monospace', fontSize: '80px', color: '#fbbf24', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(200);

    let count = 3;
    this.time.addEvent({
      delay: 600,
      repeat: 2,
      callback: () => {
        count--;
        if (count > 0) {
          text.setText(count.toString());
          this.tweens.add({ targets: text, scale: 1.3, duration: 100, yoyo: true });
        } else {
          text.setText('GO!');
          this.tweens.add({
            targets: text, alpha: 0, scale: 2, duration: 350,
            onComplete: () => { text.destroy(); this.startGame(); }
          });
        }
      }
    });
  }

  startGame() {
    this.gameActive = true;
    this.startTime = Date.now();
    this.lastTick = Date.now();

    this.gameTimer = this.time.addEvent({
      delay: 16, loop: true, callback: () => this.tick()
    });

    // 初期スポーン
    this.spawnWord();
    this.spawnTimer = this.time.addEvent({
      delay: 1500, loop: true, callback: () => this.spawnWord()
    });
  }

  tick() {
    if (!this.gameActive) return;
    const now = Date.now();
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;

    // 単語落下
    this.fallingWords.forEach(w => {
      if (w.dead) return;
      w.container.y += w.speed * dt;
      if (w.container.y >= this.groundY) {
        this.missWord(w);
      }
    });

    // デッド単語の掃除
    this.fallingWords = this.fallingWords.filter(w => !w.dead || w.container.active);

    // タイマー
    const elapsed = now - this.startTime;
    const remaining = Math.max(0, this.timeLimit - elapsed);
    const seconds = (remaining / 1000).toFixed(1);
    this.timerText.setText(`${seconds}s`);

    const ratio = remaining / this.timeLimit;
    this.timerBar.clear();
    let color = 0x4ade80;
    if (ratio < 0.2) color = 0xef4444;
    else if (ratio < 0.5) color = 0xfbbf24;
    this.timerBar.fillStyle(color);
    this.timerBar.fillRect(0, 46, 800 * ratio, 4);
    if (ratio < 0.2) this.timerText.setColor('#ef4444');

    if (remaining <= 0) this.endGame();
  }

  missWord(w) {
    if (w.dead) return;
    w.dead = true;
    this.missed++;

    if (this.lockedWord === w) this.clearLock();

    this.cameras.main.flash(80, 239, 68, 68, false);
    this.showToast('ミス!', Style.colors.error);
    this.tweens.add({
      targets: w.container, alpha: 0, y: w.container.y + 20, duration: 220,
      onComplete: () => w.container.destroy()
    });
  }

  // ---------------------------------------------------------
  //  End / Result
  // ---------------------------------------------------------
  endGame() {
    if (this.resultShown) return;
    this.gameActive = false;
    if (this.gameTimer) { this.gameTimer.remove(); this.gameTimer = null; }
    if (this.spawnTimer) { this.spawnTimer.remove(); this.spawnTimer = null; }

    const goldGained = this.defeated * 3;

    // TODO(step-D+): submitMinigameScore Cloud Function を呼んで rpg_wallet に加算
    // await firebase.functions().httpsCallable('submitMinigameScore')({
    //   minigameId: 'typing_hero',
    //   score: this.defeated,
    //   duration: this.timeLimit,
    //   goldGained,
    // });

    let rank = 'C';
    let rankColor = '#9ca3af';
    if (this.defeated >= 15) { rank = 'S'; rankColor = '#fbbf24'; }
    else if (this.defeated >= 10) { rank = 'A'; rankColor = '#4ade80'; }
    else if (this.defeated >= 6)  { rank = 'B'; rankColor = '#60a5fa'; }

    this.showResult({ goldGained, rank, rankColor });
  }

  showResult(result) {
    this.resultShown = true;
    MiniResult.show(this, {
      title: 'リザルト',
      titleColor: '#86efac',
      lines: [
        `撃破数  ${this.defeated}`,
        `ミス    ${this.missed}`,
      ],
      rank: result.rank,
      rankColor: result.rankColor,
      gold: result.goldGained,
      flavor: CaptainMichael.rankLine(result.rank),
      onBack: () => this.returnHub(result),
    });
  }

  returnHub(result) {
    if (this.returning) return;
    this.returning = true;
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(this.returnScene, {
        lastResult: { title: 'タイピング勇者', gold: result.goldGained, rank: result.rank }
      });
    });
  }
}

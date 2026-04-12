// MemoryMatch - 神経衰弱ミニゲーム (60秒)
//
// ルール:
//   - 3x4 の12枚カード (6ペア)。絵柄は宇宙テーマ。
//   - 2枚めくって一致すればそのまま、違えば裏に戻る。
//   - 全ペア揃えば CLEAR → 残り時間に応じて S/A/B/C ランクと Gold 報酬。
//   - 60秒を使い切ったら強制終了 (未クリアは C ランク、揃ったペア分だけ Gold)。
//
// クライアント完結。
// TODO(step-D+): submitMinigameScore Cloud Function に置き換える。

class MemoryMatch extends Phaser.Scene {
  constructor() {
    super('MemoryMatch');
  }

  init(data) {
    this.returnScene = (data && data.returnScene) || 'MinigameHubScene';

    this.timeLimit = 60000;
    this.startTime = 0;
    this.gameActive = false;
    this.resultShown = false;

    this.cards = [];
    this.firstPick = null;
    this.secondPick = null;
    this.matchedPairs = 0;
    this.totalPairs = 6;
    this.inputLocked = false;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0c0a1a');
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.drawUI();
    this.buildBoard();
    MinigameQuit.attach(this, {
      returnScene: this.returnScene,
      onConfirm: () => { this.gameActive = false; this.inputLocked = true; },
    });
    this.showHowToPlay();
  }

  showHowToPlay() {
    MinigameHowTo.show(this, {
      title: 'MEMORY MATCH — あそびかた',
      lines: [
        '1. 12枚のカードが裏向きで並んでいます',
        '2. タップするとカードがめくれます',
        '3. 同じ絵柄を2枚めくれば成立!',
        '4. 60秒以内に全ペアを揃えよう!',
      ],
      accent: '#c4b5fd',
      onStart: () => this.startCountdown(),
    });
  }

  drawUI() {
    const gfx = this.add.graphics();
    gfx.fillStyle(Style.intColors.bgDeep, 0.9);
    gfx.fillRect(0, 0, 800, 50);
    gfx.lineStyle(1, Style.intColors.accent, 0.4);
    gfx.lineBetween(0, 49, 800, 49);

    this.add.text(12, 15, 'メモリーマッチ', {
      fontFamily: Style.fonts.jp, fontSize: '15px',
      color: '#c4b5fd', fontStyle: '700'
    });

    this.timerText = this.add.text(790, 14, '60.0s', {
      fontFamily: Style.fonts.en, fontSize: '18px',
      color: Style.colors.accent, fontStyle: '700'
    }).setOrigin(1, 0);

    this.scoreText = this.add.text(400, 16, '', {
      fontFamily: Style.fonts.en, fontSize: '14px', color: Style.colors.textMuted
    }).setOrigin(0.5, 0);
    this.updateScore();

    this.timerBarBg = this.add.graphics();
    this.timerBarBg.fillStyle(0x1f2937);
    this.timerBarBg.fillRect(0, 46, 800, 4);
    this.timerBar = this.add.graphics();
  }

  buildBoard() {
    const symbols = ['🚀', '🌙', '🌟', '☄', '🛸', '🪐'];
    const deck = [...symbols, ...symbols];
    Phaser.Utils.Array.Shuffle(deck);

    const cols = 4;
    const rows = 3;
    const cardW = 110;
    const cardH = 130;
    const gapX = 20;
    const gapY = 18;
    const totalW = cols * cardW + (cols - 1) * gapX;
    const totalH = rows * cardH + (rows - 1) * gapY;
    const startX = (800 - totalW) / 2 + cardW / 2;
    const startY = 80 + (600 - 80 - totalH) / 2 + cardH / 2;

    for (let i = 0; i < deck.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);
      this.cards.push(this.createCard(x, y, cardW, cardH, deck[i], i));
    }
  }

  createCard(x, y, w, h, symbol, index) {
    const container = this.add.container(x, y);
    const card = {
      container,
      symbol,
      index,
      faceUp: false,
      matched: false,
    };

    const back = this.add.graphics();
    this.drawCardBack(back, w, h);
    container.add(back);

    const frontBg = this.add.graphics();
    this.drawCardFront(frontBg, w, h, false);
    frontBg.setVisible(false);
    container.add(frontBg);

    const face = this.add.text(0, 0, symbol, {
      fontFamily: 'sans-serif', fontSize: '56px'
    }).setOrigin(0.5);
    face.setVisible(false);
    container.add(face);

    card.back = back;
    card.frontBg = frontBg;
    card.face = face;

    const hitRect = new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h);
    container.setInteractive({
      hitArea: hitRect,
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    container.on('pointerdown', () => this.onCardTap(card));

    card.w = w;
    card.h = h;
    return card;
  }

  drawCardBack(gfx, w, h) {
    gfx.clear();
    gfx.fillStyle(0x000000, 0.4);
    gfx.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w, h, 10);
    gfx.fillStyle(0x4c1d95, 1);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    gfx.lineStyle(2, 0xc4b5fd, 0.9);
    gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    gfx.lineStyle(1, 0xa78bfa, 0.5);
    gfx.strokeRoundedRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 6);
  }

  drawCardFront(gfx, w, h, highlight) {
    gfx.clear();
    gfx.fillStyle(0x000000, 0.4);
    gfx.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w, h, 10);
    gfx.fillStyle(highlight ? 0x1e3a2f : 0x1f2937, 1);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    gfx.lineStyle(2, highlight ? 0x4ade80 : 0x475569, 1);
    gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
  }

  // ---------------------------------------------------------
  //  Flow
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
    this.gameTimer = this.time.addEvent({
      delay: 50, loop: true, callback: () => this.updateTimer()
    });
  }

  updateTimer() {
    const elapsed = Date.now() - this.startTime;
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

    if (remaining <= 0) this.endGame(false);
  }

  updateScore() {
    this.scoreText.setText(`${this.matchedPairs} / ${this.totalPairs}`);
  }

  // ---------------------------------------------------------
  //  Card tap
  // ---------------------------------------------------------
  onCardTap(card) {
    if (!this.gameActive) return;
    if (this.inputLocked) return;
    if (card.faceUp || card.matched) return;

    this.flipUp(card);

    if (!this.firstPick) {
      this.firstPick = card;
      return;
    }

    if (this.firstPick && !this.secondPick) {
      this.secondPick = card;
      this.inputLocked = true;
      this.time.delayedCall(450, () => this.evaluatePair());
    }
  }

  flipUp(card) {
    card.faceUp = true;
    // scaleX 1→0→1 で裏表切替
    this.tweens.add({
      targets: card.container, scaleX: 0, duration: 120, ease: 'Linear',
      onComplete: () => {
        card.back.setVisible(false);
        card.frontBg.setVisible(true);
        card.face.setVisible(true);
        this.tweens.add({
          targets: card.container, scaleX: 1, duration: 120, ease: 'Linear'
        });
      }
    });
  }

  flipDown(card) {
    card.faceUp = false;
    this.tweens.add({
      targets: card.container, scaleX: 0, duration: 120, ease: 'Linear',
      onComplete: () => {
        card.back.setVisible(true);
        card.frontBg.setVisible(false);
        card.face.setVisible(false);
        this.tweens.add({
          targets: card.container, scaleX: 1, duration: 120, ease: 'Linear'
        });
      }
    });
  }

  evaluatePair() {
    const a = this.firstPick;
    const b = this.secondPick;
    if (!a || !b) {
      this.firstPick = null;
      this.secondPick = null;
      this.inputLocked = false;
      return;
    }

    if (a.symbol === b.symbol) {
      a.matched = true;
      b.matched = true;
      this.matchedPairs++;
      this.updateScore();
      this.matchEffect(a);
      this.matchEffect(b);

      this.firstPick = null;
      this.secondPick = null;
      this.inputLocked = false;

      if (this.matchedPairs >= this.totalPairs) {
        this.time.delayedCall(400, () => this.endGame(true));
      }
    } else {
      this.time.delayedCall(350, () => {
        this.flipDown(a);
        this.flipDown(b);
        this.firstPick = null;
        this.secondPick = null;
        this.time.delayedCall(260, () => { this.inputLocked = false; });
      });
    }
  }

  matchEffect(card) {
    this.drawCardFront(card.frontBg, card.w, card.h, true);
    const glow = this.add.graphics();
    glow.lineStyle(3, 0xfbbf24, 1);
    glow.strokeRoundedRect(-card.w / 2 - 2, -card.h / 2 - 2, card.w + 4, card.h + 4, 12);
    card.container.add(glow);
    this.tweens.add({
      targets: glow, alpha: 0, duration: 700, onComplete: () => glow.destroy()
    });
    this.tweens.add({
      targets: card.container, scale: 1.12, duration: 150, yoyo: true, ease: 'Sine.easeOut'
    });
  }

  // ---------------------------------------------------------
  //  End / Result
  // ---------------------------------------------------------
  endGame(cleared) {
    if (this.resultShown) return;
    this.gameActive = false;
    if (this.gameTimer) { this.gameTimer.remove(); this.gameTimer = null; }

    const elapsed = Date.now() - this.startTime;
    const remaining = Math.max(0, this.timeLimit - elapsed);
    const remainingSec = remaining / 1000;

    let rank = 'C';
    let rankColor = '#9ca3af';
    let goldGained = 0;

    if (cleared) {
      if (remainingSec >= 45) { rank = 'S'; rankColor = '#fbbf24'; goldGained = 100; }
      else if (remainingSec >= 30) { rank = 'A'; rankColor = '#4ade80'; goldGained = 80; }
      else if (remainingSec >= 15) { rank = 'B'; rankColor = '#60a5fa'; goldGained = 50; }
      else { rank = 'C'; rankColor = '#9ca3af'; goldGained = 30; }
    } else {
      // 未クリア → 揃ったペア分だけ Gold
      goldGained = this.matchedPairs * 5;
      rank = 'C';
      rankColor = '#9ca3af';
    }

    // TODO(step-D+): submitMinigameScore Cloud Function を呼んで rpg_wallet に加算
    // await firebase.functions().httpsCallable('submitMinigameScore')({
    //   minigameId: 'memory_match',
    //   score: this.matchedPairs,
    //   duration: elapsed,
    //   cleared,
    //   goldGained,
    // });

    this.showResult({ cleared, goldGained, rank, rankColor, remainingSec });
  }

  showResult(result) {
    this.resultShown = true;
    const lines = [
      `ペア  ${this.matchedPairs} / ${this.totalPairs}`,
      result.cleared
        ? `残り時間  ${result.remainingSec.toFixed(1)} 秒`
        : '時間切れ',
    ];
    MiniResult.show(this, {
      title: result.cleared ? 'クリア!' : 'タイムアップ',
      titleColor: result.cleared ? Style.colors.success : Style.colors.error,
      lines,
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
        lastResult: { title: 'メモリーマッチ', gold: result.goldGained, rank: result.rank }
      });
    });
  }
}

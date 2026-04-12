// MathFlash - 瞬間計算ミニゲーム (30秒)
//
// ルール:
//   - 画面に計算式が次々出る (+, -, × の3種)
//   - テンキー or キーボードで答えを入力 → Enter/OK で確定
//   - 正解でフラッシュ、誤答でシェイク
//   - 時間内の正解数 × 5 Gold を報酬として表示
//
// 報酬はクライアント側で計算して結果画面に表示するだけ。
// TODO(step-D+): submitMinigameScore Cloud Function に置き換える。

class MathFlash extends Phaser.Scene {
  constructor() {
    super('MathFlash');
  }

  init(data) {
    this.returnScene = (data && data.returnScene) || 'MinigameHubScene';

    this.timeLimit = 30000;
    this.correct = 0;
    this.incorrect = 0;
    this.total = 0;
    this.currentAnswer = '';
    this.currentQuestion = null;
    this.gameActive = false;
    this.startTime = 0;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0c0a1a');
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
    const title = 'MATH FLASH — あそびかた';
    const lines = [
      '1. 画面に計算式が表示されます',
      '2. テンキーで答えを入力',
      '3. Enter で決定 (または緑の OK ボタン)',
      '4. 30秒でできるだけ多く正解しよう!',
    ];
    const accent = '#a78bfa';
    MinigameHowTo.show(this, { title, lines, accent, onStart: () => this.startCountdown() });
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

    this.add.text(12, 15, 'マスフラッシュ', {
      fontFamily: Style.fonts.jp, fontSize: '15px',
      color: '#a78bfa', fontStyle: '700'
    });

    this.timerText = this.add.text(790, 14, '30.0s', {
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

    // 問題エリア
    const panel = this.add.graphics();
    panel.fillStyle(0x1e1b4b, 0.5);
    panel.fillRoundedRect(100, 110, 600, 150, 10);

    this.questionText = this.add.text(400, 162, '', {
      fontFamily: 'monospace', fontSize: '52px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.answerDisplay = this.add.text(400, 228, '_', {
      fontFamily: 'monospace', fontSize: '32px', color: '#4ade80'
    }).setOrigin(0.5);

    this.feedbackText = this.add.text(400, 290, '', {
      fontFamily: 'monospace', fontSize: '20px', color: '#4ade80', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.createKeypad();
  }

  createKeypad() {
    const keys = [
      ['7', '8', '9'],
      ['4', '5', '6'],
      ['1', '2', '3'],
      ['C', '0', 'OK'],
    ];
    const startX = 260;
    const startY = 340;
    const btnW = 80;
    const btnH = 54;
    const gap = 8;

    keys.forEach((row, r) => {
      row.forEach((key, c) => {
        const x = startX + c * (btnW + gap);
        const y = startY + r * (btnH + gap);

        const isOk = key === 'OK';
        const isClear = key === 'C';
        const bgColor = isOk ? '#1e3a2f' : (isClear ? '#3f1d1d' : '#1e293b');
        const textColor = isOk ? '#4ade80' : (isClear ? '#fca5a5' : '#e2e8f0');

        const btn = this.add.text(x + btnW / 2, y + btnH / 2, key, {
          fontFamily: 'monospace',
          fontSize: isOk ? '18px' : '22px',
          color: textColor,
          backgroundColor: bgColor,
          padding: { x: btnW / 2 - 10, y: btnH / 2 - 12 },
          align: 'center',
          fixedWidth: btnW,
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => btn.setAlpha(0.8));
        btn.on('pointerout', () => btn.setAlpha(1));
        btn.on('pointerdown', () => this.onKeyInput(key));
      });
    });
  }

  setupKeyboardInput() {
    this.input.keyboard.on('keydown', (event) => {
      if (!this.gameActive) return;
      if (event.key >= '0' && event.key <= '9') this.onKeyInput(event.key);
      else if (event.key === 'Enter') this.onKeyInput('OK');
      else if (event.key === 'Backspace' || event.key === 'Escape') this.onKeyInput('C');
    });
  }

  onKeyInput(key) {
    if (!this.gameActive) return;
    if (key === 'OK') {
      this.submitAnswer();
    } else if (key === 'C') {
      this.currentAnswer = '';
      this.answerDisplay.setText('_');
    } else {
      if (this.currentAnswer.length < 4) {
        this.currentAnswer += key;
        this.answerDisplay.setText(this.currentAnswer);
      }
    }
  }

  // ---------------------------------------------------------
  //  Flow
  // ---------------------------------------------------------
  startCountdown() {
    const text = this.add.text(400, 300, '3', {
      fontFamily: 'monospace', fontSize: '80px', color: '#fbbf24', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(100);

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
    this.nextQuestion();
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

    if (remaining <= 0) this.endGame();
  }

  updateScore() {
    this.scoreText.setText(`${this.correct} / ${this.total}`);
  }

  // ---------------------------------------------------------
  //  Question generation
  // ---------------------------------------------------------
  nextQuestion() {
    if (!this.gameActive) return;
    this.currentAnswer = '';
    this.answerDisplay.setText('_');
    this.feedbackText.setText('');
    this.currentQuestion = this.generateQuestion();
    this.questionText.setText(this.currentQuestion.display);
  }

  generateQuestion() {
    const type = Phaser.Utils.Array.GetRandom(['add', 'sub', 'mul']);
    let a, b, answer, display;
    switch (type) {
      case 'add': {
        a = Phaser.Math.Between(2, 50);
        b = Phaser.Math.Between(2, 50);
        answer = a + b;
        display = `${a} + ${b} = ?`;
        break;
      }
      case 'sub': {
        a = Phaser.Math.Between(10, 80);
        b = Phaser.Math.Between(1, a); // 正の結果のみ
        answer = a - b;
        display = `${a} - ${b} = ?`;
        break;
      }
      case 'mul': {
        a = Phaser.Math.Between(2, 9);
        b = Phaser.Math.Between(2, 9);
        answer = a * b;
        display = `${a} x ${b} = ?`;
        break;
      }
    }
    return { a, b, answer, display, type };
  }

  submitAnswer() {
    if (!this.gameActive || this.currentAnswer === '') return;
    const playerAnswer = parseInt(this.currentAnswer, 10);
    const isCorrect = playerAnswer === this.currentQuestion.answer;
    this.total++;
    if (isCorrect) { this.correct++; this.showFeedback(true); }
    else { this.incorrect++; this.showFeedback(false); }
    this.updateScore();
  }

  showFeedback(isCorrect) {
    if (isCorrect) {
      this.feedbackText.setText('せいかい!').setColor(Style.colors.success);
      this.cameras.main.flash(80, 16, 185, 129, false);
    } else {
      this.feedbackText.setText(`ざんねん (答: ${this.currentQuestion.answer})`)
        .setColor(Style.colors.error);
      this.cameras.main.shake(100, 0.005);
    }
    this.gameActive = false;
    this.time.delayedCall(350, () => {
      this.gameActive = true;
      this.nextQuestion();
    });
  }

  // ---------------------------------------------------------
  //  End / Result
  // ---------------------------------------------------------
  endGame() {
    if (!this.gameActive && this.resultShown) return;
    this.gameActive = false;
    if (this.gameTimer) { this.gameTimer.remove(); this.gameTimer = null; }

    const goldGained = this.correct * 5;

    // TODO(step-D+): submitMinigameScore Cloud Function を呼んで rpg_wallet に加算
    // await firebase.functions().httpsCallable('submitMinigameScore')({
    //   minigameId: 'math_flash', score: this.correct, duration: this.timeLimit, goldGained
    // });

    let rank = 'C';
    let rankColor = '#9ca3af';
    if (this.correct >= 12) { rank = 'S'; rankColor = '#fbbf24'; }
    else if (this.correct >= 9) { rank = 'A'; rankColor = '#4ade80'; }
    else if (this.correct >= 6) { rank = 'B'; rankColor = '#60a5fa'; }

    this.showResult({ correct: this.correct, total: this.total, goldGained, rank, rankColor });
  }

  showResult(result) {
    this.resultShown = true;
    MiniResult.show(this, {
      title: 'リザルト',
      titleColor: '#a78bfa',
      lines: [
        `せいかい数  ${this.correct} / ${this.total}`,
        `せいかい率  ${this.total > 0 ? Math.round((this.correct / this.total) * 100) : 0}%`,
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
        lastResult: { title: 'マスフラッシュ', gold: result.goldGained, rank: result.rank }
      });
    });
  }
}

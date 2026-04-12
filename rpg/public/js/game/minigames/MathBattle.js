class MathBattle extends Phaser.Scene {
  constructor() {
    super('MathBattle');
  }

  init(data) {
    this.difficulty = data.difficulty || 1;
    this.profile = data.profile || {};
    this.callerScene = data.callerScene || 'BattleScene';

    // ゲーム状態
    this.timeLimit = 30000; // 30秒
    this.correct = 0;
    this.incorrect = 0;
    this.total = 0;
    this.maxQuestions = 10;
    this.currentAnswer = '';
    this.currentQuestion = null;
    this.gameActive = false;
    this.startTime = 0;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0c0a1a');
    this.drawUI();
    this.startCountdown();
  }

  // =========================================================
  //  UI
  // =========================================================
  drawUI() {
    const gfx = this.add.graphics();

    // ヘッダー
    gfx.fillStyle(0x1e1b4b, 0.9);
    gfx.fillRect(0, 0, 800, 50);

    this.add.text(10, 14, 'MATH BATTLE', {
      fontFamily: 'monospace', fontSize: '16px', color: '#a78bfa', fontStyle: 'bold'
    });

    // タイマー
    this.timerText = this.add.text(790, 14, '30.0s', {
      fontFamily: 'monospace', fontSize: '16px', color: '#fbbf24'
    }).setOrigin(1, 0);

    // タイマーバー
    this.timerBarBg = this.add.graphics();
    this.timerBarBg.fillStyle(0x1f2937);
    this.timerBarBg.fillRect(0, 46, 800, 4);
    this.timerBar = this.add.graphics();

    // スコア表示
    this.scoreText = this.add.text(400, 14, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#e2e8f0'
    }).setOrigin(0.5, 0);
    this.updateScore();

    // 問題表示エリア
    gfx.fillStyle(0x1e1b4b, 0.5);
    gfx.fillRoundedRect(100, 120, 600, 140, 8);

    this.questionText = this.add.text(400, 170, '', {
      fontFamily: 'monospace', fontSize: '48px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    // 回答表示
    this.answerDisplay = this.add.text(400, 230, '', {
      fontFamily: 'monospace', fontSize: '32px', color: '#4ade80'
    }).setOrigin(0.5);

    // フィードバック
    this.feedbackText = this.add.text(400, 290, '', {
      fontFamily: 'monospace', fontSize: '20px', color: '#4ade80', fontStyle: 'bold'
    }).setOrigin(0.5);

    // テンキーパッド
    this.createKeypad();

    // キーボード入力
    this.setupKeyboardInput();
  }

  createKeypad() {
    this.keypadContainer = this.add.container(0, 0);

    const keys = [
      ['7', '8', '9'],
      ['4', '5', '6'],
      ['1', '2', '3'],
      ['-', '0', 'OK'],
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
        const bgColor = isOk ? '#1e3a2f' : '#1e293b';
        const textColor = isOk ? '#4ade80' : '#e2e8f0';

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

        this.keypadContainer.add(btn);
      });
    });

    // クリアボタン
    const clearBtn = this.add.text(startX + 3 * (btnW + gap) + btnW / 2, startY + btnH / 2, 'C', {
      fontFamily: 'monospace', fontSize: '20px', color: '#ef4444',
      backgroundColor: '#1e293b',
      padding: { x: 14, y: btnH / 2 - 12 },
      align: 'center',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    clearBtn.on('pointerdown', () => this.onKeyInput('C'));
    this.keypadContainer.add(clearBtn);
  }

  setupKeyboardInput() {
    this.input.keyboard.on('keydown', (event) => {
      if (!this.gameActive) return;

      if (event.key >= '0' && event.key <= '9') {
        this.onKeyInput(event.key);
      } else if (event.key === '-') {
        this.onKeyInput('-');
      } else if (event.key === 'Enter') {
        this.onKeyInput('OK');
      } else if (event.key === 'Backspace') {
        this.onKeyInput('C');
      }
    });
  }

  onKeyInput(key) {
    if (!this.gameActive) return;

    if (key === 'OK') {
      this.submitAnswer();
    } else if (key === 'C') {
      this.currentAnswer = '';
      this.answerDisplay.setText('_');
    } else if (key === '-') {
      // マイナスは先頭のみ
      if (this.currentAnswer === '') {
        this.currentAnswer = '-';
        this.answerDisplay.setText(this.currentAnswer);
      }
    } else {
      // 数字（最大5桁）
      if (this.currentAnswer.replace('-', '').length < 5) {
        this.currentAnswer += key;
        this.answerDisplay.setText(this.currentAnswer);
      }
    }
  }

  // =========================================================
  //  ゲームフロー
  // =========================================================
  startCountdown() {
    const countdownText = this.add.text(400, 300, '3', {
      fontFamily: 'monospace', fontSize: '64px', color: '#fbbf24', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(100);

    let count = 3;
    const timer = this.time.addEvent({
      delay: 600,
      repeat: 2,
      callback: () => {
        count--;
        if (count > 0) {
          countdownText.setText(count.toString());
          this.tweens.add({
            targets: countdownText, scale: 1.3, duration: 100, yoyo: true
          });
        } else {
          countdownText.setText('GO!');
          this.tweens.add({
            targets: countdownText, alpha: 0, scale: 2, duration: 300,
            onComplete: () => {
              countdownText.destroy();
              this.startGame();
            }
          });
        }
      }
    });
  }

  startGame() {
    this.gameActive = true;
    this.startTime = Date.now();
    this.nextQuestion();

    // タイマー更新
    this.gameTimer = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => this.updateTimer()
    });
  }

  updateTimer() {
    const elapsed = Date.now() - this.startTime;
    const remaining = Math.max(0, this.timeLimit - elapsed);
    const seconds = (remaining / 1000).toFixed(1);

    this.timerText.setText(`${seconds}s`);

    // タイマーバー
    const ratio = remaining / this.timeLimit;
    this.timerBar.clear();
    let color = 0x4ade80;
    if (ratio < 0.2) color = 0xef4444;
    else if (ratio < 0.5) color = 0xfbbf24;
    this.timerBar.fillStyle(color);
    this.timerBar.fillRect(0, 46, 800 * ratio, 4);

    // 残り少ないとテキストが赤く
    if (ratio < 0.2) {
      this.timerText.setColor('#ef4444');
    }

    // 時間切れ
    if (remaining <= 0) {
      this.endGame();
    }
  }

  updateScore() {
    this.scoreText.setText(`${this.correct} / ${this.total}`);
  }

  // =========================================================
  //  問題生成
  // =========================================================
  nextQuestion() {
    if (!this.gameActive) return;
    if (this.total >= this.maxQuestions) {
      this.endGame();
      return;
    }

    this.currentAnswer = '';
    this.answerDisplay.setText('_');
    this.feedbackText.setText('');
    this.currentQuestion = this.generateQuestion();
    this.questionText.setText(this.currentQuestion.display);
  }

  generateQuestion() {
    const d = this.difficulty;

    // 難易度に応じた問題タイプ
    const types = ['add', 'sub'];
    if (d >= 2) types.push('mul');
    if (d >= 3) types.push('div');

    const type = Phaser.Utils.Array.GetRandom(types);

    let a, b, answer, display;

    switch (type) {
      case 'add': {
        const max = d === 1 ? 20 : d === 2 ? 50 : 100;
        a = Phaser.Math.Between(1, max);
        b = Phaser.Math.Between(1, max);
        answer = a + b;
        display = `${a} + ${b} = ?`;
        break;
      }
      case 'sub': {
        const max = d === 1 ? 20 : d === 2 ? 50 : 100;
        a = Phaser.Math.Between(1, max);
        b = Phaser.Math.Between(1, a); // 正の結果を保証（d1-2）
        if (d >= 3) b = Phaser.Math.Between(1, max); // d3はマイナスもOK
        answer = a - b;
        display = `${a} - ${b} = ?`;
        break;
      }
      case 'mul': {
        const maxA = d === 2 ? 9 : 12;
        const maxB = d === 2 ? 9 : 12;
        a = Phaser.Math.Between(2, maxA);
        b = Phaser.Math.Between(2, maxB);
        answer = a * b;
        display = `${a} x ${b} = ?`;
        break;
      }
      case 'div': {
        b = Phaser.Math.Between(2, 9);
        answer = Phaser.Math.Between(2, 12);
        a = b * answer; // 割り切れる問題
        display = `${a} / ${b} = ?`;
        break;
      }
    }

    return { a, b, answer, display, type };
  }

  // =========================================================
  //  回答判定
  // =========================================================
  submitAnswer() {
    if (!this.gameActive || this.currentAnswer === '' || this.currentAnswer === '-') return;

    const playerAnswer = parseInt(this.currentAnswer, 10);
    const isCorrect = playerAnswer === this.currentQuestion.answer;

    this.total++;

    if (isCorrect) {
      this.correct++;
      this.showFeedback(true);
    } else {
      this.incorrect++;
      this.showFeedback(false);
    }

    this.updateScore();
  }

  showFeedback(isCorrect) {
    if (isCorrect) {
      this.feedbackText.setText('CORRECT!').setColor('#4ade80');
      // 正解フラッシュ
      this.cameras.main.flash(100, 74, 222, 128, false);
    } else {
      this.feedbackText.setText(`MISS! (${this.currentQuestion.answer})`).setColor('#ef4444');
      this.cameras.main.shake(100, 0.005);
    }

    // 次の問題へ（少し間を置く）
    this.gameActive = false;
    this.time.delayedCall(400, () => {
      this.gameActive = true;
      this.nextQuestion();
    });
  }

  // =========================================================
  //  ゲーム終了
  // =========================================================
  endGame() {
    this.gameActive = false;
    if (this.gameTimer) this.gameTimer.remove();

    const elapsed = Date.now() - this.startTime;

    // 結果をBattleSceneに通知して自身を閉じる
    const result = {
      correct: this.correct,
      total: this.total,
      timeMs: elapsed,
      subject: 'math',
    };

    // 結果表示
    this.showResult(result);
  }

  showResult(result) {
    // 暗転
    const overlay = this.add.graphics().setDepth(200);
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, 800, 600);

    const container = this.add.container(0, 0).setDepth(201);

    container.add(this.add.text(400, 150, 'RESULT', {
      fontFamily: 'monospace', fontSize: '28px', color: '#a78bfa', fontStyle: 'bold'
    }).setOrigin(0.5));

    const accuracy = this.total > 0 ? Math.round((this.correct / this.total) * 100) : 0;
    const timeStr = (result.timeMs / 1000).toFixed(1);

    const lines = [
      `Correct: ${this.correct} / ${this.total}`,
      `Accuracy: ${accuracy}%`,
      `Time: ${timeStr}s`,
    ];

    // 評価
    let rank = 'C';
    let rankColor = '#9ca3af';
    if (accuracy >= 90 && this.correct >= 7) { rank = 'S'; rankColor = '#fbbf24'; }
    else if (accuracy >= 80 && this.correct >= 5) { rank = 'A'; rankColor = '#4ade80'; }
    else if (accuracy >= 60 && this.correct >= 3) { rank = 'B'; rankColor = '#60a5fa'; }

    container.add(this.add.text(400, 220, lines.join('\n'), {
      fontFamily: 'monospace', fontSize: '16px', color: '#e2e8f0',
      align: 'center', lineSpacing: 8
    }).setOrigin(0.5));

    const rankText = this.add.text(400, 320, rank, {
      fontFamily: 'monospace', fontSize: '64px', color: rankColor, fontStyle: 'bold'
    }).setOrigin(0.5);
    rankText.setScale(0);
    this.tweens.add({ targets: rankText, scale: 1, duration: 400, ease: 'Back.easeOut' });
    container.add(rankText);

    const okBtn = this.add.text(400, 430, '[ Continue ]', {
      fontFamily: 'monospace', fontSize: '18px', color: '#4ade80',
      backgroundColor: '#1e3a2f', padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    okBtn.on('pointerover', () => okBtn.setColor('#86efac'));
    okBtn.on('pointerout', () => okBtn.setColor('#4ade80'));
    okBtn.on('pointerdown', () => {
      this.returnToBattle(result);
    });
    container.add(okBtn);

    // SPACEでも
    this.input.keyboard.once('keydown-SPACE', () => {
      this.returnToBattle(result);
    });
  }

  returnToBattle(result) {
    // BattleScene に結果を通知
    const battleScene = this.scene.get(this.callerScene);
    battleScene.events.emit('minigame-result', result);

    // BattleSceneを再開して自身を停止
    this.scene.resume(this.callerScene);
    this.scene.stop();
  }
}

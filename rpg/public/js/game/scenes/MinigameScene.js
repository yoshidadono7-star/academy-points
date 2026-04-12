class MinigameScene extends Phaser.Scene {
  constructor() {
    super('MinigameScene');
  }

  init(data) {
    this.subject = data.subject || 'math';
    this.difficulty = data.difficulty || 1;
    this.profile = data.profile || {};
  }

  create() {
    // 科目に応じたミニゲームを起動
    // Phase 0 では math のみ実装
    switch (this.subject) {
      case 'math':
      default:
        this.scene.start('MathBattle', {
          difficulty: this.difficulty,
          profile: this.profile,
          callerScene: 'BattleScene',
        });
        break;

      // Phase 1 で追加:
      // case 'english': ...
      // case 'japanese': ...
      // case 'science': ...
      // case 'social': ...
      // case 'speed_reading': ...
    }
  }
}

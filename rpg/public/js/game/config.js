const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  pixelArt: true,
  dom: { createContainer: true },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [
    BootScene,
    LoginScene,
    HomeTownScene,
    GachaScene,
    MinigameScene,
    MathBattle,
    MinigameHubScene,
    MathFlash,
    MemoryMatch,
    TypingHero,
  ]
};

const game = new Phaser.Game(config);

// GachaSystem - クライアント抽選 + Firestore 同期 (v2.0 Step 5)
//
// 現状:
//   - 抽選はクライアント側 (GachaSystem.roll)
//   - 保有チケットは rpg_gacha_tickets/{uid} を subscribe してミラー
//   - consume() はローカル decrement のみ (楽観更新)
//
// 既知の制限:
//   Firestore 側から更新 snapshot が来ると local state が上書きされるため、
//   サーバが新チケットを付与した瞬間にローカル draw 分がリセットされる。
//   これは rollGacha Cloud Function 未実装の暫定状態。
//
// TODO(step-6+): rollGacha Cloud Function を実装し、consume() をサーバ呼び出しに差し替える。

const GachaTickets = {
  standard: 0,
  premium: 0,
  daily_free_available: true,

  _unsub: null,
  _listeners: [],

  // Firestore の rpg_gacha_tickets/{uid} を subscribe してミラー開始
  subscribe(uid) {
    if (!uid) return;
    if (this._unsub) this._unsub();
    this._unsub = FirebaseSync.onTicketsChange(uid, (data) => {
      this.standard = data.standard || 0;
      this.premium = data.premium || 0;
      this.daily_free_available = data.daily_free_available !== false;
      this._listeners.forEach(fn => {
        try { fn(this); } catch (e) { console.error('GachaTickets listener error', e); }
      });
    });
  },

  unsubscribe() {
    if (this._unsub) {
      this._unsub();
      this._unsub = null;
    }
  },

  addListener(fn) {
    this._listeners.push(fn);
  },

  removeListener(fn) {
    this._listeners = this._listeners.filter(f => f !== fn);
  },

  canRoll(gachaType) {
    if (gachaType === 'standard')   return this.standard > 0;
    if (gachaType === 'premium')    return this.premium > 0;
    if (gachaType === 'daily_free') return this.daily_free_available;
    return false;
  },

  // ローカル楽観 decrement (TODO: rollGacha 実装時にサーバ呼び出しへ)
  consume(gachaType) {
    if (!this.canRoll(gachaType)) return false;
    if (gachaType === 'standard')   this.standard -= 1;
    if (gachaType === 'premium')    this.premium -= 1;
    if (gachaType === 'daily_free') this.daily_free_available = false;
    this._listeners.forEach(fn => {
      try { fn(this); } catch (e) { console.error('GachaTickets listener error', e); }
    });
    return true;
  },

  snapshot() {
    return {
      standard: this.standard,
      premium: this.premium,
      daily_free_available: this.daily_free_available
    };
  }
};

const GachaSystem = (() => {
  function rollRarity(weights) {
    const entries = Object.entries(weights).filter(([, w]) => w > 0);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = Math.random() * total;
    for (const [rarity, w] of entries) {
      r -= w;
      if (r <= 0) return rarity;
    }
    return entries[entries.length - 1][0];
  }

  function pickItem(rarity) {
    const pool = GACHA_ITEM_POOL.filter(it => it.rarity === rarity);
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  return {
    roll(gachaType) {
      const config = GACHA_TABLES[gachaType];
      if (!config) throw new Error(`Unknown gacha type: ${gachaType}`);
      const rarity = rollRarity(config.weights);
      const item = pickItem(rarity);
      return { gachaType, rarity, item };
    },

    isRareOrAbove(rarity) {
      return RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf('rare');
    },

    rarityStars(rarity) {
      const n = RARITY_ORDER.indexOf(rarity) + 1;
      return '★'.repeat(Math.max(1, n));
    },

    rarityColorHex(rarity) {
      return RARITY_COLORS[rarity] || '#ffffff';
    },

    rarityColorInt(rarity) {
      return Phaser.Display.Color.HexStringToColor(this.rarityColorHex(rarity)).color;
    }
  };
})();

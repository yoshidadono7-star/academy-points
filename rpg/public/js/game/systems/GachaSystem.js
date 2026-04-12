// GachaSystem - Firestore チケット同期 + 表示ユーティリティ
//
// 抽選・チケット消費・インベントリ追加は Cloud Function rollGacha がサーバ側で処理。
// クライアントは GachaTickets でチケット残数を表示し、FirebaseSync.rollGacha() を呼ぶ。

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


  snapshot() {
    return {
      standard: this.standard,
      premium: this.premium,
      daily_free_available: this.daily_free_available
    };
  }
};

const GachaSystem = (() => {
  return {
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

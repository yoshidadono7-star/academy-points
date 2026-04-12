class LoginScene extends Phaser.Scene {
  constructor() {
    super('LoginScene');
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.cameras.main.setBackgroundColor(Style.colors.bgDeep);
    this.busy = false;
    this.transitioning = false;

    // 星空 + 流れ星
    this.starfield = Style.starfield(this, { seed: 'login-stars', density: 220 });

    // タイトル
    this.add.text(width / 2, height * 0.16, "HERO'S ACADEMY", {
      fontFamily: Style.fonts.title,
      fontSize: '40px',
      color: Style.colors.accent,
      fontStyle: '900',
    }).setOrigin(0.5);

    // サブタイトル (アカデミー宇宙軍)
    this.add.text(width / 2, height * 0.16 + 48, '— アカデミー宇宙軍 入隊端末 —', {
      fontFamily: Style.fonts.jp,
      fontSize: '13px',
      color: Style.colors.textDim,
      letterSpacing: 2,
    }).setOrigin(0.5);

    // 下部ステータステキスト
    this.statusText = this.add.text(width / 2, height * 0.88, '', {
      fontFamily: Style.fonts.jp, fontSize: '13px',
      color: Style.colors.error, align: 'center'
    }).setOrigin(0.5);

    this.createLoginForm(width, height);

    firebase.auth().onAuthStateChanged((user) => {
      if (user && !this.transitioning) {
        this.onAuthed(user);
      }
    });
  }

  shutdown() {
    if (this.starfield && this.starfield.shootingStarTimer) {
      this.starfield.shootingStarTimer.remove();
      this.starfield.shootingStarTimer = null;
    }
  }

  createLoginForm(width, height) {
    const jpFont = `'Noto Sans JP','Hiragino Sans',sans-serif`;
    const enFont = `'Orbitron',monospace`;
    const html = `
      <div style="
        display:flex; flex-direction:column; align-items:center; gap:16px;
        font-family: ${jpFont}; color:#e5e7eb;
        background: linear-gradient(180deg, #111827 0%, #0b1020 100%);
        border:2px solid #fbbf24aa; border-radius:14px;
        padding:26px 30px; width:320px;
        box-shadow:0 0 32px rgba(251,191,36,0.25), 0 8px 24px rgba(0,0,0,0.6);
      ">
        <div style="
          font-family:${enFont}; font-size:14px; color:#fbbf24;
          letter-spacing:3px; font-weight:700;
        ">▸ LOGIN ◂</div>

        <label style="width:100%; font-size:12px; color:#9ca3af;">ニックネーム
          <input id="rpg-nickname" type="text" autocomplete="off" spellcheck="false"
            placeholder="例: ほし太"
            style="
              width:100%; margin-top:6px; padding:10px 12px;
              background:#0b1222; border:1px solid #475569; border-radius:8px;
              color:#f3f4f6; font-family:${jpFont}; font-size:15px; outline:none;
              transition:border-color 0.15s;
            " />
        </label>

        <label style="width:100%; font-size:12px; color:#9ca3af;">PIN (4桁の数字)
          <input id="rpg-pin" type="tel" inputmode="numeric" pattern="[0-9]*" maxlength="4"
            autocomplete="off" placeholder="────"
            style="
              width:100%; margin-top:6px; padding:10px 12px;
              background:#0b1222; border:1px solid #475569; border-radius:8px;
              color:#fbbf24; font-family:${enFont}; font-size:22px; font-weight:700;
              outline:none; letter-spacing:12px; text-align:center;
            " />
        </label>

        <button id="rpg-login-btn" type="button" style="
          width:100%; margin-top:6px; padding:12px 0;
          background:linear-gradient(180deg,#fbbf24,#d97706);
          border:none; border-radius:8px;
          color:#1a1a3e; font-family:${jpFont}; font-size:16px; font-weight:700;
          cursor:pointer; letter-spacing:4px;
          box-shadow:0 0 16px rgba(251,191,36,0.5);
          transition: transform 0.1s, box-shadow 0.15s;
        ">ログイン</button>
      </div>
    `;

    this.formDom = this.add.dom(width / 2, height * 0.58).createFromHTML(html);

    const nicknameEl = this.formDom.getChildByID('rpg-nickname');
    const pinEl = this.formDom.getChildByID('rpg-pin');
    const btnEl = this.formDom.getChildByID('rpg-login-btn');

    this.nicknameEl = nicknameEl;
    this.pinEl = pinEl;
    this.btnEl = btnEl;

    pinEl.addEventListener('input', () => {
      pinEl.value = pinEl.value.replace(/[^0-9]/g, '').slice(0, 4);
    });

    const trySubmit = () => this.handleLogin();

    btnEl.addEventListener('click', trySubmit);

    nicknameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); pinEl.focus(); }
    });
    pinEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); trySubmit(); }
    });

    setTimeout(() => nicknameEl && nicknameEl.focus(), 100);
  }

  setStatus(msg, color = '#ef4444') {
    if (this.statusText) {
      this.statusText.setText(msg);
      this.statusText.setColor(color);
    }
  }

  setBusy(busy) {
    this.busy = busy;
    if (!this.btnEl) return;
    this.btnEl.disabled = busy;
    this.btnEl.textContent = busy ? '通信中…' : 'ログイン';
    this.btnEl.style.opacity = busy ? '0.6' : '1';
    this.btnEl.style.cursor = busy ? 'default' : 'pointer';
  }

  async handleLogin() {
    if (this.busy) return;

    const nickname = (this.nicknameEl.value || '').trim();
    const pin = (this.pinEl.value || '').trim();

    if (!nickname) {
      this.setStatus('ニックネームを入力してください、クルー。');
      this.nicknameEl.focus();
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      this.setStatus('PIN は 4桁の数字で入力してください。');
      this.pinEl.focus();
      return;
    }

    this.setBusy(true);
    this.setStatus('アカデミーに問い合わせ中…', Style.colors.successDim);

    try {
      const callable = firebase.functions().httpsCallable('createRpgAuthToken');
      const res = await callable({ nickname, pin });
      const data = res && res.data;
      if (!data || !data.token) {
        throw new Error('トークンを取得できませんでした');
      }

      this.pendingStudent = {
        studentId: data.studentId,
        studentName: data.studentName,
        studentNickname: data.studentNickname,
        studentCallsign: data.studentCallsign,
      };

      this.setStatus('認証成功。搭乗を許可します…', Style.colors.success);
      await firebase.auth().signInWithCustomToken(data.token);
      // onAuthStateChanged が発火して onAuthed が呼ばれる
    } catch (err) {
      console.error('[LoginScene] login failed:', err);
      const msg = this.humanizeAuthError(err);
      this.setStatus(msg);
      this.setBusy(false);
    }
  }

  humanizeAuthError(err) {
    const code = err && (err.code || '');
    const msg = (err && err.message) || '';
    if (code === 'functions/not-found' || /not-found/.test(msg)) {
      return 'ニックネームか PIN が違うようだ。もう一度確認してくれ。';
    }
    if (code === 'functions/invalid-argument' || /invalid-argument/.test(msg)) {
      return '入力内容に誤りがある。ニックネームと 4桁 PIN を確認してくれ。';
    }
    if (/network/i.test(msg)) {
      return '通信エラーだ。接続を確認してもう一度試してくれ。';
    }
    return '認証に失敗した。もう一度試してくれ、クルー。';
  }

  async onAuthed(user) {
    if (this.transitioning) return;
    this.transitioning = true;

    FirebaseSync.setUser(user);
    GachaTickets.subscribe(user.uid);

    if (this.pendingStudent) {
      FirebaseSync.setStudentMeta(this.pendingStudent);
    } else {
      // セッション復元ケース: Custom Token クレームから復元
      try {
        const res = await user.getIdTokenResult();
        const c = res && res.claims;
        FirebaseSync.setStudentMeta({
          studentId: user.uid,
          studentName: (c && (c.studentCallsign || c.studentNickname || c.studentName)) || 'Hero',
          studentNickname: (c && c.studentNickname) || '',
          studentCallsign: (c && c.studentCallsign) || '',
        });
      } catch (e) {
        FirebaseSync.setStudentMeta({ studentId: user.uid, studentName: 'Hero' });
      }
    }

    try {
      let profile = await FirebaseSync.getProfile(user.uid);
      if (!profile) {
        profile = await FirebaseSync.createProfile(user.uid, {});
      }
      this.goToHomeTown(profile);
    } catch (err) {
      console.error('[LoginScene] profile load failed:', err);
      this.setStatus('プロフィールの読み込みに失敗した。少し待って再試行してくれ。');
      this.transitioning = false;
      this.setBusy(false);
    }
  }

  goToHomeTown(profile) {
    if (this.formDom) { this.formDom.destroy(); this.formDom = null; }
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('HomeTownScene', { profile });
    });
  }
}

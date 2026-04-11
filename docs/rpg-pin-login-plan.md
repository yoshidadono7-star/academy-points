# RPG PIN ログイン実装計画

## 背景

現在、RPG (`hero-s-points-rpg.web.app`) は Google ログインを使っているが、
以下の問題がある:

- 塾長の1アカウントを全員で使うと、全員の報酬が混ざる
- 生徒1人1つの Google アカウントは非現実的（小学生等）
- アカウント紐付けUIも結局手動作業が必要

**解決**: academy-points で既に使っている「ニックネーム + PIN」ログインを RPG にも適用。

---

## 設計

### 認証フロー

```
1. 生徒が hero-s-points-rpg.web.app を開く
2. LoginScene で「ニックネーム + PIN」を入力
3. RPG が Cloud Function `createRpgAuthToken(nickname, pin)` を呼び出し
4. Cloud Function が Firestore で students をクエリ
5. 生徒が見つかれば、student.id を UID とした Firebase Custom Token を生成して返す
6. RPG は signInWithCustomToken(token) で Firebase Auth セッションを確立
7. firebase.auth().currentUser.uid === student.id
8. rpg_profiles/{student.id}, rpg_wallet/{student.id} 等がそのまま使える
```

### 利点

- ✅ Google アカウント不要
- ✅ アカウント紐付け作業不要（student.id = Firebase UID になる）
- ✅ 既存の RpgBridgeDB (academy-points) のロジックがそのまま使える
  - `rpg_account_links` による resolveRpgUid は自然に student.id を返すようになる
- ✅ 小学生でも使える
- ✅ 既存の PIN 認証システムを活用

### デメリット

- ⚠️ RPG 側の LoginScene, FirebaseSync, Cloud Functions の改修が必要
- ⚠️ PIN は 4 桁なので理論上ブルートフォース可能（小規模塾なら許容範囲）

---

## 実装タスク

### academy-rpg 側 (ローカル Claude で実装)

#### 1. Cloud Function `createRpgAuthToken` 新規作成

**ファイル**: `~/academy-rpg/functions/createRpgAuthToken.js`

```javascript
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * createRpgAuthToken
 *
 * 生徒のニックネーム + PIN を受け取り、該当する生徒のCustom Tokenを返す。
 * RPG側は返ってきたトークンでsignInWithCustomTokenする。
 *
 * 入力: { nickname: string, pin: string }
 * 出力: { token: string, studentId: string, studentName: string }
 */
module.exports = onCall(async (request) => {
  const { nickname, pin } = request.data || {};

  // 入力バリデーション
  if (!nickname || typeof nickname !== 'string') {
    throw new HttpsError('invalid-argument', 'nickname is required');
  }
  if (!pin || typeof pin !== 'string' || pin.length !== 4) {
    throw new HttpsError('invalid-argument', 'pin must be 4 digits');
  }

  // Firestore から生徒を検索
  const snap = await db.collection('students')
    .where('nickname', '==', nickname.trim())
    .where('pin', '==', pin.trim())
    .limit(1)
    .get();

  if (snap.empty) {
    throw new HttpsError('not-found', 'ニックネームまたはPINが正しくありません');
  }

  const student = snap.docs[0];
  const studentId = student.id;
  const studentData = student.data();

  // Custom Token 生成 (UID = student.id)
  const customToken = await admin.auth().createCustomToken(studentId, {
    studentName: studentData.name,
    studentNickname: studentData.nickname,
    studentCallsign: studentData.callsign,
    grade: studentData.grade,
  });

  return {
    token: customToken,
    studentId: studentId,
    studentName: studentData.callsign || studentData.nickname || studentData.name,
  };
});
```

#### 2. `functions/index.js` に追加

```javascript
exports.createRpgAuthToken = require('./createRpgAuthToken');
```

#### 3. `LoginScene.js` を全面書き換え

- Google ログインボタンを削除
- ニックネーム入力フォーム + PIN入力フォーム
- 「ログイン」ボタンで Cloud Function 呼び出し
- 返ってきた Custom Token で `signInWithCustomToken`
- エラー表示

**HTML要素を Phaser 上にオーバーレイする必要がある** (DOM要素)。
または、Phaser の rexUI / テキスト入力プラグインを使うか、
シンプルに `this.add.dom` で HTML input を埋め込むか。

推奨: `this.add.dom().createFromHTML()` でログインフォームをDOM注入。

#### 4. `FirebaseSync.js` の `createProfile` を調整

- 現状: Google ログインユーザの displayName を使ってプロフィールを作成
- 変更後: Custom Token のクレーム (studentName, studentNickname, etc.) から値を取得

#### 5. `HomeTownScene.js` の HUD 名前表示

- 現状: Google アカウント名が表示されている
- 変更後: student.callsign か nickname を表示

### academy-points 側 (このクラウドセッションで対応)

変更不要！ RpgBridgeDB の `resolveRpgUid` は自然に student.id を返すので、
rpg_* コレクションが全て student.id をキーに統一される。

**オプション**: 紐付けUI は混乱を避けるため削除するか、非表示にする。
ただし、暫定的に残しておいても害はない。

---

## ローカル Claude への指示文

以下を academy-rpg ディレクトリで開いた Claude に貼り付けてください:

---

```
RPG の認証を Google ログインから PIN ログインに切り替えます。
academy-points と同じ「ニックネーム + PIN」で認証する方式です。

理由: 生徒1人1つのGoogleアカウントは非現実的。
academy-points の student.id を Firebase Auth UID として使うことで、
RPG と academy-points の連携を完全に一致させたい。

実装内容:

1. Cloud Function `createRpgAuthToken` 新規作成
   - 入力: { nickname, pin }
   - 処理: Firestore の students コレクションから該当生徒を検索
   - 出力: Firebase Custom Token (UID = student.id)
   - ファイル: functions/createRpgAuthToken.js
   - index.js にエクスポート追加

2. LoginScene.js 全面書き換え
   - Google ログインを廃止
   - ニックネーム入力 + PIN 入力フォーム (4桁)
   - 「ログイン」ボタン
   - エラー表示
   - 成功時: signInWithCustomToken(token) → HomeTownScene へ遷移
   - DOM オーバーレイ方式 (this.add.dom().createFromHTML()) を推奨

3. FirebaseSync.js の createProfile を調整
   - Google の displayName ではなく、
     Custom Token のクレーム (studentName, studentNickname, studentCallsign) を使用
   - もしくは Cloud Function から studentName を返してもらい、クライアント側で保持

4. HomeTownScene.js の HUD
   - 名前表示を callsign/nickname ベースに変更

5. デプロイ
   - firebase deploy --only functions,hosting:hero-s-points-rpg --project hero-s-points

各ステップで確認を取りながら進めてください。

補足:
- academy-points と同じ Firestore の students コレクションを参照します
- PIN は 4桁固定
- 複数の生徒が同じニックネームを持つことは無い想定 (PINで区別)
- 既存の Phase 0 アーカイブタグ phase0-archive はそのまま残してOK
- 既存の Google ログイン関連コードは削除してOK
- signInWithPopup は不要になる
```

---

## テスト手順

実装後、以下の順でテスト:

1. RPG サイトにアクセス
2. ニックネーム + PIN を入力 (例: 「ジロー」「1234」)
3. ログイン成功 → ホームタウン画面
4. `firebase.auth().currentUser.uid` が academy-points の student.id と一致するか確認
5. academy-points で学習セッションを完了 (ポモドーロ) → RPG 画面の HUD に Gold/XP が反映されるか
6. RPG の Shop でガチャチケットを確認 → +1 されているか

## リスク・考慮事項

### セキュリティ

- PIN は 4桁 (1/10000 の確率) なので、総当り攻撃されると簡単に破られる可能性
- 対策 (後日):
  - Cloud Function にレート制限を追加 (1分あたり5回まで等)
  - 失敗回数カウント + 一時ロック
- 現時点では小規模塾なので許容範囲

### マイグレーション

- 既に Google ログインで作成された rpg_profiles データ (G8DutIDrdRZboRo6s6W7sp9o33B2 等)
  はそのまま残る
- 新しい PIN ログインで作られるプロフィールは student.id ベース
- 古いデータは放置か手動削除

### 紐付けUIの扱い

- 管理画面に追加したRPG紐付けUIは PIN ログイン導入後は **不要**
- 当面は残しておいて、動作確認後に削除する

# Academy RPG 連携: 完了状況と今後

## ✅ 完了した実装 (2026-04-11)

### Step 5 (初期版)
- academy-points から rpg_* コレクションへ報酬書き込み
- `RpgBridgeDB` ヘルパーを db.js に追加
- ポモドーロ完走時の自動報酬付与 (student.html)
- Firestore Rules の `rpg_*` 権限追加

### Step 5.1 (PIN ログイン切り替え)
- RPG を Google ログインから **PIN ログイン** に切替
- Cloud Function `createRpgAuthToken` を追加 (academy-rpg 側)
- nickname + pin → student.id を UID とした Custom Token を発行
- LoginScene, FirebaseSync, HomeTownScene を改修
- **結果**: RPG の Firebase Auth UID = academy-points の student.id

### Step 5.2 (クリーンアップ)
- RpgBridgeDB.resolveRpgUid を簡素化 (常に student.id を返すだけ)
- 管理画面の RPG 紐付けUI を非表示化 (コードは残存、style:display:none)
- 🎮連携バッジも非表示化

---

## 🎯 現在の動作

```
生徒が RPG にアクセス
  ↓
ニックネーム + PIN でログイン
  ↓
Cloud Function createRpgAuthToken が students コレクションを検索
  ↓
student.id を UID とした Custom Token を発行
  ↓
RPG は signInWithCustomToken で認証
  ↓
firebase.auth().currentUser.uid === student.id ✅

勉強 (academy-points)
  ↓
RpgBridgeDB.awardForPomodoro(student.id, ...)
  ↓
Firestore: rpg_wallet/{student.id}, rpg_profiles/{student.id} 等に書き込み
  ↓
RPG 画面が onSnapshot で即時反映
```

---

## 🔮 今後のタスク

### B. ミニゲーム3種実装 (ローカル Claude)
- MathFlash (30秒計算バトル)
- MemoryMatch (1分記憶カード)
- TypingHero (45秒タイピング)
- MinigameHubScene (選択画面)

### C. 日本語化 + デザイン磨き上げ (ローカル Claude)
- 全UIテキストを日本語化
- アイテム名を世界観に合わせた和名に
- 配色・フォント・演出調整

### D. rollGacha サーバ権威化 (ローカル Claude)
- ガチャ抽選を Cloud Function に移動
- チート防止

### E. 塾長向け使い方ガイド (クラウド Claude)
- 生徒・保護者・スタッフ向け操作説明
- トラブルシューティング

---

## 🗑️ 廃止・非推奨

### `rpg_account_links` コレクション
- PIN ログイン導入前は academy-points 生徒ID と Google UID の紐付けに使っていた
- PIN ログイン後は不要
- 既存データはそのまま残してOK (害は無い)

### 管理画面の RPG 紐付けUI
- `openRpgLinkModal`, `saveRpgLink`, `unlinkRpgAccount` 関数
- `🎮連携済/未連携` ボタン
- すべて display:none で非表示化、将来不要なら削除

### RpgBridgeDB.resolveRpgUid
- 互換性のために残してあるが、常に studentId を返すだけ
- 将来的に削除してもよい

---

## 📝 運用メモ

### 古い rpg_profiles データ (Google UID 期)
先に Google ログインでテストしていた時のデータが残っている:
- `rpg_profiles/G8DutIDrdRZboRo6s6W7sp9o33B2` (先生のGoogle UID)
- `rpg_wallet/G8DutIDrdRZboRo6s6W7sp9o33B2`
- `rpg_gacha_tickets/G8DutIDrdRZboRo6s6W7sp9o33B2`

PIN ログイン後はこのデータにアクセスされない。放置してよいが、
気になるなら Firebase Console から手動削除可能。

### Firestore Rules の single source of truth
academy-points/firestore.rules が SSOT。
academy-rpg 側からは今後 rules をデプロイしないこと。

```bash
cd ~/academy-points
firebase deploy --only firestore:rules --project hero-s-points
```

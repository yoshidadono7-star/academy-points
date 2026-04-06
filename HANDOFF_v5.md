# HERO'S ACADEMY セッション引き継ぎ文書 v5

**最終更新**: 2026年4月6日 | **ブランチ**: `claude/heros-academy-system-FiDg0`
**前回セッション（v4まで）**: コミット70個 / Phase 0〜7
**今回セッション**: コミット7個追加（cdade2c〜d15cf45）| +1,613行

---

## 今回セッションの実施内容

### Phase 8: バグ修正・未実装機能接続・全画面拡充（4/6）— コミット71-77

#### コミット71: 既知の未解決事項4件を修正
1. **学習ルート読み込みエラー**: `loadRouteProgressCards`/`loadExamCountdown`/`loadMaterialProgressCards` にnullチェック追加
2. **チェックアウト未呼び出し**: `logout()` を async化、`AttendanceDB.checkOut()` + `ActiveSessionsDB.end()` を呼び出し
3. **一蓮托生ボーナス**: `stopStudy()` にギルド全員学習ボーナス（メンバー数×10pt）の加算ロジック実装
4. **コマンダーバフ**: `CommanderBuffDB` を db.js に新規追加。CP50→ポイント+20%（30分間）、CP100→ボスダメージ×1.5（60分間）を実適用

#### コミット72: 未実装機能6件を接続・実装
1. **宇宙マップ全体画面** (`screenSpaceMap`): SPACE_STATIONS 10段階 + HIDDEN_AREAS 6箇所の縦型マップUI。ホームからタップで遷移
2. **月間ストーリーテーマ**: `STORY_THEMES` をホーム画面上部に「CHAPTER N/12」バナー表示
3. **シールド防衛ミッション**: `SHIELD_DEFENSE_MISSIONS` を5月/10月のデイリーミッション抽選に統合（3枠中1枠）
4. **報酬カタログ** (`screenRewards`): `RewardsDB` 全5メソッド + `StudentsDB.spendPoints()` をランク制限付き交換UIで接続
5. **サポート艦隊行動記録**: `logSupportAction()` を管理画面に接続。サポーター行に🤝ボタン追加
6. **自動通知**: `NotificationsDB.add()` をバッジ獲得・ボス討伐時に自動Firestore記録

#### コミット73: 全画面の機能拡充
- **[致命的バグ修正]** `parent.html` に `db.js` のimportが欠落 → 学習ルート・教材進捗・出席確認が完全に動作不能だった
- **保護者画面**: 「🚀 宇宙冒険」タブ新設（宇宙マップ進捗 + ギルド情報カード + 隠しエリア発見状況）
- **教室モニター**: ストーリーテーマに説明文(desc)追加、スペースマップに各生徒の次ステーション進捗バー追加
- **生徒画面**: 学習履歴に「💰 ポイント取引」タブ追加（`CoinsDB.getByStudent()`接続）、ランキングに「ギルド」タブ追加

#### コミット74: 管理画面に報酬カタログ管理UI追加
- 「🏆 報酬カタログ」タブ新設: `RewardsDB` の完全CRUD管理（追加/編集/削除モーダル）
- カテゴリ(グッズ/体験/特権/地域)、レベル(1-4)、必要ランク、クールダウン日数の設定
- 交換履歴テーブル表示
- Firestoreインデックス3件追加（rewards, rewardHistory, coins）

#### コミット75: 完了画面の変数スコープ修正 + briefing初期化改善 + seedデータ拡充
- **[致命的バグ修正]** `showCompleteScreen()` に `commanderMultiplier`/`commanderBossBuff`/`allStudiedBonus` が渡されておらず、完了画面でこれらが表示不能だった
- **briefing.html**: `Promise.all` → `Promise.allSettled` に変更（1モジュール失敗で全画面停止を防止）。`init()` を `DOMContentLoaded` 内に移動
- **seed-data.js**: サンプル報酬カタログ10件（Lv.1-4×4カテゴリ）+ サンプル景品4件を追加

#### コミット76: 重要なsilent catchブロックにエラーログ追加
- DB書き込み・セッション管理・ポイント計算・認証の empty `catch(e) {}` 11箇所に `console.warn/error` 追加
- 対象: `AttendanceDB`, `ActiveSessionsDB`, `GuildsDB`, `CommanderBuffDB`, `SupportFleetDB`, parent.html auto-login

#### コミット77: 未使用DBメソッドをUI接続
- `PrizesDB.getHistory()` → 景品画面に交換履歴セクション追加
- `SpaceMapDB.equipTitle()` → 宇宙マップの隠しエリア称号に「装備」ボタン追加
- `RewardsDB.getByLevel()` → 報酬カタログにLv.1-4フィルタボタン追加
- `RouteTasksDB.getOverdue()` → 管理画面の学習ルートタブに全生徒遅延タスクアラート追加

---

## 現在のファイル状態

| ファイル | 行数 | 役割 |
|---------|------|------|
| student.html | 4,053 | 生徒画面（学習・ポイント・ゲーミフィケーション） |
| index.html | 5,502 | 管理画面（全機能管理・23タブ） |
| db.js | 2,764 | データモデル・DB操作・ゲームロジック |
| briefing.html | 1,489 | 教室モニター |
| parent.html | 1,121 | 保護者画面 |

---

## 新規追加されたDBオブジェクト・コレクション

### CommanderBuffDB（新規）
```
コレクション: commanderBuffs
メソッド: activate(type, durationMinutes), getActive(), getPointMultiplier(), getBossDamageMultiplier()
用途: CP50→ポイント+20%（30分間）、CP100→ボスダメージ×1.5（60分間）
```

### Firestoreルール追加
- `commanderBuffs`: read=true, write=isAdmin()

### Firestoreインデックス追加（3件）
- rewards: level + cost
- rewardHistory: studentId + exchangedAt
- coins: studentId + createdAt

---

## 新規追加された画面・機能

### 生徒画面（student.html）新規画面
| 画面ID | 名前 | 機能 |
|--------|------|------|
| screenSpaceMap | 宇宙マップ | 全10ステーション+6隠しエリアの俯瞰マップ、称号装備 |
| screenRewards | 報酬カタログ | ランク制限付き報酬交換、Lv別フィルタ |

### 生徒画面 既存画面の拡張
- ホーム: 月間ストーリーバナー（CHAPTER N/12）、スペースマップタップで全体マップ遷移
- 景品交換: 交換履歴セクション追加
- ランキング: 「ギルド」タブ追加
- 学習履歴: 「ポイント取引」タブ追加
- マイページメニュー: 「🚀 宇宙マップ」「🎖️ 報酬カタログ」リンク追加
- 完了画面: コマンダーバフ表示、一蓮托生ボーナス表示

### 管理画面（index.html）
- 「🏆 報酬カタログ」タブ新設（CRUD完備）
- サポーター行に支援行動記録ボタン（🤝）
- 学習ルートタブに全生徒遅延タスクアラート
- コマンダーCP: maxCp=100に変更、CP50/CP100の2段階バフ発動

### 保護者画面（parent.html）
- `db.js` import追加（致命的バグ修正）
- 「🚀 宇宙冒険」タブ新設（宇宙マップ進捗+ギルド情報+隠しエリア）

### 教室モニター（briefing.html）
- ストーリーテーマにCHAPTER番号+説明文追加
- スペースマップに各生徒の次ステーション進捗バー追加
- init()をPromise.allSettled化（部分的ロード可能）
- DOMContentLoadedイベント内で初期化

---

## ポイント計算フロー（更新版）

```
1. basePoints = 分数 + ポモドーロボーナス(5pt×回数)
2. イベント重複判定（セッション開始〜終了 ∩ イベント発動〜終了 ≠ 空）
3. コマンダーバフ倍率取得（CommanderBuffDB.getPointMultiplier → 1.0 or 1.2）
4. points = round(basePoints × eventMultiplier × commanderMultiplier) + eventBonusPoints
5. ギルドポイント加算
6. 一蓮托生ボーナス判定（ギルド全員学習済み → メンバー数×10pt）
7. コンボボーナス加算
8. サポーター艦隊バフ取得
9. コマンダーボスバフ取得（CommanderBuffDB.getBossDamageMultiplier → 1.0 or 1.5）
10. レイドボスダメージ計算（弱点/耐性/コンボ/サポーター/コマンダーバフ）
11. バッジ判定 → 通知自動記録
12. ミッション達成判定
13. 隠しエリア解放判定
```

---

## 既知の残存事項（低優先度）

### 未使用DBメソッド（約12件、CRUDユーティリティ）
将来のUI拡張時に使用可能な状態で保持。削除不要。
- `GuildsDB.update/getRanking`, `MissionsDB.getActive/getById/update`
- `EventsDB.getAll`, `MaterialProgressDB.getByStudent/addBulk`
- `ExamSchedulesDB.update/getAll`, `StudyRoutesDB.update`, `RouteTasksDB.update/getByStudent`
- `ConditionsDB.getByStudent`, `CoinsDB.getByDateRange`

### 残りのsilent catch（約15件）
振動API・UI表示のみの軽微なcatchブロック。実害なし。

### 大規模リファクタリング候補
- HTMLファイルの分割（student.html 4,053行、index.html 5,502行）
- CSS/JSの外部ファイル化
- コンポーネント的な構造への移行

---

## デプロイ手順（変更なし）
```bash
cd ~/academy-points
git checkout main
git merge claude/heros-academy-system-FiDg0
npx firebase deploy --project hero-s-points
```

---

## seed-data.js の実行
新しいseedAll()は以下を含む：
1. 4月ストーリーチャプター
2. 4月レイドボス（重力の番人ガルヴァトン）
3. **サンプル報酬カタログ10件**（Lv.1-4、グッズ/体験/特権/地域）
4. **サンプル景品4件**

実行方法: 管理画面ログイン → F12 → Console → `seedAll()`

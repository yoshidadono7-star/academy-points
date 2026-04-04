# HERO'S ゲーミフィケーション・システム — セッション引き継ぎ文書 v3

**セッション日時:** 2026年4月4日
**プロジェクト:** academy-points
**ブランチ:** `claude/gamification-system-design-4JP9t`（mainにマージ済み）
**公開URL:** https://hero-s-points.web.app
**作業者:** Claude (Opus 4.6)

---

## 1. このセッションで何をしたか（全体サマリー）

前回セッション（4/2）で設計・実装されたdb.jsの7モジュール+マルチバース翻訳システムに対応する**UIを全画面に実装**し、**Firebase Hostingへのデプロイ**と**GitHub Actions自動化**を完了した。

### 前回（4/2）からの引き継ぎ事項（HANDOFF.md参照）
- db.jsに7モジュール+893行追加済み（SpaceMap, Combo, DailyMissions, Boss Damage, Story, SupportFleet, マルチバース翻訳）
- 設計ドキュメント7本（HTML）作成済み
- HANDOFF.mdのセクション5（A〜E）が次回TODO

### 今回の成果
1. **student.html UI実装**（+774行）— 宇宙マップ、ミッション3択、コンボ図鑑、完了画面拡張、ボス弱点表示、テーマ切替、世界観選択画面
2. **index.html 管理UI追加**（+412行）— ボス戦略設定、ストーリー管理タブ、ORBIT設定、サポート艦隊、コマンダーCP、保護者PIN
3. **briefing.html モニター拡張**（+377行）— SpaceMapパネル、Storyパネル、Boss弱点パネル、コマンダーバフ演出
4. **parent.html 修正** — db二重宣言バグ修正、エラーハンドリング強化
5. **db.js 修正** — SpaceMapDBにgetStation/getStationProgressメソッド追加
6. **Firebase Hosting デプロイ** — APIキー設定、初回デプロイ完了
7. **GitHub Actions** — mainブランチpush時の自動デプロイ設定

---

## 2. 成果物一覧（変更ファイル）

### 14コミット（mainにマージ済み）

| # | コミット | ファイル | 内容 |
|---|---------|---------|------|
| 1 | 383c9b2 | student.html | PROJECT: ORBIT UI実装 — 6機能追加 |
| 2 | 4a20d73 | index.html | 管理UI拡張 — ボス戦略・ストーリー・サポート艦隊・コマンダーCP |
| 3 | a90b6f9 | briefing.html | モニター拡張 — 宇宙マップ・ストーリー・ボス弱点・コマンダーバフ |
| 4 | 2eff6ac | student.html | 世界観セレクト画面（次元ゲート）を実装 |
| 5 | e1f3575 | firebase.json, DEPLOY.md | デプロイ準備 |
| 6 | 7083d57 | firebase-config.js | 実APIキー設定 |
| 7 | 657c4f6 | db.js | SpaceMapDBメソッド追加 |
| 8 | 1d388a2 | briefing.html | ボスパネルエラー表示改善 |
| 9 | 3b61ac4 | index.html | 保護者PINフィールド追加 |
| 10 | 1d91bae | parent.html | db二重宣言修正 |
| 11 | dcdf774 | parent.html | Promise.allSettled変更 |
| 12 | 2fd03b4 | parent.html | 全データ読込関数にtry-catch追加 |
| 13 | ee08ab7 | parent.html | showPortal全体にtry-catch + calcLevel安全チェック |
| 14 | bf9d46e | .github/workflows/ | GitHub Actions自動デプロイ |

### ファイルサイズ

| ファイル | 行数 | 役割 |
|---------|------|------|
| student.html | 2,870行 | 生徒用モバイルPWA |
| index.html | 3,836行 | 先生用管理ダッシュボード |
| briefing.html | 1,322行 | 教室モニター（SF風） |
| parent.html | 623行 | 保護者ポータル |
| db.js | 2,090行 | データ層（23モジュール+翻訳） |

---

## 3. 各画面の現在の状態

### student.html（生徒用PWA）— 17画面

| 画面 | 状態 | 備考 |
|------|------|------|
| ログイン | OK | ニックネーム+4桁PIN |
| 世界観選択 | OK | worldId未設定時に表示、6世界カード+プレビュー |
| ホーム | OK | 宇宙マップ+デイリーミッション3択+クイックアクション6ボタン |
| コンディション | OK | 気分/エネルギー/やる気の絵文字選択 |
| タスク | OK | タスク一覧+完了ボタン |
| 学習モード選択 | OK | 科目/場所/方法選択 |
| タイマー | OK | ポモドーロ/通常切替、startHour記録追加 |
| 学習完了 | OK | 9ステップ処理（コンボ+ボスダメージ+ミッション+バッジ） |
| ランキング | OK | ポイント/ストリーク/レベル切替 |
| 景品交換 | OK | ポイント消費で景品交換 |
| 履歴 | OK | 日付別学習ログ |
| バッジ | OK | 19バッジの獲得/未獲得表示 |
| コンボ図鑑 | OK | 13コンボの発見/未発見/隠し表示 |
| メッセージ | OK | 先生からのメッセージ+返信 |
| ギルド | OK | ギルド情報+メンバー一覧（Phase 2用） |
| レイドボス | OK | HPバー+弱点/耐性/特殊能力表示 |
| プロフィールメニュー | OK | 次元シフト期間中は世界観変更ボタン表示 |

### index.html（管理画面）— 19タブ

| タブ | 状態 | 今回の変更 |
|------|------|-----------|
| ランキング | OK | — |
| 学習モニター | OK | — |
| タスク管理 | OK | — |
| コンディション | OK | — |
| 履歴 | OK | — |
| 景品交換 | OK | — |
| メッセージ | OK | — |
| 生徒管理 | OK | ORBIT設定追加（testType/weakSubject/targetStation/role/parentPin）、サポーター切替ボタン |
| ギルド | OK | — |
| レイドボス | OK | 弱点/耐性/特殊能力の作成UI追加、一覧にも表示 |
| **ストーリー** | **NEW** | チャプター作成/進捗更新/決着機能、月次テーマ表示 |
| ミッション | OK | — |
| イベント | OK | — |
| ポイント経済 | OK | — |
| コーチング分析 | OK | — |
| アノマリー | OK | — |
| 離脱リスク | OK | — |
| テスト結果 | OK | — |
| 塾設定 | OK | — |
| **ヘッダー** | OK | コマンダーCPゲージ追加 |

### briefing.html（教室モニター）— 8パネル

| パネル | 状態 | 備考 |
|--------|------|------|
| CURRENT MISSION | OK | ミッション未設定時は「なし」表示 |
| **SPACE MAP** | **NEW** | 全31名のステーション別位置表示 |
| MONTHLY RANKING | OK | トップ5表示 |
| LIVE FEED | OK | リアルタイムフィード |
| **STORY** | **NEW** | 月次テーマ+チャプター進捗+イベント統合 |
| **RAID BOSS** | **NEW** | 弱点/耐性/特殊能力タグ表示 |
| TODAY'S STATS | OK | 学習時間/ポモドーロ/ポイント/ストリーク |
| **コマンダーバフ** | **NEW** | CP閾値到達で金色グロー+バナー演出 |

---

## 4. インフラ状態

| 項目 | 状態 | 詳細 |
|------|------|------|
| Firebase Hosting | 稼働中 | https://hero-s-points.web.app |
| Firestore | 稼働中 | インデックス2つ作成済み（raidBosses, studyLogs） |
| Firebase Auth | 稼働中 | メール/パスワード、管理者3アカウント |
| GitHub Actions | 稼働中 | mainブランチpush→自動デプロイ |
| サービスアカウントキー | 更新済み | 古いキー削除、新キーGitHub Secretsに登録 |
| FCMプッシュ通知 | 未設定 | VAPIDキーがプレースホルダーのまま |

### Firestoreインデックス（作成済み）

| コレクション | フィールド1 | フィールド2 |
|-------------|-----------|-----------|
| raidBosses | defeated (Asc) | createdAt (Desc) |
| studyLogs | date (Asc) | createdAt (Desc) |

### 追加インデックスが必要になる可能性があるクエリ

| コレクション | クエリ | 発生タイミング |
|-------------|--------|--------------|
| tasks | active==true + orderBy(createdAt, desc) | タスク一覧表示時 |
| studyLogs | studentId + orderBy(createdAt, desc) | 生徒の学習履歴表示時 |
| comboTriggers | studentId + comboId + orderBy(date, desc) | コンボクールダウン判定時 |
| dailyMissionDraws | studentId + date | ミッションドロー時 |
| examResults | studentId + orderBy(date, desc) | 保護者ポータルのテスト結果 |
| badges | studentId + orderBy(timestamp, desc) | 保護者ポータルのバッジ表示 |
| messages | studentId + orderBy(sentAt, desc) | 保護者ポータルのメッセージ |

---

## 5. 重要な設計決定事項（前回から引き継ぎ）

- **4層ゲームループ:** 月次(ストーリー)→週次(ボス戦略)→日次(ミッション3択)→セッション(コンボ発見)
- **マルチバース:** ルールは1つ。表示だけが6パターン。先生の設定は1回
- **Phase移行:** 期日ではなく5条件ベース
- **コマンダーシステム:** 先生は通常業務でCP自動蓄積、閾値で自動バフ
- **世界観変更:** 年4回（7月/9月/11月/1月）の各1週間限定

---

## 6. 次回セッションでやるべきこと（優先順）

### A. parent.html の本格改修 【高】
- `studySessions`コレクション参照を`studyLogs`に変更（現在存在しないコレクションを参照している）
- 学習サマリー・ヒートマップ・科目グラフをstudyLogsベースで再実装
- バッジIDの不一致修正（parent.htmlの`BADGE_DEFS`とdb.jsの`BADGE_DEFINITIONS`）

### B. Firestoreインデックス追加 【高】
- 上記表のクエリに対応するインデックスを必要に応じて作成
- エラー発生時はConsoleのリンクからワンクリック作成可能

### C. FCMプッシュ通知の設定 【中】
- FirebaseコンソールでVAPIDキーを取得
- student.htmlの`VAPID_KEY`を更新
- sw.jsのプッシュ通知ハンドラー確認

### D. ストーリーチャプター初期データ投入 【中】
- 管理画面のストーリータブから4月チャプター（LAUNCH: 発進と軌道投入）を作成
- ルート設定（理想/標準/フォールバック）
- 週次テキスト4週分

### E. レイドボス作成テスト 【中】
- 管理画面から弱点/耐性/特殊能力付きのボスを作成
- 生徒画面・モニター画面での表示確認
- calculateBossDamageの戦略性テスト

### F. Service Workerキャッシュ戦略の改善 【低】
- 現在sw.jsが全URLをキャッシュしており、chrome-extensionのURLでエラーが出る
- キャッシュ対象のフィルタリング追加が必要

### G. GitHub Pages の無効化 【低】
- Firebase Hostingに移行済みなので、GitHub Pagesは不要
- Settings → Pages → 無効化 で対応

---

## 7. 技術的な注意事項

1. **Firestoreの複合インデックス** — where+orderByの複合クエリ使用時はインデックス必須。Consoleエラーのリンクからワンクリック作成可能
2. **Service Worker** — hero-s-points.web.appのキャッシュが強力。変更反映にはCmd+Shift+R（強制リロード）が必要。それでもダメならDevTools → Application → Clear site data
3. **FCMプッシュ通知** — VAPID_KEYがプレースホルダーのまま
4. **parent.htmlのdb.js非読込** — parent.htmlはdb.jsを読み込まず、直接Firestoreにアクセスする設計。calcLevel等のヘルパーが使えない
5. **ComboDB.buildContext()** — 複数のFirestoreクエリを並列実行するので初回は遅い可能性あり
6. **conditionFn** — COMBO_DEFINITIONS等の条件関数はFirestoreにシリアライズ不可。定数としてコード内に保持
7. **世界観選択の初回表示** — worldId未設定の生徒は初回ログイン時に次元ゲート画面を表示。isDimensionShiftOpen()とは別の分岐

---

## 8. 参照すべき過去資料

| 資料 | 内容 |
|------|------|
| HANDOFF.md | 4/2セッションの引き継ぎ（db.jsの全モジュール詳細、定数一覧） |
| DEPLOY.md | Firebaseデプロイ手順書（吉田さんPC用） |
| CLAUDE_HEROS_STORYTELLING.md | 4/1セッション全記録（フレームワークv4、空間設計、ギルド8原則） |
| HEROS_統合設計書_V2_深掘り全文版_FINAL.docx | 47万字の全10章 |
| system-overview.html | 既存5画面の機能整理マップ |
| game-design-v2.html | ゲームデザイン2.0（5要素の概要設計） |
| detailed-specs.html | 5モジュールの詳細技術仕様 |
| annual-plan.html | PROJECT: ORBIT 年間計画12ヶ月 |

---

## 9. コミット履歴（本セッション分・14コミット）

```
bf9d46e GitHub Actions: Firebase Hosting自動デプロイワークフロー追加
ee08ab7 parent.html: showPortal全体にtry-catch追加 + calcLevel安全チェック
2fd03b4 parent.html: 全データ読込関数にtry-catch追加
dcdf774 parent.html: Promise.allSettledに変更しローディング無限待機を修正
1d91bae parent.html: db変数の二重宣言を修正
3b61ac4 index.html: 生徒管理に保護者PINフィールドを追加
1d388a2 briefing.html: ボスパネルのエラー表示を改善（待機中に変更）
657c4f6 db.js: SpaceMapDBにgetStation/getStationProgressメソッドを追加
7083d57 firebase-config.js: 実際のAPIキー・プロジェクト設定を反映
e1f3575 デプロイ準備: firebase.json更新 + DEPLOY.md手順書追加
2eff6ac student.html: 世界観セレクト画面（次元ゲート）を実装
a90b6f9 briefing.html: モニター画面拡張 — 宇宙マップ・ストーリー・ボス弱点・コマンダーバフ
4a20d73 index.html: 管理UI拡張 — ボス戦略設定・ストーリー管理・サポート艦隊・コマンダーCP
383c9b2 student.html: PROJECT: ORBIT UI実装 — 6機能追加
```

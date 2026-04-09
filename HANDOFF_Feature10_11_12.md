# セッション引き継ぎ文書 (2026-04-09)
## Feature 10 (艦長マイケル) + Feature 11 (ポイント経済) + Feature 12 (目標駆動型経済)

---

## 1. 本セッションで実装した機能一覧

### Feature 10: 艦長マイケル
- `briefing.html` に教室長キャラクター「艦長マイケル」(SVG: 四角顔+黒縁メガネ+口髭+艦長帽)
- AI 自動生成 (Claude Haiku 4.5) / 手動上書きのハイブリッド方式
- Firestore `dailyBriefing/{YYYY-MM-DD}` にキャッシュ
- 管理画面 (index.html) の「今日のプラン」タブに手動上書き入力欄
- タイプライター演出 + 回転リング + ソースタグ (手動/AI/自動)

### Feature 11: ポイント経済ガバナンス
- **F1**: economy タブに可視化ダッシュボード (日次グラフ/カテゴリ別/発行者別/ランキング/ログビューア)
- **F2**: 予算上限 (BudgetLimitsDB: role別月次/日次上限、オーナー編集UI)
- **C1**: イベント影響ダッシュボード + 履歴の bonus pt 表示
- **R1-R4**: 換金レート (1pt=¥1) + 原価モデリング + 責務ダッシュボード + サンプルカタログ14件
- **D1**: 特別付与テンプレート (10件サンプル、1クリック付与、F2連動)
- **S1**: 集団目標 (日曜開室/ドリンクバー/設備UP、生徒からの能動的貢献、briefing表示)

### Feature 12: 目標駆動型経済
- **X1**: 個人目標 (PersonalGoalsDB、生徒が目標設定→教室長承認→週次判定)
- **X2**: 週次自動判定エンジン (一括判定ボタン、レベル別ペナルティ)
- **X3**: ギルド9個再編 (星座テーマ: オリオン〜フェニックス、5-6名×9、自動割り当て)
- **X5**: コーチング連動 (個人目標の進捗をAIバディのコンテキストに統合)

### セキュリティ強化
- `makeMeOwner()` Console バックドア削除
- Firestore Rules: users/{uid}.role の自己書き換え禁止
- owner.html にテスト運用中アラートバナー
- ドキュメント2版体制 (_owner.html/pdf + _staff.html/pdf)

### UX改善
- タイマー自動スタート復活
- タブ切替時の先頭サブタブ自動遷移 + active下線修正
- briefing の集団目標バー (flex-wrap 2段表示)
- ログビューアのサマリーバー + タイムゾーン修正

### AI バディプロンプト強化
- アドラー心理学5大原則を明示 (目的論/全体論/主体論/対人関係論/共同体感覚)
- 勇気づけ vs 勇気くじきの詳細ガイド
- チームフロー要素 (ギルド連動)
- 科学的学習法8手法 (アクティブリコール/分散学習/インターリービング/精緻化/プロテジェ効果/テスト効果/メタ認知/デュアルコーディング)

---

## 2. 現在のブランチと最新コミット

- **ブランチ**: `claude/mission-control-dashboard-ctqvd`
- **本番URL**: https://hero-s-points.web.app
- **Firebase プロジェクト**: `hero-s-points`

---

## 3. 未デプロイのコミット

以下が塾長の Mac から `git pull && firebase deploy --only hosting --project hero-s-points` で反映待ち:
- コーチングプロンプト強化 (アドラー式 + 科学的学習法)
- X5 コーチング連動

---

## 4. 決定済みの方針 (塾長が承認済み)

### ポイント経済
- 1 pt = ¥1 (換金レート)
- 月間報酬予算: ¥75,000
- 権限モデル: 予算上限型 (owner無制限、admin月10,000pt、teacher月3,000pt/日300pt/1回100pt)
- 講師にも限定付与権限あり

### マイナスポイント (ペナルティ)
- レベル別スケーリング: Lv1-2は完全保護 (ペナルティ0)、Lv上昇に伴い増加
- 段階的: 1週目=警告のみ、2週目=半額、3週目=全額+コーチング介入
- 個人ptのフロア=0 (0を下回らない)
- ギルド連帯責任は軽め

### ギルド
- 9ギルド × 5-6名 (星座テーマ)
- 学年混成 (小中高混在)
- テストデータなので自由に再編可能

### 進級システム (Phase Y、未実装)
- C方式: 年度/累計の2本立て
- リセットタイミング: 4/1固定
- totalPoints永続、yearlyPoints/currentPointsリセット

### LEAGUES
- 格下げ (briefing から削除→分析タブに移動、Phase X6)

### コーチング哲学
- アドラー式コーチング × チームフロー (平本昭雄先生・宮越大樹先生)
- 7つの設計原則 (45期モジュール資料に記載)

---

## 5. 次セッションの最優先タスク

### 最優先: 資料読み込み + AI バディ完全統合
以下の3資料を全文読んで AI バディプロンプトに統合:
1. `docs/adler-coaching.txt` (214p, 169KB) - アドラー心理学入門 OCR
2. `docs/45期_全9モジュール統合要約_MissionControl設計基盤.md` (2,398行) - チームフロー9モジュール
3. `docs/learning-methods.txt` (325p, 489KB) - 科学的学習法 OCR

### 自動化 (Layer 1/2 の改善)
- 週次目標判定を土曜夜に自動実行 (現在は手動ボタン)
- 個人目標の承認を AI 自動承認 (合理的範囲内なら)
- 新入生のギルド自動割り当て (生徒登録時)

### 残り Phase
- X4: ギルド目標 + 週次判定 (チーム単位のPDCA)
- X6: LEAGUES 格下げ
- Y: 進級システム (C方式 + 4/1固定)
- A1: 基本レート Firestore 化
- B1: 時間帯/曜日ブースト

---

## 6. 塾長の未完了タスク

- **A-7**: admin@heros.jp のパスワード変更 (Firebase Console → Authentication)
- **最終デプロイ**: `git pull && firebase deploy --only hosting --project hero-s-points`

---

## 7. 将来構想 (塾長のアイデア、メモ段階)

### コーチング面談の録音→AI分析
- 録音→文字起こし (Whisper API)→AI要約→システムストック
- 「人間の面談」と「AIの日常サポート」の完全連結

### タイムラインの入塾前拡張 (CRM)
- 資料請求→コンタクト→紹介→体験授業→入塾→...→卒業
- コンバージョン率測定、紹介ネットワーク可視化

### 自動化の基本方針
- Layer 1 (完全自動): ポイント付与、目標進捗集計、AI バディ日常会話
- Layer 2 (AI判断+人間確認): 目標承認、離脱リスク検知
- Layer 3 (人間主体): コーチング面談、3週連続未達成対応、保護者対応、経営判断、新入生歓迎
- **人間は5箇所だけに集中すればいい**

---

## 8. ファイル構成 (主要ファイルのみ)

```
academy-points/
├── index.html          (8,502行) 管理画面
├── student.html         (7,238行) 生徒画面
├── briefing.html        (2,034行) 教室モニター (艦長マイケル)
├── teacher.html         (1,474行) 講師画面
├── owner.html           (627行)   オーナー画面
├── parent.html          (1,257行) 保護者画面
├── db.js                (4,601行) Firestore CRUD全体
├── js/
│   ├── student-context.js  生徒コンテキスト (AI バディ用)
│   └── teacher-context.js  講師コンテキスト (AI バディ用)
├── firebase-config.js      Firebase設定
├── firestore.rules         Firestoreセキュリティルール
├── firebase.json           Hosting/Firestore設定
├── .firebaserc             プロジェクトID (hero-s-points)
├── docs/
│   ├── adler-coaching.txt                              アドラー心理学入門OCR (214p)
│   ├── 45期_全9モジュール統合要約_MissionControl設計基盤.md  チームフロー9モジュール
│   └── learning-methods.txt                             科学的学習法OCR (325p)
├── STAFF_GUIDE_Feature9_owner.html/pdf  塾長版ガイド
├── STAFF_GUIDE_Feature9_staff.html/pdf  スタッフ版ガイド
└── NEXT_SESSION_NOTES.md               セッションメモ
```

---

## 9. 引き継ぎ方法

次セッション開始時に以下を伝えてください:

> HANDOFF_Feature10_11_12.md を読んでください。前回セッションの引き継ぎ文書です。
> docs/ フォルダの3つの資料 (adler-coaching.txt, 45期モジュール.md, learning-methods.txt) を全文読んで、AIバディのプロンプトに統合してください。

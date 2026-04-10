# セッション引き継ぎ文書 (2026-04-10)
## 本セッションの全作業 + 次セッションへの申し送り

---

## 1. ブランチと現在の状態

- **作業ブランチ**: `claude/mission-control-dashboard-ctqvd`
- **現在のコミット**: `e5f25c0` (v-nudge-zone-complete)
- **本番URL**: https://hero-s-points.web.app
- **Firebase プロジェクト**: `hero-s-points`

### 重要なタグ（復元ポイント）

| タグ | コミット | 内容 |
|------|---------|------|
| `ramen-ya-ni-modosu` | `2d8dc45` | ラーメン屋式UI導入前 |
| `v-before-ramen-ui` | `2d8dc45` | 同上（エイリアス） |
| `v-nudge-zone-complete` | `e5f25c0` | **現在地。ナッジゾーン完了、ゲームエンジン追加前** |
| `v-session-end-0410` | `ab738fd` | ゲームエンジン含む全作業（戻し済み、タグで保存） |

---

## 2. 本セッションで実装した機能一覧

### AIバディ強化
- 3資料統合（アドラー心理学/45期コーチング/科学的学習法）→ 全4階層バディ
- 教材活用コーチに転換（教えない、教材を使いこなす）
- 生徒別教材リスト連動（その生徒の教材だけ提案）
- 3モード柔軟化（固定順序→状態に合わせて選択）
- 英語TTS対策（カタカナ読み併記 + TTS自動置換）
- マイク自動停止 5分→15分
- 音声入力の英語制約をプロンプトに追加

### UI/UX 全面改修（ラーメン屋式タッチパネル）
- 生徒ホーム: タブ廃止 → タッチメニュー1画面
- バディパネル廃止 → 全画面チャット + トーストにバディ顔付き
- 全画面チャット: バディ顔ヘッダー + 生徒アバター + LINE式吹き出し
- 保護者画面: 11タブ → 4つの大ボタン + ◀戻る
- 講師画面: 8タブ → 8つの大ボタン + ◀戻る
- 戻るボタン: 全画面に3D立体「◀ 戻る」
- 通知バッジ: メッセージ/タスク/バッジ等のボタンが光る
- 学習中ボタン: タイマー中はホームに緑「⏱️ 数学 学習中 05:23」
- 教材選択: 学習モード選択画面に教材ボタン追加
- ホームにバディ顔 + 生徒アバター表示

### 科学的学習法
- アクティブリコール: 学習完了→バディチャットで振り返り
- 分散学習スケジュール: 自動生成 (1日→3日→7日→14日→30日後)
- 復習日を大きく表示 + カレンダー登録(.ics)
- バディがログイン時に復習リマインド自動声かけ

### 行動経済学的ナッジゾーン
- ③損失回避: ストリーク警告（「途切れないで！」）
- ②社会的証明: 今X人が勉強中
- ①変動報酬: ラッキーミッション3枚カード
- ⑤所属感: ギルド進捗 + チーム目標
- ④あと少し効果: レベルアップ近接表示（残り50pt以内で金色）

### 自動化・システム改善（別ブランチから cherry-pick 済み）
- ギルド自動配属 / 週次目標自動判定 / 個人目標AI自動承認
- ポイントレート Firestore化 + 管理画面エディタ
- 時間帯/曜日ブースト + ギルド目標 + LEAGUES格下げ
- 進級システム (yearlyPoints + 年度リセット)
- ラッキーミッション（旧デイリーミッション改名）

---

## 3. 未デプロイの問題

**現在、塾長のMacからデプロイしても変更が反映されない問題が発生中。**

原因の可能性:
- ローカルが `main` ブランチにいて、pull しても作業ブランチの変更が反映されていない
- Service Worker のキャッシュが強力すぎる

**次セッションで最初にやること:**
```bash
cd ~/academy-points
git fetch origin
git checkout claude/mission-control-dashboard-ctqvd
git reset --hard origin/claude/mission-control-dashboard-ctqvd
firebase deploy --only hosting,firestore:rules --project hero-s-points
```

---

## 4. 戻したもの（ゲームエンジン）

ゲームエンジン v3.0 は実装後に戻しました。理由: UI のバグ修正が先。

**保存場所**: タグ `v-session-end-0410` (コミット `ab738fd`)
**復活方法**: `git cherry-pick 464aaee c83c3fb c7eb3f5 117e47f ab738fd`

**ゲーム設計書**: `docs/game-design-v3.md` は現在のブランチに残っている
**別プロジェクト**: `~/academy-rpg/` にゲーム設計書をコピー済み。ゲーム開発は別プロジェクトで進める方針。

### ゲームエンジンの内容（参考）
- js/game-engine.js: 基地/装備/バディ育成/クエスト/戦力スコア
- WORLD_ENGINE: 宇宙テーマの全定義（建物5/装備15/章12/進化4段階）
- processGameRewards(): 学習完了時の統合報酬処理

---

## 5. 既知のバグ・課題

| 重要度 | 内容 | 状態 |
|--------|------|------|
| **High** | デプロイしても変更が反映されない | 未解決。ブランチ同期の問題 |
| **High** | AIバディ 400エラー | プロンプトが長すぎる可能性。HERO_DOJO_FRAMEWORK + MATERIAL_COACHING_GUIDE の短縮が必要 |
| **Medium** | homeRankBadge null参照 | コード修正済みだがデプロイ未反映 |
| **Medium** | 復習ボタンが固まる | loadHome の null参照エラーが原因。修正済みだがデプロイ未反映 |
| **Low** | VoiceSystem speak error: not-allowed | ブラウザの autoplay policy。ユーザー操作後は動作する |

---

## 6. 次セッションの優先タスク

### 最優先: デプロイ問題の解決
1. ブランチを正しく checkout して deploy
2. SW バージョンを v6 に上げる（v5→v6）
3. 動作確認

### 高: AIバディの 400 エラー修正
- HERO_DOJO_FRAMEWORK が長すぎる → 重要部分だけ残して短縮
- または buildStaticSystemGuide() を分割して cache_control を最適化

### 高: UI バグの確認
- 「もう1回学習する」ボタンが表示されるか
- 復習リマインダーが正常動作するか
- ナッジゾーンが正しく表示されるか

### 中: ゲーム設計のやり直し
- `~/academy-rpg/` で別セッションを立ち上げ
- game-design-v3.md をベースに再設計
- academy-points とは分離して開発

---

## 7. ファイル構成

```
academy-points/
├── index.html          (8,800行+) 管理画面
├── student.html         (8,000行+) 生徒画面 ← 大幅改修
├── briefing.html        (2,100行+) 教室モニター
├── teacher.html         (1,600行+) 講師画面 ← ラーメン屋式に改修
├── owner.html           (660行+)   オーナー画面
├── parent.html          (1,400行+) 保護者画面 ← ラーメン屋式に改修
├── db.js                (5,000行+) Firestore CRUD全体
├── js/
│   ├── student-context.js  生徒コンテキスト（教材リスト追加）
│   └── teacher-context.js  講師コンテキスト
├── firebase-config.js      Firebase設定
├── firestore.rules         Firestoreセキュリティルール
├── sw.js                   Service Worker (v5)
├── session-summary.html    本セッションのサマリー（全画面リンク付き）
├── docs/
│   ├── game-design-v3.md   ゲーミフィケーション設計書 v3.0
│   ├── adler-coaching.txt  アドラー心理学入門OCR
│   ├── 45期_全9モジュール統合要約.md  チームフロー9モジュール
│   └── learning-methods.txt 科学的学習法OCR
└── HANDOFF_Feature10_11_12.md  前回セッション引き継ぎ
```

---

## 8. 引き継ぎ方法

次セッション開始時に以下を伝えてください:

> HANDOFF_Session_0410.md を読んでください。前回セッションの引き継ぎ文書です。
> まずデプロイ問題を解決してから、AIバディの400エラーを修正してください。

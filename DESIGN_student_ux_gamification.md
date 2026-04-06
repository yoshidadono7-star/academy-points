# 生徒画面 UI/UX ゲーミフィケーション拡張 設計書

更新日: 2026-04-06
ブランチ: `feature/student-ux-gamification`

---

## 1. 実現可能性の評価

### 1-1. 映像（動画）演出の組み込み

**技術的実現性: 高（ほぼ問題なし）**

| 項目 | 評価 | 備考 |
|------|------|------|
| HTML5 `<video>` タグ | 容易 | 軽量MP4をFirebase Storageに配置。autoplay+muted属性で自動再生可能 |
| YouTube iframe | 容易 | ただしオフライン不可、広告リスク、読み込み遅延あり |
| Lottie/CSS アニメーション | 推奨 | 軽量で即座に再生。レベルアップ等の定型演出に最適 |
| Firebase Storage容量 | 注意 | 無料枠5GB。短尺動画(10-30秒)なら数十本は格納可能 |

**既存コードへの影響: 最小限**
- `student.html` の `showCompleteScreen()` (L2608) に動画トリガーを追加するだけ
- `fireConfetti()` (L3175) と併用可能
- 新規スクリーン `screenCutscene` を追加し、navigate()で遷移

**リスク:**
- 動画ファイルサイズによる初回読み込み遅延 → **対策:** Lazy loadまたはService Worker事前キャッシュ
- モバイル自動再生制限 → **対策:** muted+playsinline属性、タップで再生開始

**推奨アプローチ:** Firebase Storage + HTML5 `<video>` + Lottie(軽量アニメ)のハイブリッド

---

### 1-2. ギルド・クエスト風UIへの刷新

**技術的実現性: 高**

| 項目 | 評価 | 備考 |
|------|------|------|
| クエスト掲示板UI | 容易 | 既存 `DailyMissionsDB` を活用。HTMLテンプレートの差し替え |
| 達成アニメーション | 容易 | 既存 `fireConfetti()` を拡張 + 効果音 |
| 効果音 | 容易 | Web Audio API。短いSE(数KB)をbase64埋め込みまたはStorage |
| デイリーミッション拡張 | 中程度 | 既存の `DAILY_MISSION_POOL` (db.js L1580+) にクエスト風メタデータ追加 |

**既存データとの整合性:**
- `DailyMissionsDB` はすでに `studentId`, `date`, `missions[]`, `completedMissions[]` を持つ
- `missions[]` 配列の各要素にクエスト風表示データ（難易度アイコン、ストーリーテキスト等）を追加
- **DB変更不要** — 表示レイヤーの変更のみで実現可能

**現在のホーム画面構造 (student.html L905-1041):**
```
ヘッダー → ステータスカード → 宇宙マップ → ストーリーナレーション
→ デイリーミッション → クイックアクション → ボトムナビ
```

**変更方針:** デイリーミッション領域 (L1006-1010) をクエスト掲示板風UIに差し替え

---

### 1-3. タワーディフェンス風ミニゲーム / デジタル拠点要素

**技術的実現性: 中〜高（段階的に実装すれば安全）**

| 項目 | 評価 | 備考 |
|------|------|------|
| 拠点建設UI | 中程度 | CSS Grid/Flexboxで十分。Canvas不要 |
| タワー購入・強化 | 容易 | 既存 `RewardsDB` の仕組みを流用（ポイント消費→アイテム取得） |
| 週末防衛（自動戦闘） | 中程度 | 既存 `RaidBossDB` のダメージ計算を流用可能 |
| アバター着せ替え | 容易 | CSS + SVGスプライト。装備データはFirestoreに保存 |
| リアルタイム表示 | 高リスク | Firestore onSnapshot はコスト増。ポーリング推奨 |

**データ整合性リスク:**
- ポイント消費は既存 `StudentsDB.spendPoints()` + `CoinsDB.addTransaction()` を使うので安全
- 新規コレクション追加のみで既存データに影響なし

**推奨:** Phase 1ではアバター+拠点表示のみ。防衛ゲームはPhase 2以降

---

## 2. フェーズ分けの提案

### Phase 12: 映像・サウンド演出基盤（1-2日）

**目的:** 動画・音声の再生基盤を構築し、既存イベントに演出を追加

| タスク | 工数 | 影響範囲 |
|--------|------|----------|
| カットシーンスクリーン新規追加 | 小 | student.html のみ |
| `<video>` プレイヤーコンポーネント実装 | 小 | student.html のみ |
| 効果音(SE)再生システム追加 | 小 | student.html のみ |
| レベルアップ演出の強化 | 小 | showCompleteScreen() |
| ボス討伐カットシーン | 小 | showCompleteScreen() |
| 初回ログインオープニング | 小 | handleLogin() |

**成果物:**
- `playVideo(url, onEnd)` 汎用関数
- `playSE(name)` 効果音再生関数
- Firebase Storage `/cutscenes/` ディレクトリ
- 初回ログインフラグ（StudentsDBに `seenOpening: true` フィールド追加）

---

### Phase 13: クエスト掲示板UI（2-3日）

**目的:** ホーム画面をRPGのギルド掲示板風に刷新

| タスク | 工数 | 影響範囲 |
|--------|------|----------|
| デイリーミッション表示のクエスト風UI化 | 中 | student.html ホーム画面 |
| クエスト受注→完了アニメーション | 小 | CSS + JS |
| 達成時SE + エフェクト | 小 | student.html |
| クエスト難易度・ストーリーフレーバーテキスト追加 | 小 | db.js DAILY_MISSION_POOL |
| 「冒険の書」（学習履歴のRPG風表示） | 中 | student.html 新スクリーン |

**UI設計案:**
```
┌──────────────────────────────────┐
│  ギルド掲示板  📜                │
├──────────────────────────────────┤
│  🟡 COMMON                      │
│  ┌────────────────────────┐      │
│  │ ⚔️ ポモドーロ修練      │      │
│  │ 「集中の炎を3回灯せ」  │      │
│  │ 報酬: 30pt  ⭐         │      │
│  │ [受注する]              │      │
│  └────────────────────────┘      │
│                                  │
│  🔴 RARE                        │
│  ┌────────────────────────┐      │
│  │ 📚 知識の探求者         │      │
│  │ 「3つの学問を渡り歩け」│      │
│  │ 報酬: 50pt  ⭐⭐       │      │
│  │ [受注する]              │      │
│  └────────────────────────┘      │
│                                  │
│  🟣 LEGENDARY (?)               │
│  ┌────────────────────────┐      │
│  │ ❓ ???                  │      │
│  │ 「条件を満たすと出現」  │      │
│  │ [ロック中]              │      │
│  └────────────────────────┘      │
└──────────────────────────────────┘
```

---

### Phase 14: アバター・拠点基盤（2-3日）

**目的:** デジタル報酬の基盤を構築

| タスク | 工数 | 影響範囲 |
|--------|------|----------|
| アバターシステム設計・DB追加 | 中 | db.js |
| アバター表示コンポーネント (SVG/CSS) | 中 | student.html |
| 装備ショップUI | 中 | student.html 景品画面拡張 |
| 拠点表示（自分の宇宙基地） | 中 | student.html 新スクリーン |
| 拠点建設・強化メニュー | 中 | student.html |

**アバターデザイン方針:**
- CSSベースの2Dアバター（パーツ合成: 顔/髪/服/アクセサリー）
- 各パーツはRewardsDBのアイテムとして登録
- 装備状態はStudentsDBの新フィールドで管理

---

### Phase 15: タワーディフェンス（週末防衛戦）（長期）

**目的:** 拠点の強さが実際のゲーム効果に連動

| タスク | 工数 | 影響範囲 |
|--------|------|----------|
| 防衛戦ロジック設計 | 大 | db.js 新規 |
| 週末自動戦闘システム | 大 | db.js + Cloud Functions推奨 |
| 戦闘アニメーション | 大 | student.html |
| リーダーボード（拠点ランキング） | 中 | student.html + db.js |

**注意:** Cloud FunctionsまたはCronジョブが必要になる可能性が高い

---

## 3. Firestoreスキーマ追加案

### 3-1. カットシーン管理

```javascript
// 新コレクション: cutscenes
const CutscenesDB = {
  // cutscenes/{cutsceneId}
  fields: {
    id: 'string',           // 'opening', 'levelup_5', 'boss_defeat_dragon' 等
    type: 'string',         // 'video' | 'lottie' | 'css'
    url: 'string',          // Firebase Storage URL or Lottie JSON URL
    triggerEvent: 'string', // 'first_login' | 'level_up' | 'boss_defeat' | 'rank_up'
    triggerValue: 'any',    // レベル番号、ボスID等
    duration: 'number',     // 秒
    skippable: 'boolean',
    active: 'boolean'
  }
};

// StudentsDBに追加するフィールド
// seenCutscenes: ['opening', 'levelup_5', ...]  // 視聴済みカットシーンID
```

### 3-2. アバター・装備

```javascript
// 新コレクション: avatarParts
const AvatarPartsDB = {
  // avatarParts/{partId}
  fields: {
    name: 'string',
    category: 'string',    // 'face' | 'hair' | 'outfit' | 'accessory' | 'background' | 'frame'
    rarity: 'string',      // 'common' | 'rare' | 'epic' | 'legendary'
    cost: 'number',         // ポイントコスト (0 = 初期装備)
    rankRequired: 'string', // 'rookie' | 'crew' | 'senior' | 'captain'
    unlockCondition: 'string', // null | 'badge:xxx' | 'level:5' | 'streak:30'
    spriteData: 'string',  // CSSクラス名 or SVGパスデータ
    active: 'boolean'
  }
};

// StudentsDBに追加するフィールド
// avatar: {
//   face: 'partId',
//   hair: 'partId',
//   outfit: 'partId',
//   accessory: 'partId',
//   background: 'partId',
//   frame: 'partId'
// }
// ownedParts: ['partId1', 'partId2', ...]  // 所持パーツ一覧
```

### 3-3. 拠点（宇宙基地）

```javascript
// 新コレクション: bases
const BasesDB = {
  // bases/{studentId}  (1生徒1拠点)
  fields: {
    studentId: 'string',
    name: 'string',             // 拠点名（生徒が命名可能）
    level: 'number',            // 拠点レベル (1-10)
    buildings: [{               // 建設済み施設
      type: 'string',          // 'shield' | 'cannon' | 'radar' | 'lab' | 'hangar'
      level: 'number',
      position: 'number'       // グリッド位置
    }],
    defenseRating: 'number',    // 防御力（建物レベルから自動計算）
    lastDefenseDate: 'string',  // 最終防衛戦日
    defenseWins: 'number',
    defenseLosses: 'number',
    totalInvested: 'number',    // 累計投資ポイント
    createdAt: 'timestamp'
  }
};

// 建物定義（db.js内の定数）
const BUILDING_TYPES = [
  {
    type: 'shield',
    name: 'エネルギーシールド',
    icon: '🛡️',
    desc: '防御力を上げる。小テストの失点ダメージを軽減',
    costs: [50, 100, 200, 400, 800],     // レベル1-5のコスト
    defensePerLevel: [10, 25, 50, 100, 200]
  },
  {
    type: 'cannon',
    name: 'レーザーキャノン',
    icon: '🔫',
    desc: '攻撃力を上げる。週末防衛戦で敵を自動撃退',
    costs: [80, 150, 300, 600, 1200],
    attackPerLevel: [15, 35, 70, 150, 300]
  },
  {
    type: 'radar',
    name: 'レーダー施設',
    icon: '📡',
    desc: 'ミッション報酬が増加。隠しクエストの発見率UP',
    costs: [60, 120, 250, 500, 1000],
    bonusPerLevel: [5, 10, 20, 40, 80]  // 報酬増加%
  },
  {
    type: 'lab',
    name: '研究ラボ',
    icon: '🔬',
    desc: '経験値効率が上がる。ポイント獲得に微量ボーナス',
    costs: [100, 200, 400, 800, 1600],
    xpBonusPerLevel: [2, 5, 10, 20, 50]  // ボーナスpt
  },
  {
    type: 'hangar',
    name: '格納庫',
    icon: '🚀',
    desc: 'アバターパーツの収容上限が増加',
    costs: [40, 80, 160, 320, 640],
    capacityPerLevel: [5, 10, 20, 40, 80]
  }
];
```

### 3-4. 防衛戦ログ

```javascript
// 新コレクション: defenseLog
const DefenseLogDB = {
  // defenseLog/{logId}
  fields: {
    studentId: 'string',
    date: 'string',
    wave: 'number',             // ウェーブ番号
    enemyType: 'string',        // 'テスト怪獣', '宿題スライム' 等
    enemyPower: 'number',
    playerDefense: 'number',
    result: 'string',           // 'win' | 'lose'
    reward: 'number',           // 勝利ボーナスpt
    createdAt: 'timestamp'
  }
};
```

---

## 4. 実装の安全性ガイドライン

### 既存コードを壊さないための原則

1. **DB変更は常に「追加」のみ** — 既存フィールドの削除・型変更は行わない
2. **新機能はフィーチャーフラグで制御** — `AcademyConfigDB` に `enableCutscenes`, `enableQuestUI`, `enableBase` を追加
3. **ポイント消費は既存パスを通す** — `StudentsDB.spendPoints()` + `CoinsDB.addTransaction()` を必ず使用
4. **段階的リリース** — 各Phaseを個別ブランチで開発し、mainにマージ前にテスト

### パフォーマンス注意点

- 動画は **Lazy Load** — 必要になるまでロードしない
- Lottieアニメーションは **JSON埋め込み** を避け、外部ファイルとして分離
- 拠点データの **onSnapshot** はコスト大 — `getDoc()` で十分
- アバターSVGは **CSSスプライトシート** にまとめる

---

## 5. 優先度マトリクス

| Phase | 機能 | インパクト | 工数 | リスク | 推奨順位 |
|-------|------|-----------|------|--------|----------|
| 12 | 映像・SE演出 | 高（没入感） | 小 | 低 | **1位** |
| 13 | クエスト掲示板UI | 高（毎日の体験） | 中 | 低 | **2位** |
| 14 | アバター・拠点表示 | 中（長期モチベ） | 中 | 低 | **3位** |
| 15 | タワーディフェンス | 中（差別化） | 大 | 中 | **4位** |

**推奨:** Phase 12 → 13 を先に実装（1週間以内で大きなインパクト）。
Phase 14-15 は生徒のフィードバックを見てから着手。

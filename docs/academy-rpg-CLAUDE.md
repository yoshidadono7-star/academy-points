# HERO'S ACADEMY RPG - 開発ガイド (v2.0)

**このファイルの位置**: `~/academy-rpg/CLAUDE.md`
**対象**: Claude Code（このプロジェクトで作業するAI）

---

## プロジェクトの目的

既存の塾アプリ `hero-s-points.web.app` (academy-points) と連動する、
**「勉強の報酬を楽しむ場所」** としての軽量RPG。

### 絶対に守る原則

> **RPG は勉強の「邪魔をしない」**
>
> - プレイ時間は **1セッション最大2分** まで
> - 勉強時間を奪うゲームロジック（長い探索・長いバトル）は **作らない**
> - RPG の役割は「勉強の成果を見える化し、ごほうびを与える」こと

---

## アーキテクチャ概要

```
┌─────────────────────────────┐       ┌──────────────────────────────┐
│  academy-points (既存塾アプリ) │       │  academy-rpg (この本体)      │
│  hero-s-points.web.app       │       │  hero-s-points-rpg.web.app   │
│                              │       │                              │
│  - ポモドーロ学習            │──┐    │  - ガチャ                    │
│  - タスク管理                │  │    │  - ミニゲーム                │
│  - 出席・ストリーク          │  │    │  - ホームタウン閲覧          │
│                              │  │    │  - 装備・バディ管理          │
└─────────────────────────────┘  │    └──────────────────────────────┘
                                  │              ↑
                                  │ (報酬を貯める)
                                  ↓
                    ┌────────────────────────┐
                    │  Firestore: rpg_*      │
                    │  - rpg_profiles        │
                    │  - rpg_wallet          │
                    │  - rpg_inventory       │
                    │  - rpg_gacha_tickets   │
                    └────────────────────────┘
```

### 連携の流れ

1. 生徒が **academy-points** でポモドーロ完走・タスク完了
2. Cloud Function `awardStudyReward` が呼ばれて **rpg_wallet** に XP/Gold/ガチャチケットを付与
3. 生徒が **academy-rpg** を開く
4. 「勉強中に貯まった報酬」を確認 → ガチャを回す / ミニゲームで遊ぶ
5. 1-2分で満足して閉じる → また勉強に戻る

---

## Phase 0 (完了済み) - プロトタイプとして保存

以下は **初期実装** として既に完成しているが、v2.0 では大幅に簡素化する:

- ✅ Phaser.js プロジェクト初期化
- ✅ BootScene / LoginScene (Google Auth)
- ✅ HomeTownScene (マップ・NPC)
- ✅ DungeonScene (3フロア) ← **v2.0 で廃止**
- ✅ BattleScene + MathBattle ← **v2.0 でミニゲーム化**
- ✅ Cloud Functions: awardSessionResult ← **v2.0 で置き換え**

**Phase 0 のコードはタグ `phase0-archive` を打って保存すること:**

```bash
cd ~/academy-rpg
git tag phase0-archive
git push origin phase0-archive
```

---

## v2.0 の実装方針

### 1. ホームタウン画面 (軽量化)

- **維持**: マップ表示、自分のキャラクター、施設の見た目
- **変更**: 移動・探索を **廃止**。各施設はタップで直接入れる
- **追加**: 画面上部に「今日の勉強時間」「今日のポモドーロ数」を常時表示
- **所要時間**: 開いて1秒で全情報が見える

### 2. ガチャシステム (メイン機能)

#### 基本設計

```
rpg_gacha_tickets/{uid} {
  standard: 3,    // 通常チケット（ポモドーロ1回 = 1枚）
  premium: 0,     // プレミアムチケット（イベント報酬）
  updatedAt: timestamp
}
```

#### ガチャの種類

| ガチャ名 | 消費 | 排出 |
|---------|------|------|
| **スタンダード** | チケット1枚 | 装備(common~rare), バディ経験値 |
| **プレミアム** | プレミアム1枚 | 装備(rare~legendary), レアバディ |
| **デイリー無料** | 1日1回 | 小ゴールド, スタミナ回復 |

#### 演出

- 画面中央で宝箱が開く **3秒アニメ**
- レア以上は追加で **光る演出** (+2秒)
- 「スキップ」ボタンで即結果表示可能

#### 実装ファイル

- `public/js/game/scenes/GachaScene.js` - ガチャ画面
- `public/js/game/systems/GachaSystem.js` - 抽選ロジック
- `public/js/game/data/gachaTables.js` - 排出テーブル定義

### 3. ミニゲーム (3種類、各30秒〜1分)

既存の `MathBattle.js` を参考に、以下の3つを作る:

#### A. 瞬間計算 (Math Flash)
- **時間**: 30秒
- **内容**: 表示された計算式を素早くタップ（○×方式）
- **報酬**: 正解数 × 5 Gold

#### B. 記憶カード (Memory Match)
- **時間**: 1分
- **内容**: 3x4の12枚カードから同じ絵柄を揃える
- **報酬**: クリア時間に応じて Gold + チケット

#### C. タイピング勇者 (Typing Hero)
- **時間**: 45秒
- **内容**: 落ちてくる英単語をタイプして撃退
- **報酬**: 撃破数 × 3 Gold + 英語経験値

#### 実装ファイル

- `public/js/game/minigames/MathFlash.js`
- `public/js/game/minigames/MemoryMatch.js`
- `public/js/game/minigames/TypingHero.js`
- `public/js/game/scenes/MinigameHubScene.js` - ミニゲーム選択画面

### 4. 装備・バディ管理 (簡易)

- 獲得した装備・バディを一覧表示
- タップで装備変更
- ステータス (ATK/DEF/HP) はキャラ画像の横に表示
- **育成要素は最小限** (経験値を貯めて進化するだけ)

実装ファイル:
- `public/js/game/scenes/InventoryScene.js`

### 5. 削除するもの

以下は v2.0 で **完全に削除** する:

- ❌ `DungeonScene.js` - ダンジョン探索
- ❌ `BattleScene.js` - ターン制バトル
- ❌ `Monster.js` - モンスター徘徊AI
- ❌ ホームタウンの自由移動 (Player.js の移動ロジック)
- ❌ NPC会話システム (ダイアログは固定ポップアップに)

---

## Cloud Functions (新規)

### awardStudyReward (academy-points から呼ぶ)

```javascript
// 勉強セッション完了時に academy-points から呼ばれる
// 入力: { studentId, pomodoroCount, totalMinutes, subject }
// 処理:
//   - rpg_wallet に XP/Gold 加算
//   - rpg_gacha_tickets に standard チケット加算
//   - rpg_profiles のステータス更新
// 出力: { xp_gained, gold_gained, tickets_gained }
```

### rollGacha (RPG から呼ぶ)

```javascript
// ガチャを引く
// 入力: { gachaType: 'standard' | 'premium' | 'daily_free' }
// 処理:
//   - チケット消費 (サーバ権威)
//   - 排出テーブルから抽選
//   - rpg_inventory に追加
// 出力: { items: [...], rarity: 'rare' }
```

### submitMinigameScore (RPG から呼ぶ)

```javascript
// ミニゲーム結果を申請
// 入力: { minigameId, score, duration }
// 処理:
//   - スコアバリデーション (異常検知)
//   - 報酬計算
//   - rpg_wallet 更新
// 出力: { gold_gained, tickets_gained }
```

---

## Firestore スキーマ (v2.0)

```
rpg_profiles/{uid}
  displayName: string
  level: number
  xp: number
  avatarId: string
  equippedItems: { weapon, armor, accessory }
  buddyId: string (nullable)
  createdAt: timestamp
  updatedAt: timestamp

rpg_wallet/{uid}
  gold: number
  gems: number  (課金通貨、未実装でOK)
  updatedAt: timestamp

rpg_gacha_tickets/{uid}
  standard: number
  premium: number
  daily_free_available: boolean
  daily_free_last_used: timestamp
  updatedAt: timestamp

rpg_inventory/{uid}/items/{itemId}
  itemType: 'weapon' | 'armor' | 'accessory' | 'buddy'
  name: string
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  stats: { atk, def, hp }
  acquiredAt: timestamp

rpg_minigame_results/{docId}
  uid: string
  minigameId: string
  score: number
  goldGained: number
  createdAt: timestamp
```

### Firestore Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rpg_profiles/{uid} {
      allow read: if request.auth.uid == uid;
      allow create: if request.auth.uid == uid;
      allow update: if false; // Cloud Functions のみ
    }
    match /rpg_wallet/{uid} {
      allow read: if request.auth.uid == uid;
      allow write: if false;
    }
    match /rpg_gacha_tickets/{uid} {
      allow read: if request.auth.uid == uid;
      allow write: if false;
    }
    match /rpg_inventory/{uid}/items/{itemId} {
      allow read: if request.auth.uid == uid;
      allow write: if false;
    }
    match /rpg_minigame_results/{docId} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
```

---

## 開発の進め方

### Phase 1 (v2.0 メイン実装)

1. **Phase 0 のアーカイブ** (タグ打ち)
2. **不要ファイルの削除** (DungeonScene, BattleScene, Monster)
3. **HomeTownScene の簡素化** (移動廃止、タップ遷移に)
4. **GachaScene + GachaSystem** の実装
5. **ミニゲーム 3種** の実装
6. **Cloud Functions 3つ** の実装 (awardStudyReward, rollGacha, submitMinigameScore)
7. **academy-points 側の連携** (勉強完了時に awardStudyReward を呼ぶ)
8. **デプロイ** (`hero-s-points-rpg.web.app`)

### Phase 2 (将来)

- レイドボス (全生徒で共闘、academy-points の既存レイドと連動)
- ギルド機能
- シーズンイベント
- 装備強化・進化

---

## デプロイコマンド

```bash
cd ~/academy-rpg

# Hosting のみ
firebase deploy --only hosting:hero-s-points-rpg --project hero-s-points

# Functions のみ
firebase deploy --only functions --project hero-s-points

# Firestore Rules のみ
firebase deploy --only firestore:rules --project hero-s-points

# 全部
firebase deploy --project hero-s-points
```

---

## 注意事項

- **hero-s-points プロジェクトを共有している** ので、デプロイ時は `--only hosting:hero-s-points-rpg` を必ず指定する（既存 academy-points サイトを上書きしないため）
- Firestore Rules は academy-points のルールとマージする必要がある (両プロジェクトで同じ Firestore を使用)
- **既存の rpg_* コレクションは Phase 0 のデータが残っている** ので、スキーマ変更時はマイグレーション不要 (新フィールドは追加のみ)

---

## Claude への指示

このプロジェクトで作業するときは:

1. **「RPG は勉強の邪魔をしない」を最優先** に判断する
2. 新機能を追加する前に「プレイ時間が2分以内に収まるか」を確認
3. 長い探索・複雑な操作が必要になったら **設計を見直す**
4. コード変更は `~/academy-rpg/` 内でのみ行う (academy-points には触らない)
5. デプロイ前に必ず `firebase deploy` の対象を確認する

# HERO'S ACADEMY — プロジェクトガイド

このファイルは Claude Code がプロジェクト全体を理解するためのガイドです。

---

## プロジェクト概要

宮崎県延岡市の学習塾「HERO'S（ヒーローズ）」のゲーミフィケーション学習システム。

### 2つのアプリ

| アプリ | URL | ディレクトリ | 用途 |
|--------|-----|-------------|------|
| **塾アプリ本体** | `hero-s-points.web.app` | このリポジトリのルート (`./`) | 生徒・講師・保護者・管理者向けの学習管理 |
| **RPGゲーム** | `hero-s-points-rpg.web.app` | `./rpg/` | 勉強の報酬で遊ぶ軽量RPG（ガチャ・ミニゲーム） |

### Firebase プロジェクト

- プロジェクトID: `hero-s-points`
- 両アプリが**同じ Firestore / Auth / Functions** を共有
- Hosting はマルチサイト: `hero-s-points` (塾アプリ) + `hero-s-points-rpg` (RPG)

---

## ディレクトリ構成

```
academy-points/
├── index.html              管理画面 (8,800行+)
├── student.html            生徒画面 (8,000行+) — ラーメン屋式タッチUI
├── briefing.html           教室モニター — 艦長マイケルのブリーフィング
├── teacher.html            講師画面 — ラーメン屋式タッチUI
├── owner.html              オーナー画面
├── parent.html             保護者画面 — ラーメン屋式タッチUI
├── db.js                   Firestore CRUD (5,000行+) — RpgBridgeDB含む
├── firebase-config.js      Firebase初期化
├── firestore.rules         Firestore セキュリティルール (SSOT)
├── sw.js                   Service Worker
├── js/
│   ├── student-context.js  生徒コンテキスト
│   └── teacher-context.js  講師コンテキスト
├── rpg/                    ★ RPGゲーム (Phaser.js)
│   ├── public/
│   │   ├── student.html    RPGエントリポイント
│   │   └── js/
│   │       ├── db.js       Firebase初期化 (RPG用)
│   │       └── game/
│   │           ├── config.js
│   │           ├── scenes/     BootScene, LoginScene, HomeTownScene, GachaScene, MinigameHubScene
│   │           ├── minigames/  MathFlash, MemoryMatch, TypingHero
│   │           ├── systems/    FirebaseSync, GachaSystem, StyleConfig, MinigameHowTo, MinigameQuit
│   │           └── data/       gachaTables.js
│   └── firebase.json      RPG用Firebase設定 (site: hero-s-points-rpg)
├── functions/              ★ Cloud Functions (共有)
│   ├── index.js
│   ├── awardSessionResult.js   RPGバトル報酬 (Phase 0遺物)
│   ├── awardStudyReward.js     勉強→RPG報酬付与
│   └── createRpgAuthToken.js   PIN認証→Custom Token
├── docs/
│   ├── academy-rpg-CLAUDE.md         RPG開発ガイド (v2.0)
│   ├── rpg-integration-next-steps.md RPG連携完了状況
│   └── rpg-pin-login-plan.md         PINログイン実装計画
└── CLAUDE.md               ← このファイル
```

---

## 認証方式

### 塾アプリ (academy-points)

| 画面 | 認証 | URL |
|------|------|-----|
| 管理画面 | `admin@heros.jp` + パスワード | `/` |
| 生徒画面 | ニックネーム + PIN (4桁) | `/student` |
| 講師画面 | 講師PIN (4桁) | `/teacher` |
| 保護者画面 | 保護者PIN (4桁) | `/parent` |
| オーナー画面 | Firebase Auth + `role: owner` | `/owner` |
| 教室モニター | 認証不要 | `/briefing` |

### RPGゲーム

- **PIN ログイン** (Google ログインから移行済み)
- ニックネーム + PIN → Cloud Function `createRpgAuthToken` → Custom Token
- Firebase Auth UID = academy-points の `student.id`
- RPGとacademy-pointsで同じ生徒IDを共有

---

## RPG連携の仕組み

```
academy-points (勉強) → RpgBridgeDB.awardForPomodoro() → Firestore rpg_* → RPG HUD リアルタイム更新
```

### 報酬レート (1ポモドーロあたり)
- +20 EXP
- +10 ゴールド
- +1 スタンダードチケット

### rpg_* コレクション
- `rpg_profiles/{studentId}` — レベル, EXP, アバター
- `rpg_wallet/{studentId}` — ゴールド
- `rpg_gacha_tickets/{studentId}` — チケット数
- `rpg_daily_stats/{studentId}/days/{YYYY-MM-DD}` — 今日の学習統計
- `rpg_inventory/{studentId}/items/{itemId}` — 獲得アイテム
- `rpg_transactions/{docId}` — 取引履歴

---

## デプロイコマンド

```bash
# 塾アプリのみ
firebase deploy --only hosting --project hero-s-points

# RPGのみ
firebase deploy --only hosting:hero-s-points-rpg --project hero-s-points

# Cloud Functions のみ
firebase deploy --only functions --project hero-s-points

# Firestore Rules のみ (SSOT: このリポジトリから)
firebase deploy --only firestore:rules --project hero-s-points

# 全部
firebase deploy --project hero-s-points
```

---

## RPGの設計方針

> **RPGは勉強の「邪魔をしない」**
> - プレイ時間は **1セッション最大2分** まで
> - 勉強時間を奪うゲームロジックは作らない
> - RPGの役割は「勉強の成果を見える化し、ごほうびを与える」こと

### RPGで遊べること
- **ガチャ** — 勉強で貯めたチケットで武器・装甲・バディを入手
- **ミニゲーム3種** — MathFlash (30秒計算) / MemoryMatch (60秒神経衰弱) / TypingHero (45秒タイピング)
- **ホームタウン閲覧** — 宇宙ステーションの施設をタップ

### RPGからなくしたもの (v2.0)
- ダンジョン探索 (歩き回る時間がもったいない)
- エンカウント・ターン制バトル (長すぎる)
- フロア攻略 (Phase 0 のアーカイブタグ `phase0-archive` に保存)

---

## 世界観

- **テーマ**: 宇宙学園「HERO'S ACADEMY」
- **生徒** = 宇宙飛行士候補 (クルー)
- **艦長マイケル・ステラ・グランドー** = 歴戦の宇宙艦長 (ブリーフィング + RPGフレーバー)
- **8体のバディ**: ルカ(ロボット), ミミ(猫), レックス(竜), ピヨ(ひよこ), ニャン太(関西猫侍), ゾルク(宇宙人), モチ(うさぎ), アリス(きつね)
- **6つの世界テーマ**: 伝説の冒険者, 特殊部隊, ヒロイン物語, アカデミア, 星の庭師, 星海の探検家(デフォルト)

---

## 次のタスク (優先順)

### D. rollGacha サーバ権威化
- ガチャ抽選を Cloud Function に移動 (チート防止)
- `functions/rollGacha.js` を新規作成
- GachaSystem.js のクライアント抽選をサーバ呼び出しに差し替え

### E. 塾長向け使い方ガイド
- 生徒・保護者・スタッフ向け操作説明

### その他
- academy-points のデプロイブランチ整理 (main へマージ)
- Service Worker バージョンアップ (v5→v6)
- Node.js 20 → 22 移行 (2026-04-30 deprecation)
- Anthropic API クレジット管理

---

## 注意事項

- `firestore.rules` は academy-points が Single Source of Truth。RPG側からはデプロイしない
- `firebase.json` の hosting は `"public": "."` (ルートディレクトリ)。RPG は `rpg/` 以下
- 大きなファイル: student.html (8000行+), index.html (8800行+), db.js (5000行+)
- コード変更後のデプロイを忘れないこと

# academy-rpg を academy-points に統合する手順

## 概要

2つのリポジトリ (academy-points + academy-rpg) を 1つに統合し、
ローカルの1つの Claude セッションから全てを操作できるようにする。

---

## 手順 (ローカル PC で実行)

### 1. academy-rpg のファイルをコピー

```bash
cd ~/academy-points

# rpg ディレクトリを作成してコピー
mkdir -p rpg
cp -r ~/academy-rpg/public rpg/
cp -r ~/academy-rpg/firebase.json rpg/firebase.json

# Cloud Functions をコピー (academy-points には functions/ が無かったので新規)
cp -r ~/academy-rpg/functions ./functions

# package.json (functions 用)
# functions/package.json は既にコピーされている
```

### 2. firebase.json をマルチサイト対応に更新

academy-points の `firebase.json` を以下のように変更:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "hosting": [
    {
      "target": "main",
      "public": ".",
      "ignore": [
        "firebase.json",
        "**/.*",
        "**/node_modules/**",
        "rpg/**",
        "functions/**",
        "README.md",
        "HANDOFF*.md",
        "CLAUDE*.md",
        "docs/**",
        "*.docx",
        "*.pdf"
      ],
      "rewrites": [
        { "source": "/briefing", "destination": "/briefing.html" },
        { "source": "/student", "destination": "/student.html" },
        { "source": "/parent", "destination": "/parent.html" },
        { "source": "/teacher", "destination": "/teacher.html" },
        { "source": "/owner", "destination": "/owner.html" },
        { "source": "/classroom", "destination": "/briefing.html" },
        { "source": "**", "destination": "/index.html" }
      ]
    },
    {
      "target": "rpg",
      "public": "rpg/public",
      "ignore": [
        "firebase.json",
        "**/.*",
        "**/node_modules/**"
      ]
    }
  ],
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "runtime": "nodejs20"
    }
  ]
}
```

### 3. .firebaserc にターゲットを設定

```json
{
  "projects": {
    "default": "hero-s-points"
  },
  "targets": {
    "hero-s-points": {
      "hosting": {
        "main": ["hero-s-points"],
        "rpg": ["hero-s-points-rpg"]
      }
    }
  }
}
```

### 4. functions の依存関係をインストール

```bash
cd ~/academy-points/functions
npm install
cd ..
```

### 5. .gitignore を更新

以下を追加:

```
functions/node_modules/
rpg/public/node_modules/
```

### 6. デプロイテスト

```bash
# 塾アプリのみ
firebase deploy --only hosting:main --project hero-s-points

# RPGのみ
firebase deploy --only hosting:rpg --project hero-s-points

# Cloud Functions
firebase deploy --only functions --project hero-s-points

# 全部
firebase deploy --project hero-s-points
```

### 7. コミット

```bash
git add -A
git commit -m "merge: academy-rpg を academy-points に統合 (rpg/ ディレクトリ)"
git push origin claude/fix-deployment-errors-tvRt9
```

### 8. academy-rpg リポジトリの扱い

統合後、`~/academy-rpg/` は削除 or アーカイブ:
```bash
# アーカイブ (念のため残す)
mv ~/academy-rpg ~/academy-rpg-archived
```

---

## 統合後の使い方

```bash
cd ~/academy-points
claude
```

Claude に以下を伝える:
> CLAUDE.md を読んでください。
> 塾アプリは `./` (ルート)、RPGは `./rpg/` にあります。

---

## 統合後のデプロイコマンド (変更点)

| 対象 | 旧コマンド | 新コマンド |
|------|-----------|-----------|
| 塾アプリ | `firebase deploy --only hosting` | `firebase deploy --only hosting:main` |
| RPG | `cd ~/academy-rpg && firebase deploy --only hosting:hero-s-points-rpg` | `firebase deploy --only hosting:rpg` |
| Functions | `cd ~/academy-rpg && firebase deploy --only functions` | `firebase deploy --only functions` |
| Rules | `firebase deploy --only firestore:rules` | `firebase deploy --only firestore:rules` (変更なし) |

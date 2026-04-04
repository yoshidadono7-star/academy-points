# Firebase デプロイ手順（吉田さんPC用）

## 前提
- Googleアカウントでログイン済み
- Firebase プロジェクト `hero-s-points` が存在する（はず）

---

## ステップ1: Firebase CLI インストール（初回のみ）

ターミナル（Mac: Terminal / Win: PowerShell）を開いて:

```bash
npm install -g firebase-tools
```

確認:
```bash
firebase --version
```
→ バージョン番号が出ればOK

---

## ステップ2: Firebaseにログイン（初回のみ）

```bash
firebase login
```
→ ブラウザが開くのでGoogleアカウントでログイン
→ 「Firebase CLI がアクセスをリクエストしています」→ 許可

---

## ステップ3: プロジェクト確認

```bash
firebase projects:list
```

**確認ポイント:**
- `hero-s-points` が一覧にあるか？
- なければ作成が必要（→ ステップ3b へ）
- あれば → ステップ4 へ

### ステップ3b: プロジェクトが無い場合

Firebaseコンソール https://console.firebase.google.com/ を開いて:
1. 「プロジェクトを追加」
2. プロジェクト名: `hero-s-points`
3. Googleアナリティクスはオフでもいい
4. 作成完了を待つ

**Hosting有効化:**
1. 左メニュー → 「Hosting」
2. 「始める」ボタン

**Firestore有効化:**
1. 左メニュー → 「Firestore Database」
2. 「データベースの作成」→ 本番モード → asia-northeast1（東京）

**Authentication有効化:**
1. 左メニュー → 「Authentication」
2. 「始める」→ 「メール/パスワード」を有効化

---

## ステップ4: APIキーの取得と設定

Firebaseコンソール → 歯車（プロジェクト設定）→ 「全般」タブ
→ 下にスクロール → 「マイアプリ」セクション

**ウェブアプリがなければ:**
1. 「</>」（ウ���ブ）ボタンをクリック
2. アプリ名: `hero-s-points-web`
3. 「Firebase Hosting も設定する」にチェック
4. 「アプリを登録」

**表示される設定値をメモ:**
```
apiKey: "AIza..."
authDomain: "hero-s-points.firebaseapp.com"
projectId: "hero-s-points"
storageBucket: "hero-s-points...."
messagingSenderId: "123..."
appId: "1:123..."
```

**この6つの値をClaudeに貼り付けてください。**
firebase-config.js を更新します。

---

## ステップ5: プロジェクト紐付け

コードがあるフォルダに移動:
```bash
cd ~/Desktop/academy-points
```
（またはgit cloneした場所）

最新コードを取得:
```bash
git pull origin claude/gamification-system-design-4JP9t
```

Firebaseプロジェクトを紐付け:
```bash
firebase use hero-s-points
```

---

## ステップ6: デプロイ

```bash
firebase deploy --only hosting
```

成功すると:
```
✓ Deploy complete!

Hosting URL: https://hero-s-points.web.app
```

このURLでアプリが公開されます！

---

## デプロイされるファイル

| ファイル | URL | 用途 |
|---------|-----|------|
| index.html | / | 先生用管理画面 |
| student.html | /student | 生徒用PWA |
| briefing.html | /briefing | 教室モニター |
| parent.html | /parent | 保護者用 |
| db.js | /db.js | データ層 |
| sw.js | /sw.js | Service Worker |
| manifest.json | /manifest.json | PWA設定 |

設計ドキュメント（session-report等）はデプロイから除外済みです。

---

## トラブルシューティング

### 「プロジェクトが見つかりません」
```bash
firebase projects:list
```
で正しいIDを確認 → `firebase use <正しいID>`

### 「Firestoreインデックスエラー」（デプロイ後）
ブラウザのコンソールにエラーリンクが表示される → クリックしてインデックスを作成

### 「管理画面にログインできない」
Firebase Authentication でメール/パスワード認証を有効化し、
Firebaseコンソール → Authentication → ユーザーを追加

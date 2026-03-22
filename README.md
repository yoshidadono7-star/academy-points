# Hero's Academy Points（ヒーローズ塾ポイントシステム）

塾の学習管理＆ゲーミフィケーションシステム。生徒のポイント管理、学習ログ、景品交換、保護者ポータルなどを提供します。

## 機能一覧

- **管理ダッシュボード** (`index.html`) — 生徒管理、ポイント付与、タスク・景品設定、CSV出力
- **生徒ポータル** (`student.html`) — ポイント確認、ランキング、バッジ、ギルド、レイドボス
- **保護者ポータル** (`parent.html`) — 学習状況レポート、通知確認
- Firebase Authentication（管理者ログイン）
- Firestore データベース
- FCM プッシュ通知
- PWA対応（オフライン利用可能）
- Zoom授業検知

## セットアップ手順（他のMacで使う場合）

### 1. リポジトリをクローン

```bash
git clone https://github.com/yoshidadono7-star/academy-points.git
cd academy-points
```

### 2. Firebase CLIのインストール

```bash
npm install -g firebase-tools
firebase login
```

### 3. Firebase設定

`firebase-config.js` にFirebaseプロジェクトの情報を設定してください：

```js
const firebaseConfig = {
  apiKey: "あなたのAPIキー",
  authDomain: "hero-s-points.firebaseapp.com",
  projectId: "hero-s-points",
  storageBucket: "hero-s-points.appspot.com",
  messagingSenderId: "あなたのSenderID",
  appId: "あなたのAppID"
};
```

> **注意:** APIキーなどの認証情報はGitHubにpushしないでください。

### 4. Firebaseプロジェクトの紐付け

```bash
firebase use hero-s-points
```

### 5. ローカルで動作確認

```bash
firebase serve
```

ブラウザで `http://localhost:5000` にアクセスして動作確認できます。

### 6. デプロイ（Web公開）

```bash
firebase deploy
```

デプロイ後、`https://hero-s-points.web.app` でアクセス可能になります。

## ファイル構成

```
academy-points/
├── index.html          # 管理者ダッシュボード
├── student.html        # 生徒ポータル
├── parent.html         # 保護者ポータル
├── db.js               # Firestoreデータベース操作
├── firebase-config.js  # Firebase設定（※要編集）
├── firebase.json       # Firebase Hosting設定
├── firestore.rules     # Firestoreセキュリティルール
├── sw.js               # Service Worker（PWA）
├── manifest.json       # PWAマニフェスト
└── icons/              # アプリアイコン
```

## 複数Mac間での開発

変更をpushする：
```bash
git add .
git commit -m "変更内容の説明"
git push
```

他のMacで最新を取得する：
```bash
git pull
```

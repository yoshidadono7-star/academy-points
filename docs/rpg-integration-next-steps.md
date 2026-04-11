# Academy RPG 連携: 次のステップ

## Step 5 完了内容 (2026-04-11)

### academy-points 側の実装

1. **firestore.rules 更新** — `rpg_*` コレクションへの admin 書き込み権限を追加
2. **db.js に RpgBridgeDB 追加** — RPG 側へ報酬を反映するヘルパー
   - `awardForPomodoro(studentId, pomodoroCount, minutes, subject)` — ポモドーロ完走時の報酬
   - `resolveRpgUid(studentId)` — academy-points 生徒ID → RPG Google UID の紐付け解決
   - `linkAccount(studentId, googleUid)` — アカウント紐付け
   - `unlinkAccount(studentId)` — 紐付け解除
   - `getAllLinks()` — 全紐付け一覧
3. **student.html** — ポモドーロ完走時に `RpgBridgeDB.awardForPomodoro` を自動呼び出し

### 報酬レート

| 項目 | 1ポモドーロあたり |
|------|-------------------|
| XP | +20 |
| Gold | +10 |
| Standard チケット | +1 |

academy-rpg 側の `functions/awardStudyReward.js` と同じレート。

---

## 未解決の課題

### 1. アカウント紐付けの UI が未実装

現状、生徒が RPG を Google ログインで使うと、RPG UID (例: `google_abc123`) と
academy-points 生徒ID (例: `student_xyz789`) が別物になる。

`RpgBridgeDB.resolveRpgUid()` は `rpg_account_links/{academyStudentId}` を見に行くが、
現時点ではそのドキュメントを作る UI が無い。

そのため今は、`rpg_account_links` が空の状態では
**academy-points 生徒ID のまま RPG 側コレクションに書き込まれる**。
つまり生徒が Google ログインした RPG では、まだ報酬が見えない状態。

### 2. 必要な実装

#### A. 管理画面 (index.html) にアカウント紐付け UI

以下のような画面を追加:

- 生徒一覧 (`students` コレクション)
- 各生徒の隣に「RPG アカウント紐付け」ボタン
- クリック → モーダル → 「生徒の Google ログイン UID を入力」
- 保存 → `RpgBridgeDB.linkAccount(studentId, googleUid)` 呼び出し

Google UID は RPG ログイン後に生徒に伝えてもらう方式で OK。
もしくは、RPG 側に「自分の Google UID を表示」ボタンを置く。

#### B. RPG 側 (academy-rpg) にマージロジック

現状の `FirebaseSync.createProfile` は `rpg_profiles/{googleUid}` を作る。
紐付けがあれば `rpg_profiles/{academyStudentId}` にマージする仕組みが必要。

案:
1. LoginScene で Google ログイン直後、`rpg_account_links` を逆引き
2. 自分の googleUid が紐付けられている `academyStudentId` を探す
3. 見つかれば `rpg_profiles/{academyStudentId}` を読んで UI に反映
4. 見つからなければ新規プロフィール作成 (現状の挙動)

もしくは、LoginScene に「アカウント紐付け」ボタンを追加:
- 生徒自身に academy-points の PIN を入力してもらう
- サーバで PIN → 生徒ID を逆引きし、`rpg_account_links` に書き込む

### 3. その他の将来タスク

- `rollGacha` Cloud Function 実装 (サーバ権威のガチャ)
- ミニゲーム3種 (MathFlash / MemoryMatch / TypingHero)
- Inventory シーン (獲得装備・バディ一覧)
- 科目別スキルレート (`rpg_skill_rates`) 連動の強化バフ

---

## Firestore Rules の同期

**重要**: academy-points と academy-rpg の両方が同じ Firestore を使っているので、
`firestore.rules` はどちらか片方しか有効にならない (最後にデプロイしたほうが勝つ)。

### 対応方針

- **Single Source of Truth**: academy-points 側の `firestore.rules` をマスターとし、
  academy-rpg 側のルールは **空** または同じ内容を保つ
- または、academy-rpg 側からはルールをデプロイしない運用にする

### 今回追加した rpg_* ルール (academy-points/firestore.rules 末尾)

```
match /rpg_profiles/{uid} { ... }
match /rpg_wallet/{uid} { ... }
match /rpg_gacha_tickets/{uid} { ... }
match /rpg_daily_stats/{uid}/days/{dateId} { ... }
match /rpg_inventory/{uid}/items/{itemId} { ... }
match /rpg_account_links/{academyStudentId} { ... }
match /rpg_minigame_results/{docId} { ... }
match /rpg_transactions/{docId} { ... }
match /rpg_skill_rates/{uid} { ... }
```

academy-rpg 側にデプロイされている rules は古いので、必ず academy-points 側を
最後にデプロイすること。

```bash
cd ~/academy-points
firebase deploy --only firestore:rules --project hero-s-points
```

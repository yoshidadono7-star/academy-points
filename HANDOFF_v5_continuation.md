## セッション引き継ぎ（続き）— Phase 8〜11

**更新日: 2026年4月6日 | 累計コミット数: 98 | 開発期間: 2026/3/21〜4/6**
**最新コミット: 7e52521（Zoomを塾と同等扱いに変更）**
**開発ブランチ: claude/review-handoff-docs-kk210-WpmyP**

---

### 画面とファイル行数（最新）

| 画面 | URL | ファイル | 行数 | 前回比 |
|------|-----|---------|------|--------|
| 管理画面（先生用） | / | index.html | 7,797 | +2,516 |
| 生徒画面 | /student | student.html | 4,094 | +556 |
| 保護者画面 | /parent | parent.html | 1,567 | +554 |
| 教室モニター | /briefing | briefing.html | 1,566 | +92 |
| 講師画面（**新規**） | /teacher | teacher.html | 1,044 | **新規** |
| DB層 | — | db.js | 4,005 | +1,291 |
| **合計** | | | **20,073** | **+6,436** |

---

### Phase 8: スケジュール管理 + 講師管理（4/5〜4/6前半）— コミット71-86

**教室運営の実務機能を一括実装**

- **スケジュール管理システム**:
  - ScheduleSlotsDB: 日別×時間帯の授業スロット管理
  - ScheduleTemplatesDB: 週固定パターン（テンプレート）
  - 日/週/月/年の4ビュー切替（全5画面対応）
  - 生徒行×時間列のマトリクス表示
  - モーダルUIでのスロット追加・編集・削除
  - スケジュール自動生成エンジン（テンプレートから一括反映）

- **講師管理システム**:
  - TeachersDB: 講師CRUD（名前/メール/担当科目/時給/役割）
  - ShiftsDB: シフト管理（日別×時間帯）
  - AvailabilityDB: 講師の出勤可能時間
  - 講師キャパシティ管理（最大担当数 vs 現在担当数）
  - 人件費予測表示（教室長は変動費から除外）
  - teacher.html（講師ポータル）新規作成

- **承認フロー**:
  - 保護者がスケジュール変更をリクエスト → 管理画面で承認/差戻し
  - parent.htmlに承認/差戻し通知表示

- **整合性チェック**:
  - スケジュール×講師シフト×テンプレートの自動整合チェック
  - 手動修復UI（データ不整合の検出＆一括修復）

### Phase 9: 塾運営基盤の強化（4/6）— コミット87-93

**実務運営に必要な管理機能を追加**

- **生徒カルテ（総合ビュー）**:
  - 1ページで生徒の全情報を俯瞰（学習履歴/ポイント/コンディション/テスト/面談/スケジュール）
  - index.htmlの生徒管理タブに「📋 カルテ」ボタン追加

- **面談記録システム**:
  - InterviewRecordsDB: 面談タイプ（定期/臨時/三者/電話/オンライン）、内容、次回アクション
  - CoachingDBの簡易メモ → 履歴付きの面談記録に拡張
  - 生徒・保護者画面にも面談記録を共有表示

- **収支管理ダッシュボード**:
  - 💹 タブ: 月謝収入/講師人件費/固定費/営業利益を一画面表示
  - AcademyConfigDB: 塾全体の設定（家賃/光熱費/その他固定費）
  - コース別売上×生徒数、講師別人件費の内訳表示

- **UI/UXリデザイン**:
  - 管理画面: 2段ナビゲーション（4カテゴリ: 日常/管理/ゲーム/システム）
  - 全画面にカテゴリナビ導入 + タブ名統一
  - 保護者・講師・モニター画面を簡素化
  - バッジ獲得時のコンフェッティ（紙吹雪）エフェクト追加

- **保護者レポート・通知システム**:
  - TeacherCommentsDB: 講師コメント（学習態度/理解度/特記事項）
  - reportLogsコレクション: レポート送信履歴
  - 自動レポート生成（日次/週次/月次）
  - メール送信テンプレート + プレビュー機能

### Phase 10: ポイント経済リデザイン + 家庭学習検証（4/6）— コミット94-96

**経営合理性に基づくポイントシステム全面見直し**

- **COIN_PARAMS改定**:
  - ポモドーロ: 5→7pt / 振り返り+計画: 3→5pt
  - 家庭学習パラメータ追加: 写真ボーナス+5pt、保護者確認+3pt、1日60分上限
  - 残高上限: 2000→3500pt

- **レベル閾値全面改定**（到達目安: 週3回通塾の場合）:
  - Lv2=100pt（約2週間）、Lv5=1000pt（約5ヶ月）、Lv10=7000pt（約2年）

- **ストリークボーナス引上げ**:
  - 3日: 5→10pt / 5日: 15→20pt / 10日: 30→40pt / 20日: 50→60pt

- **家庭学習検証システム（3段階）**:
  - Phase 1: 講師承認制 — 自宅学習は `pending` 状態で記録、管理画面で承認後にポイント付与
  - Phase 2: 写真提出 — ノート写真をFirebase Storageにアップ、承認画面で確認、+5ptボーナス
  - Phase 3: 保護者確認 — parent.htmlでワンタップ確認、+3ptボーナス
  - StudyLogsDBに `approvalStatus/pauseCount/pauseLog/photoUrl/parentConfirmed` フィールド追加
  - `getPending()/approve()/reject()` メソッド追加

- **報酬カタログ再設計（コストゼロ中心）**:
  - 経営試算: 報酬予算 = 月謝の1-2% = 250-500円/生徒/月
  - DEFAULT_REWARDS_CATALOG: 25種の報酬を4カテゴリに分類
    - 🎫 特権（好きな席/BGM/自習室パス/副塾長体験等）: コスト0円
    - 🏆 称号（カスタム称号/プロフィール装飾/殿堂入り）: コスト0円
    - 📚 学習体験（1on1質問/特別レッスン/模試サポート）: 0〜3000円
    - 🎁 物品（駄菓子/文具/図書カード）: 100〜1000円
  - student.htmlにカテゴリフィルター + ランク制限 + クールダウン表示
  - seedDefaultRewards(): 初回アクセス時に自動シード

- **PrizesDB → RewardsDB統合**: 景品UIをRewardsDB参照に全面書き換え

### Phase 11: Zoom即時付与（4/6）— コミット97-98

- Zoomは講師がリアルタイムで見ている前提 → 塾と同等の即時ポイント付与に変更
- **最終的な場所別ポイント付与ルール**:
  - 塾: 即時付与（confirmed）
  - Zoom: 即時付与（confirmed）
  - 自宅: pending → 講師承認後に付与

---

### 現在のデータモデル概要（db.js: 4,005行）

#### DBオブジェクト（37個）— 前回27個から+10個

| カテゴリ | DB名 | 状態 |
|---------|------|------|
| 既存 | StudentsDB, StudyLogsDB, TasksDB, PrizesDB, ConditionsDB, BadgesDB, MessagesDB, GuildsDB, RaidBossDB, ExamResultsDB, NotificationsDB, CoachingDB, MissionsDB, CoinsDB, EventsDB, RewardsDB, SpaceMapDB, ComboDB, DailyMissionsDB, StoryDB, SupportFleetDB, MaterialProgressDB, ActiveSessionsDB, AttendanceDB, DailyPlansDB, ExamSchedulesDB, StudyRoutesDB, RouteTasksDB | 維持 |
| **新規** | **AcademyConfigDB** | 塾設定（家賃/固定費） |
| **新規** | **TeachersDB** | 講師管理（名前/科目/時給/役割） |
| **新規** | **ShiftsDB** | 講師シフト管理 |
| **新規** | **ScheduleTemplatesDB** | 週固定パターン |
| **新規** | **ScheduleSlotsDB** | 授業スロット管理 |
| **新規** | **AvailabilityDB** | 講師出勤可能時間 |
| **新規** | **OperationTasksDB** | 業務タスク管理 |
| **新規** | **InterviewRecordsDB** | 面談記録 |
| **新規** | **TeacherCommentsDB** | 講師コメント（レポート用） |

#### Firestoreコレクション（42個）— 前回31個から+11個

新規追加: `academyConfig`, `availability`, `interviewRecords`, `operationTasks`, `reportLogs`, `scheduleSlots`, `scheduleTemplates`, `shifts`, `supportActions`, `teacherComments`, `teachers`

#### 新規定数

| 定数名 | 内容 |
|--------|------|
| DEFAULT_REWARDS_CATALOG | 25種の報酬カタログ（4カテゴリ） |
| SHIELD_DEFENSE_MISSIONS | シールド防衛ミッション |

#### COIN_PARAMS（改定後）

```
基本: attendance=10, pomodoro=7, pomodoroTriple=10, review=5, reviewPlan=5, aiProblems10=3
社会: teaching=10, newStudentSupport=15, trialSupport=20, socialMonthlyMax=200
家庭学習: homeStudyPhotoBonus=5, homeStudyParentBonus=3, homeStudyStreakBonus=10, homeStudyDailyMax=60
経済: coinExpiry=180, balanceCap=3500, giftDailyMax=20, giftPerMax=10
オンボーディング: starterPack=20, welcomeBonus=30, rookieMultiplier=1.5, eventMultiplier=2.0
```

#### レベル閾値（改定後）

```
Lv1=0, Lv2=100, Lv3=300, Lv4=600, Lv5=1000, Lv6=1500, Lv7=2200, Lv8=3000, Lv9=4500, Lv10=7000
```

#### ストリークボーナス（改定後）

```
3-4日=10pt, 5-9日=20pt, 10-19日=40pt, 20日+=60pt
```

---

### StudyLogsDB スキーマ（拡張後）

| フィールド | 型 | 説明 |
|-----------|---|------|
| studentId, studentName | string | 生徒識別 |
| subject, duration, points | string/number | 学習内容 |
| location | string | 塾/自宅/Zoom |
| method, pomodoroCount | string/number | 学習方法 |
| material, materialName, materialNote | string | 教材情報 |
| **approvalStatus** | string | **confirmed/pending/rejected** |
| **pauseCount** | number | **一時停止回数** |
| **pauseLog** | array | **一時停止タイムスタンプ配列** |
| **photoUrl** | string | **学習ノート写真URL** |
| **parentConfirmed** | boolean | **保護者確認済みフラグ** |
| **verificationMethod** | string | **auto/photo/parent** |
| date, createdAt | string/timestamp | 日付 |

---

### ポイント計算フロー（改定後）

1. basePoints = 分数 + ポモドーロボーナス(**7pt**×回数)
2. イベント重複判定（セッション期間 ∩ イベント期間 ≠ 空）
3. points = round(basePoints × eventMultiplier) + eventBonusPoints
4. **場所判定: 塾/Zoom → 即時付与 / 自宅 → pending（ポイント未付与）**
5. コンボボーナス加算（**approvalStatus === 'confirmed' 条件付き**）
6. ギルドポイント加算（塾/Zoomのみ即時）
7. レイドボスダメージ計算
8. バッジ判定 → 9. ミッション達成判定
10. **自宅の場合: 管理画面で承認 → StudyLogsDB.approve() → ポイント付与 + 写真/保護者ボーナス**

---

### 報酬交換の経済設計

| カテゴリ | 価格帯 | 実コスト | クールダウン |
|---------|--------|----------|-------------|
| 🎫 特権 | 50-1000pt | 0円 | 1-90日 |
| 🏆 称号 | 100-2000pt | 0円 | なし（期間制） |
| 📚 学習 | 100-1500pt | 0-3000円 | 3-90日 |
| 🎁 物品 | 100-1500pt | 100-1000円 | 7-90日 |

**月間コスト見積もり**: 生徒1人あたり100-300円（予算250-500円以内）

---

### 既知の未解決事項（更新）

| 重要度 | 内容 | 状態 |
|--------|------|------|
| Medium | 生徒画面「学習ルート」読み込みエラー | 未修正 |
| Medium | 一蓮托生ボーナス: checkAllStudiedBonus()ポイント加算未実装 | 未修正 |
| Medium | コマンダーバフ: ポイント倍率適用ロジック未確認 | 未修正 |
| Medium | チェックアウト: logout()でAttendanceDB.checkOut()未呼出 | 未修正 |
| Low | PrizesDB: RewardsDBに統合済みだがPrizesDB定義自体は残存 | 将来削除予定 |
| **New** | **Firestoreインデックス: approvalStatus+createdAt を要デプロイ** | firebase deploy必要 |
| **New** | **Firebase Storage: storage.rules を要デプロイ** | firebase deploy必要 |

---

### 重要な設計原則（追加分）

- **家庭学習検証**: 塾/Zoom=即時信頼、自宅=3段階検証（講師承認→写真→保護者）
- **ポイント経済**: 1ptは「努力1単位」であり円と非連動。報酬の9割がコストゼロの特権・体験
- **経営合理性**: 報酬予算は月謝の1-2%（250-500円/生徒/月）以内に収まる設計
- **報酬カタログ**: 4カテゴリ（特権/称号/学習/物品）×4ランク（ルーキー/クルー/シニア/キャプテン）
- **スケジュール**: テンプレート（週パターン）→ 自動生成 → 手動調整 → 承認フローの4段階

---

### デプロイ手順（更新）

```bash
cd ~/academy-points
git checkout main
git merge claude/review-handoff-docs-kk210-WpmyP
npx firebase deploy --project hero-s-points
```

※ 今回のデプロイで storage.rules と Firestore インデックス（approvalStatus+createdAt）が新規追加されます。

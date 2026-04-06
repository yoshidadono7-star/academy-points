# HERO'S ACADEMY - 引き継ぎ文書 Phase 8-11

更新日: 2026-04-06
ブランチ: `claude/deploy-schedule-teacher-features-5E85T`

## 概要

Phase 8-11として以下の機能を実装:
1. **スケジュール管理** + **講師管理** (Phase 8)
2. **生徒カルテ** + **面談記録** + **収支管理** (Phase 9)
3. **ポイント経済リデザイン** + **家庭学習検証** + **報酬カタログ** (Phase 10)
4. **Zoom即時ポイント付与** (Phase 11)

## 新規ファイル

| ファイル | 説明 |
|---------|------|
| teacher.html | 講師ポータル (PIN認証, スケジュール, 承認, コメント) |
| storage.rules | Firebase Storage ルール (写真アップロード用) |
| HANDOFF_v5_continuation.md | 本文書 |

## db.js 新規DBオブジェクト (+10個)

| DB名 | コレクション | 用途 |
|------|-------------|------|
| AcademyConfigDB | academyConfig | 塾設定 (家賃/光熱費/固定費) |
| TeachersDB | teachers | 講師CRUD (名前/科目/時給/役割/PIN) |
| ShiftsDB | shifts | 講師シフト (日別×時間帯) |
| AvailabilityDB | availability | 講師出勤可能時間 |
| ScheduleTemplatesDB | scheduleTemplates | 週固定パターン |
| ScheduleSlotsDB | scheduleSlots | 実際の授業スロット (日別) |
| InterviewRecordsDB | interviewRecords | 面談記録 (タイプ/内容/アクション) |
| TeacherCommentsDB | teacherComments | 講師コメント (レポート用) |
| OperationTasksDB | operationTasks | 業務タスク |
| ReportLogsDB | reportLogs | レポート送信履歴 |

## StudyLogsDB 変更点

新規フィールド:
- `approvalStatus`: 'pending' / 'confirmed' / 'rejected'
- `pauseCount`: 一時停止回数
- `pauseLog`: 一時停止ログ
- `photoUrl`: 写真提出URL
- `parentConfirmed`: 保護者確認済みフラグ
- `approvedBy` / `approvedAt`: 承認者/日時

新規メソッド:
- `update(id, data)` - 汎用更新
- `getPending()` - 承認待ち一覧 (approvalStatus='pending')
- `approve(id, approvedBy)` - 承認
- `reject(id, approvedBy, reason)` - 却下

## ポイントパラメータ改定 (Phase 10)

| 項目 | 旧値 | 新値 |
|------|------|------|
| ポモドーロ1セット | 5pt | 7pt |
| 残高上限 | 2,000pt | 3,500pt |
| ストリーク 3-4日 | 5pt | 10pt |
| ストリーク 5-9日 | 15pt | 20pt |
| ストリーク 10-19日 | 30pt | 40pt |
| ストリーク 20日+ | 50pt | 60pt |

レベル閾値: [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4500, 7000]

## Zoom即時付与 (Phase 11)

| 場所 | ポイント付与 | 承認 |
|------|-------------|------|
| 塾 | 即時付与 | 不要 |
| Zoom | 即時付与 | 不要 |
| 自宅 | 承認後に付与 | 講師が承認/却下 |

写真提出ボーナス: +5pt / 保護者確認ボーナス: +3pt

## index.html 追加タブ

- **スケジュール**: 日/週/月ビュー, テンプレート管理, 自動生成
- **講師管理**: CRUD, シフト管理, 人件費予測
- **面談記録**: 生徒別/全体, タイプ別 (定期/臨時/三者/電話/オンライン)
- **収支管理**: 月謝収入/人件費/固定費/営業利益
- **家庭学習承認**: pending一覧, 承認/却下

生徒管理に「カルテ」ボタン追加 (学習履歴/ポイント/コンディション/面談/コメント一覧)

## parent.html 追加タブ

- **スケジュール**: 今週のスケジュール表示
- **学習確認**: 家庭学習の保護者確認ボタン (+3ptボーナス)
- **面談**: 面談記録閲覧

## teacher.html (新規)

PIN認証ログイン、5タブ:
- 今日のスケジュール
- 家庭学習承認 (承認/却下)
- 生徒コメント記入
- シフト確認
- 統計

## firebase.json 変更

- `/teacher` リライト追加
- `storage.rules` 追加

## firestore.rules 追加コレクション

academyConfig, teachers, shifts, availability, scheduleTemplates,
scheduleSlots, interviewRecords, teacherComments, operationTasks, reportLogs

## firestore.indexes.json 追加インデックス

- studyLogs: approvalStatus + createdAt (DESC)

## デプロイ手順

```bash
cd ~/academy-points
git checkout main
git merge claude/deploy-schedule-teacher-features-5E85T
npx firebase deploy --project hero-s-points
```

## 既知の未解決事項

| 重要度 | 内容 | 状態 |
|--------|------|------|
| Medium | 学習ルート読み込みエラー | 未修正 |
| Medium | チェックアウト: logout()でcheckOut()未呼出 | 未修正 |
| Low | PrizesDB: RewardsDB統合済みだが定義残存 | 将来削除予定 |

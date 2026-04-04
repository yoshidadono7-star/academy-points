# HERO'S ゲーミフィケーション・システム設計 — セッション引き継ぎ文書

**セッション日時:** 2026年4月2日
**プロジェクト:** academy-points
**ブランチ:** `claude/gamification-system-design-d2FD9`
**作業者:** Claude (Opus 4.6) + Gemini（世界観・年間シナリオの共同設計）

---

## 1. このセッションで何をしたか（全体サマリー）

HERO'S延岡校の学習塾ポイントシステムを「ポイントカード」から「本物のゲーム」に進化させるための**設計・一部実装・ローカライズ**を行った。

### 前回（4/1）からの引き継ぎ事項
- ストーリーテリング・フレームワークv4（7ステージ、三重螺旋）
- 空間設計（3F/2F-1号室/2F-2号室のトリプルゾーン）
- ギルド編成8原則
- ワンウェイミラー型匿名性
- Phase 1(ソロ)→2(匿名ギルド)→3(実名ギルド)のロードマップ
- **「今すぐギルドは作れない。ソロが先」という吉田さんの方針が最重要制約**

### 今回の成果
1. 既存コードの完全把握（5画面・17タブ・16モジュール全て実装済みを確認）
2. ゲームデザイン2.0（5要素統合ゲームループの設計）
3. Phase 1の8週間具体計画
4. 5モジュールの詳細技術仕様
5. db.jsへの7モジュール+マルチバース翻訳システムの実装（+893行）
6. ストーリーテリングPhase 1版 + 保護者説明資料
7. PROJECT: ORBIT 年間計画（12ヶ月・延岡ローカライズ）
8. 6世界観マルチバース翻訳システムの設計・実装
9. Gemini提案のPROJECT: ORBIT検証（即採用5件/時期調整3件/不採用3件）
10. Gemini提案のコマンダーシステム/UIスキンの検証と修正採用

---

## 2. 成果物一覧（ファイル）

### 設計ドキュメント（HTMLで閲覧可能）
| # | ファイル | 行数 | 内容 |
|---|---------|------|------|
| 1 | `system-overview.html` | 502 | 既存5画面の機能整理マップ |
| 2 | `game-design-v2.html` | 654 | ゲームデザイン2.0（5要素の概要設計、6タブ） |
| 3 | `phase1-plan.html` | 568 | Phase 1 ソロ文化確立 8週間ロードマップ（7タブ） |
| 4 | `detailed-specs.html` | 1,123 | 5モジュールの詳細技術仕様（5タブ） |
| 5 | `storytelling-phase1.html` | 517 | ストーリーテリングPhase 1 + 保護者説明資料（5タブ） |
| 6 | `annual-plan.html` | 591 | PROJECT: ORBIT 年間計画 12ヶ月（クリック展開式） |
| 7 | `session-report-v2.html` | 398 | セッションレポートv2（項目1-8の詳細） |

### 実装コード
| ファイル | 変更量 | 内容 |
|---------|--------|------|
| `db.js` | 1,195行→2,088行 (+893行) | 7モジュール+マルチバース翻訳システム |

### 閲覧方法
```bash
cd ~/Desktop/academy-points
git pull origin claude/gamification-system-design-d2FD9
open game-design-v2.html   # 等、ブラウザで直接開ける
```

---

## 3. db.jsの現在の状態（2,088行・23モジュール+翻訳システム）

### 元からあったモジュール（16個）
StudentsDB, StudyLogsDB, TasksDB, PrizesDB, ConditionsDB, BadgesDB, MessagesDB, GuildsDB, RaidBossDB, ExamResultsDB, NotificationsDB, CoachingDB, RiskDetector, MissionsDB, EventsDB, CoinsDB

### 今回追加したモジュール（7個）
| モジュール | 行数 | 役割 |
|-----------|------|------|
| SpaceMapDB | ~70 | 宇宙マップ。10ステーション+6隠しエリア。getStation(), checkAndUnlock() |
| ComboDB | ~150 | コンボシステム。13コンボ（公開3+隠し10）。buildContext(), checkAll() |
| DailyMissionsDB | ~180 | ランダムミッション。21ミッション（18通常+3シールド防衛）。draw(), checkCompletion() |
| calculateBossDamage() | ~35 | 戦略ボスダメージ計算。属性倍率×コンボ×ポモドーロ×サポートバフ |
| StoryDB | ~120 | 分岐ストーリー。チャプター管理、ルート進捗、月末結末判定 |
| SupportFleetDB | ~60 | サポート艦隊。私立合格者のクラスチェンジ、バフ計算(最大×1.6) |
| マルチバース翻訳 | ~130 | 6世界観の翻訳辞書、translateTerm(), isDimensionShiftOpen() |

### 追加した定数
| 定数 | 件数 |
|------|------|
| SPACE_STATIONS | 10（地球〜銀河の果て） |
| HIDDEN_AREAS | 6（彗星の洞窟〜観測所オメガ） |
| COMBO_DEFINITIONS | 13（公開3+隠し10、不屈のエンジン含む） |
| DAILY_MISSION_POOL | 18（Common6/Uncommon5/Rare4/Epic2/Legendary2） |
| SHIELD_DEFENSE_MISSIONS | 3（テストなし月用） |
| TARGET_STATIONS | 7（延岡の高校7校） |
| STORY_THEMES | 12（月次テーマ4月〜3月） |
| WORLD_THEMES | 6（legend/tactical/heroine/academia/cozy/space） |

### 生徒プロフィールに追加したフィールド
```
testType: 'midterm' | 'no_midterm'   // 中間テスト有無
weakSubject: null | '数学'等          // 苦手科目
targetStation: null | 'nobeoka_h'等   // 志望校
role: 'student' | 'supporter'        // サポート艦隊
missionStreak: 0                     // ミッション連続達成
worldId: 'space'                     // 選択した世界観（6択）
uiTheme: 'starforce'                 // UIスキン（Phase2解放）
```

---

## 4. 重要な設計決定事項

### ゲームデザイン
- **4層ゲームループ:** 月次(ストーリー)→週次(ボス戦略)→日次(ミッション3択)→セッション(コンボ発見)
- **設計原則:** 全ループに「生徒が自分で選ぶ」瞬間がある
- **学習完了時の9ステップ処理:** ①ポイント計算→②コンボ判定→③ポイント付与→④ボスダメージ→⑤バッジ→⑥ミッション→⑦ストーリー→⑧隠しエリア→⑨完了画面

### マルチバース（6世界観）
- **ルールは1つ。表示（言葉・色）だけが6通りに変わる**
- 先生の月次設定は1回（共通テキスト）。6パターンへの変換はプログラムが自動で行う
- Phase 1はデフォルト（宇宙）1種でスタート。Week 3-4で選択解放
- **世界観変更は年4回（7月/9月/11月/1月）の各1週間限定**

### PROJECT: ORBIT（年間計画）
- 12ヶ月の月次テーマが延岡の受験スケジュールに完全連動
- 5月・10月: testType分岐（中間テスト有無でミッションが変わる）
- 1月: サポート艦隊（私立合格者→県立組へのバフ支援）
- 3月: フライトレコーダー（1年間のエンドロール）

### コマンダーシステム（先生の参戦）
- 先生は今まで通りの業務をするだけでCPが自動蓄積
- CPが閾値に達したら自動でバフ発動（操作負荷ゼロ）
- モニターに「コマンダーから支援到達！」と演出表示

### Phase移行条件
- 期日ではなく5条件ベースで判断（定着率80%、ポモドーロ文化、コンボ発見、運用安定、自然な交流）

---

## 5. 次回セッションでやるべきこと（優先順）

### A. student.html のUI実装 【最優先】
既存の14画面構造をベースに以下を追加改修:
1. ホーム画面: レベル表示→宇宙マップに差替（getStation()使用）
2. ランダムミッション3択カード（DailyMissionsDB.draw()使用）
3. コンボ図鑑画面の新設（ComboDB.getDiscoveries()使用）
4. 学習完了画面: コンボ発動表示+ボスダメージ表示の追加
5. ボス弱点表示の追加（weakness/resistance表示）
6. CSS変数によるテーマ切替の基盤（WORLD_THEMESのcolorPrimary/colorBg適用）

**注意:** Geminiが作ったモックアップ（デスクトップ用2カラム）は使えない。既存student.htmlはモバイルPWAなのでモバイルファーストで改修すること。

### B. index.html の管理UI追加 【高】
1. ボス作成フォームに弱点/耐性/特殊能力の設定を追加
2. ストーリーチャプター管理画面の新設
3. サポート艦隊管理画面（role変更ボタン）
4. コマンダーCP表示（小さなゲージ）

### C. monitor.html の表示追加 【中】
1. 全生徒の宇宙マップ位置表示
2. ストーリーテキスト+進捗パネル
3. ボス弱点表示の強化
4. コマンダーバフ発動時の演出

### D. 世界観セレクト画面 【Phase 1 Week 3-4】
1. 初回ログイン時の世界観選択UI
2. 6世界のCSS配色セット
3. チュートリアル・ツアー（6世界体験）

### E. Firebaseデプロイ 【完成後】
hero-s-points.web.app に公開

---

## 6. 参照すべき過去資料

| 資料 | 内容 |
|------|------|
| CLAUDE_HEROS_STORYTELLING.md | 4/1セッション全記録。フレームワークv4、空間設計、ギルド8原則、匿名性設計 |
| HEROS_統合設計書_V2_深掘り全文版_FINAL.docx | 47万字の全10章。教育的基盤、ポイント設計、コーチング連動 |
| HERO_S_Points_v2.docx | ポイントシステム完全仕様。認知科学6メソッドのコイン配分根拠 |
| heros-v7.html | HP（Webサイト）。9タブ構成 |
| Geminiとの会話記録 | PROJECT: ORBIT、6世界観マルチバース、コマンダーシステム、UIモックアップ |

---

## 7. 技術的な注意事項

1. **Firestoreの複合インデックス** — studySessions等にwhere+orderByの複合クエリがある。インデックス未作成だとデータ表示されない
2. **Service Worker** — sw.jsのキャッシュ戦略をネットワークファーストに変更済み（前回セッションで修正）
3. **FCMプッシュ通知** — SERVER_KEYがプレースホルダーのまま
4. **parent.html** — Promise.allSettledに修正済み（前回セッションで修正）
5. **db.jsのconditionFn** — COMBO_DEFINITIONS等の条件関数はFirestoreにシリアライズできない。定数としてコード内に保持する設計
6. **ComboDB.buildContext()** — 複数のFirestoreクエリを並列実行するので、初回呼び出しは少し遅い可能性あり

---

## 8. コミット履歴（本セッション分）

```
3b5a298 マルチバース翻訳システム + 年間計画を追加
3e01392 PROJECT: ORBIT 年間計画(12ヶ月)を追加
dc66a82 セッションレポートv2(最終版)を追加 - 全8項目の詳細
dcd8a83 PROJECT: ORBIT — 延岡ローカライズ5要素をdb.jsに追加
fbeed64 セッションレポート(全6項目の詳細)を追加
e2e4e4f ストーリーテリングPhase 1版 + 保護者説明資料を追加
44ead25 db.jsにGame Design v2.0の5モジュールを実装
296f60e 5要素の詳細技術設計書を追加
afeb3ce Phase 1ソロ文化確立の具体計画を追加 - 8週間ロードマップ
bf64b83 ゲームデザインv2.0設計書を追加 - 5要素統合ゲームループ
b0bae80 システム全体像の整理ドキュメント(HTML形式)を追加
```

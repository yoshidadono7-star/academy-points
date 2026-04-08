// Firebase設定 - hero-s-points プロジェクト
const firebaseConfig = {
  apiKey: "AIzaSyBeY5L5bupgjiSVbsyOI8VkMcmGyeDfFdo",
  authDomain: "hero-s-points.firebaseapp.com",
  projectId: "hero-s-points",
  storageBucket: "hero-s-points.firebasestorage.app",
  messagingSenderId: "391139988281",
  appId: "1:391139988281:web:ae87b669e7a94bc12f0ee8"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- Feature 9: 階層型コーチングシステム起動時マイグレーション ---
// db.js が読み込まれた後に classroomId マイグレーションと default 教室作成を実行
// 起動時に1回だけ動く（settings/migrations.classroomIdAdded=true で再実行を防ぐ）
document.addEventListener('DOMContentLoaded', () => {
  // db.js が読み込まれているかチェック
  if (typeof migrateClassroomId === 'function' && typeof ClassroomsDB !== 'undefined') {
    setTimeout(async () => {
      try {
        await ClassroomsDB.ensureDefault();
        await migrateClassroomId();
      } catch (e) {
        console.warn('[classroom-migration] failed:', e);
      }
    }, 2000); // 画面描画を優先するため少し遅延
  }
});

// --- Feature 9 緊急修正 #4: Service Worker 自動更新 ---
// 新しいバージョンの sw.js がデプロイされたら、ユーザーが何もしなくても
// 自動的に新 SW を install → active → ページリロードまで実行する。
// これにより「キャッシュで古い画面が見え続ける」問題が永久に解消される。
if ('serviceWorker' in navigator) {
  // updateViaCache: 'none' → ブラウザが sw.js 自体をキャッシュしないので
  // 毎回ネットワークから最新を取得できる
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
    .then(reg => {
      // 起動時に明示的にチェック
      reg.update().catch(() => {});
      // タブが visible になるたびにもチェック（バックグラウンド復帰時）
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          reg.update().catch(() => {});
        }
      });
    })
    .catch(e => console.log('[sw-autoupdate] register failed:', e));

  // 新しい SW が active になった瞬間に1回だけリロード
  // → ユーザーは何もしなくても自動で新画面を見られる
  let __swRefreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (__swRefreshing) return;
    __swRefreshing = true;
    console.log('[sw-autoupdate] new version active, reloading...');
    window.location.reload();
  });
}

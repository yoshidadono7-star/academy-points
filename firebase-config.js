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

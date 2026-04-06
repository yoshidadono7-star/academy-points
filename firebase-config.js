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
// Firebase Storage初期化（家庭学習写真アップロード用）
try { firebase.storage(); } catch(e) { console.warn('Storage init skipped:', e.message); }

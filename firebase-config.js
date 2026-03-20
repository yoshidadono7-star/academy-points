// Firebase設定 - hero-s-points プロジェクト
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "hero-s-points.firebaseapp.com",
  projectId: "hero-s-points",
  storageBucket: "hero-s-points.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

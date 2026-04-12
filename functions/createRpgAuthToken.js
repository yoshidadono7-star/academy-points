const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * createRpgAuthToken
 *
 * 生徒のニックネーム + PIN を受け取り、該当する生徒の Custom Token を返す。
 * RPG 側は返ってきたトークンで signInWithCustomToken する。
 *
 * 入力: { nickname: string, pin: string }
 * 出力: { token: string, studentId: string, studentName: string }
 */
module.exports = onCall(async (request) => {
  const { nickname, pin } = request.data || {};

  if (!nickname || typeof nickname !== 'string') {
    throw new HttpsError('invalid-argument', 'nickname is required');
  }
  if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    throw new HttpsError('invalid-argument', 'pin must be 4 digits');
  }

  const snap = await db.collection('students')
    .where('nickname', '==', nickname.trim())
    .where('pin', '==', pin.trim())
    .limit(1)
    .get();

  if (snap.empty) {
    throw new HttpsError('not-found', 'ニックネームまたはPINが正しくありません');
  }

  const student = snap.docs[0];
  const studentId = student.id;
  const s = student.data();

  const customToken = await admin.auth().createCustomToken(studentId, {
    studentName: s.name || '',
    studentNickname: s.nickname || '',
    studentCallsign: s.callsign || '',
    grade: s.grade || '',
  });

  return {
    token: customToken,
    studentId,
    studentName: s.callsign || s.nickname || s.name || 'Hero',
    studentNickname: s.nickname || '',
    studentCallsign: s.callsign || '',
  };
});

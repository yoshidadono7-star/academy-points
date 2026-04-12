const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.awardSessionResult = require('./awardSessionResult');
exports.awardStudyReward = require('./awardStudyReward');
exports.createRpgAuthToken = require('./createRpgAuthToken');
exports.rollGacha = require('./rollGacha');

const doc = 'demo'
const admin = require('firebase-admin')
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://probest-763de-default-rtdb.firebaseio.com"
  });
const fbs = admin.database()
const rtb = fbs.ref(doc)
module.exports = rtb
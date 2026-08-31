require('dotenv').config();
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_PRIVATE_KEY)),
  });
}

const db = admin.firestore();
db.collection('conveners').where('email', '==', 'admin@dkju.org').get()
  .then(snap => console.log('Conveners:', snap.size))
  .catch(err => console.error(err));

db.collection('pariksha_board_convener').where('email', '==', 'admin@dkju.org').get()
  .then(snap => console.log('PB Conveners:', snap.size))
  .catch(err => console.error(err));

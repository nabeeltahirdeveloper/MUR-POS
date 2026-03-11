const { db } = require('./src/lib/firebase-admin');

async function check() {
  const doc = await db.collection('settings').doc('main').get();
  console.log('Settings main:', doc.exists ? doc.data() : 'not found');
}

check();

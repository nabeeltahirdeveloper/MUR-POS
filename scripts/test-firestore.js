const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
if (!process.env.FIREBASE_PROJECT_ID) {
    dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
};

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function test() {
    console.log('Testing Firestore connection...');
    try {
        const snapshot = await db.collection('users').limit(1).get();
        console.log('Firestore connection successful!');
        console.log('Users found:', snapshot.size);
    } catch (e) {
        console.error('Firestore connection failed:', e);
    }
}

test();

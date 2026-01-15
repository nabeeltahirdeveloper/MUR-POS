import admin from 'firebase-admin';

// Strict Singleton Pattern
if (!admin.apps.length) {
    const isProd = process.env.NODE_ENV === 'production';

    // Get and clean the private key
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!privateKey) {
        throw new Error('Missing FIREBASE_PRIVATE_KEY');
    }

    // Clean key formatting
    privateKey = privateKey.trim();
    if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
        (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
        privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n').trim();

    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey,
            }),
        });
        if (!isProd) console.log('Firebase Admin initialized successfully');
    } catch (error) {
        console.error('Firebase Admin initialization error:', error);
    }
}

export const adminApp = admin;
export const db = admin.firestore();
export const auth = admin.auth();
export const { Timestamp, FieldValue } = admin.firestore;
export type { firestore } from 'firebase-admin';


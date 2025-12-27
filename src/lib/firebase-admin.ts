import admin from 'firebase-admin';

let app: admin.app.App;
let db: admin.firestore.Firestore;
let auth: admin.auth.Auth;

const isProd = process.env.NODE_ENV === 'production';

if (admin.apps.length === 0) {
    // Get and clean the private key
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    if (!privateKey) {
        throw new Error(
            'Missing FIREBASE_PRIVATE_KEY. Please set it in your environment variables.'
        );
    }
    
    // Trim whitespace first
    privateKey = privateKey.trim();
    
    // Remove surrounding quotes if present (single or double) - be more careful
    // Only remove quotes if they're at the very start and end
    if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
        (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
        privateKey = privateKey.slice(1, -1);
    }
    
    // Replace escaped newlines with actual newlines
    // This handles both \\n (double backslash) and \n (single backslash) cases
    privateKey = privateKey.replace(/\\n/g, '\n');
    
    // Trim again after processing
    privateKey = privateKey.trim();
    
    // Validate that the key has proper PEM format markers
    if (!privateKey.includes('BEGIN') || !privateKey.includes('END')) {
        throw new Error(
            'Invalid FIREBASE_PRIVATE_KEY format. The key must include "-----BEGIN PRIVATE KEY-----" and "-----END PRIVATE KEY-----" markers. ' +
            'Make sure you copied the entire private_key value from your Firebase service account JSON file.'
        );
    }
    
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
        throw new Error(
            'Missing Firebase configuration. Please set FIREBASE_PROJECT_ID and FIREBASE_CLIENT_EMAIL in your environment variables.'
        );
    }

    try {
        app = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey,
            }),
        });

        db = admin.firestore(app);
        auth = admin.auth(app);
        
        if (!isProd) console.log('Firebase Admin initialized successfully');
    } catch (error) {
        console.error('Firebase Admin initialization error:', error);
        throw new Error(
            `Failed to initialize Firebase Admin: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
            'Please check that your FIREBASE_PRIVATE_KEY is correctly formatted with proper BEGIN/END markers and newlines.'
        );
    }
} else {
    app = admin.app();
    db = admin.firestore(app);
    auth = admin.auth(app);
}

const { Timestamp, FieldValue } = admin.firestore;

export { db, auth, app, Timestamp, FieldValue };


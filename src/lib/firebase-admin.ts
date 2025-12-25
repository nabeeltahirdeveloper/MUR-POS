import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

let app: App;
let db: Firestore;
let auth: Auth;

if (getApps().length === 0) {
    // Get and clean the private key
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    if (!privateKey) {
        throw new Error(
            'Missing FIREBASE_PRIVATE_KEY. Please set it in your environment variables.'
        );
    }
    
    // Debug: Log what we're getting (remove after fixing)
    console.log('Raw private key length:', privateKey.length);
    console.log('First 100 chars:', privateKey.substring(0, 100));
    console.log('Last 100 chars:', privateKey.substring(Math.max(0, privateKey.length - 100)));
    
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
    
    // Debug: Log after processing
    console.log('Processed private key length:', privateKey.length);
    console.log('Has BEGIN:', privateKey.includes('BEGIN'));
    console.log('Has END:', privateKey.includes('END'));
    console.log('Starts with BEGIN:', privateKey.startsWith('-----BEGIN'));
    console.log('Ends with END:', privateKey.endsWith('-----'));
    
    // Validate that the key has proper PEM format markers
    if (!privateKey.includes('BEGIN') || !privateKey.includes('END')) {
        console.error('Private key validation failed. Key preview:', privateKey.substring(0, 200));
        throw new Error(
            'Invalid FIREBASE_PRIVATE_KEY format. The key must include "-----BEGIN PRIVATE KEY-----" and "-----END PRIVATE KEY-----" markers. ' +
            'Make sure you copied the entire private_key value from your Firebase service account JSON file. ' +
            `Current key length: ${privateKey.length}, starts with: ${privateKey.substring(0, 50)}`
        );
    }
    
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
        throw new Error(
            'Missing Firebase configuration. Please set FIREBASE_PROJECT_ID and FIREBASE_CLIENT_EMAIL in your environment variables.'
        );
    }

    try {
        app = initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey,
            }),
        });

        db = getFirestore(app);
        auth = getAuth(app);
        
        console.log('Firebase Admin initialized successfully');
    } catch (error) {
        console.error('Firebase Admin initialization error:', error);
        throw new Error(
            `Failed to initialize Firebase Admin: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
            'Please check that your FIREBASE_PRIVATE_KEY is correctly formatted with proper BEGIN/END markers and newlines.'
        );
    }
} else {
    app = getApps()[0];
    db = getFirestore(app);
    auth = getAuth(app);
}

export { db, auth, app };


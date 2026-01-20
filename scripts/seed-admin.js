const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
if (!process.env.FIREBASE_PROJECT_ID) {
    dotenv.config({ path: path.resolve(__dirname, '../.env') });
}

const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
};

if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    console.error('Error: Missing Firebase credentials in environment variables.');
    process.exit(1);
}

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function seedAdmin() {
    const adminUser = {
        email: 'ahmedwaleed9897@gmail.com',
        password: 'Waliahmed123@4',
        displayName: 'Waleed Ahmed',
        role: 'admin'
    };

    console.log(`Seeding user: ${adminUser.email}`);

    try {
        let uid;

        // 1. Create or Get User in Authentication
        try {
            const existingUser = await admin.auth().getUserByEmail(adminUser.email);
            console.log('User exists, deleting to ensure clean state...');
            await admin.auth().deleteUser(existingUser.uid);
            console.log('Successfully deleted existing user');
        } catch (error) {
            if (error.code !== 'auth/user-not-found') {
                throw error;
            }
            // User doesn't exist, proceed to create
        }

        // Create fresh user
        const userRecord = await admin.auth().createUser({
            email: adminUser.email,
            password: adminUser.password,
            displayName: adminUser.displayName,
            emailVerified: true,
        });
        uid = userRecord.uid;
        console.log('Successfully created new user:', uid);


        // 2. Set Custom Claims
        await admin.auth().setCustomUserClaims(uid, { role: adminUser.role });

        // 3. Create/Update User Document in Firestore
        await db.collection('users').doc(uid).set({
            email: adminUser.email,
            name: adminUser.displayName,
            role: adminUser.role,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log('Successfully seeded admin user in Firestore');
        process.exit(0);

    } catch (error) {
        console.error('Error seeding admin user:', error);
        process.exit(1);
    }
}

seedAdmin();

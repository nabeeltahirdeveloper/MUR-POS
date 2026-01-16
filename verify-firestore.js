
const admin = require('firebase-admin');
const dotenv = require('dotenv');

// Load env vars manually to ensure we see what the app sees
dotenv.config({ path: '.env.local' });
if (!process.env.FIREBASE_PROJECT_ID) {
    dotenv.config({ path: '.env' });
}

console.log("Project ID:", process.env.FIREBASE_PROJECT_ID);

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

async function checkFirestore() {
    console.log("Checking Firestore for 'ahmedwaleed9897@gmail.com'...");

    try {
        const snapshot = await db.collection('users').where('email', '==', 'ahmedwaleed9897@gmail.com').get();

        if (snapshot.empty) {
            console.log("❌ User NOT found in Firestore 'users' collection.");
        } else {
            console.log(`✅ User FOUND. Count: ${snapshot.size}`);
            snapshot.forEach(doc => {
                console.log(`- Doc ID: ${doc.id}`);
                console.log(`- Data:`, doc.data());
            });
        }

    } catch (error) {
        console.error("Error querying Firestore:", error);
    }
}

checkFirestore();

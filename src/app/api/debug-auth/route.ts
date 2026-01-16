
import { NextResponse } from 'next/server';
import { adminApp, db } from '@/lib/firebase-admin';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, password } = body;

        console.log("--- DEBUG AUTH START ---");
        console.log("Email:", email);

        // 1. Check API Key
        const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCj77-aRSmM-m34vqwZ1r5rFkEYkmu6Vb4";
        console.log("Using API Key:", apiKey ? apiKey.substring(0, 10) + "..." : "MISSING");

        // 2. Verify Password (REST API)
        const verifyPasswordUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
        console.log("Verifying password via REST API...");

        const verifyResponse = await fetch(verifyPasswordUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true }),
        });

        const verifyData = await verifyResponse.json();

        if (!verifyResponse.ok) {
            console.error("❌ Password verification failed:", verifyData.error);
            return NextResponse.json({
                step: 'password_verification',
                success: false,
                error: verifyData.error
            }, { status: 400 });
        }

        console.log("✅ Password verified. UID:", verifyData.localId);

        // 3. Check Firestore
        console.log("Checking Firestore for user...");
        console.log("Project ID:", process.env.FIREBASE_PROJECT_ID);

        const userSnap = await db
            .collection("users")
            .where("email", "==", email)
            .limit(1)
            .get();

        if (userSnap.empty) {
            console.error("❌ User NOT found in Firestore query (email match).");

            // Try by ID
            const userDoc = await db.collection("users").doc(verifyData.localId).get();
            if (!userDoc.exists) {
                console.error("❌ User NOT found by ID fallback either.");
                return NextResponse.json({
                    step: 'firestore_lookup',
                    success: false,
                    error: "User not found in Firestore",
                    uid: verifyData.localId
                }, { status: 404 });
            }
            console.log("⚠️ Found by ID fallback.");
            return NextResponse.json({
                step: 'firestore_lookup',
                success: true,
                method: 'id_fallback',
                user: userDoc.data()
            });
        }

        const userData = userSnap.docs[0].data();
        console.log("✅ User found in Firestore:", userData.email);

        return NextResponse.json({
            step: 'complete',
            success: true,
            user: userData
        });

    } catch (error: any) {
        console.error("❌ Exception:", error);
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}

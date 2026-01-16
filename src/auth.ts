import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import type { FirestoreUser } from "@/types/firestore"
import { authConfig } from "./auth.config"

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials) => {
                if (!credentials?.email || !credentials?.password) {
                    return null
                }

                const email = credentials.email as string;
                const password = credentials.password as string;

                // 🚨 QUOTA EMERGENCY BYPASS 🚨
                // Allows access when Firestore is dead (Error code 8)
                if (email === "bypass@moontraders.com" && password === "bypass") {
                    console.log("Debug: Using EMERGENCY BYPASS login");
                    return {
                        id: "bypass-admin-id",
                        email: "bypass@moontraders.com",
                        name: "Bypass Admin",
                        role: "admin"
                    };
                }

                try {
                    // Get Firebase API key from environment
                    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCj77-aRSmM-m34vqwZ1r5rFkEYkmu6Vb4";

                    // Verify password using Firebase Auth REST API
                    const verifyPasswordUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

                    const verifyResponse = await fetch(verifyPasswordUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            email,
                            password,
                            returnSecureToken: true,
                        }),
                    });

                    const verifyData = await verifyResponse.json();

                    if (!verifyResponse.ok || verifyData.error) {
                        // Invalid credentials
                        console.error('Password verification failed:', verifyData.error?.message);
                        return null;
                    }

                    // Password is correct, get user info from Firestore
                    const firebaseUserId = verifyData.localId;

                    const { db } = await import('@/lib/firebase-admin');

                    // 🔒 ONLY ONE READ
                    const userSnap = await db
                        .collection("users")
                        .where("email", "==", email)
                        .limit(1)
                        .get();

                    if (userSnap.empty) {
                        console.log("Debug: User not found in Firestore by email:", email);
                        // User exists in Firebase Auth but not in Firestore - this shouldn't happen usually
                        // Fallback: try by ID if email query fails (rare edge case of email change)
                        const userDoc = await db.collection("users").doc(firebaseUserId).get();
                        if (!userDoc.exists) {
                            console.error('User not found in Firestore (by ID either):', firebaseUserId);
                            return null;
                        }
                        console.log("Debug: User found by ID fallback");
                        const userData = userDoc.data();
                        return {
                            id: userDoc.id,
                            email: userData?.email,
                            name: userData?.name,
                            role: userData?.role || 'staff',
                        };
                    }

                    const userDoc = userSnap.docs[0];
                    const userData = userDoc.data();

                    console.log("Debug: Login successful for:", email);

                    return {
                        id: userDoc.id,
                        email: userData.email,
                        name: userData.name,
                        role: userData.role || 'staff',
                    };
                } catch (error) {
                    console.error('Auth error detailed:', error);
                    return null;
                }
            },
        }),
    ],
})

import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { getDocById } from "@/lib/firestore-helpers"
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

                try {
                    // Get Firebase API key from environment
                    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBIWERzFqcXr1UV9n24zRQ5pm0r8h5SCSo";
                    
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
                    
                    // Get user profile from Firestore
                    const user = await getDocById<FirestoreUser>('users', firebaseUserId);
                    
                    if (!user) {
                        // User exists in Firebase Auth but not in Firestore - this shouldn't happen
                        console.error('User not found in Firestore:', firebaseUserId);
                        return null;
                    }
                    
                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        role: user.role || 'staff',
                    };
                } catch (error) {
                    console.error('Auth error:', error);
                    return null;
                }
            },
        }),
    ],
})

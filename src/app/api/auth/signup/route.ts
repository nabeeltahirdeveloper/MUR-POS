import { NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase-admin';
import { createDoc } from '@/lib/firestore-helpers';
import type { FirestoreUser } from '@/types/firestore';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, email, password } = body;

        if (!email || !password || !name) {
            return NextResponse.json(
                { message: 'Missing required fields' },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json(
                { message: 'Password must be at least 8 characters long' },
                { status: 400 }
            );
        }

        // Check if user already exists in Firestore
        const existingUsers = await db.collection('users')
            .where('email', '==', email)
            .limit(1)
            .get();

        if (!existingUsers.empty) {
            return NextResponse.json(
                { message: 'User with this email already exists' },
                { status: 409 }
            );
        }

        // Check if user exists in Firebase Auth
        try {
            await auth.getUserByEmail(email);
            return NextResponse.json(
                { message: 'User with this email already exists' },
                { status: 409 }
            );
        } catch (error: any) {
            // User doesn't exist, continue
            if (error.code !== 'auth/user-not-found') {
                throw error;
            }
        }

        // Create user in Firebase Auth
        const firebaseUser = await auth.createUser({
            email,
            password,
            displayName: name,
        });

        // Create user profile in Firestore
        const userData: Omit<FirestoreUser, 'id'> = {
            name,
            email,
            role: 'staff', // Default role is staff, admin must be manually updated or seeded
            createdAt: new Date(),
        };

        const userId = await createDoc<Omit<FirestoreUser, 'id'>>('users', userData, firebaseUser.uid);

        return NextResponse.json(
            { 
                message: 'User created successfully', 
                user: {
                    id: userId,
                    ...userData,
                }
            },
            { status: 201 }
        );
    } catch (error: any) {
        console.error('Signup error:', error);
        
        // Handle Firebase Auth errors
        if (error.code === 'auth/email-already-exists') {
            return NextResponse.json(
                { message: 'User with this email already exists' },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}

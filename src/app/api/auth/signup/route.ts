import { NextResponse } from 'next/server';
// import { auth, db } from '@/lib/firebase-admin';
// import { createDoc } from '@/lib/firestore-helpers';
// import type { FirestoreUser } from '@/types/firestore';

/**
 * Signup API Route
 * This endpoint is currently DISABLED for the production build.
 */
export async function POST(req: Request) {
    // Signup is disabled for production to prevent unauthorized account creation.
    return NextResponse.json(
        { message: 'Registration is currently disabled. Please contact an administrator.' },
        { status: 403 }
    );
}

/*
// Original Signup Logic (Disabled)
export async function POST_DISABLED(req: Request) {
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

        // Check if user already exists
        // ... (remaining logic)
    } catch (error: any) {
        console.error('Signup error:', error);
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}
*/

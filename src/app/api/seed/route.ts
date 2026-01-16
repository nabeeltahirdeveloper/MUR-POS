
import { NextResponse } from 'next/server';
import { adminApp, db } from '@/lib/firebase-admin';

export async function GET() {
    try {
        // Check if Admin SDK is initialized
        if (adminApp.apps.length === 0) {
            return NextResponse.json(
                { error: 'Firebase Admin SDK not initialized. Check server logs and environment variables.' },
                { status: 500 }
            );
        }

        const adminUser = {
            email: 'ahmedwaleed9897@gmail.com',
            password: 'Waliahmed123@4',
            displayName: 'Waleed Ahmed',
            role: 'admin'
        };

        let uid;

        // 1. Create or Get User in Authentication
        try {
            // Check if user exists first
            try {
                const existingUser = await adminApp.auth().getUserByEmail(adminUser.email);
                console.log('User exists, deleting to ensure clean state...');
                await adminApp.auth().deleteUser(existingUser.uid);
                console.log('Successfully deleted existing user');
            } catch (error: any) {
                if (error.code !== 'auth/user-not-found') {
                    throw error;
                }
                // User doesn't exist, proceed to create
            }

            // Create fresh user
            const userRecord = await adminApp.auth().createUser({
                email: adminUser.email,
                password: adminUser.password,
                displayName: adminUser.displayName,
                emailVerified: true,
            });
            uid = userRecord.uid;
            console.log('Successfully created new user:', uid);

        } catch (error: any) {
            throw error;
        }

        // 2. Set Custom Claims (Optional, but good for security rules)
        await adminApp.auth().setCustomUserClaims(uid, { role: adminUser.role });

        // 3. Create/Update User Document in Firestore
        await db.collection('users').doc(uid).set({
            email: adminUser.email,
            name: adminUser.displayName,
            role: adminUser.role,
            createdAt: adminApp.firestore.FieldValue.serverTimestamp(), // Update timestamp on seed
            updatedAt: adminApp.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log('Successfully seeded admin user in Firestore');

        return NextResponse.json({
            message: 'Admin user seeded successfully',
            uid,
            email: adminUser.email
        });

    } catch (error: any) {
        console.error('Error seeding admin user:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to seed admin user' },
            { status: 500 }
        );
    }
}

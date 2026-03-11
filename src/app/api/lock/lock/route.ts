import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function POST() {
    try {
        await db.collection('settings').doc('lock').set({
            isLocked: true,
            updatedAt: new Date(),
        }, { merge: true });

        return NextResponse.json({ success: true, message: 'System locked' });
    } catch (error) {
        console.error('Lock system error:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to lock system' },
            { status: 500 }
        );
    }
}

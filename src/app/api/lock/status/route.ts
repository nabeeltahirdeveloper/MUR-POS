import { NextResponse } from 'next/server';
import { isSystemLocked } from '@/lib/lock';

export async function GET() {
    try {
        const isLocked = await isSystemLocked();
        return NextResponse.json({ isLocked });
    } catch (error) {
        console.error('Fetch lock status error:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to fetch lock status' },
            { status: 500 }
        );
    }
}

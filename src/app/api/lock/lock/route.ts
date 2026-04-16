import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST() {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        await prisma.systemSetting.upsert({
            where: { key: 'lock' },
            create: {
                key: 'lock',
                value: JSON.stringify({ isLocked: true, updatedAt: new Date().toISOString() }),
            },
            update: {
                value: JSON.stringify({ isLocked: true, updatedAt: new Date().toISOString() }),
            },
        });

        return NextResponse.json({ success: true, message: 'System locked' });
    } catch (error) {
        console.error('Lock system error:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to lock system' },
            { status: 500 }
        );
    }
}

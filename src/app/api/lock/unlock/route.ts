import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const UNLOCK_PASSWORD = process.env.UNLOCK_PASSWORD;

if (!UNLOCK_PASSWORD) {
    console.error('UNLOCK_PASSWORD environment variable is not set');
}

export async function POST(request: NextRequest) {
    try {
        const { password } = await request.json();

        if (!password) {
            return NextResponse.json(
                { success: false, message: 'Password is required' },
                { status: 400 }
            );
        }

        if (!UNLOCK_PASSWORD) {
            return NextResponse.json(
                { success: false, message: 'Unlock password not configured on server' },
                { status: 500 }
            );
        }

        if (password === UNLOCK_PASSWORD) {
            await prisma.systemSetting.upsert({
                where: { key: 'lock' },
                create: {
                    key: 'lock',
                    value: JSON.stringify({ isLocked: false, updatedAt: new Date().toISOString() }),
                },
                update: {
                    value: JSON.stringify({ isLocked: false, updatedAt: new Date().toISOString() }),
                },
            });

            return NextResponse.json(
                { success: true, message: 'Unlocked successfully' },
                { status: 200 }
            );
        }

        return NextResponse.json(
            { success: false, message: 'Incorrect password' },
            { status: 401 }
        );
    } catch (error) {
        console.error('Unlock error:', error);
        return NextResponse.json(
            { success: false, message: 'Server error' },
            { status: 500 }
        );
    }
}

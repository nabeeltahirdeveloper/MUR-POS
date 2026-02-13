import { NextRequest, NextResponse } from 'next/server';

const UNLOCK_PASSWORD = process.env.UNLOCK_PASSWORD || 'jbc@123';

export async function POST(request: NextRequest) {
    try {
        const { password } = await request.json();

        if (!password) {
            return NextResponse.json(
                { success: false, message: 'Password is required' },
                { status: 400 }
            );
        }

        if (password === UNLOCK_PASSWORD) {
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
        return NextResponse.json(
            { success: false, message: 'Server error' },
            { status: 500 }
        );
    }
}

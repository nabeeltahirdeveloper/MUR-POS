import { NextResponse } from 'next/server';

export async function POST(_req: Request) {
    return NextResponse.json(
        { message: 'Registration is currently disabled. Please contact an administrator.' },
        { status: 403 }
    );
}

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDocById, updateDoc } from '@/lib/prisma-helpers';
import type { ApiUser } from '@/types/models';

export async function POST(req: Request) {
    try {
        const session = await auth();

        if (!session?.user?.email || !session?.user?.id) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { name } = body;

        if (!name) {
            return NextResponse.json({ message: 'Name is required' }, { status: 400 });
        }

        // Update user in PostgreSQL
        await updateDoc<Partial<ApiUser>>('users', session.user.id, { name });

        // Get updated user
        const updatedUser = await getDocById<ApiUser>('users', session.user.id);

        if (!updatedUser) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        return NextResponse.json(
            { message: 'Profile updated successfully', user: updatedUser },
            { status: 200 }
        );
    } catch (error) {
        console.error('Profile update error:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}

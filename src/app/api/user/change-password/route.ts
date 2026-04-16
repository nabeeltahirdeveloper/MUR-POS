import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';

export async function POST(req: Request) {
    try {
        const session = await auth();

        if (!session?.user?.email || !session?.user?.id) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ message: 'Missing fields' }, { status: 400 });
        }

        if (newPassword.length < 8) {
            return NextResponse.json(
                { message: 'New password must be at least 8 characters long' },
                { status: 400 }
            );
        }

        // Get user from database
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
        });

        if (!user) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) {
            return NextResponse.json({ message: 'Current password is incorrect' }, { status: 400 });
        }

        // Hash and update new password
        const newHash = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: session.user.id },
            data: { passwordHash: newHash },
        });

        return NextResponse.json(
            { message: 'Password changed successfully' },
            { status: 200 }
        );
    } catch (error: any) {
        console.error('Password change error:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}

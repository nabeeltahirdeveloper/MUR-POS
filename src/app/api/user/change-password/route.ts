import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { hashPassword, comparePassword } from '@/lib/bcrypt';

export async function POST(req: Request) {
    try {
        const session = await auth();

        if (!session?.user?.email) {
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

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user || !user.passwordHash) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        const isPasswordValid = await comparePassword(currentPassword, user.passwordHash);

        if (!isPasswordValid) {
            return NextResponse.json({ message: 'Incorrect current password' }, { status: 400 });
        }

        const hashedPassword = await hashPassword(newPassword);

        await prisma.user.update({
            where: { email: session.user.email },
            data: { passwordHash: hashedPassword },
        });

        return NextResponse.json(
            { message: 'Password changed successfully' },
            { status: 200 }
        );
    } catch (error) {
        console.error('Password change error:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}

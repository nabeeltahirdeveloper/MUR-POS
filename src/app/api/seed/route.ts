import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';

export async function GET() {
    try {
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: "Not available in production" }, { status: 403 });
        }
        const adminUser = {
            email: 'ahmedwaleed9897@gmail.com',
            password: 'Admin@123',
            name: 'Waleed Ahmed',
            role: 'admin'
        };

        const passwordHash = await bcrypt.hash(adminUser.password, 10);

        // Upsert admin user
        const user = await prisma.user.upsert({
            where: { email: adminUser.email },
            create: {
                email: adminUser.email,
                name: adminUser.name,
                passwordHash,
                role: adminUser.role,
            },
            update: {
                name: adminUser.name,
                passwordHash,
                role: adminUser.role,
            },
        });


        return NextResponse.json({
            message: 'Admin user seeded successfully',
            id: user.id,
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

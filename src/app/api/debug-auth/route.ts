import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, password } = body;

        console.log("--- DEBUG AUTH START ---");
        console.log("Email:", email);

        // Find user in PostgreSQL
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            console.error("User NOT found in database.");
            return NextResponse.json({
                step: 'user_lookup',
                success: false,
                error: "User not found in database"
            }, { status: 404 });
        }

        console.log("User found:", user.email, "Role:", user.role);

        // Verify password
        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
            console.error("Password verification failed.");
            return NextResponse.json({
                step: 'password_verification',
                success: false,
                error: "Invalid password"
            }, { status: 400 });
        }

        console.log("Password verified successfully.");

        return NextResponse.json({
            step: 'complete',
            success: true,
            user: { id: user.id, email: user.email, name: user.name, role: user.role }
        });
    } catch (error: any) {
        console.error("Exception:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

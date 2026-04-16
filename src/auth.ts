import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "./auth.config"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcrypt"

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials) => {
                if (!credentials?.email || !credentials?.password) {
                    return null
                }

                const email = credentials.email as string;
                const password = credentials.password as string;

                try {
                    // Find user in PostgreSQL
                    const user = await prisma.user.findUnique({
                        where: { email },
                    });

                    if (!user) {
                        console.error('User not found:', email);
                        return null;
                    }

                    // Verify password with bcrypt
                    const isValid = await bcrypt.compare(password, user.passwordHash);

                    if (!isValid) {
                        console.error('Password verification failed for:', email);
                        return null;
                    }

                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        role: user.role || 'staff',
                    };
                } catch (error) {
                    console.error('Auth error:', error);
                    return null;
                }
            },
        }),
    ],
})

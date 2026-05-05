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
                    console.error('[auth] Missing email or password in credentials');
                    return null
                }

                const email = credentials.email as string;
                const password = credentials.password as string;

                try {
                    const user = await prisma.user.findUnique({
                        where: { email },
                    });

                    if (!user) {
                        console.error(`[auth] User not found for email="${email}". DB host=${process.env.DATABASE_URL?.match(/@([^/?]+)/)?.[1] ?? "unknown"}`);
                        return null;
                    }

                    const isValid = await bcrypt.compare(password, user.passwordHash);

                    if (!isValid) {
                        console.error(`[auth] Password mismatch for email="${email}" id=${user.id}. Hash prefix=${user.passwordHash.slice(0, 7)}`);
                        return null;
                    }

                    console.log(`[auth] Login OK email="${email}" id=${user.id} role=${user.role}`);
                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        role: user.role || 'staff',
                    };
                } catch (error: any) {
                    // Infrastructure failure (DB unreachable, TLS handshake, bcrypt issue,
                    // etc.) must NOT collapse into "invalid password". Log it and re-throw
                    // so NextAuth surfaces it as a Configuration error instead of
                    // CredentialsSignin — that distinction is what makes the live box
                    // debuggable.
                    console.error(`[auth] Authorize threw error: ${error?.message ?? error}`);
                    if (error?.code) console.error(`[auth] Prisma error code: ${error.code}`);
                    throw error;
                }
            },
        }),
    ],
})

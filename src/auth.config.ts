import type { NextAuthConfig } from "next-auth"

export const authConfig = {
    session: {
        strategy: "jwt",
        // maxAge will be set dynamically by signIn() maxAge parameter
        // When maxAge is not provided, NextAuth uses session cookies (expires on browser close)
        // When maxAge is provided in signIn(), it sets persistent cookie expiration
    },
    providers: [],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = user.role;
                token.id = user.id as string;
                token.name = user.name;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.role = token.role as string;
                session.user.id = token.id as string;
                session.user.name = token.name as string;
            }
            return session;
        }
    }
} satisfies NextAuthConfig

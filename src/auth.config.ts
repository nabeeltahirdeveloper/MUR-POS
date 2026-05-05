import type { NextAuthConfig } from "next-auth"

export const authConfig = {
    session: {
        strategy: "jwt",
    },
    // Allow NextAuth to trust the host header from the reverse proxy
    // (nginx/caddy in front of the app). Required when deployed behind
    // any proxy that terminates TLS.
    trustHost: true,
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

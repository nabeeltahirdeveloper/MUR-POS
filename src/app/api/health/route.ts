import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Public diagnostic endpoint. Reports whether the deployed app
 * has the env vars + DB connectivity it needs to function.
 *
 * Returns plain JSON so it can be hit from a browser or curl.
 * Intentionally does NOT expose secret values, only their presence.
 */
export const dynamic = "force-dynamic";

export async function GET() {
    const checks: Record<string, any> = {
        timestamp: new Date().toISOString(),
        nodeEnv: process.env.NODE_ENV ?? "unset",
        env: {
            DATABASE_URL: process.env.DATABASE_URL ? "set" : "MISSING",
            DIRECT_URL: process.env.DIRECT_URL ? "set" : "MISSING",
            NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "set" : "MISSING",
            NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "MISSING",
            UNLOCK_PASSWORD: process.env.UNLOCK_PASSWORD ? "set" : "MISSING",
        },
        database: {
            host: "unknown",
            connected: false,
            userCount: -1,
            testUserExists: false,
            error: null as string | null,
        },
    };

    // Extract DB host from URL for visibility (without exposing password)
    try {
        const url = process.env.DATABASE_URL ?? "";
        const match = url.match(/@([^/?]+)/);
        if (match) checks.database.host = match[1];
    } catch { /* noop */ }

    try {
        const userCount = await prisma.user.count();
        checks.database.connected = true;
        checks.database.userCount = userCount;

        const testUser = await prisma.user.findUnique({
            where: { email: "test@mur.com" },
            select: { id: true, email: true, role: true },
        });
        checks.database.testUserExists = !!testUser;
    } catch (err: any) {
        checks.database.error = err?.message ?? String(err);
    }

    const ok =
        checks.env.DATABASE_URL === "set" &&
        checks.env.NEXTAUTH_SECRET === "set" &&
        checks.database.connected;

    return NextResponse.json(
        { ok, ...checks },
        { status: ok ? 200 : 503 }
    );
}

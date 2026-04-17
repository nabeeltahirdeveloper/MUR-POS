import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

// Routes that should be blocked in production (test/debug endpoints)
const DEV_ONLY_ROUTES = [
    "/api/test",
    "/api/debug-auth",
    "/api/seed",
    "/test",
]

function isDevOnlyRoute(pathname: string): boolean {
    return DEV_ONLY_ROUTES.some(route => pathname.startsWith(route))
}

// API routes that don't require authentication
const PUBLIC_API_ROUTES = [
    "/api/auth",        // NextAuth endpoints
    "/api/lock/status", // Lock status check (read-only, no sensitive data)
    "/api/lock/unlock", // Uses its own password-based auth
]

function isPublicApiRoute(pathname: string): boolean {
    return PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))
}

export default auth((req) => {
    const isLoggedIn = !!req.auth
    const { nextUrl } = req
    const user = req.auth?.user

    // Block test/debug/seed routes in production
    if (process.env.NODE_ENV === "production" && isDevOnlyRoute(nextUrl.pathname)) {
        if (nextUrl.pathname.startsWith("/api")) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }
        return NextResponse.redirect(new URL("/dashboard", nextUrl))
    }

    const isApiRoute = nextUrl.pathname.startsWith("/api")
    const isPublicRoute = ["/login", "/signup", "/"].includes(nextUrl.pathname)
    const isAuthRoute = ["/login", "/signup"].includes(nextUrl.pathname)
    const isAdminRoute = nextUrl.pathname.startsWith("/admin")

    // API routes: return 401 JSON instead of redirecting
    if (isApiRoute) {
        if (isPublicApiRoute(nextUrl.pathname)) {
            return NextResponse.next()
        }
        if (!isLoggedIn) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }
        return NextResponse.next()
    }

    if (isAuthRoute) {
        if (isLoggedIn) {
            if (user?.role === "admin") {
                return NextResponse.redirect(new URL("/admin", nextUrl))
            }
            return NextResponse.redirect(new URL("/dashboard", nextUrl))
        }
        return NextResponse.next()
    }

    if (!isLoggedIn && !isPublicRoute) {
        let callbackUrl = nextUrl.pathname;
        if (nextUrl.search) {
            callbackUrl += nextUrl.search;
        }

        const encodedCallbackUrl = encodeURIComponent(callbackUrl);

        return NextResponse.redirect(new URL(`/login?callbackUrl=${encodedCallbackUrl}`, nextUrl))
    }

    if (isAdminRoute && user?.role !== "admin") {
        return NextResponse.redirect(new URL("/dashboard", nextUrl))
    }

    return NextResponse.next()
})

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.jpg|.*\\.svg|.*\\.png|.*\\.jpeg|.*\\.webp).*)"],
}

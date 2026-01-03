import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
    const isLoggedIn = !!req.auth
    const { nextUrl } = req
    const user = req.auth?.user

    const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth")
    const isPublicRoute = ["/login", "/signup", "/"].includes(nextUrl.pathname)
    const isAuthRoute = ["/login", "/signup"].includes(nextUrl.pathname)
    const isAdminRoute = nextUrl.pathname.startsWith("/admin")
    const isDashboardRoute = nextUrl.pathname.startsWith("/dashboard")

    if (isApiAuthRoute) {
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
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|favicon.jpg|.*\\.svg|.*\\.png|.*\\.jpeg|.*\\.webp).*)"],
}

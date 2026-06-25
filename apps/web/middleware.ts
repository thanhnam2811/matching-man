import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_COOKIE = "dashboard_token";

export function middleware(request: NextRequest) {
    const token = request.cookies.get(TOKEN_COOKIE)?.value;
    const pathname = request.nextUrl.pathname;
    const isAuthPage = pathname === "/login" || pathname === "/register";
    const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

    if (token && isAuthPage) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (!token && isDashboard) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
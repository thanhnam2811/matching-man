import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_COOKIE = "dashboard_token";

export function middleware(request: NextRequest) {
    const token = request.cookies.get(TOKEN_COOKIE)?.value;
    const isLoginRoute = request.nextUrl.pathname.startsWith("/login");

    if (!token && !isLoginRoute) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    if (token && isLoginRoute) {
        return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
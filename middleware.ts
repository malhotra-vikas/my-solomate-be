import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const allowedOrigin = process.env.NEXT_PUBLIC_ADMIN_FRONTEND_ORIGIN || "http://localhost:5173";

export function middleware(req: NextRequest) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
        // Handle preflight requests
        if (req.method === "OPTIONS") {
            return new NextResponse(null, {
                status: 200,
                headers: {
                    "Access-Control-Allow-Origin": allowedOrigin,
                    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type,Authorization",
                },
            });
        }

        // Add headers to all API responses
        const res = NextResponse.next();
        res.headers.set("Access-Control-Allow-Origin", allowedOrigin);
        res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
        res.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
        return res;
    }

    return NextResponse.next();
}

export const config = {
    matcher: "/api/:path*",
};

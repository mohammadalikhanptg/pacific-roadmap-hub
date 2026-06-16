import { NextRequest, NextResponse } from "next/server";
import { verifySession, COOKIE } from "@/lib/auth";

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/auth/")) return NextResponse.next();
  const session = await verifySession(req.cookies.get(COOKIE)?.value);
  if (session) return NextResponse.next();
  return NextResponse.redirect(new URL("/api/auth/signin", req.url));
}

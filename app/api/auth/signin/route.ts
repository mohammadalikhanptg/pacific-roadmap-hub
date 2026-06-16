import { NextRequest, NextResponse } from "next/server";
import { authConfigured, authorizeUrl, STATE_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  if (!authConfigured()) {
    return new NextResponse("Microsoft login is not configured yet.", { status: 503 });
  }
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}

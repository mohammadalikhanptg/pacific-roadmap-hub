import { NextRequest, NextResponse } from "next/server";
import { authConfigured, authorizeUrl, STATE_COOKIE, NONCE_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  if (!authConfigured()) {
    return new NextResponse("Microsoft login is not configured yet.", { status: 503 });
  }
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const res = NextResponse.redirect(authorizeUrl(state, nonce));
  const opts = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 600 };
  res.cookies.set(STATE_COOKIE, state, opts);
  res.cookies.set(NONCE_COOKIE, nonce, opts);
  return res;
}

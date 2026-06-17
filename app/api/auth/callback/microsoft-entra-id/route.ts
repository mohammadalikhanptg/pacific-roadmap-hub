import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCode, decodeJwtClaims, idTokenValid, signSession, identityAllowed,
  COOKIE, STATE_COOKIE, NONCE_COOKIE,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = req.cookies.get(STATE_COOKIE)?.value;
  const nonce = req.cookies.get(NONCE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected) {
    return new NextResponse("Invalid login state. Please try signing in again.", { status: 400 });
  }
  try {
    const tok = await exchangeCode(code);
    const claims = decodeJwtClaims(tok.id_token);
    if (!idTokenValid(claims, nonce)) {
      return new NextResponse("Login token failed validation. Please try again.", { status: 401 });
    }
    const email = claims.preferred_username || claims.email;
    if (!identityAllowed(email, claims.tid)) {
      return new NextResponse("This account is not permitted to view this page.", { status: 403 });
    }
    const session = await signSession({ sub: claims.sub, email, tid: claims.tid, exp: Date.now() + 7 * 24 * 3600 * 1000 });
    const res = NextResponse.redirect(new URL("/", url.origin));
    res.cookies.set(COOKIE, session, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 3600 });
    res.cookies.delete(STATE_COOKIE);
    res.cookies.delete(NONCE_COOKIE);
    return res;
  } catch {
    return new NextResponse("Login failed. Please try again.", { status: 500 });
  }
}

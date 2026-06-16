import { NextRequest, NextResponse } from "next/server";

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

// Interim fail-closed Basic Auth gate. Replaced by Microsoft (Entra) login
// once the Azure app registration / redirect URI is in place.
export function middleware(req: NextRequest) {
  const user = process.env.ROADMAP_USER;
  const pass = process.env.ROADMAP_PASS;
  const auth = req.headers.get("authorization");
  if (user && pass && auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const idx = decoded.indexOf(":");
      if (idx >= 0 && decoded.slice(0, idx) === user && decoded.slice(idx + 1) === pass) {
        return NextResponse.next();
      }
    }
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Pacific Roadmaps", charset="UTF-8"' },
  });
}

import { NextResponse } from "next/server";
import { COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const res = NextResponse.redirect((process.env.APP_BASE_URL || "https://pacific-roadmap-hub.vercel.app") + "/");
  res.cookies.delete(COOKIE);
  return res;
}

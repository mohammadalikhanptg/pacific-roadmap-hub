// Minimal Microsoft Entra (OIDC authorization-code) login for an internal,
// single-tenant page. No third-party auth library: standard Microsoft v2.0
// endpoints + an HMAC-signed session cookie (Web Crypto, edge-compatible).

const TENANT = process.env.ENTRA_TENANT_ID || "";
const CLIENT_ID = process.env.ENTRA_CLIENT_ID || "";
const CLIENT_SECRET = process.env.ENTRA_CLIENT_SECRET || "";
const SECRET = process.env.AUTH_SECRET || "";
const BASE_URL = process.env.APP_BASE_URL || "https://pacific-roadmap-hub.vercel.app";
const ALLOWED = (process.env.ALLOWED_EMAILS || "")
  .toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);

export const COOKIE = "rh_session";
export const STATE_COOKIE = "rh_oauth_state";
export const REDIRECT_URI = BASE_URL + "/api/auth/callback/microsoft-entra-id";

export function authConfigured(): boolean {
  return Boolean(TENANT && CLIENT_ID && CLIENT_SECRET && SECRET);
}

export function authorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    response_mode: "query",
    scope: "openid profile email",
    state,
  });
  return "https://login.microsoftonline.com/" + TENANT + "/oauth2/v2.0/authorize?" + p.toString();
}

export async function exchangeCode(code: string): Promise<{ id_token: string }> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    scope: "openid profile email",
  });
  const r = await fetch("https://login.microsoftonline.com/" + TENANT + "/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!r.ok) throw new Error("token_exchange_failed_" + r.status);
  return r.json();
}

function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeJwtClaims(token: string): Record<string, any> {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(token.split(".")[1])));
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signSession(payload: Record<string, any>): Promise<string> {
  const data = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data) as BufferSource);
  return data + "." + bytesToB64url(new Uint8Array(sig));
}

export async function verifySession(token: string | undefined): Promise<Record<string, any> | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const key = await hmacKey();
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlToBytes(sig) as BufferSource,
      new TextEncoder().encode(data) as BufferSource
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(data)));
    if (typeof payload.exp === "number" && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function identityAllowed(email: string | undefined, tid: string | undefined): boolean {
  if (!tid || tid !== TENANT) return false;
  if (ALLOWED.length === 0) return true;
  return Boolean(email && ALLOWED.includes(email.toLowerCase()));
}

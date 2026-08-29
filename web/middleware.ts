import { NextResponse, type NextRequest } from "next/server";

// One shared team login (locked: single user for everyone). The gate is a
// signed cookie derived from APP_PASSWORD — no identity system needed for one
// identity. Until APP_PASSWORD is set in Vercel, the app stays open and the
// dashboard says so.
async function expectedToken(secret: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("discova-auth-v1"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function middleware(req: NextRequest) {
  const pass = process.env.APP_PASSWORD;
  if (!pass) return NextResponse.next();
  if (req.nextUrl.pathname === "/login") return NextResponse.next();
  const cookie = req.cookies.get("discova_auth")?.value;
  if (cookie && cookie === (await expectedToken(pass))) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

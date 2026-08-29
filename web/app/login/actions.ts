"use server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const token = (pass: string) =>
  createHmac("sha256", pass).update("discova-auth-v1").digest("hex");

export async function signIn(formData: FormData) {
  const pass = process.env.APP_PASSWORD ?? "";
  const given = String(formData.get("password") ?? "");
  const a = Buffer.from(given), b = Buffer.from(pass);
  const ok = pass.length > 0 && a.length === b.length && timingSafeEqual(a, b);
  if (!ok) redirect("/login?err=1");
  (await cookies()).set("discova_auth", token(pass), {
    httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/",
  });
  redirect("/");
}

export async function signOut() {
  (await cookies()).delete("discova_auth");
  redirect("/login");
}

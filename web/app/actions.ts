"use server";
import { redirect } from "next/navigation";

export async function startAudit(formData: FormData) {
  const domain = String(formData.get("domain") ?? "").trim();
  const rawTier = String(formData.get("tier") ?? "audit");
  const tier = ["audit", "investigation", "intelligence"].includes(rawTier) ? rawTier : "audit";
  const competitors = String(formData.get("competitors") ?? "").trim();
  const base = process.env.WORKER_URL;
  if (!base) redirect("/?err=worker");
  let id: string | null = null;
  try {
    const r = await fetch(
      `${base.replace(/\/+$/, "")}/analyze?domain=${encodeURIComponent(domain)}&tier=${tier}` +
        (tier === "intelligence" && competitors ? `&competitors=${encodeURIComponent(competitors)}` : ""),
      {
        method: "POST",
        cache: "no-store",
        headers: process.env.WORKER_SECRET
          ? { "x-worker-secret": process.env.WORKER_SECRET }
          : undefined,
      }
    );
    if (r.ok) ({ id } = await r.json());
  } catch {
    // fall through to error redirect
  }
  redirect(id ? `/run/${id}` : "/?err=start");
}

// Proxies the PDF request to the worker, which holds the browser.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const base = process.env.WORKER_URL;
  if (!base) {
    return new Response(
      "WORKER_URL is not set. Add it in Vercel (the worker's Railway domain, e.g. https://xxxx.up.railway.app) and redeploy.",
      { status: 503 }
    );
  }
  const upstream = await fetch(`${base.replace(/\/+$/, "")}/pdf?runId=${encodeURIComponent(id)}`, {
    headers: process.env.WORKER_SECRET ? { "x-worker-secret": process.env.WORKER_SECRET } : undefined,
    cache: "no-store",
  });
  if (!upstream.ok) {
    return new Response(`Worker error (${upstream.status}): ${await upstream.text()}`, { status: 502 });
  }
  return new Response(upstream.body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": upstream.headers.get("content-disposition") ?? "inline",
      "x-discova-pages": upstream.headers.get("x-discova-pages") ?? "",
    },
  });
}

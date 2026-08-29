import Link from "next/link";
import { db } from "@/lib/db";
import { startAudit } from "@/app/actions";

export const dynamic = "force-dynamic";

const BAND_COLOR: Record<string, string> = {
  Critical: "var(--attn)", Developing: "var(--improve)", Fair: "var(--accent)",
  Good: "var(--good)", Excellent: "var(--good)",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const { err } = await searchParams;
  const client = db();

  if (!client) {
    return (
      <Shell>
        <div className="bg-[var(--paper)] px-8 py-10">
          <h2 className="serif text-xl text-[var(--ink)]">Database not connected</h2>
          <p className="mt-3 text-sm">Add the Supabase values in Vercel → Environment Variables, then redeploy.</p>
        </div>
      </Shell>
    );
  }

  const [{ data: beat }, { data: runs, error }] = await Promise.all([
    client.from("worker_heartbeat").select("last_beat, version").eq("id", 1).maybeSingle(),
    client.from("runs").select("id, domain, tier, status, started_at, scores").order("started_at", { ascending: false }).limit(50),
  ]);

  const beatAge = beat ? (Date.now() - new Date(beat.last_beat).getTime()) / 1000 : null;
  const engineAlive = beatAge !== null && beatAge < 90;

  return (
    <Shell>
      {/* Engine status */}
      <div className="bg-[var(--paper)] px-8 py-5 flex items-baseline justify-between border-b border-[var(--hair)]">
        <span className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)]">Engine</span>
        <span className="text-sm" style={{ color: engineAlive ? "var(--good)" : "var(--attn)" }}>
          {engineAlive
            ? `alive — heartbeat ${Math.round(beatAge!)}s ago (${beat!.version})`
            : beat ? `stale — last heartbeat ${Math.round(beatAge!)}s ago` : "no heartbeat yet"}
        </span>
      </div>

      {/* New analysis */}
      <div className="bg-[var(--paper)] px-8 py-7 border-b border-[var(--hair)]">
        <p className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)]">New analysis</p>
        {err && (
          <p className="mt-3 text-sm text-[var(--attn)]">
            {err === "worker" ? "WORKER_URL is not configured." : "The engine could not start that audit — check the domain and try again."}
          </p>
        )}
        <form action={startAudit} className="mt-4">
          <div className="flex gap-3">
            <input
              name="domain" required placeholder="example.com.my"
              className="flex-1 border border-[var(--rule)] bg-transparent px-4 py-2.5 text-[15px] text-[var(--ink)] placeholder:text-[var(--faint)] focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              className="shrink-0 bg-[var(--accent)] text-white px-6 py-2.5 text-sm hover:opacity-90"
            >
              Run audit
            </button>
          </div>
          <div className="mt-5">
            <label className="flex items-baseline gap-4 py-3 cursor-pointer">
              <input type="radio" name="tier" value="audit" defaultChecked className="translate-y-0.5 accent-[var(--accent)]" />
              <span className="serif text-lg text-[var(--ink)] w-32 shrink-0">Audit</span>
              <span className="text-sm flex-1">The complete lean.X audit. Key pages, full check register, client-ready PDF.</span>
              <span className="text-xs text-[var(--faint)] shrink-0">~2 min</span>
            </label>
            <label className="flex items-baseline gap-4 py-3 border-t border-[var(--hair)] opacity-40">
              <input type="radio" name="tier" value="investigation" disabled className="translate-y-0.5" />
              <span className="serif text-lg text-[var(--ink)] w-32 shrink-0">Investigation</span>
              <span className="text-sm flex-1">The whole site — patterns and template-level causes. Arrives at stage 8.</span>
              <span className="text-xs text-[var(--faint)] shrink-0">~5 min</span>
            </label>
            <label className="flex items-baseline gap-4 py-3 border-t border-[var(--hair)] opacity-40">
              <input type="radio" name="tier" value="intelligence" disabled className="translate-y-0.5" />
              <span className="serif text-lg text-[var(--ink)] w-32 shrink-0">Intelligence</span>
              <span className="text-sm flex-1">External data, competitors, priorities and a 30/60/90 plan. Arrives at stage 9.</span>
              <span className="text-xs text-[var(--faint)] shrink-0">~15 min</span>
            </label>
          </div>
        </form>
      </div>

      {/* Runs */}
      <div className="bg-[var(--paper)] px-8 py-7">
        <p className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)]">Runs</p>
        {error && <p className="mt-4 text-sm text-[var(--attn)]">Query failed: {error.message}</p>}
        {runs && runs.length === 0 && <p className="mt-4 text-sm text-[var(--muted)]">No runs yet.</p>}
        <div className="mt-2">
          {runs?.map((r) => {
            const overall = r.scores?.overall as number | undefined;
            const band = r.scores?.band as string | undefined;
            const running = !["done", "failed"].includes(r.status);
            return (
              <Link key={r.id} href={`/run/${r.id}`}
                className="flex items-baseline gap-4 py-4 border-t border-[var(--hair)] first:border-t-0 hover:bg-[var(--ground)] -mx-3 px-3">
                <span className="serif text-lg text-[var(--ink)] flex-1 truncate">{r.domain}</span>
                <span className="text-xs text-[var(--faint)] w-28 shrink-0 capitalize">{r.tier}</span>
                <span className="text-xs text-[var(--faint)] w-28 shrink-0">
                  {new Date(r.started_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                {overall !== undefined ? (
                  <span className="w-32 shrink-0 text-right">
                    <span className="serif text-xl text-[var(--ink)]">{overall}</span>
                    <span className="text-xs text-[var(--faint)]">/100</span>{" "}
                    <span className="text-xs" style={{ color: BAND_COLOR[band ?? ""] ?? "var(--muted)" }}>{band}</span>
                  </span>
                ) : (
                  <span className="w-32 shrink-0 text-right text-xs"
                    style={{ color: running ? "var(--accent)" : "var(--attn)" }}>
                    {running ? `${r.status}…` : r.status}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-baseline justify-between pb-3">
          <span className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)]">
            <span className="text-[var(--ink)] font-semibold">DISCOVA</span>
            <span className="mx-1.5 text-[var(--rule)]">·</span>powered by lean.X digital
          </span>
          <span className="text-[11px] text-[var(--faint)]">internal</span>
        </header>
        <div className="border-t-2 border-[var(--ink)]">{children}</div>
      </div>
    </main>
  );
}

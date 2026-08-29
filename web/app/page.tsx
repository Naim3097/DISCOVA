import Link from "next/link";
import { db } from "@/lib/db";
import { startAudit, deleteRun } from "@/app/actions";
import { signOut } from "@/app/login/actions";
import { AutoRefresh } from "@/app/refresh";

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

  const anyRunning = (runs ?? []).some((r) => !["done", "failed", "partial"].includes(r.status));

  return (
    <Shell>
      {anyRunning && <AutoRefresh every={5000} />}
      {/* Engine status */}
      <div className="bg-[var(--paper)] px-8 py-5 flex items-baseline justify-between border-b border-[var(--hair)]">
        <span className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)]">Engine</span>
        <span className="text-sm" style={{ color: engineAlive ? "var(--good)" : "var(--attn)" }}>
          {engineAlive
            ? `alive — heartbeat ${Math.round(beatAge!)}s ago (${beat!.version})`
            : beat ? `stale — last heartbeat ${Math.round(beatAge!)}s ago` : "no heartbeat yet"}
        </span>
      </div>
      {!process.env.APP_PASSWORD && (
        <div className="bg-[var(--paper)] px-8 py-3 border-b border-[var(--hair)]">
          <p className="text-[12px] text-[var(--improve)]">
            No team password set — anyone with the link can use this. Add APP_PASSWORD in Vercel to close the gate.
          </p>
        </div>
      )}

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
            <label className="flex items-baseline gap-4 py-3 border-t border-[var(--hair)] cursor-pointer">
              <input type="radio" name="tier" value="investigation" className="translate-y-0.5 accent-[var(--accent)]" />
              <span className="serif text-lg text-[var(--ink)] w-32 shrink-0">Investigation</span>
              <span className="text-sm flex-1">Everything in Audit, plus a site-wide crawl: the patterns and template-level causes behind the findings. Same score.</span>
              <span className="text-xs text-[var(--faint)] shrink-0">~5 min</span>
            </label>
            <label className="flex items-baseline gap-4 py-3 border-t border-[var(--hair)] cursor-pointer">
              <input type="radio" name="tier" value="intelligence" className="translate-y-0.5 accent-[var(--accent)]" />
              <span className="serif text-lg text-[var(--ink)] w-32 shrink-0">Intelligence</span>
              <span className="text-sm flex-1">Everything in Investigation, plus Google&apos;s speed data, competitor comparison, priorities and an internal 30/60/90. Same score.</span>
              <span className="text-xs text-[var(--faint)] shrink-0">~6 min</span>
            </label>
            <div className="pt-2 pb-1 border-t border-[var(--hair)]">
              <input
                name="competitors"
                placeholder="Competitors, up to 3, comma separated — Intelligence only (optional)"
                className="w-full border border-[var(--rule)] bg-transparent px-4 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--faint)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
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
            const running = !["done", "failed", "partial"].includes(r.status);
            return (
              <div key={r.id}
                className="flex items-center gap-3 border-t border-[var(--hair)] first:border-t-0 hover:bg-[var(--ground)] -mx-3 px-3 group">
                <Link href={`/run/${r.id}`} className="flex items-center gap-3 py-2.5 flex-1 min-w-0">
                  <span className="text-[14px] font-medium text-[var(--ink)] flex-1 truncate">{r.domain}</span>
                  <span className="hidden sm:block text-[9px] font-mono uppercase tracking-wider text-[var(--faint)] border border-[var(--rule)] rounded px-1.5 py-0.5 w-28 text-center shrink-0">
                    {r.tier}
                  </span>
                  <span className="text-[11px] font-mono text-[var(--faint)] w-24 text-right shrink-0">
                    {new Date(r.started_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{" · "}
                    {new Date(r.started_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="flex items-baseline justify-end gap-1.5 w-44 shrink-0">
                    <span
                      className={`text-[10px] font-mono text-right w-20 truncate ${running ? "animate-pulse" : ""}`}
                      style={{
                        color:
                          r.status === "failed" ? "var(--attn)"
                          : r.status === "partial" ? "var(--improve)"
                          : running ? "var(--accent)"
                          : BAND_COLOR[band ?? ""] ?? "var(--muted)",
                      }}>
                      {r.status === "failed" ? "failed" : r.status === "partial" ? "partial" : running ? `${r.status}…` : band}
                    </span>
                    <span className="font-semibold text-[15px] text-[var(--ink)] tabular-nums text-right w-8">
                      {overall !== undefined ? overall : "—"}
                    </span>
                    <span className="text-[10px] text-[var(--faint)] w-7">
                      {overall !== undefined ? "/100" : ""}
                    </span>
                  </span>
                </Link>
                <form action={deleteRun} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" title="Delete this run and its findings"
                    className="text-[var(--faint)] hover:text-[var(--attn)] text-sm px-1.5 py-2">
                    ✕
                  </button>
                </form>
              </div>
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
        <header className="flex items-center justify-between pb-4">
          <span className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/discova-logo.png" alt="DISCOVA" className="h-8 w-auto" />
            <span className="text-[10px] tracking-[.14em] uppercase text-[var(--muted)] pt-1.5">
              powered by lean.X digital
            </span>
          </span>
          <span className="text-[11px] text-[var(--faint)] flex items-baseline gap-3">
            internal
            {process.env.APP_PASSWORD && (
              <form action={signOut}>
                <button type="submit" className="hover:text-[var(--ink)] underline underline-offset-2">
                  sign out
                </button>
              </form>
            )}
          </span>
        </header>
        <div className="border-t-2 border-[var(--ink)]">{children}</div>
      </div>
    </main>
  );
}

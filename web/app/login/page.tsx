import { signIn } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const { err } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/discova-logo.png" alt="DISCOVA" className="h-9 w-auto" />
        <p className="mt-3 text-[10px] tracking-[.14em] uppercase text-[var(--muted)] text-center">
          powered by lean.X digital
        </p>
        <div className="mt-5 w-full border-t-2 border-[var(--ink)] bg-[var(--paper)] px-8 py-8">
          <h1 className="serif text-2xl text-[var(--ink)] text-center">Team access</h1>
          <form action={signIn} className="mt-5">
            <input
              type="password" name="password" required autoFocus
              placeholder="Team password"
              className="w-full border border-[var(--rule)] bg-transparent px-4 py-2.5 text-[15px] text-[var(--ink)] placeholder:text-[var(--faint)] focus:outline-none focus:border-[var(--accent)]"
            />
            {err && (
              <p className="mt-2 text-[13px] text-[var(--attn)]">That password is not right.</p>
            )}
            <button
              type="submit"
              className="mt-4 w-full bg-[var(--accent)] text-white px-6 py-2.5 text-sm hover:opacity-90"
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

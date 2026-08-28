export default function Home() {
  return (
    <main className="min-h-screen bg-[#F2F4F5] text-[#33454F] flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white px-10 py-12" style={{ boxShadow: "0 1px 2px rgba(13,32,48,.05)" }}>
        <p className="text-[11px] tracking-[.14em] uppercase text-[#6B7C86]">
          DISCOVA <span className="mx-1 text-[#C9D3D8]">·</span> powered by lean.X digital
        </p>
        <h1 className="mt-4 text-3xl text-[#14252F]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
          Website Visibility Intelligence
        </h1>
        <div className="mt-8 border-t border-[#E1E7EA] pt-5 text-sm space-y-2">
          <p className="flex justify-between"><span>Interface</span><span className="text-[#2C6549]">deployed</span></p>
          <p className="flex justify-between"><span>Engine</span><span className="text-[#6B7C86]">stage 0 — not yet connected</span></p>
        </div>
      </div>
    </main>
  );
}

// DISCOVA analyzer pipeline — Audit tier.
// crawl (raw + rendered) → checks → verify → score → write.
import { chromium } from "playwright";
import { CHECKS, collectStrengths } from "./checks.js";
import { designReview } from "./design.js";
import { writeNarrative, gapCandidates } from "./writer.js";
import { CATS, scoreRun, rollUp, deductionFor } from "./scoring.js";

const UA = "DiscovaBot/1.0 (+https://discova-production.up.railway.app/bot)";
const T = (ms) => AbortSignal.timeout(ms);

async function httpGet(url, { maxHops = 5, method = "GET", timeout = 15000 } = {}) {
  let hops = 0, current = url;
  const t0 = Date.now();
  let ttfb = null;
  while (hops <= maxHops) {
    const res = await fetch(current, {
      method, redirect: "manual", signal: T(timeout),
      headers: { "user-agent": UA, "accept-encoding": "gzip, br" },
    });
    if (ttfb === null) ttfb = Date.now() - t0;
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      if (!loc) return { code: res.status, hops, finalUrl: current, headers: hdrs(res) };
      current = new URL(loc, current).href;
      hops++;
      continue;
    }
    const body = method === "GET" ? await res.text().catch(() => "") : "";
    return { code: res.status, hops, finalUrl: current, headers: hdrs(res), body, ttfb };
  }
  return { code: 0, hops, finalUrl: current, headers: {}, body: "", ttfb };
}
const hdrs = (res) => Object.fromEntries([...res.headers.entries()]);

async function probe(domain, log) {
  const p = {};
  const apex = domain.replace(/^www\./, "");
  const www = `www.${apex}`;

  log("probing redirects and files");
  p.httpRedirect = await httpGet(`http://${domain}/`).then((r) => ({
    ...r, finalHttps: r.finalUrl.startsWith("https://"),
  })).catch((e) => ({ error: e.message }));

  p.hostA = await httpGet(`https://${apex}/`, { method: "HEAD" }).then((r) => ({ ...r, url: `https://${apex}/` })).catch((e) => ({ error: e.message }));
  p.hostB = await httpGet(`https://${www}/`, { method: "HEAD" }).then((r) => ({ ...r, url: `https://${www}/` })).catch((e) => ({ error: e.message }));

  const base = p.httpRedirect?.finalUrl?.startsWith("https") ? new URL(p.httpRedirect.finalUrl).origin : `https://${domain}`;
  p.base = base;

  p.robots = await httpGet(`${base}/robots.txt`).catch((e) => ({ error: e.message }));

  const tried = [];
  p.sitemap = { ok: false, count: 0, urls: [], tried };
  const robotsMap = (p.robots?.body ?? "").match(/sitemap:\s*(\S+)/i)?.[1];
  const candidates = [robotsMap, `${base}/sitemap.xml`, `${base}/wp-sitemap.xml`, `${base}/sitemap_index.xml`, `${base}/sitemap-index.xml`].filter(Boolean);
  for (const sm of candidates) {
    tried.push(new URL(sm, base).pathname);
    const r = await httpGet(new URL(sm, base).href).catch(() => null);
    if (r?.code === 200 && /<(urlset|sitemapindex)/i.test(r.body)) {
      let urls = [...r.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
      if (/<sitemapindex/i.test(r.body)) {
        const children = urls.slice(0, 4);
        urls = [];
        for (const child of children) {
          const cr = await httpGet(child).catch(() => null);
          if (cr?.code === 200) urls.push(...[...cr.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]));
        }
      }
      p.sitemap = { ok: true, count: urls.length, urls: urls.slice(0, 200), tried };
      break;
    }
  }

  const nfPath = `discova-check-${Date.now().toString(36)}`;
  p.notFound = await httpGet(`${base}/${nfPath}`).then((r) => ({ code: r.code, path: nfPath })).catch((e) => ({ error: e.message }));

  log("timing the server");
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const r = await httpGet(`${base}/`).catch(() => null);
    if (r?.ttfb) samples.push(r.ttfb);
    if (i === 0 && r) {
      p.home = {
        code: r.code, headers: r.headers, body: r.body,
        sizeRaw: Buffer.byteLength(r.body ?? ""), encoding: r.headers["content-encoding"] ?? null,
      };
    }
  }
  samples.sort((a, b) => a - b);
  p.home = { ...(p.home ?? {}), ttfbSamples: samples, ttfbMedian: samples[Math.floor(samples.length / 2)] ?? null };

  log("reading key pages");
  const sameHost = (u) => { try { return new URL(u).host.replace(/^www\./, "") === apex; } catch { return false; } };
  const pageUrls = (p.sitemap.urls ?? []).filter(sameHost).filter((u) => new URL(u).pathname !== "/").slice(0, 6);
  p.keyPages = [];
  for (const u of pageUrls) {
    const r = await httpGet(u, { timeout: 10000 }).catch(() => null);
    if (!r) continue;
    p.keyPages.push({
      path: new URL(u).pathname, code: r.code,
      title: r.body?.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null,
      hasDesc: /<meta[^>]+name=["']description["']/i.test(r.body ?? ""),
      h1Count: (r.body?.match(/<h1[\s>]/gi) ?? []).length,
    });
  }
  return p;
}

async function render(base, log, rawBody) {
  log("rendering in Chrome");
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const dom = {};
  try {
    const page = await browser.newPage({ userAgent: UA, viewport: { width: 1280, height: 900 } });
    let consoleErrors = 0;
    page.on("console", (m) => { if (m.type() === "error") consoleErrors++; });
    await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
    await page.evaluate(async () => {
      document.querySelectorAll("img").forEach((i) => { i.loading = "eager"; if (i.dataset?.src) i.src = i.dataset.src; });
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise((r) => setTimeout(r, 1800));
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 600));
    }).catch(() => {});

    const raw = rawBody ?? "";
    Object.assign(dom, await page.evaluate(() => {
      const cs = getComputedStyle;
      const all = [...document.querySelectorAll("*")];
      const fonts = {};
      all.forEach((e) => {
        const f = cs(e).fontFamily.split(",")[0].replace(/["']/g, "").trim();
        if (f && e.textContent.trim()) fonts[f] = (fonts[f] || 0) + 1;
      });
      const pal = {};
      all.forEach((e) => {
        const st = cs(e);
        [st.color, st.backgroundColor].forEach((v) => {
          if (v && v !== 'rgba(0, 0, 0, 0)') pal[v] = (pal[v] || 0) + 1;
        });
      });
      const dead = [...document.querySelectorAll('a[href="#"],a[href=""]')];
      const deadReal = dead.filter((a) => {
        const dt = a.getAttribute("data-toggle") || a.getAttribute("data-bs-toggle") || "";
        const cl = a.className?.toString() ?? "";
        return !a.onclick && !dt && !/menu|nav|toggle|lang|collapse|tab|dropdown|accordion/i.test(cl) && !a.closest("nav");
      });
      const sliderRoots = [...document.querySelectorAll(".carousel,.swiper,.swiper-container,.owl-carousel,.slick-slider")]
        .filter((e) => !e.parentElement?.closest(".carousel,.swiper,.swiper-container,.owl-carousel,.slick-slider"));
      const text = document.body.innerText;
      const count = (re) => (text.match(re) || []).length;
      const wa = [...document.querySelectorAll('a[href*="wa.me"],a[href*="api.whatsapp.com"]')].map((a) => a.getAttribute("href"));
      const res = performance.getEntriesByType("resource");
      const sum = (arr) => Math.round(arr.reduce((s, x) => s + (x.transferSize || 0), 0) / 1024);
      return {
        title: document.title,
        metaDesc: document.querySelector('meta[name="description"]')?.content || null,
        canonical: document.querySelector('link[rel="canonical"]')?.href || null,
        lang: document.documentElement.lang || null,
        og: document.querySelectorAll('meta[property^="og:"]').length,
        ldTypes: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => {
          try { const j = JSON.parse(s.textContent); return j["@type"] || (Array.isArray(j) ? j[0]?.["@type"] : null) || "?"; }
          catch { return "invalid"; }
        }).filter(Boolean),
        h1s: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim().slice(0, 60)),
        h1Count: document.querySelectorAll("h1").length,
        words: text.trim().split(/\s+/).length,
        internalPaths: [...new Set([...document.querySelectorAll("a[href]")]
          .filter((a) => a.hostname === location.hostname && a.pathname !== "/" && !a.href.includes("#"))
          .map((a) => a.pathname))],
        deadLinksTotal: dead.length,
        deadLinksReal: deadReal.length,
        sliders: sliderRoots.length,
        emoji: count(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu),
        caps: all.filter((e) => cs(e).textTransform === "uppercase").length,
        fonts: Object.entries(fonts).sort((a, b) => b[1] - a[1]).slice(0, 6),
        palette: Object.entries(pal).sort((a, b) => b[1] - a[1]).slice(0, 12),
        waLinks: wa,
        waPrefilledCount: wa.filter((h) => /[?&]text=/.test(h ?? "")).length,
        tel: document.querySelectorAll('a[href^="tel:"]').length,
        mailto: document.querySelectorAll('a[href^="mailto:"]').length,
        imgs: [...document.images].slice(0, 60).map((i) => ({
          src: (i.currentSrc || i.src || "").slice(0, 160),
          alt: i.alt ?? "",
          natural: [i.naturalWidth, i.naturalHeight],
          displayed: [Math.round(i.getBoundingClientRect().width), Math.round(i.getBoundingClientRect().height)],
          complete: i.complete,
        })),
        resources: {
          count: res.length,
          transferKB: sum(res),
          thirdKB: sum(res.filter((x) => { try { return new URL(x.name).host !== location.host; } catch { return false; } })),
        },
        addressLike: /\b\d{5}\b|jalan|lorong|taman|lot\s?\d|persiaran/i.test(text),
        phoneLike: /(\+?6?0?1\d[\s-]?\d{3,4}[\s-]?\d{4})|(\b0[2-9]\d?[\s-]?\d{6,8}\b)/.test(text),
        emailLike: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text),
        bodySample: text.slice(0, 4000),
        capsButtons: [...document.querySelectorAll('button, a')].filter((b) => {
          const t = b.textContent.trim();
          return t.length > 3 && t === t.toUpperCase() && /[A-Z]{3}/.test(t) && b.getBoundingClientRect().width > 40;
        }).length,
        btnClassVariants: [...new Set([...document.querySelectorAll('button,[class*=btn],[class*=button]')].map((b) => (b.className||'').toString().trim()).filter(Boolean))].length,
        cardClassVariants: [...new Set([...document.querySelectorAll('[class*=card]')].map((c) => (c.className||'').toString().split(' ')[0]))].length,
        heroCtaCount: [...document.querySelectorAll('a,button')].filter((b) => {
          const r = b.getBoundingClientRect();
          const cl = (b.className||'').toString();
          return r.top >= 0 && r.top < 850 && r.width > 60 && (/btn|button|cta/i.test(cl) || b.tagName === 'BUTTON');
        }).length,
        rawUrlTextCount: (text.match(/(https?:\/\/|wa\.me\/)[^\s]{4,}/g) || []).length,
        stuckCounters: [...document.querySelectorAll('[class*=count], [data-target], [data-to]')].filter((e) => e.textContent.trim() === '0').length,
        strokes: all.filter((e) => { const v = cs(e).webkitTextStrokeWidth; return v && v !== '0px'; }).length,
        langMix: {
          malay: count(/\b(dan|untuk|anda|kami|yang|dengan|adalah|atau)\b/gi),
          english: count(/\b(the|and|for|with|your|our|are|from)\b/gi),
        },
      };
    }));

    dom.consoleErrors = consoleErrors;
    dom.rawTitle = raw.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null;
    dom.htmlTagCount = (raw.match(/<html[\s>]/gi) ?? []).length || 1;
    dom.titleTagCount = (raw.match(/<title[\s>]/gi) ?? []).length;

    const stats = { total: dom.imgs?.length ?? 0, noAlt: 0, broken: 0, waNamed: 0, genericNamed: 0 };
    for (const i of dom.imgs ?? []) {
      if (!i.alt.trim()) stats.noAlt++;
      if (i.complete && i.natural[0] === 0 && i.displayed[0] > 10) stats.broken++;
      if (/IMG-\d{8}-WA\d+|WhatsApp[-_ ]?Image/i.test(i.src)) stats.waNamed++;
      if (/images?-?\d+\.(jpe?g|png)|Screenshot[\s_-]|download\.(png|jpe?g)/i.test(i.src)) stats.genericNamed++;
    }
    dom.imgStats = stats;

    try {
      await page.setViewportSize({ width: 1280, height: 2400 });
      await page.evaluate(() => window.scrollTo(0, 0));
      dom.screenshotB64 = (await page.screenshot({ type: 'jpeg', quality: 55 })).toString('base64');
    } catch (e) { log('screenshot failed: ' + e.message); }

    dom.keyImages = [];
    const picks = (dom.imgs ?? [])
      .filter((i) => i.natural[0] >= 200 && i.displayed[0] >= 120 && /^https?:/.test(i.src))
      .sort((x, y) => y.displayed[0] * y.displayed[1] - x.displayed[0] * x.displayed[1])
      .slice(0, 3);
    for (const pick of picks) {
      try {
        const r = await fetch(pick.src, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) });
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length > 20_000_000) continue;
        const ct = r.headers.get('content-type') ?? '';
        const media = /png/.test(ct) ? 'image/png' : /webp/.test(ct) ? 'image/webp' : /gif/.test(ct) ? 'image/gif' : 'image/jpeg';
        dom.keyImages.push({ src: pick.src.slice(0, 120), alt: pick.alt, media, b64: buf.toString('base64') });
      } catch { /* skip unfetchable image */ }
    }

    const mob = await browser.newPage({ userAgent: UA, viewport: { width: 375, height: 812 } });
    await mob.goto(`${base}/`, { waitUntil: "load", timeout: 30000 }).catch(() => {});
    dom.overflow375 = await mob.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2).catch(() => false);
  } finally {
    await browser.close();
  }
  return dom;
}

export async function runAudit(domain, { onStatus = () => {}, log = console.log } = {}) {
  const ctx = { domain, probes: {}, dom: {} };

  await onStatus("crawling");
  ctx.probes = await probe(domain, log);
  ctx.dom = await render(ctx.probes.base ?? `https://${domain}`, log, ctx.probes.home?.body);

  await onStatus("checking");
  const findings = [];
  for (const check of CHECKS) {
    try {
      const f = check.run(ctx);
      if (f) {
        findings.push({
          check_id: check.id,
          ...f,
          score_impact: f.score_zero || f.evidence_label !== "verified" && f.evidence_label !== "likely"
            ? 0
            : f.category === CATS.D ? 0 : deductionFor(f.severity),
        });
      }
    } catch (e) {
      log(`check ${check.id} crashed: ${e.message}`);
    }
  }

  await onStatus("verifying");
  const design = await designReview(
    ctx.dom,
    `${ctx.dom.title ?? domain} — ${ctx.dom.metaDesc ?? ""}`.slice(0, 220)
  ).catch((e) => { log("design review unavailable: " + e.message); return null; });
  if (design) log(`design review: ${design.points}/24`);
  else log("design review pending (no vision available)");

  await onStatus("scoring");
  const pendingCats = design ? [CATS.A] : [CATS.D, CATS.A];
  const injected = design ? { [CATS.D]: design.score } : {};
  const { catScores, overall, band } = scoreRun(findings, { pendingCats, injected });
  const areas = rollUp(catScores, findings, { pendingCats });
  const strengths = collectStrengths(ctx);

  const scores = {
    overall, band, areas, strengths,
    ...(design ? { design_subscores: design.subscores, design_total: { points: design.points, max: design.max } } : {}),
    cat_scores: catScores,
    design_pending: !design,
    checks_run: CHECKS.length,
    coverage_note: `engine v1 runs ${CHECKS.length} of the 160-check register; scores reflect assessed checks only`,
    engine: "audit-v1",
  };
  await onStatus("writing");
  const narrative = await writeNarrative({
    domain,
    overall, band, areas, strengths,
    findings: findings.map((f) => ({
      severity: f.severity, category: f.category, title: f.title, client_summary: f.client_summary,
    })),
    design,
    gapCandidates: gapCandidates(ctx),
  }).catch((e) => { log("writer unavailable: " + e.message); return null; });

  if (narrative?.__error) {
    scores.narrative_error = narrative.__error;
    log("writer failed: " + narrative.__error);
  }
  if (narrative && !narrative.__error) {
    log("narrative written");
    scores.narrative = {
      lead: narrative.lead, sub: narrative.sub,
      closing_strong: narrative.closing_strong, closing_rest: narrative.closing_rest,
      next_step: narrative.next_step,
    };
    for (const area of scores.areas) {
      const n = narrative.area_notes?.[area.key];
      if (n && n.length > 12) area.note = n;
    }
    const cands = gapCandidates(ctx);
    if (narrative.gap_index != null && cands[narrative.gap_index]) {
      scores.clearest_gap = { ...cands[narrative.gap_index], note: narrative.gap_note ?? "" };
    }
  }

  return { scores, findings, ctx };
}

// DISCOVA check register — Audit tier, deterministic checks.
// Every check returns null (pass / not applicable) or a finding.
// Verification rules are built in: dead links are runtime-verified,
// images are measured after forced load, titles are raw-vs-rendered diffed.
import { CATS } from "./scoring.js";

const F = (o) => ({
  evidence_label: "verified",
  verification: "raw_html",
  confidence: 1.0,
  reach: "medium",
  effort: "low",
  ...o,
});

export const CHECKS = [
  // ---------- Technical: protocol & hosts ----------
  {
    id: "tech-https-redirect",
    run: (c) =>
      c.probes.httpRedirect?.finalHttps === false
        ? F({
            category: CATS.T, severity: "high",
            title: "The site does not settle on a secure address",
            evidence: `http://${c.domain}/ resolved to ${c.probes.httpRedirect.finalUrl} (${c.probes.httpRedirect.hops} hops)`,
            internal_detail: "Force a single 301 from http:// to https:// at the edge.",
            client_summary: "Visitors arriving on the insecure address are not moved to the secure one, which both browsers and Google penalise.",
            reach: "high", effort: "quick_win",
          })
        : null,
  },
  {
    id: "tech-dual-host",
    run: (c) => {
      const a = c.probes.hostA, b = c.probes.hostB;
      if (a?.code === 200 && b?.code === 200 && a.hops === 0 && b.hops === 0)
        return F({
          category: CATS.T, severity: "medium",
          title: "Site answers at two addresses with no redirect",
          evidence: `${a.url} → 200 (0 redirects) and ${b.url} → 200 (0 redirects)`,
          internal_detail: "Pick one canonical host and 301 the other to it at the host/edge level; align the canonical tag.",
          client_summary: "Your site exists at two addresses at once, so Google has to guess which is real - and the value splits between them.",
          reach: "high", effort: "quick_win",
        });
      return null;
    },
  },
  {
    id: "tech-robots",
    // A network failure (code 0/5xx) is "could not verify", never "missing".
    run: (c) =>
      [404, 410, 403].includes(c.probes.robots?.code)
        ? F({
            category: CATS.T, severity: "high",
            title: "No robots.txt file",
            evidence: `GET /robots.txt → ${c.probes.robots?.code ?? "no response"}`,
            internal_detail: "Publish robots.txt allowing normal crawling and referencing the sitemap URL.",
            client_summary: "The file that guides search engines around the site is missing, so crawling is less efficient than it should be.",
            reach: "high", effort: "quick_win",
          })
        : null,
  },
  {
    id: "tech-robots-sitemap-ref",
    run: (c) =>
      c.probes.robots?.code === 200 && !/sitemap:/i.test(c.probes.robots.body ?? "")
        ? F({
            category: CATS.T, severity: "low",
            title: "robots.txt does not point to the sitemap",
            evidence: "robots.txt present but contains no Sitemap: line",
            internal_detail: "Add `Sitemap: <absolute sitemap URL>` to robots.txt.",
            client_summary: "Search engines are not told where the site's page list lives.",
            effort: "quick_win",
          })
        : null,
  },
  {
    id: "tech-sitemap",
    run: (c) =>
      !c.probes.sitemap?.ok
        ? F({
            category: CATS.T, severity: "critical",
            title: "No XML sitemap at any standard location",
            evidence: `Probed: ${(c.probes.sitemap?.tried ?? []).join(", ")} — none returned valid XML`,
            internal_detail: "Generate and publish an XML sitemap (CMS plugin or build step) and submit it in Search Console.",
            client_summary: "Google is given no list of the site's pages, so discovery depends entirely on following links.",
            reach: "high", effort: "quick_win",
          })
        : null,
  },
  {
    id: "tech-404",
    run: (c) =>
      c.probes.notFound?.code === 200
        ? F({
            category: CATS.T, severity: "high",
            title: "Missing pages return a working page instead of an error",
            evidence: `GET /${c.probes.notFound.path} → 200`,
            internal_detail: "Return HTTP 404 with a branded error page for unknown routes; soft-404s allow infinite duplicate URLs into the index.",
            client_summary: "Any mistyped address quietly returns a working page, which lets unlimited duplicate copies of the site be recorded.",
            reach: "high",
          })
        : null,
  },
  {
    id: "tech-nested-html",
    run: (c) =>
      c.dom.htmlTagCount > 1
        ? F({
            category: CATS.T, severity: "critical",
            title: "The page contains more than one HTML document",
            evidence: `${c.dom.htmlTagCount} <html> openings found in the served source`,
            verification: "raw_html",
            internal_detail: "A full document has been pasted inside another (typically into a CMS body). Rebuild as a proper template so one valid document is served.",
            client_summary: "The page is two web pages stuck together, and search engines ignore the half that carries the intended titles and settings.",
            reach: "high", effort: "medium",
          })
        : null,
  },
  {
    id: "tech-dup-title-tags",
    run: (c) =>
      (c.dom.titleTagCount ?? 0) > 1 && c.dom.htmlTagCount === 1
        ? F({
            category: CATS.O, severity: "high",
            title: "The page carries two competing title tags",
            evidence: `${c.dom.titleTagCount} <title> elements in one served document`,
            internal_detail: "A second head fragment is embedded in the body (leftover of a pasted template). Remove the duplicate so one title is authoritative.",
            client_summary: "The page gives Google two different names for itself, and Google chooses which to believe.",
            reach: "high", effort: "quick_win",
          })
        : null,
  },
  {
    id: "tech-canonical",
    run: (c) =>
      !c.dom.canonical
        ? F({
            category: CATS.T, severity: "medium",
            title: "No canonical address declared",
            evidence: "No <link rel=\"canonical\"> in the rendered document",
            verification: "rendered_dom",
            internal_detail: "Add a self-referencing canonical to every indexable page.",
            client_summary: "Pages do not declare their official address, which invites duplicate versions into Google's index.",
            effort: "quick_win",
          })
        : null,
  },
  {
    id: "tech-compression",
    run: (c) =>
      c.probes.home?.encoding == null && (c.probes.home?.sizeRaw ?? 0) > 40_000
        ? F({
            category: CATS.T, severity: "medium",
            title: "Responses are served uncompressed",
            evidence: `Homepage ${Math.round(c.probes.home.sizeRaw / 1024)}KB with no content-encoding`,
            internal_detail: "Enable gzip/brotli at the server or CDN.",
            client_summary: "Pages are sent at full size instead of compressed, so every visit is slower than it needs to be.",
          })
        : null,
  },
  {
    id: "tech-caching",
    run: (c) => {
      const cc = c.probes.home?.headers?.["cache-control"] ?? "";
      return /max-age=0|no-store|no-cache/.test(cc) || cc === ""
        ? F({
            category: CATS.T, severity: "medium",
            title: "Caching disabled for repeat visitors",
            evidence: `Cache-Control: ${cc || "(absent)"}`,
            internal_detail: "Serve hashed static assets with long-lived immutable caching; add page/CDN caching where the stack allows.",
            client_summary: "Nothing is stored for returning visitors, so every visit re-downloads everything.",
          })
        : null;
    },
  },
  {
    id: "tech-ttfb",
    run: (c) =>
      (c.probes.home?.ttfbMedian ?? 0) > 600
        ? F({
            category: CATS.T, severity: "medium",
            title: "Slow first response from the server",
            evidence: `TTFB median ${c.probes.home.ttfbMedian}ms across ${c.probes.home.ttfbSamples.length} samples`,
            internal_detail: "Investigate server/app latency; target under 300ms (caching layer, hosting tier, or origin optimisation).",
            client_summary: "Pages take noticeably longer to start loading than they should.",
            reach: "high",
          })
        : null,
  },
  {
    id: "tech-weight",
    run: (c) =>
      (c.dom.resources?.transferKB ?? 0) > 2500
        ? F({
            category: CATS.T, severity: "medium",
            title: "The page is heavy to load",
            evidence: `${c.dom.resources.transferKB}KB transferred across ${c.dom.resources.count} requests (third-party ${c.dom.resources.thirdKB}KB)`,
            verification: "rendered_dom",
            internal_detail: "Compress the largest images, remove unused libraries, and defer third-party scripts.",
            client_summary: "The page downloads far more than it needs to, which is costly on mobile connections.",
            reach: "high", effort: "medium",
          })
        : null,
  },
  {
    id: "tech-console-errors",
    run: (c) =>
      (c.dom.consoleErrors ?? 0) > 0
        ? F({
            category: CATS.T, severity: "low",
            title: "Errors in the browser console",
            evidence: `${c.dom.consoleErrors} console error(s) during page load`,
            verification: "rendered_dom",
            internal_detail: "Open devtools on the homepage and resolve the logged errors.",
            client_summary: "The page reports errors while loading - usually harmless to visitors, but a sign of unfinished plumbing.",
          })
        : null,
  },
  {
    id: "tech-overflow-mobile",
    run: (c) =>
      c.dom.overflow375
        ? F({
            category: CATS.T, severity: "medium",
            title: "The page overflows sideways on phones",
            evidence: "Horizontal scroll present at 375px viewport",
            verification: "rendered_dom",
            internal_detail: "Find the element wider than the viewport at 375px and constrain it (max-width:100%, overflow-x on tables).",
            client_summary: "On a phone the page scrolls sideways, which reads as broken to visitors and to Google's mobile checks.",
            reach: "high",
          })
        : null,
  },
  {
    id: "tech-lang-mismatch",
    run: (c) => {
      const { malay = 0, english = 0 } = c.dom.langMix ?? {};
      return c.dom.lang?.toLowerCase().startsWith("en") && malay >= 8 && malay > english * 1.5
        ? F({
            category: CATS.T, severity: "medium",
            title: "Page language is declared as English but reads as Malay",
            evidence: `lang="${c.dom.lang}", stopword counts: malay=${malay}, english=${english}`,
            evidence_label: "likely", confidence: 0.7, verification: "rendered_dom",
            internal_detail: "Set the html lang attribute to ms-MY (and add hreflang if an English version exists).",
            client_summary: "The page tells Google it is in English while the content is in Malay, which affects who it is shown to.",
            effort: "quick_win",
          })
        : null;
    },
  },

  // ---------- On-page ----------
  {
    id: "onpage-title-missing",
    run: (c) =>
      !c.dom.title
        ? F({
            category: CATS.O, severity: "critical",
            title: "The page has no title",
            evidence: "Rendered document.title is empty",
            verification: "rendered_dom",
            internal_detail: "Set a descriptive, keyword-bearing <title> on every page.",
            client_summary: "The single most important line Google reads is missing.",
            reach: "high", effort: "quick_win",
          })
        : null,
  },
  {
    id: "onpage-title-diff",
    run: (c) => {
      const raw = (c.dom.rawTitle ?? "").trim(), ren = (c.dom.title ?? "").trim();
      return raw && ren && raw !== ren
        ? F({
            category: CATS.O, severity: "medium",
            title: "The title changes after the page loads",
            evidence: `Served title: "${raw}" → after scripts run: "${ren}"`,
            verification: "rendered_dom",
            internal_detail: "Emit the final title server-side; JS-swapped titles mean crawlers may index either version.",
            client_summary: "The page's name changes as it loads, so Google may show a different title than intended.",
          })
        : null;
    },
  },
  {
    id: "onpage-meta-desc",
    run: (c) =>
      !c.dom.metaDesc
        ? F({
            category: CATS.O, severity: "high",
            title: "No meta description",
            evidence: "No <meta name=\"description\"> on the homepage",
            verification: "rendered_dom",
            internal_detail: "Write a 150-160 character description leading with the primary service and location.",
            client_summary: "Google writes its own snippet for the site instead of showing a chosen message.",
            reach: "high", effort: "quick_win",
          })
        : null,
  },
  {
    id: "onpage-h1",
    run: (c) => {
      const n = c.dom.h1Count ?? 0;
      if (n === 1) return null;
      return F({
        category: CATS.O, severity: n === 0 ? "high" : "medium",
        title: n === 0 ? "The page has no main heading" : `The page declares ${n} main headings`,
        evidence: n === 0 ? "0 <h1> elements in the rendered page" : `${n} <h1> elements; first: ${JSON.stringify((c.dom.h1s ?? [])[0] ?? "")}`,
        verification: "rendered_dom",
        internal_detail: "Exactly one <h1> per page, carrying the page's primary term; demote the rest to h2/h3.",
        client_summary: n === 0
          ? "The page never states its main heading, which both visitors and Google rely on."
          : "Multiple competing main headings blur what the page is about.",
        effort: "quick_win",
      });
    },
  },
  {
    id: "onpage-thin",
    run: (c) =>
      (c.dom.words ?? 0) < 250
        ? F({
            category: CATS.C, severity: (c.dom.words ?? 0) < 100 ? "critical" : "high",
            title: `The homepage carries only ${c.dom.words} words`,
            evidence: `${c.dom.words} words of rendered text`,
            verification: "rendered_dom",
            internal_detail: "Add substantive copy: what the business does, for whom, where, and why to choose it.",
            client_summary: "There is very little for either a visitor or Google to read about what the business offers.",
            reach: "high", effort: "medium",
          })
        : null,
  },
  {
    id: "onpage-single-page",
    run: (c) => {
      const pages = Math.max(c.probes.sitemap?.count ?? 0, (c.dom.internalPaths ?? []).length + 1);
      return pages <= 1
        ? F({
            category: CATS.K, severity: "high",
            title: "One page competes for every search",
            evidence: `Sitemap URLs: ${c.probes.sitemap?.count ?? 0}; distinct internal links: ${(c.dom.internalPaths ?? []).length}`,
            internal_detail: "Create a page per service/route/topic so each search need has an indexable URL.",
            client_summary: "A single page can only compete for one kind of search, however good it is.",
            reach: "high", effort: "medium",
          })
        : null;
    },
  },
  {
    id: "onpage-dup-titles",
    run: (c) => {
      const titles = (c.probes.keyPages ?? []).map((p) => p.title).filter(Boolean);
      const dupes = titles.filter((t, i) => titles.indexOf(t) !== i);
      return dupes.length
        ? F({
            category: CATS.O, severity: "high",
            title: "Multiple pages share the same title",
            evidence: `${dupes.length + 1}+ pages share: "${dupes[0]}"`,
            internal_detail: "Give every page a unique, descriptive title; shared titles collapse pages together in Google's eyes.",
            client_summary: "Different pages introduce themselves to Google with the same name, so they cannot be told apart in search.",
            reach: "high", effort: "quick_win",
          })
        : null;
    },
  },
  {
    id: "onpage-pages-no-desc",
    run: (c) => {
      const missing = (c.probes.keyPages ?? []).filter((p) => p.code === 200 && !p.hasDesc);
      return missing.length >= 2
        ? F({
            category: CATS.O, severity: "medium",
            title: `${missing.length} key pages have no meta description`,
            evidence: missing.slice(0, 4).map((p) => p.path).join(", "),
            internal_detail: "Write unique descriptions for each listed page.",
            client_summary: "Several important pages leave their search snippet for Google to improvise.",
            effort: "quick_win",
          })
        : null;
    },
  },

  {
    id: "content-no-supporting-pages",
    run: (c) => {
      const pages = Math.max(c.probes.sitemap?.count ?? 0, (c.dom.internalPaths ?? []).length + 1);
      return pages <= 2
        ? F({
            category: CATS.C, severity: "high",
            title: "No supporting pages to build authority with",
            evidence: `Site consists of ${pages} page(s); no service, about, or content pages found`,
            internal_detail: "Build out service/about/FAQ pages and supporting content so the site can demonstrate expertise.",
            client_summary: "Beyond the front page there is nothing that shows depth on the subject, which is what search engines reward.",
            reach: "high", effort: "medium",
          })
        : null;
    },
  },
  {
    id: "content-no-proof",
    run: (c) => {
      const text = c.dom.bodySample ?? "";
      const hasProof = /testimoni|review|rating|★|sejaks?d{4}|sinces?d{4}|tahun pengalaman|years? (of )?experience|lesen|licen[cs]e|SSM|d{4,}[s-]?[A-Z]/i.test(text);
      return !hasProof && (c.dom.words ?? 0) > 100
        ? F({
            category: CATS.C, severity: "high",
            title: "No visible proof - testimonials, credentials or track record",
            evidence: "Rendered text contains no testimonial, review, licence, registration or years-in-business marker",
            evidence_label: "likely", confidence: 0.7, verification: "rendered_dom",
            internal_detail: "Add credentials (registration/licence, years operating) and 2-3 named testimonials with permission.",
            client_summary: "There is nowhere a visitor can see that anyone has trusted the business before.",
            reach: "high",
          })
        : null;
    },
  },

  // ---------- Images ----------
  {
    id: "img-alt",
    run: (c) => {
      const { total = 0, noAlt = 0 } = c.dom.imgStats ?? {};
      return total >= 5 && noAlt / total > 0.4
        ? F({
            category: CATS.O, severity: "medium",
            title: `${noAlt} of ${total} images have no description`,
            evidence: `${noAlt}/${total} rendered images with empty alt text`,
            verification: "rendered_dom",
            internal_detail: "Add descriptive alt text to content images (not decorative icons).",
            client_summary: "Most pictures are invisible to Google Images and to screen readers.",
            effort: "quick_win",
          })
        : null;
    },
  },
  {
    id: "img-broken",
    run: (c) => {
      const { broken = 0 } = c.dom.imgStats ?? {};
      return broken > 0
        ? F({
            category: CATS.T, severity: "medium",
            title: `${broken} image(s) fail to load`,
            evidence: `${broken} images measured 0x0 after forced loading and full scroll`,
            verification: "runtime_js",
            internal_detail: "Fix or remove the broken image sources (verified after forcing lazy-load).",
            client_summary: "Some pictures on the page never load, leaving gaps a visitor can see.",
          })
        : null;
    },
  },
  {
    id: "img-upscaled",
    run: (c) => {
      const up = (c.dom.imgs ?? []).filter(
        (i) => i.natural[0] > 0 && i.displayed[0] > i.natural[0] * 1.8 && i.displayed[0] > 200
      );
      return up.length
        ? F({
            category: CATS.T, severity: "low",
            title: `${up.length} image(s) stretched well beyond their real size`,
            evidence: up.slice(0, 3).map((i) => `${i.src.split("/").pop()?.slice(0, 30)} ${i.natural.join("x")}→${i.displayed.join("x")}`).join("; "),
            verification: "rendered_dom",
            internal_detail: "Export these images at or above their displayed size.",
            client_summary: "Some pictures are blown up past their real resolution and render blurry.",
            effort: "quick_win",
          })
        : null;
    },
  },
  {
    id: "img-wa-filenames",
    run: (c) => {
      const { waNamed = 0 } = c.dom.imgStats ?? {};
      return waNamed > 0
        ? F({
            category: CATS.D, severity: "medium",
            title: `${waNamed} image(s) show WhatsApp-transfer filenames`,
            evidence: "Filenames matching IMG-...-WA#### / WhatsApp-Image-...",
            internal_detail: "WhatsApp permanently recompresses photos. Re-source originals via email/Drive and replace.",
            client_summary: "Some photos were sent through WhatsApp, which permanently reduces their quality before they ever reach the site.",
            score_zero: true,
          })
        : null;
    },
  },

  // ---------- SERP ----------
  {
    id: "serp-og",
    run: (c) =>
      (c.dom.og ?? 0) === 0
        ? F({
            category: CATS.S, severity: "medium",
            title: "No social share preview card",
            evidence: "Zero og: meta tags",
            internal_detail: "Add Open Graph tags (title, description, image) with a branded share image.",
            client_summary: "When the site's link is shared on WhatsApp or Facebook, no preview card appears.",
            effort: "quick_win",
          })
        : null,
  },
  {
    id: "serp-schema",
    run: (c) =>
      (c.dom.ldTypes ?? []).length === 0
        ? F({
            category: CATS.S, severity: "high",
            title: "No structured data anywhere",
            evidence: "0 application/ld+json blocks",
            internal_detail: "Add Organization/LocalBusiness JSON-LD, plus FAQPage/Product/Service types where content exists.",
            client_summary: "The site never introduces itself to Google in the structured form rich results are built from.",
            reach: "high", effort: "quick_win",
          })
        : null,
  },

  // ---------- Local ----------
  {
    id: "local-nap",
    run: (c) => {
      const missing = [];
      if (!c.dom.addressLike) missing.push("address");
      if (!c.dom.phoneLike) missing.push("phone");
      if (!c.dom.emailLike) missing.push("email");
      return missing.length >= 2
        ? F({
            category: CATS.L, severity: "high",
            title: `Business contact details missing: ${missing.join(", ")}`,
            evidence: `Rendered text contains no recognisable ${missing.join(" or ")}`,
            verification: "rendered_dom",
            internal_detail: "Publish full NAP (name, address, phone) in the footer and contact page; add email.",
            client_summary: "The details both Google and careful customers look for are not published on the site.",
            reach: "high",
          })
        : null;
    },
  },
  {
    id: "local-schema",
    run: (c) => {
      const types = (c.dom.ldTypes ?? []).join(",");
      return (c.dom.ldTypes ?? []).length > 0 && !/LocalBusiness|Organization|FinancialService|Store|Restaurant|MedicalBusiness|ProfessionalService/i.test(types)
        ? F({
            category: CATS.L, severity: "medium",
            title: "No business-identity markup",
            evidence: `Schema present (${types}) but no organisation/local-business type`,
            internal_detail: "Add LocalBusiness (or the closest subtype) with name, address, phone, hours, areaServed.",
            client_summary: "Google is not formally told who the business is or where it operates.",
            effort: "quick_win",
          })
        : null;
    },
  },
  {
    id: "local-gbp",
    run: () =>
      F({
        category: CATS.L, severity: "medium",
        title: "Google Business Profile could not be confirmed",
        evidence: "Requires owner confirmation or profile access to verify either way",
        evidence_label: "not_testable", verification: "none",
        internal_detail: "Confirm with the client; if absent, create and verify a GBP for the service area.",
        client_summary: "Whether the business appears on Google's local map could not be confirmed from outside.",
        score_zero: true,
      }),
  },

  // ---------- Authority ----------
  {
    id: "auth-backlinks",
    run: () =>
      F({
        category: CATS.A, severity: "low",
        title: "Backlink profile not assessed",
        evidence: "Requires a backlink data provider (deferred integration)",
        evidence_label: "requires_external_data", verification: "none",
        internal_detail: "Assess via Ahrefs/DataForSEO when the integration is added.",
        client_summary: "Who links to the site - a major trust signal - needs a dedicated data source to measure.",
        score_zero: true,
      }),
  },
  {
    id: "auth-tld",
    run: (c) =>
      /\.(cc|io|xyz|co|net|org|info)$/.test(c.domain) && !/\.(com\.my|my|org\.my|edu\.my|net\.my)$/.test(c.domain)
        ? F({
            category: CATS.A, severity: "low",
            title: "The domain carries no Malaysian signal",
            evidence: `${c.domain} — no .my / .com.my presence detected`,
            evidence_label: "likely", confidence: 0.7,
            internal_detail: "Consider .com.my/.my (requires SSM), cheapest while the site is young; weigh against existing equity.",
            client_summary: "The web address itself tells Google nothing about serving Malaysia, unlike competitors on local domains.",
            score_zero: true,
          })
        : null,
  },

  // ---------- UX ----------
  {
    id: "ux-dead-links",
    run: (c) =>
      (c.dom.deadLinksReal ?? 0) > 0
        ? F({
            category: CATS.U, severity: "medium",
            title: `${c.dom.deadLinksReal} link(s) genuinely go nowhere`,
            evidence: `${c.dom.deadLinksTotal} href="#" links found; ${c.dom.deadLinksReal} have no click handler, menu role, or script wiring (runtime-verified)`,
            verification: "runtime_js",
            internal_detail: "Point each dead anchor at its destination or remove it. (Links with JS handlers were excluded.)",
            client_summary: "Some links on the page do nothing when clicked.",
            effort: "quick_win",
          })
        : null,
  },
  {
    id: "ux-contact-paths",
    run: (c) => {
      const paths = (c.dom.waLinks?.length ? 1 : 0) + (c.dom.tel ? 1 : 0) + (c.dom.mailto ? 1 : 0);
      return paths === 1
        ? F({
            category: CATS.U, severity: "medium",
            title: "Only one way to make contact",
            evidence: `Contact routes found: ${c.dom.waLinks?.length ? "WhatsApp" : ""}${c.dom.tel ? "phone" : ""}${c.dom.mailto ? "email" : ""}`,
            verification: "rendered_dom",
            internal_detail: "Add at least one more route (phone + email at minimum); larger customers often cannot use chat apps.",
            client_summary: "Visitors who cannot or will not use that one channel have no way to reach the business.",
          })
        : null;
    },
  },
  {
    id: "ux-wa-prefill",
    run: (c) =>
      (c.dom.waLinks?.length ?? 0) > 0 && (c.dom.waPrefilledCount ?? 0) === 0
        ? F({
            category: CATS.U, severity: "low",
            title: "WhatsApp links open with an empty message box",
            evidence: `${c.dom.waLinks.length} wa.me link(s), none carrying a ?text= pre-fill`,
            verification: "rendered_dom",
            internal_detail: "Pre-fill each WhatsApp link with a qualifying message naming the service.",
            client_summary: "Customers arrive in WhatsApp facing a blank box; pre-written messages convert better and arrive pre-qualified.",
            effort: "quick_win",
          })
        : null,
  },

  // ---------- Design (deterministic subset; scored fully at stage 5) ----------
  {
    id: "design-emoji",
    run: (c) =>
      (c.dom.emoji ?? 0) >= 3
        ? F({
            category: CATS.D, severity: "low",
            title: `${c.dom.emoji} emoji used in page copy`,
            evidence: `${c.dom.emoji} emoji characters in rendered text`,
            verification: "rendered_dom",
            internal_detail: "Replace emoji used as design elements with a consistent icon set in brand colours.",
            client_summary: "Emoji render differently on every phone and read as casual against a professional positioning.",
            score_zero: true,
          })
        : null,
  },
  {
    id: "design-font-sprawl",
    run: (c) => {
      const real = (c.dom.fonts ?? []).filter(([n, count]) => count > 10 && !/ui-|system|-apple|emoji/i.test(n));
      return real.length > 2
        ? F({
            category: CATS.D, severity: "low",
            title: `${real.length} typefaces in active use`,
            evidence: real.map(([n, ct]) => `${n} (${ct})`).join(", "),
            verification: "rendered_dom",
            internal_detail: "Consolidate to one heading face + one body face.",
            client_summary: "Several different typefaces compete on the page where a deliberate pair would read as designed.",
            score_zero: true,
          })
        : null;
    },
  },

  {
    id: "tech-rented-address",
    run: (c) => {
      const host = (c.domain ?? "").toLowerCase();
      const PLATFORMS = /\.(easy\.co|wixsite\.com|wix\.com|weebly\.com|blogspot\.com|wordpress\.com|myshopify\.com|netlify\.app|vercel\.app|github\.io|webflow\.io|carrd\.co|godaddysites\.com|business\.site|square\.site|mystrikingly\.com|framer\.website|framer\.app|super\.site|notion\.site)$/;
      return PLATFORMS.test(host)
        ? F({
            category: CATS.T, severity: "critical",
            title: "The business does not own its web address",
            evidence: `${host} is a rented subdomain of ${host.match(PLATFORMS)[1]}`,
            internal_detail: "Register a proper domain, move the site (or at least mirror it) there, and 301 the platform address across. Until then every ranking signal accrues to the platform's domain, not the business.",
            client_summary: "The website lives inside someone else's address, so all the reputation it earns with Google belongs to that platform, and it all vanishes if the site ever moves.",
            reach: "high", effort: "medium",
          })
        : null;
    },
  },
  {
    id: "kw-few-indexable-pages",
    run: (c) => {
      const pages = Math.max(c.probes.sitemap?.count ?? 0, (c.dom.internalPaths ?? []).length + 1);
      return pages >= 2 && pages <= 4
        ? F({
            category: CATS.K, severity: "medium",
            title: `Only ${pages} pages compete for every possible search`,
            evidence: `Sitemap URLs: ${c.probes.sitemap?.count ?? 0}; distinct internal links: ${(c.dom.internalPaths ?? []).length}`,
            internal_detail: "Map the service/product/location matrix and give each real search intent its own indexable page.",
            client_summary: `With ${pages} pages the site can only enter a handful of searches, whatever their quality.`,
            reach: "high", effort: "medium",
          })
        : null;
    },
  },
  {
    id: "content-shallow-key-pages",
    run: (c) => {
      const kp = (c.probes.keyPages ?? []).filter((p) => p.code === 200 && p.words != null);
      if (kp.length < 2) return null;
      const thin = kp.filter((p) => p.words < 120);
      return thin.length / kp.length >= 0.7
        ? F({
            category: CATS.C, severity: "high",
            title: "The inner pages are as thin as the front",
            evidence: `${thin.length} of ${kp.length} key pages carry under 120 words as served: ${thin.slice(0, 4).map((p) => `${p.path} (${p.words}w)`).join(", ")}`,
            internal_detail: "Every listed page needs real copy: what it is, for whom, why this business. Template shells rank for nothing.",
            client_summary: "Behind the front page the other pages are shells, so there is no depth anywhere for Google to reward.",
            reach: "high", effort: "medium",
          })
        : null;
    },
  },

  // ---------- Quality tier: separates "exists" from "good" ----------
  // These fire only when the base element passes its presence check, so a site
  // that merely HAS things stops scoring like a site whose things are GOOD.
  {
    id: "onpage-meta-desc-quality",
    run: (c) => {
      const d = (c.dom.metaDesc ?? "").trim();
      if (!d) return null; // absence handled by onpage-meta-desc
      const t = (c.dom.title ?? "").trim();
      if (t && d.toLowerCase() === t.toLowerCase())
        return F({
          category: CATS.O, severity: "medium",
          title: "The meta description just repeats the title",
          evidence: `Description == title: "${d.slice(0, 90)}"`,
          verification: "rendered_dom",
          internal_detail: "Write a distinct 150-160 character description that sells the click, not a copy of the title.",
          client_summary: "The line under the site's name in Google repeats the name instead of giving a reason to click.",
          effort: "quick_win",
        });
      if (d.length < 70)
        return F({
          category: CATS.O, severity: "medium",
          title: `The meta description is only ${d.length} characters`,
          evidence: `"${d}" (${d.length} chars; effective snippets run 120-160)`,
          verification: "rendered_dom",
          internal_detail: "Extend to 150-160 characters: lead with the primary service and location, end with the differentiator.",
          client_summary: "The site's one line in Google search results is too short to persuade anyone to choose it.",
          effort: "quick_win",
        });
      if (d.length > 170)
        return F({
          category: CATS.O, severity: "low",
          title: `The meta description runs to ${d.length} characters`,
          evidence: `${d.length} chars; Google truncates around 160`,
          verification: "rendered_dom",
          internal_detail: "Trim to under 160 characters with the key message in the first 120.",
          client_summary: "Google cuts the site's search-result line mid-sentence, so the pitch never finishes.",
          effort: "quick_win",
        });
      return null;
    },
  },
  {
    id: "onpage-title-quality",
    run: (c) => {
      const t = (c.dom.title ?? "").trim();
      if (!t) return null; // absence is critical elsewhere
      if (t.length > 65)
        return F({
          category: CATS.O, severity: "low",
          title: `The page title runs to ${t.length} characters`,
          evidence: `"${t.slice(0, 80)}…" (${t.length} chars; Google shows ~60)`,
          verification: "rendered_dom",
          internal_detail: "Rework to under 60 characters with the primary term first.",
          client_summary: "The site's name line gets cut off in Google before it finishes.",
          effort: "quick_win",
        });
      if (t.length < 12)
        return F({
          category: CATS.O, severity: "low",
          title: `The page title is only ${t.length} characters`,
          evidence: `"${t}" (${t.length} chars)`,
          verification: "rendered_dom",
          internal_detail: "Use the full width: primary service + location + brand comfortably fit in 60 characters.",
          client_summary: "The site introduces itself to Google with a few characters where a full sentence would win more searches.",
          effort: "quick_win",
        });
      return null;
    },
  },
  {
    id: "kw-brand-only-title",
    run: (c) => {
      const t = (c.dom.title ?? "").trim();
      if (!t) return null;
      const brand = (c.domain ?? "").replace(/^www\./, "").split(".")[0].toLowerCase();
      const fillers = /^(home|welcome|official|website|site|laman|rasmi|utama|my|the|and|of|for|page|homepage|index)$/i;
      const words = t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
      const meaningful = words.filter(
        (w) => w.length >= 3 && !fillers.test(w) && !brand.includes(w) && !w.includes(brand)
      );
      return meaningful.length === 0
        ? F({
            category: CATS.K, severity: "high",
            title: "The title says who the business is, not what it does",
            evidence: `Title "${t}" contains no service, product or place words beyond the brand name`,
            evidence_label: "likely", confidence: 0.8, verification: "rendered_dom",
            internal_detail: `Lead the <title> with what people actually search for, then the brand: "[primary service] [location] | ${t}".`,
            client_summary: "People who already know the business can find it; people searching for what it sells cannot.",
            reach: "high", effort: "quick_win",
          })
        : null;
    },
  },
  {
    id: "kw-generic-headings",
    run: (c) => {
      const h1s = (c.dom.h1s ?? []).map((h) => (h ?? "").trim()).filter(Boolean);
      if (!h1s.length) return null; // absence handled by onpage-h1
      const generic = /^(welcome|welcome to.{0,30}|home|hello|about( us)?|selamat datang.{0,30}|laman utama|utama|our services|services|introduction)$/i;
      return h1s.every((h) => generic.test(h))
        ? F({
            category: CATS.K, severity: "medium",
            title: "The main heading is a greeting, not an offer",
            evidence: `h1: ${h1s.map((h) => `"${h.slice(0, 50)}"`).join(", ")}`,
            evidence_label: "likely", confidence: 0.8, verification: "rendered_dom",
            internal_detail: "Rewrite the h1 as the primary search phrase the page should win, not a welcome line.",
            client_summary: "The biggest line on the page greets visitors instead of telling Google what the business sells.",
            reach: "medium", effort: "quick_win",
          })
        : null;
    },
  },
  {
    id: "content-depth-modest",
    run: (c) => {
      const w = c.dom.words ?? 0;
      return w >= 250 && w < 400
        ? F({
            category: CATS.C, severity: "medium",
            title: `The homepage carries ${w} words where competitive pages run far deeper`,
            evidence: `${w} rendered words; pages that win competitive searches typically carry 600+`,
            verification: "rendered_dom",
            internal_detail: "Deepen the homepage: the offer, who it serves, where, proof, and answers to the obvious objections.",
            client_summary: "The page says enough to introduce the business but not enough to outrank anyone established.",
            effort: "medium",
          })
        : null;
    },
  },
  {
    id: "content-headings-flat",
    run: (c) => {
      const w = c.dom.words ?? 0;
      return w >= 250 && (c.dom.h2Count ?? 0) === 0
        ? F({
            category: CATS.C, severity: "low",
            title: "The content has no section headings",
            evidence: `${w} words with 0 <h2> section headings`,
            verification: "rendered_dom",
            internal_detail: "Break the copy into h2 sections named for the things people search (services, areas, FAQs).",
            client_summary: "The page reads as one unbroken block, so neither skimming visitors nor Google can see its structure.",
            effort: "quick_win",
          })
        : null;
    },
  },
  {
    id: "content-stale-year",
    run: (c) => {
      const m = (c.dom.bodySample ?? "").match(/(?:©|copyright)\s*(?:\D{0,20})?((?:19|20)\d{2})(?!\s*[-–]\s*(?:19|20)\d{2})/i);
      if (!m) return null;
      const year = Number(m[1]);
      const now = new Date().getFullYear();
      return year <= now - 2
        ? F({
            category: CATS.C, severity: year <= now - 3 ? "medium" : "low",
            title: `The site's copyright line still says ${year}`,
            evidence: `Footer text: "${m[0]}" (current year ${now})`,
            verification: "rendered_dom",
            internal_detail: "Update the footer year (or generate it); a stale year is the classic abandoned-site signal.",
            client_summary: `The site announces it was last touched in ${year}, which quietly tells visitors nobody is maintaining it.`,
            effort: "quick_win",
          })
        : null;
    },
  },
  {
    id: "serp-favicon",
    run: (c) =>
      c.dom.faviconLink === false && c.probes.faviconIco !== 200
        ? F({
            category: CATS.S, severity: "low",
            title: "The site has no icon in search results and browser tabs",
            evidence: `No <link rel="icon"> and /favicon.ico returns ${c.probes.faviconIco || "nothing"}`,
            internal_detail: "Add a favicon (SVG or 48px+ PNG) and a link tag; Google shows it beside every mobile result.",
            client_summary: "In search results and browser tabs the site appears with a blank placeholder where its mark should be.",
            effort: "quick_win",
          })
        : null,
  },
  {
    id: "img-alt-junk",
    run: (c) => {
      const alts = c.dom.altSamples ?? [];
      if (alts.length < 5) return null;
      const junk = alts.filter((a) =>
        /\.(jpe?g|png|webp|gif)$|^(img|image|dsc|dscn|pic|photo|screenshot|whatsapp)[-_ ]?\d|^\d{6,}$|^untitled/i.test(a)
      );
      return junk.length / alts.length >= 0.3
        ? F({
            category: CATS.O, severity: "medium",
            title: "Image descriptions are just filenames",
            evidence: `${junk.length} of ${alts.length} alt texts are filenames, e.g. ${junk.slice(0, 3).map((j) => `"${j.slice(0, 40)}"`).join(", ")}`,
            verification: "rendered_dom",
            internal_detail: "Replace filename alts with what the image shows; a filename alt is worse than none for relevance.",
            client_summary: "The pictures are technically labelled, but the labels are camera filenames that mean nothing to Google.",
            effort: "quick_win",
          })
        : null;
    },
  },
  {
    id: "ux-copyright-mismatch",
    run: (c) => {
      const t = c.dom.bodySample ?? "";
      const other = t.match(/(?:©|copyright)[^.\n]{0,60}?([A-Z][A-Za-z&.\s]{3,40})(?:\.|All|$)/);
      const brand = (c.domain ?? "").replace(/^www\./, "").split(".")[0].toLowerCase();
      if (!other || !other[1]) return null;
      const holder = other[1].trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      return holder.length >= 4 && !holder.includes(brand.replace(/[^a-z0-9]/g, "")) && !brand.replace(/[^a-z0-9]/g, "").includes(holder)
        ? F({
            category: CATS.U, severity: "low",
            title: "The footer credits a different name than the site's own",
            evidence: `Footer: "${other[0].slice(0, 80).trim()}" on ${c.domain}`,
            evidence_label: "likely", confidence: 0.6, verification: "rendered_dom",
            internal_detail: "Align the footer copyright with the trading name, or remove the template vendor's credit.",
            client_summary: "The small print at the bottom names someone else, which reads as a template nobody finished.",
            effort: "quick_win",
          })
        : null;
    },
  },
];

// Framework register targets per category vs what this engine build assesses.
// Honest coverage accounting: category_confidence = assessed / register.
// Derived from the register at load: first category a check can emit is its home.
export const ASSESSED = CHECKS.reduce((m, c) => {
  const k = c.run.toString().match(/category: CATS\.([A-Z])/)?.[1];
  if (k && CATS[k]) m[CATS[k]] = (m[CATS[k]] ?? 0) + 1;
  return m;
}, {});
export const REGISTER = {
  [CATS.T]: { register: 18 }, [CATS.O]: { register: 13 }, [CATS.C]: { register: 18 },
  [CATS.K]: { register: 13 }, [CATS.S]: { register: 9 }, [CATS.L]: { register: 5 },
  [CATS.A]: { register: 9 }, [CATS.U]: { register: 5 }, [CATS.D]: { register: 24 },
};

// Deterministic strengths — drawn from checks that PASSED. Real, never invented.
export function collectStrengths(c) {
  const s = [];
  if (c.probes.httpRedirect?.finalHttps && (c.probes.hostA?.code !== 200 || c.probes.hostB?.code !== 200 || c.probes.hostA?.hops > 0 || c.probes.hostB?.hops > 0))
    s.push("Secure address correctly enforced with clean redirects");
  if (c.probes.sitemap?.ok && c.probes.sitemap.count >= 5) s.push(`An XML sitemap is in place (${c.probes.sitemap.count} pages listed for Google)`);
  if (c.dom.metaDesc) s.push("A meta description is set, controlling the search snippet");
  if ((c.dom.og ?? 0) > 0) s.push("Share preview tags are present for social and chat apps");
  if ((c.dom.ldTypes ?? []).length > 0) s.push(`Structured data present (${c.dom.ldTypes.slice(0, 3).join(", ")})`);
  if ((c.dom.waPrefilledCount ?? 0) > 0) s.push("WhatsApp links open with a pre-written enquiry message");
  if (c.dom.h1Count === 1) s.push("A single clear main heading on the page");
  const { total = 0, noAlt = 0 } = c.dom.imgStats ?? {};
  if (total >= 5 && noAlt === 0) s.push("Every image carries a description");
  if ((c.probes.home?.ttfbMedian ?? 9999) < 300) s.push("Fast server response (under 300ms)");
  if (!c.dom.overflow375) s.push("The layout holds together on a phone screen");
  return s.slice(0, 4);
}

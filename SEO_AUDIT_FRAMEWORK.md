# lean.X digital — Standard Website Audit Framework

**Version 2.2** — 27 August 2026
**Invocation:** `Audit this website: [URL]`

---

## 0. The Product Model

This framework produces **two documents from one analysis**. Getting this separation right is the commercial core of the product.

```
Deep Analysis  →  Score & Prioritise  →  Simplify  →  1-Page Client Report  →  Sales Conversation  →  Paid Implementation
   160 checks        9 categories        6 areas         the only thing
   internal          internal            client            the client sees
```

**Why the split exists.** A full technical audit is the delivery plan. Handing it to a prospect gives away the scope of work — they can pass it to a developer, or to an AI, and implement it without us. The client-facing document must establish that problems exist and that they cost money, without functioning as a set of instructions.

The client should finish reading and think:
> *"I have problems, I roughly understand what they are, and I need someone to fix them."*

Not:
> *"Great, I'll forward this to my developer."*

---

## 1. The Two Outputs

| | **Internal Analyser File** | **Client Visibility Check** |
|---|---|---|
| Audience | lean.X digital team only | Prospect / client |
| Length | As long as needed | One page |
| Checks shown | All 100+ | None individually |
| Categories | 9 weighted | 6 plain-English areas |
| Evidence | Full — source extracts, headers, measurements | None |
| Fix detail | Complete, developer-ready | None |
| Roadmap | Full 30/60/90 | Not included — that is the proposal |
| Tone | Technical, precise | Non-technical, commercial |
| Purpose | Scope, price and deliver the work | Start the sales conversation |

**Rule:** the two documents must never contradict each other. The overall score is identical on both. If a client asks how the number was reached, the internal file must justify it.

---

## 2. Operating Principles

1. **Never fabricate data.** No invented search volumes, difficulty scores, traffic estimates, authority metrics, ranking positions or backlink counts — on either document.
2. **Score honestly, communicate kindly.** A weak site gets a low score. The *framing* softens; the *number* does not. A prospect told "62, good foundation" has less reason to buy than one told "your sales page is strong but Google can't see it."
3. **Every internal claim carries an evidence label** (§4).
4. **Report what works.** Both documents open with genuine strengths. An audit that is only criticism reads as a sales pitch and loses trust.
5. **Never promise rankings.** Directional outcomes only.
6. **Audit the site, not the client.** Never characterise whoever built it.
7. **Scale weights, don't punish.** If a category genuinely does not apply, redistribute proportionally (§6.3).
8. **State limitations openly.** Naming what we could not test makes what we did test more credible.

---

## 3. Master Check Register

The internal analyser runs every applicable check below. Record each as **PASS / FAIL / WARN / N/A / NOT TESTABLE / INFO**. Target coverage is 100+ technical checks plus the 24 design criteria; the MY.Z Solution audit ran 136 + 24 = 160.

Sections 3.1–3.7 and 3.8 are all run in-house. **No external designer input is required** — §3.8.1 sets out the three methods that make every design criterion assessable.

### 3.1 Technical SEO — ~68 checks

**Security & protocol:** HTTPS enabled · certificate valid & issuer · certificate expiry · HTTP→HTTPS redirect · www↔non-www redirect · redirect hop count · redirect chains/loops · mixed content · HSTS · CSP · X-Content-Type-Options · X-Frame-Options

**Crawlability:** robots.txt exists · robots.txt valid · robots.txt sitemap reference · disallow rules sane · `/sitemap.xml` · `/wp-sitemap.xml` · `/sitemap_index.xml` · `/sitemap-index.xml` · CMS-specific sitemap paths · sitemap URL count · sitemap validity · pretty permalinks · CMS routing reaching application · crawl depth to key pages · orphan pages

**Indexability:** meta robots audit · X-Robots-Tag header · noindex misuse · canonical tag present · canonical self-reference · cross-domain canonicals · placeholder/demo content removed · staging copies exposed

**Error handling:** 404 returns correct status · branded 404 page · soft 404s · 5xx errors on any route · author archive · search results page · category archive · date archive · attachment pages · feeds indexable · duplicate content across query parameters

**Document structure:** single valid HTML document · `lang` attribute correct · charset declared · viewport meta · structured data present · schema types valid · Open Graph tags · Twitter Card tags

**Performance:** compression active · Cache-Control headers · TTFB · total page weight · request count · first-party vs third-party split · render-blocking scripts · render-blocking CSS · CDN libraries loaded in production · icon library weight · hotlinked external images · font loading strategy

**Images:** count · alt text coverage · `width`/`height` attributes · lazy loading · next-gen formats · descriptive filenames · responsive srcset · dead query parameters · file sizes

**Mobile & rendering:** horizontal overflow at 375px · tap target sizing · console errors · console warnings · JS-dependent content · rendered vs raw DOM diff

**Platform:** CMS & version · server software · server language version & EOL status · plugin fingerprint · directory listing exposure · xmlrpc exposure · hreflang (if multilingual) · pagination handling

**Not testable without access:** Core Web Vitals field data · Lighthouse lab scores · crawl budget from logs · index coverage from Search Console

### 3.2 On-Page SEO — ~20 checks
Title present · title keyword-optimised · title length · title uniqueness · meta description present · meta description length · H1 present · single H1 · H1 keyword usage · heading hierarchy validity · heading keyword usage · word count · content originality · search intent alignment · internal link count · anchor text quality · outbound link profile · SEO-friendly URLs · CTA presence · keyword cannibalisation · content depth vs competitors

### 3.3 Content & E-E-A-T — ~17 checks
Business name published · physical address · phone number · email address · company registration number · about page · contact page · team/author credentials · on-site testimonials · case studies · blog or regular content · FAQ content · FAQ schema · content freshness · claims substantiated · urgency mechanics authentic · legal pages present

> **Note on urgency mechanics:** check countdown timers, stock counters and "X people viewing" widgets for whether they reflect anything real. A timer hardcoded to reset is a trust liability and, in many markets, a consumer-protection exposure. Report it factually, without moralising.

### 3.4 Local SEO — ~9 checks
NAP published · NAP consistency · Google Business Profile · LocalBusiness schema · location pages · service area defined · local keywords in metadata · reviews displayed · citation coverage

### 3.5 SERP Visibility — ~6 checks
FAQ rich result eligibility · business panel eligibility · review star eligibility · sitelinks eligibility · snippet text control · social share preview card

### 3.6 Authority & Off-Page — ~6 checks
Backlink profile · referring domains · brand mentions · directory listings · domain TLD locality · domain age

> **TLD locality matters for local businesses.** A `.cc`, `.io` or `.xyz` domain carries no national signal. Where competitors use `.com.my`, `.co.uk` or equivalent, flag it — and note that migration is cheapest while the site is new.

### 3.7 UX & Conversion — ~10 checks
Value proposition clarity · CTA placement · contact pathway count · enquiry form present · mobile usability · site navigation · trust signals · social proof visibility · readability · conversion tracking configured

### 3.8 Design & Brand — 24 criteria

Adapted from the Leanx Digital UI/UX & Visual Design Checklist. **The same 24 criteria apply to every website we audit**; only the findings change.

**Scoring: `✅` = 1 · `⚠️` = 0.5 · `❌` = 0.** Half-credit is the standing convention (see §3.8.3). Report each area as a sub-score, then:

```
Design & Brand score = (total ÷ 24) × 100
```

#### A. Imagery & Assets (5)
1. Photos sharp, high resolution, professionally shot — not phone or WhatsApp-compressed documentation shots
2. Hero and CTA banners feature **people** handling the service — faces build trust faster than objects
3. One fixed aspect ratio per component (hero 16:9, cards 4:3, thumbnails 3:2) — no random crops
4. Every photo matches its label or category
5. No text baked into images; no broken or grey placeholder images

#### B. Typography (4)
6. Maximum 2 typefaces, deliberately chosen — name the actual font; template defaults in heavy weights read as generic
7. Headline weight confident, not shouting — SemiBold not Black; no all-caps buttons or headings; no text strokes
8. Clear size hierarchy; only **one** loud element per screen
9. Font personality matches the brand — heritage brand ≠ template font; premium claim ≠ shouting caps

#### C. Colour & Brand (5)
10. One dominant brand colour used consistently on every page
11. Palette limited to 2–3 colours plus neutrals — no ad-hoc colours, **no emoji as design elements**
12. Colours intentional and connected to the brand story — check the logo first; if equity exists in a colour, apply it rather than replace it
13. Buttons, links and highlights use the same colours, and **one consistent label per action** site-wide
14. A stranger could recall the brand colour after one visit

*Also check:* brand name spelled identically everywhere — browser tab, logo, footer, social handles, domain.

#### D. Hero Section (5)
15. One static hero — no rotating slider
16. One cinematic, high-quality image: the business at its most impressive, ideally with a person
17. One headline stating the specialty, plus one clear CTA — WhatsApp links pre-filled with a qualifying message
18. Text readable via dark gradient overlay, not strokes or heavy shadows
19. Generous whitespace; nothing screaming above or around the hero — no marquees, countdowns or badge clutter

#### E. Layout & Consistency (5)
20. Page flows in buyer logic: problem/promise → proof → services → offer → action; low-intent content never before the sell
21. One card component, one button component, reused identically
22. Visual weight matches importance — the key offer and real proof are the loudest elements, never gimmicks
23. Consistent naming, capitalisation and language; no raw URLs as text; no dead `#` links
24. Animated elements verified working — static beats broken; counters must never linger at "0"

### 3.8.1 Running the design review without a designer

Every criterion is assessable in-house. Three methods, in order of preference:

**Method 1 — Rendered-page inspection (browser JS).** Read computed styles from the live DOM, not the source. This yields hard evidence for most criteria:

| Signal | How |
|---|---|
| Actual fonts used, by element count | `getComputedStyle(el).fontFamily` across all elements |
| Actual colour palette, by frequency | collect `color` + `backgroundColor`, rank by count |
| All-caps usage | count `textTransform === 'uppercase'` |
| Text strokes | count non-zero `webkitTextStroke` |
| Sliders/carousels | `.swiper, .slick, .owl-carousel, [class*=carousel], [class*=slider]` |
| Dead links | `a[href="#"], a[href=""], a:not([href])` |
| Emoji as design elements | regex the rendered `innerText` for emoji ranges |
| Component sprawl | unique `className` values on `[class*=card]` and buttons |
| Button label consistency | collect and dedupe button text |
| WhatsApp pre-fill | check `wa.me` hrefs for a `?text=` parameter |
| Whitespace | unique `paddingTop` values across `<section>` |
| Hero gradient overlay | test hero `backgroundImage` for `gradient` |
| Section order (buyer logic) | first heading inside each `<section>`, in order |
| Image dimensions and format | `naturalWidth/Height`, `currentSrc` extension |

**Method 2 — Look at the images.** Download each key image and open it. This is what makes criteria 1, 2, 4, 5 and 16 genuinely assessable rather than guessed:
```bash
curl -sSL "<image-url>" -o img.webp
chrome --headless=new --screenshot="img.png" --window-size=W,H "file:///abs/path/img.webp"   # if not PNG/JPG
```
Then read `img.png` directly. Judge: is there a person? is it sharp or compressed? is text baked in? does it match its label? is it contextual or a studio cutout?

**Method 3 — Filename and asset forensics.** `IMG-…-WA####` or `WhatsApp-Image-…` means WhatsApp compression. `images-17.jpg`, `download.png`, `unsplash`/`ixlib` parameters, or a hostname belonging to a preview deployment all indicate borrowed or provisional assets.

**Honest limits.** Two things stay genuinely subjective: *criterion 9* (font personality matches the brand) and *criterion 22* (visual weight matches importance). Judge these from the evidence — the font's actual name and character against the brand's stated positioning, and section order plus heading prominence against what the business says matters most — and say so plainly in the internal file. Screenshots are unavailable in the current environment, so **never claim to have viewed the full rendered page**; claim only what the DOM, the computed styles and the opened images actually show.

### 3.8.2 Root-cause diagnosis — required

Every design review ends with **one** diagnosis. Pitch the disease, not 24 fixes.

| | Fits when | The line |
|---|---|---|
| **A. No design system** | Failures spread evenly across all five areas | "The site was assembled without a design system — no fixed fonts, colours, image sizes or component rules, so every element was decided one by one. Fix the system once and every page falls into place." |
| **B. Tone contradiction** | Copy promises one thing, design signals another | "Your words promise premium. Your design behaves like a flash sale. We make the design keep the promise the copy is making." |
| **C. Undersold strength** | Real credibility exists but is presented poorly | "Your strongest asset is presented as a buried line. The redesign has one mission: make the website look as established as the business actually is." |

Where none fits — a well-designed site whose problem is thin content or no reach — say that plainly rather than forcing a diagnosis.

### 3.8.3 Scoring convention — RESOLVED

Earlier audits mixed strict pass-counting with part-marks (see history below). **Half-credit for `⚠️` is now the standard**, matching both the checklist format and how gradations are naturally assessed.

| Site | Method used at the time | As published | Under half-credit |
|---|---|---:|---:|
| MY.Z Solution | strict | 33 | 46 |
| Adam Karpets | strict | 8 | 17 |
| KAMA-AI | graded | 73 | 73 |
| DRVSAFE | graded | 56 | 56 |
| AD-DEEN concept | graded | 40 | 40 |
| CQ-TEC | none supplied | — | — |
| Takaful Solutions | half-credit | 81 | 81 |

Re-score MY.Z and Adam Karpets before those two are compared against any later audit.

### 3.8.4 Recurring checks worth naming

These appear on most Malaysian SME sites:
- **Image provenance.** WhatsApp-transferred photos are permanently compressed. Check filenames first.
- **Brand name consistency.** Count the spellings across body copy, logo, footer and the browser tab.
- **Artificial urgency.** Countdown timers that reset, fake scarcity, "HOT" tags. Report the trust consequence.
- **Label consistency per action.** Count how many different labels the same action uses.
- **Shouting.** All-caps buttons and headings versus the brand's stated positioning. Caps on small section kickers are acceptable; caps on buttons are not.
- **Dead links — verify at runtime.** `href="#"` in the source does *not* mean the link is dead. Modern sites attach handlers in JavaScript. Always check the script before reporting a broken button.

## 4. Evidence Labels

| Label | Meaning |
|---|---|
| **Verified Finding** | Directly observed and reproducible |
| **Likely Issue** | Strongly indicated, not fully provable without more access |
| **Recommendation** | Best practice, not a defect claim |
| **Requires External Data** | Needs GSC, GA4, logs, PSI/CrUX, SEMrush, Ahrefs, or Screaming Frog |

Client documents carry **no labels** — but nothing unlabelled internally may reach the client document at all.

---

## 5. Severity, Impact, Opportunity, Reach, Confidence, Effort

**Severity:** Critical (blocks indexing/ranking/conversion; gates other work) · High (materially suppresses visibility) · Medium (meaningful but not blocking) · Low (hygiene)

**Impact:** how much it matters where it applies — High (primary revenue/conversion path) · Medium (secondary path) · Low (peripheral)

**Reach:** how much of the site it touches — High (site-wide or template-level) · Medium (a section) · Low (single page or element)

**Confidence:** how certain the finding is — Verified (1.0) · Likely (0.7) · Inferred (0.4). Set by the verification method; nothing below 0.4 is published.

**Opportunity:** High (large untapped demand or clear competitor gap) · Medium · Low

**Effort:** Quick Win (<1hr, no dev) · Low (<1 day) · Medium (1–5 days) · High (>1 week or structural)

**Prioritisation:** `(Impact × Opportunity × Reach) ÷ Effort × Confidence` — High=3, Medium=2, Low=1; Effort: QW=1, Low=1.5, Med=3, High=5. **Critical severity is actioned first regardless of score.** *(Reach and Confidence added in v2.2 to align with the DISCOVA priority model.)*

---

## 6. Scoring

### 6.1 Internal category weights
| Category | Weight |
|---|---:|
| Technical SEO | 18% |
| On-Page SEO | 13% |
| Content & Topical Authority | 18% |
| Keyword & Search Opportunity | 13% |
| Google/SERP Visibility | 9% |
| Local SEO | 5% |
| Authority & Off-Page SEO | 9% |
| SEO UX & Conversion | 5% |
| **Design & Brand** | **10%** |

### 6.2 Scoring each category
Start at 100, deduct: Critical −25 · High −15 · Medium −8 · Low −3. Floor 0. Add back up to +10 for genuinely strong implementations, documented so the credit is auditable.

**Design & Brand is scored differently** — by the checklist in §3.8, not by deduction. Its score is `(✅ ÷ 24) × 100`.

**Overall** = Σ (category score × weight).

### 6.3 Non-applicable categories
Remove the weight and redistribute proportionally. Never score an inapplicable category 0. State the redistribution in the internal file.

### 6.4 Health bands (internal)
| Score | Band |
|---:|---|
| 85–100 | Excellent |
| 70–84 | Good |
| 55–69 | Fair |
| 35–54 | Poor |
| 0–34 | Critical |

---

## 7. Client Roll-Up

The nine internal categories collapse into six client-facing areas. **Weights are preserved, so the overall score is identical on both documents.**

| Client area | Internal categories | Combined weight |
|---|---|---:|
| **1. Google Visibility** | Keyword & Search Opportunity + SERP Visibility + Authority & Off-Page | 31% |
| **2. Website Content** | Content & Topical Authority + On-Page SEO | 31% |
| **3. User Experience** | SEO UX & Conversion | 5% |
| **4. Technical Foundation** | Technical SEO | 18% |
| **5. Local Search** | Local SEO | 5% |
| **6. Design & Brand** | Design & Brand | 10% |

Each area score is the weighted average of its constituent categories.

### 7.1 Client status bands
| Score | Status shown to client |
|---:|---|
| 75–100 | **Good** |
| 55–74 | **Fair** |
| 35–54 | **Needs Improvement** |
| 0–34 | **Needs Attention** |

**Area scores are shown to the client as bars.** A score of 22 for Technical Foundation reveals nothing actionable, so it is safe under §8, and the bar chart communicates severity far faster than five paragraphs. Show the number alongside the bar and the status word.

The Design & Brand area additionally shows its five sub-scores as bars (`Typography 1/4` etc.). The individual criteria that failed stay internal.

---

## 8. Disclosure Rules

**The test:** *could a competent developer act on this sentence without us?* If yes, it stays internal.

### Never appears in the client document
- Step-by-step instructions of any kind
- Code, markup, schema examples, or tag syntax
- Named settings, plugins, or configuration values
- The specific diagnosis of a technical fault (describe the *symptom and cost*, not the cause)
- Recommended URL structures or page lists
- Keyword lists, keyword mapping, or search term tables
- Competitor page counts, sitemap structures, or architecture
- Per-page metadata, titles or descriptions
- Backlink or digital PR tactics
- Content briefs or article outlines
- The quick-win list
- The 30/60/90 roadmap — **that is the proposal, not the audit**
- Any checklist enabling self-implementation

### Always appears in the client document
- One overall score out of 100, plainly explained
- Five areas, each with a status, 1–2 plain sentences, and an Opportunity line
- 3–5 priority recommendations naming **what** needs attention and **why it costs them**
- Genuine strengths, stated without hedging
- A "What This Means" close and a single recommended next step

### Translation examples

| Internal | Client-facing |
|---|---|
| "Set permalinks to Post name; this restores `/wp-sitemap.xml` and the 404 template." | "Several settings behind the scenes are stopping Google from listing the site properly." |
| "Homepage `<title>` resolves to the brand only; the keyword-rich title sits inside `<body>` due to a nested document." | "The website is not set up to appear when customers search for the services you offer." |
| "Build `/hantar-barang-ke-sabah/` and `/hantar-barang-ke-sarawak/`; competitor runs 70 URLs on a service × destination matrix." | "Every service is described on a single page. Competitors give each service and route a page of its own." |
| "Add FAQPage and LocalBusiness JSON-LD." | "The business cannot currently appear in Google's local map results." |
| "Switch Montserrat Black to Plus Jakarta Sans SemiBold; sentence-case all buttons." | "The type is loud and generic where the brand promises premium." |
| "Commit to deep navy as primary; remove the yellow warning banner and emoji." | "There is no single colour a visitor would associate with the brand." |
| "Delete the marquee and the resetting countdown timer." | "Attention devices undercut the headline, and visitors who notice artificial urgency tend to doubt honest claims alongside it." |

The pattern: **name the business consequence, withhold the mechanism.**

---

## 9. Client Report Template

Fits on one page. Non-technical throughout.

```
WEBSITE VISIBILITY CHECK
[Business name] · [domain] · [date]

OVERALL WEBSITE HEALTH: [n]/100
[2–3 sentences, plain English. Lead with a genuine strength where one
exists, then state the core limitation in business terms.]

WHERE YOU STAND                          [bar]  [score]  [status]
1. Google Visibility      ███░░░░░░░░░░░░░░  12   Needs attention
2. Website Content        ███░░░░░░░░░░░░░░  15   Needs attention
3. User Experience        █████████░░░░░░░░  45   Needs improvement
4. Technical Foundation   █████░░░░░░░░░░░░  22   Needs attention
5. Local Search           ██░░░░░░░░░░░░░░░   8   Needs attention
6. Design & Brand         ███████░░░░░░░░░░  33   Needs attention
   [one sentence of business consequence under each]

THE CLEAREST GAP
   [one comparison chart — the single most persuasive fact found,
    usually pages-Google-can-find vs a competitor]

DESIGN & BRAND REVIEW
   [five sub-scores as bars, one short line each]
   Imagery & Assets  3/5 · Typography 1/4 · Colour & Brand 0/5
   Hero Section 2/5 · Layout & Consistency 2/5

OUR PRIORITY RECOMMENDATIONS
01 — [Area]   [what needs attention and why it matters commercially]
02 — [Area]   ...
03 — [Area]   ...
04 — [Area]   ...
05 — [Area]   ...

WHAT THIS MEANS
[2–3 sentences: overall situation, what is salvageable, what is at stake.]

Recommended next step: [Full SEO & Website Optimisation Programme,
or the appropriate service based on findings.]

Footer: "Based on a review of over 100 individual checks carried out
on [date]. Findings are presented at summary level; the detailed
breakdown forms part of the full optimisation programme."
```

That closing footer line does real work: it signals depth, explains why the document is short, and positions the detail as part of the paid engagement.

---

## 10. Internal Report Structure

1. Executive Summary
2. Overall Health Score (8 categories)
3. Key Findings — strengths first
4. Technical SEO Assessment
5. On-Page SEO Assessment
6. Content & Topical Authority
7. Keyword & Search Opportunity
8. Google/SERP Visibility
9. Local SEO *(if applicable)*
10. Competitor & Market Comparison
11. Authority & Off-Page SEO
12. SEO UX & Conversion
13. Critical Issues
14. Quick Wins
15. Strategic Growth Opportunities
16. Prioritised Action Plan
17. 30/60/90-Day Roadmap
18. What We Would Need Access To
19. Final Assessment
20. **Client Roll-Up Mapping** — how the 8 categories became 5, and what was withheld
21. **Full Check Register** — every check with its outcome

**Standard issue format** for each major finding:

> **Issue** · **Evidence** (with URL, header, tag or measurement) · **Why it matters** · **Priority** · **Impact** · **Effort** · **Recommendation** · **Expected outcome**

---

## 11. Quick Wins vs Strategic Opportunities

**Quick Win** — all four: effort is Quick Win or Low · no redevelopment · impact Medium or High · achievable by an editor with normal CMS access.

**Strategic Opportunity** — all three: effort Medium or High · creates new ranking surface, authority, or removes a structural ceiling · payback in months.

Both live in the internal file only.

---

## 12. Data Collection

**Collectible without client access:** response headers · redirect chains · robots.txt · sitemaps · rendered DOM · raw HTML · all meta/schema · headings · link graph · image inventory · resource waterfall · TTFB · console output · CMS fingerprint · public CMS APIs · competitor sitemaps · SSL certificate.

**Requires external tools or client access:**

| Data | Source |
|---|---|
| Impressions, clicks, CTR, positions, queries | Google Search Console |
| Index coverage & crawl errors | Google Search Console |
| Sessions, conversions, user paths | GA4 |
| Field Core Web Vitals | CrUX / PageSpeed Insights |
| Lab performance scores | PageSpeed Insights / Lighthouse |
| Crawl budget, bot behaviour | Server logs |
| Volume, difficulty, CPC, competitor keywords | SEMrush / Ahrefs |
| Backlinks, referring domains | Ahrefs / Majestic / SEMrush |
| Full-site crawl at scale | Screaming Frog / Sitebulb |
| Map visibility, reviews | Google Business Profile |
| Localised SERP positions | Geo-targeted rank tracker |

**Known tooling limitation:** web search runs US-based. For non-US markets this cannot confirm local SERP positions or brand visibility. Never treat an empty result as proof of non-indexation — record it as *Requires External Data* and resolve via Search Console.

---

## 13. 30/60/90 Roadmap Structure *(internal only)*

| Window | Theme | Contents |
|---|---|---|
| **1–30** | Foundations & Quick Wins | Critical technical blockers, indexing, metadata, headings, internal linking, tracking, baseline measurement |
| **31–60** | Surface & Relevance | New service/location pages, keyword-mapped content, topic clusters, schema, local SEO, content gaps |
| **61–90** | Authority & Compounding | Link building, digital PR, citations, content expansion, competitor gaps, iteration on early data |

Adjust to findings; state where the standard structure was varied and why. Never project traffic or ranking figures without baseline data.

---

## 14. Execution Order

1. Fetch headers, robots.txt, sitemaps; test redirects.
2. Download and parse homepage raw HTML.
3. Render in a real browser; diff rendered vs raw; capture console and resource waterfall.
4. Enumerate all content (sitemaps, CMS APIs, link crawl).
5. Probe error handling, archive/query surfaces, platform health.
6. Run on-page inspection across key pages.
7. Fetch 3–6 competitor sitemaps; count and compare structure.
8. Assess local, authority and UX layers; run the 24-criterion design review (§3.8).
9. Complete the check register.
10. Score all 9 categories; compute weighted overall.
11. Classify issues; derive Quick Wins and Strategic Opportunities.
12. Build action plan and 30/60/90.
13. **Write the internal file.**
14. **Roll up to 5 areas; apply disclosure rules; write the client one-pager.**
15. Verify the two documents agree on the score and contradict nowhere.

---

## 15. Scoring Worksheet

```
SITE:                             AUDIT DATE:
AUDITOR:                          CHECKS RUN:

INTERNAL                     RAW /100   WEIGHT   WEIGHTED
Technical SEO                   ___      0.20      ___
On-Page SEO                     ___      0.15      ___
Content & Topical Authority     ___      0.20      ___
Keyword & Search Opportunity    ___      0.15      ___
Google/SERP Visibility          ___      0.10      ___
Local SEO                       ___      0.05      ___
Authority & Off-Page SEO        ___      0.10      ___
SEO & UX Conversion             ___      0.05      ___
Design & Brand (=✅÷24)          ___      0.10      ___
                                        -------   -------
OVERALL                                   1.00      ___ /100   BAND: ______

CLIENT ROLL-UP               SCORE    STATUS
1. Google Visibility          ___     ____________
2. Website Content            ___     ____________
3. User Experience            ___     ____________
4. Technical Foundation       ___     ____________
5. Local Search               ___     ____________
6. Design & Brand            ___     ____________

REGISTER:  pass ___  fail ___  warn ___  n/a ___  not testable ___
ISSUES:    critical ___  high ___  medium ___  low ___
PIPELINE:  quick wins ___  strategic opportunities ___
EXTERNAL DATA GAPS: ______________________________________
DISCLOSURE CHECK: client doc contains no code, no named settings,
                  no page lists, no keyword tables, no roadmap  [ ]
```

---

## 16. Deliverable Design Standard

The client document goes out under our name. It must not look machine-generated. These are the tells to avoid, learned from rebuilding the MY.Z report:

**Never**
- Coloured accent rails down the left of cards
- Uniform bordered boxes for every block — use hairline rules and whitespace instead
- Monospace as decoration (labels, pills, headings); mono is for data and code only
- Tiny uppercase letterspaced micro-labels on every element — two per page maximum
- Traffic-light pills with wash backgrounds
- Oversized hero numbers inside bordered tiles
- Dark full-bleed hero bands with a bright accent underline
- Gradient or rounded-cap chart fills, donut charts, legends
- Heavy em-dash use in the copy — a well-known AI writing signature

**Always**
- Type-led hierarchy: size, weight and space, not borders and fills
- Serif headings with a sans body (Georgia + Segoe UI; both are system fonts, so no webfont CDN — which the Artifact CSP blocks anyway)
- A letterhead — firm name, date, rule, title — not a hero band
- Status as small-caps type in a muted semantic colour, not as a chip
- Flat bars, square ends, one muted fill, values labelled directly
- One accent colour, used sparingly; semantic colour on a handful of words only

### 16.1 Charts
Editorial-statistical, not dashboard. Three that earn their place on every audit:
1. **Health scale** — five bands, current band marked. Puts the score in context.
2. **Area score bars** — the six client areas. Communicates severity in seconds.
3. **The clearest gap** — one comparison chart carrying the single most persuasive fact found. For MY.Z that was pages-Google-can-find, 1 vs 70.

### 16.2 Producing the PDF
Write a separate print-optimised HTML (light palette only, A4, `@page { size: A4; margin: 13mm 19mm 11mm }`, `print-color-adjust: exact`, `break-inside: avoid` on rows), then:

```bash
chrome --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="Client-Website-Visibility-Check.pdf" "file:///path/to/print.html"
```

**Verify the page count before sending** — target 2 pages:
```bash
grep -a -o "/Count [0-9]*" output.pdf | head -1
```
Do not assume it fits. The first MY.Z render silently ran to 3 pages.

### 16.3 Length target
Client document: **400–650 words**. Visuals carry "how bad and where"; text carries "why it costs you". One sentence of business consequence per area, complete thoughts in the recommendations. Neither a wall of prose nor telegraphic fragments.

// DISCOVA design review — the 24 criteria of framework §3.8.
// 12 measured deterministically from the rendered DOM; 12 judged by Claude
// vision from a page screenshot + key images. No API key → returns null and
// Design stays pending; it never fakes a score.

const AREAS = {
  imagery: { label: "Imagery & Assets", ids: ["a1", "a2", "a3", "a4", "a5"] },
  typography: { label: "Typography", ids: ["b6", "b7", "b8", "b9"] },
  colour: { label: "Colour & Brand", ids: ["c10", "c11", "c12", "c13", "c14"] },
  hero: { label: "Hero Section", ids: ["d15", "d16", "d17", "d18", "d19"] },
  layout: { label: "Layout & Consistency", ids: ["e20", "e21", "e22", "e23", "e24"] },
};

const VISION_IDS = ["a1", "a2", "a4", "a5", "b8", "b9", "c12", "d16", "d18", "d19", "e20", "e22"];

// ---------- deterministic half ----------
function rgbToHue(str) {
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  const [r, g, b] = [+m[1] / 255, +m[2] / 255, +m[3] / 255];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (s < 0.15 || l > 0.92 || l < 0.08) return null; // neutral
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return Math.round(((h * 60) + 360) % 360);
}

export function deterministicCriteria(dom) {
  const c = {};
  const note = (met, good, bad) => ({ met, note: met === 1 ? good : bad });

  // a3 — fixed aspect ratios per component
  const ratios = new Set(
    (dom.imgs ?? [])
      .filter((i) => i.displayed[0] > 120 && i.displayed[1] > 60)
      .map((i) => (i.displayed[0] / i.displayed[1]).toFixed(1))
  );
  c.a3 = ratios.size <= 2 ? note(1, "Consistent image proportions across components")
    : ratios.size <= 3 ? { met: 0.5, note: "Image proportions vary between components" }
    : { met: 0, note: `${ratios.size} different image shapes on one page — no fixed ratios` };

  // b6 — max 2 typefaces
  const real = (dom.fonts ?? []).filter(([n, ct]) => ct > 10 && !/ui-|system|-apple|emoji/i.test(n));
  c.b6 = real.length <= 2 ? note(1, `Disciplined type: ${real.map(([n]) => n).join(" + ") || "system stack"}`)
    : real.length === 3 ? { met: 0.5, note: `Three typefaces in use (${real.map(([n]) => n).join(", ")})` }
    : { met: 0, note: `${real.length} typefaces in use, led by ${real[0]?.[0]}` };

  // b7 — no shouting, no strokes
  const caps = dom.capsButtons ?? 0, strokes = dom.strokes ?? 0;
  c.b7 = caps === 0 && strokes === 0 ? note(1, "No all-caps buttons or text strokes")
    : caps <= 2 && strokes === 0 ? { met: 0.5, note: `${caps} all-caps button(s)` }
    : { met: 0, note: `${caps} all-caps buttons${strokes ? `, ${strokes} text strokes` : ""} — the page shouts` };

  // c10 / c14 — one dominant recallable colour
  const hueUses = {};
  let colored = 0;
  for (const [col, ct] of dom.palette ?? []) {
    const h = rgbToHue(col);
    if (h === null) continue;
    const bucket = Math.round(h / 30) * 30;
    hueUses[bucket] = (hueUses[bucket] || 0) + ct;
    colored += ct;
  }
  const hueGroups = Object.entries(hueUses).sort((a, b) => b[1] - a[1]);
  // Adjacent hues (within 30°) are one colour family — navy+teal reads as one identity.
  let domShare = 0;
  for (const [bStr, ct] of hueGroups) {
    const b = +bStr;
    const family = ct
      + (hueUses[(b + 30) % 360] ?? 0)
      + (hueUses[(b - 30 + 360) % 360] ?? 0);
    domShare = Math.max(domShare, colored ? family / colored : 0);
  }
  c.c10 = domShare >= 0.45 ? note(1, "One clearly dominant brand colour")
    : domShare >= 0.25 ? { met: 0.5, note: "A leading colour exists but does not dominate" }
    : { met: 0, note: "No colour leads — nothing for a visitor to remember" };
  c.c14 = { met: c.c10.met, note: c.c10.met === 1 ? "The dominant colour is memorable after one visit" : "No single colour would be recalled after a visit" };

  // c11 — palette restraint (+ no emoji as design elements)
  const groups = hueGroups.length, emoji = dom.emoji ?? 0;
  c.c11 = groups <= 3 && emoji < 3 ? note(1, `Palette held to ${groups} hue group(s)`)
    : groups <= 4 && emoji < 6 ? { met: 0.5, note: `${groups} hue groups${emoji >= 3 ? `, ${emoji} emoji in copy` : ""}` }
    : { met: 0, note: `${groups} hue groups${emoji >= 3 ? ` and ${emoji} emoji used decoratively` : ""} — no palette system` };

  // c13 — consistent buttons
  const btnVar = dom.btnClassVariants ?? 0;
  c.c13 = btnVar <= 3 ? note(1, "One consistent button treatment")
    : btnVar <= 5 ? { met: 0.5, note: `${btnVar} button style variants` }
    : { met: 0, note: `${btnVar} different button styles across the page` };

  // d15 — static hero
  c.d15 = (dom.sliders ?? 0) === 0 ? note(1, "A single static hero, no rotating slider")
    : { met: 0, note: `${dom.sliders} rotating carousel(s) — most visitors never see the later slides` };

  // d17 — one headline + one clear CTA
  const oneH1 = (dom.h1Count ?? 0) === 1, ctas = dom.heroCtaCount ?? 0;
  c.d17 = oneH1 && ctas > 0 && ctas <= 2 ? note(1, "One headline with a clear call to action")
    : oneH1 ? { met: 0.5, note: `One headline but ${ctas || "no"} CTA button(s) in the opening screen` }
    : { met: 0, note: `${dom.h1Count ?? 0} main headings and ${ctas} buttons compete in the opening screen` };

  // e21 — component reuse
  const cardVar = dom.cardClassVariants ?? 0;
  c.e21 = cardVar <= 2 && btnVar <= 3 ? note(1, "Card and button components reused consistently")
    : cardVar <= 4 && btnVar <= 5 ? { met: 0.5, note: "Components broadly similar but not uniform" }
    : { met: 0, note: `${cardVar} card variants and ${btnVar} button variants — no component system` };

  // e23 — naming/language consistency, no raw URLs, no dead links
  const viol =
    (dom.deadLinksReal > 0 ? 1 : 0) +
    ((dom.rawUrlTextCount ?? 0) > 0 ? 1 : 0) +
    (Math.min(dom.langMix?.malay ?? 0, dom.langMix?.english ?? 0) > 15 ? 1 : 0);
  c.e23 = viol === 0 ? note(1, "Naming, language and links are consistent")
    : viol === 1 ? { met: 0.5, note: "One consistency slip (dead link, raw URL shown, or mixed language)" }
    : { met: 0, note: "Dead links, raw URLs or mixed language undercut the finish" };

  // e24 — animated elements actually render
  c.e24 = (dom.stuckCounters ?? 0) === 0 ? note(1, "No animated elements stuck at zero")
    : { met: 0, note: `${dom.stuckCounters} counter(s) showing "0" after load` };

  // a5 deterministic half — broken images feed into the vision-judged a5
  c._a5_broken = dom.imgStats?.broken ?? 0;

  return c;
}

// ---------- vision half ----------
const VISION_PROMPT = `You are the design reviewer inside DISCOVA, a website audit engine. You are shown (1) a screenshot of the top of a web page, and (2) up to three key images from that page, each labelled with its alt text. Assess ONLY the following criteria, strictly.

Score each: 1 (clearly met), 0.5 (partially), 0 (not met).

a1_sharp: photos look sharp and professional, not phone-compressed documentation shots. If there are no real photographs at all, score 0.
a2_people: hero/banner imagery features real people relevant to the business. Logos, mascots and product cutouts score 0.
a4_match: each supplied image plausibly matches its stated alt text/label.
a5_clean: no text baked into image pixels (bands of caption text inside the image itself); professional composition.
b8_hierarchy: one clear reading order; only ONE loud element per screen — competing banners/badges/countdowns score 0.
b9_personality: the typography's character fits the business named in the page (judgment — say why in the note).
c12_story: the colour palette feels intentional and connected to what the business sells (judgment).
d16_cinematic: the opening screen carries one strong image of the business at its best, ideally with a person.
d18_readable: text over imagery stays readable via gradient/scrim, not outlines or harsh shadows.
d19_calm: generous whitespace; nothing screaming above or around the hero (marquees, countdown timers, badge clutter score 0).
e20_flow: the visible section order follows buyer logic: promise → proof/services → offer → action (headings list provided).
e22_weight: the most visually prominent elements are the genuinely important ones (offer, proof), not gimmicks.

Respond with ONLY a JSON object, no prose:
{"a1_sharp":{"met":0,"note":"..."},"a2_people":{...},"a4_match":{...},"a5_clean":{...},"b8_hierarchy":{...},"b9_personality":{...},"c12_story":{...},"d16_cinematic":{...},"d18_readable":{...},"d19_calm":{...},"e20_flow":{...},"e22_weight":{...}}
Notes: one short sentence each, plain English, client-tone (describe the page, never the maker).`;

async function callVision(dom, context) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !dom.screenshotB64) return null;

  const content = [
    { type: "text", text: `Business context: ${context}` },
    { type: "text", text: "Screenshot of the top of the page:" },
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: dom.screenshotB64 } },
  ];
  for (const img of (dom.keyImages ?? []).slice(0, 3)) {
    content.push({ type: "text", text: `Key image (alt: "${img.alt || "none"}")` });
    content.push({ type: "image", source: { type: "base64", media_type: img.media, data: img.b64 } });
  }
  content.push({ type: "text", text: VISION_PROMPT });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: AbortSignal.timeout(90000),
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 1500,
          messages: [{ role: "user", content }],
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      const text = data.content?.map((b) => b.text ?? "").join("") ?? "";
      const json = text.match(/\{[\s\S]*\}/)?.[0];
      if (!json) throw new Error("no JSON in response");
      return JSON.parse(json);
    } catch (e) {
      if (attempt === 1) {
        console.error("[discova-worker] vision failed:", e.message);
        return null;
      }
    }
  }
  return null;
}

const KEYMAP = {
  a1: "a1_sharp", a2: "a2_people", a4: "a4_match", a5: "a5_clean",
  b8: "b8_hierarchy", b9: "b9_personality", c12: "c12_story",
  d16: "d16_cinematic", d18: "d18_readable", d19: "d19_calm",
  e20: "e20_flow", e22: "e22_weight",
};

export async function designReview(dom, businessContext) {
  const det = deterministicCriteria(dom);
  const vis = await callVision(dom, businessContext);
  if (!vis) return null; // design stays pending — never a partial fake

  const all = {};
  for (const [id, v] of Object.entries(det)) if (!id.startsWith("_")) all[id] = v;
  for (const [short, long] of Object.entries(KEYMAP)) {
    const v = vis[long];
    all[short] = v && typeof v.met === "number"
      ? { met: Math.max(0, Math.min(1, v.met)), note: String(v.note ?? "").slice(0, 160), judged: true }
      : { met: 0.5, note: "Could not be assessed this run", judged: true };
  }
  // a5: broken images cap the vision score
  if ((det._a5_broken ?? 0) > 0 && all.a5) {
    all.a5 = { met: 0, note: `${det._a5_broken} image(s) fail to load`, judged: true };
  }

  const subscores = [];
  let points = 0;
  for (const area of Object.values(AREAS)) {
    let p = 0;
    let worst = null;
    for (const id of area.ids) {
      const cr = all[id];
      p += cr?.met ?? 0;
      if (!worst || (cr?.met ?? 1) < (worst.met ?? 1)) worst = cr;
    }
    points += p;
    subscores.push({
      area: area.label,
      points: Math.round(p * 2) / 2,
      max: area.ids.length,
      note: worst?.note ?? "",
    });
  }

  return {
    subscores,
    points: Math.round(points * 2) / 2,
    max: 24,
    score: Math.round((points / 24) * 100),
    criteria: all,
  };
}

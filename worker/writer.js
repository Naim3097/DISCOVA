// DISCOVA writer layer — site-specific client prose for the Visibility Check.
// Disclosure enforced structurally: the writer never receives internal_detail
// or raw evidence, and its output is scanned for technical vocabulary.
// Any failure falls back to the deterministic phrases; a run never blocks on prose.

const BANNED = [
  "robots.txt", "robots file", "sitemap", "canonical", "meta description", "meta tag",
  "schema", "json-ld", "structured data", "hreflang", "301", "redirect rule",
  "wordpress", "yoast", "rank math", "plugin", "api", "dns", "cdn", "javascript",
  "css", "alt text", "open graph", "og:", "ttfb", "cache-control", "h1", "lazy load",
];

export function disclosureViolations(text) {
  const t = (text ?? "").toLowerCase();
  return BANNED.filter((word) => {
    const esc = word.replace(/\./g, "\\$&");
    return new RegExp("(^|[^a-z0-9])" + esc + "([^a-z0-9]|$)").test(t);
  });
}

const HOUSE_STYLE = `You write the client-facing prose for lean.X digital's Website Visibility Check. Voice: a senior consultant reporting to a business owner. Plain English, British spelling, calm and direct. Lead with what is genuinely working before what is not. Name the business consequence, never the mechanism.

HARD RULES:
- The disclosure test: if a competent developer could act on a sentence without hiring us, it is forbidden. Never name technologies, files, settings, tags, or step-by-step fixes. Describe symptoms and costs only.
- Never invent numbers, claims, or capabilities. Use only the facts provided.
- No em dashes. Use full stops and commas. No exclamation marks. No emoji.
- Do not flatter and do not catastrophise. A weak site is described honestly with its real strengths acknowledged.`;

function buildPrompt(data) {
  return `${HOUSE_STYLE}

THE RUN:
Domain: ${data.domain}
Overall: ${data.overall}/100, band: ${data.band}
Areas: ${data.areas.map((a) => `${a.label} ${a.score} (${a.status})`).join(" · ")}
Strengths (verified): ${data.strengths.join(" | ") || "none recorded"}
Findings (client-safe): ${data.findings
    .map((f) => `[${f.severity}/${f.category}] ${f.title}: ${f.client_summary}`)
    .join("\n")}
${data.design ? `Design review ${data.design.points}/24: ${data.design.subscores.map((s) => `${s.area} ${s.points}/${s.max} (${s.note})`).join(" · ")}` : "Design review pending."}
Clearest-gap candidates (verified numbers, choose AT MOST one, never alter the numbers, or return null if none is persuasive):
${data.gapCandidates.length ? data.gapCandidates.map((g, i) => `${i}: ${g.label_a} = ${g.value_a} vs ${g.label_b} = ${g.value_b}`).join("\n") : "none"}

Write JSON ONLY, exactly this shape:
{
  "lead": "One sentence, max 26 words. The verdict: the single truest tension of this site, e.g. strengths against what limits it.",
  "sub": "One supporting sentence, max 24 words.",
  "area_notes": { ${data.areas.map((a) => `"${a.key}": "one sentence of business consequence for ${a.label}, max 18 words"`).join(", ")} },
  "gap_index": ${data.gapCandidates.length ? "0-based index of the chosen candidate, or null" : "null"},
  "gap_note": "if gap chosen: one or two sentences explaining why that gap costs them, max 40 words; else null",
  "closing_strong": "Opening clause of the close in bold, max 8 words. Write a fresh verdict specific to this site; never reuse a stock phrase.",
  "closing_rest": "Two sentences completing the close: what is salvageable and what is at stake. Max 55 words.",
  "next_step": "One sentence recommending the engagement, starting with the offer not the problem. Max 30 words."
}`;
}

async function callWriter(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(60000),
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`writer API ${res.status}`);
  const data = await res.json();
  const text = data.content?.map((b) => b.text ?? "").join("") ?? "";
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error(`writer returned no JSON (stop: ${data.stop_reason}, blocks: ${(data.content ?? []).map((b) => b.type).join("+") || "none"})`);
  return JSON.parse(json);
}

export async function writeNarrative(data) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  let prompt = buildPrompt(data);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await callWriter(prompt);
      const flat = [
        out.lead, out.sub, out.gap_note, out.closing_strong, out.closing_rest, out.next_step,
        ...Object.values(out.area_notes ?? {}),
      ].join(" ");
      const viol = disclosureViolations(flat);
      if (viol.length === 0) return out;
      if (attempt === 0) {
        prompt += `\n\nYour previous draft failed the disclosure test by using: ${viol.join(", ")}. Rewrite without any technical vocabulary at all.`;
        continue;
      }
      console.error("[discova-worker] writer failed disclosure twice:", viol.join(", "));
      return { __error: "disclosure: " + viol.join(",") };
    } catch (e) {
      if (attempt === 1) {
        console.error("[discova-worker] writer unavailable:", e.message);
        return { __error: e.message };
      }
    }
  }
  return null;
}

// Deterministic, verified gap candidates — the writer chooses and phrases, never invents.
export function gapCandidates(ctx) {
  const out = [];
  const dom = ctx.dom ?? {}, probes = ctx.probes ?? {};
  const { total = 0, noAlt = 0 } = dom.imgStats ?? {};

  if (total >= 8 && noAlt / total > 0.5)
    out.push({
      label_a: "Pictures on the website", value_a: total, sub_a: "what visitors see",
      label_b: "Described so Google can find them", value_b: total - noAlt, sub_b: "the rest are invisible to search",
    });
  if ((dom.words ?? 0) < 150 && total >= 6)
    out.push({
      label_a: "Pictures on the homepage", value_a: total, sub_a: "images and banners",
      label_b: "Words on the homepage", value_b: dom.words, sub_b: "everything a visitor can read",
    });
  if ((probes.sitemap?.count ?? 0) >= 10 && !dom.metaDesc)
    out.push({
      label_a: "Pages built on the website", value_a: probes.sitemap.count, sub_a: "real work already done",
      label_b: "Pages that introduce themselves to Google", value_b: 0, sub_b: "search snippets left to chance",
    });
  return out.slice(0, 3);
}

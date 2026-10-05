// Per-run usage meter. The queue processes one run at a time, so a module
// accumulator reset at run start is accurate. Prices are constants to update
// when plans change; search cost is the PAID serper rate - while free credits
// last, real cash spend on search is zero.

export const usage = { anthropic_in: 0, anthropic_out: 0, searches: 0 };

export function resetUsage() {
  usage.anthropic_in = 0;
  usage.anthropic_out = 0;
  usage.searches = 0;
}

const PRICE = {
  anthropic_in_per_m: 3,   // claude-sonnet input USD per 1M tokens
  anthropic_out_per_m: 15, // claude-sonnet output USD per 1M tokens
  search_each: 0.001,      // serper paid tier: $50 / 50k queries
};

export function runCost() {
  const anthropic_usd = usage.anthropic_in / 1e6 * PRICE.anthropic_in_per_m
    + usage.anthropic_out / 1e6 * PRICE.anthropic_out_per_m;
  const search_usd = usage.searches * PRICE.search_each;
  return {
    anthropic_tokens: { input: usage.anthropic_in, output: usage.anthropic_out },
    searches: usage.searches,
    anthropic_usd: +anthropic_usd.toFixed(4),
    search_usd_at_paid_rate: +search_usd.toFixed(4),
    total_usd: +(anthropic_usd + search_usd).toFixed(4),
  };
}

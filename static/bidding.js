/* Money display and bid steps, shared by every screen that shows a price or
   moves a bid: the admin console, the stage, the phone remote, the live view,
   team portals and the report.

   Amounts are stored in lakhs everywhere (1 = ₹1L = ₹100K). The server keeps
   the same rules in app.py (pricing_rule / pricing_step_at); keep them in step.

   Pricing config (config key "pricing", JSON):
     { mode: 'same' | 'category',
       same:       { base, increment, steps: [{ from, increment }] },
       categories: { "<category>": { base, increment, steps: [...] } } }
   A step applies once the current bid reaches its `from` amount:
   { increment: 0.5, steps: [{ from: 10, increment: 1 }] } bids +50K up to 10L,
   then +1L from 10L onward. */
(function (root) {
  'use strict';

  const num = (v, d) => { const n = parseFloat(v); return isNaN(n) ? d : n; };
  // Amounts are kept to the nearest ₹1K, so float sums never show 0.30000004.
  const round = v => Math.round(v * 100) / 100;

  /* ₹50K below one lakh, ₹1.5L from one lakh up. */
  function fmtL(v) {
    if (v == null || v === '' || isNaN(Number(v))) return '₹ --';
    const n = Number(v);
    if (n !== 0 && Math.abs(n) < 1) return '₹' + (Math.round(n * 1000) / 10) + 'K';
    return '₹' + round(n) + 'L';
  }

  function cleanRule(r, fallback) {
    r = r || {};
    const steps = (Array.isArray(r.steps) ? r.steps : [])
      .map(s => ({ from: num(s && s.from, NaN), increment: num(s && s.increment, NaN) }))
      .filter(s => s.from > 0 && s.increment > 0)
      .sort((a, b) => a.from - b.from);
    return {
      base: Math.max(0, num(r.base, fallback.base)),
      increment: num(r.increment, 0) > 0 ? num(r.increment, 0) : fallback.increment,
      steps: steps,
    };
  }

  /* The auction's pricing from its config. Auctions set up before per-category
     pricing fall back to their single base price and increment. */
  function parse(config) {
    config = config || {};
    let p = config.pricing;
    if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = null; } }
    p = p || {};
    const legacy = { base: num(config.common_base_price, 10), increment: num(config.bid_increment, 2.5) || 2.5 };
    const same = cleanRule(p.same, legacy);
    const categories = {};
    Object.keys(p.categories || {}).forEach(k => { categories[k] = cleanRule(p.categories[k], same); });
    return { mode: p.mode === 'category' ? 'category' : 'same', same: same, categories: categories };
  }

  /* The rule a player of this category is auctioned under. */
  function ruleFor(pricing, category) {
    if (pricing && pricing.mode === 'category' && category && pricing.categories[category]) return pricing.categories[category];
    return (pricing && pricing.same) || { base: 0, increment: 2.5, steps: [] };
  }

  /* The increment used to raise a bid that currently stands at `bid`. */
  function stepAt(rule, bid) {
    let inc = rule.increment;
    rule.steps.forEach(s => { if (bid >= s.from - 1e-9) inc = s.increment; });
    return inc;
  }

  /* The increment that led to `bid` — what one step down removes. */
  function stepBelow(rule, bid) {
    let inc = rule.increment;
    rule.steps.forEach(s => { if (bid > s.from + 1e-9) inc = s.increment; });
    return inc;
  }

  function up(rule, bid, times) {
    let b = num(bid, 0);
    for (let i = 0; i < (times || 1); i++) b = round(b + stepAt(rule, b));
    return b;
  }

  function down(rule, bid) {
    const b = num(bid, 0);
    return Math.max(0, round(b - stepBelow(rule, b)));
  }

  root.fmtL = fmtL;
  root.BidRules = { parse: parse, ruleFor: ruleFor, stepAt: stepAt, up: up, down: down, round: round };
})(typeof window !== 'undefined' ? window : this);

/* Category-wise draws, shared by the stage's admin bar (auction_display.js)
   and the dashboard console (app.jsx).

   The admin chooses the category a Spin Draw or Random Draw takes players
   from. Once that category has no unsold player left, draws move on to the
   next category that still has some, in the order of the category rules
   (the order setup created them), then any category without a rule; past
   the last one they wrap round to the first, for players passed and put
   back. An empty choice draws from every unsold player, as before.

   The choice is kept in auction_state as "draw_category", so a reload and
   both consoles draw from the same category. */
(function (root) {
  'use strict';

  const unsold = players => (players || []).filter(p => p.status === 'unsold');

  /* Categories in draw order, each with how many unsold players it has left. */
  function categories(players, rules) {
    const left = {};
    unsold(players).forEach(p => {
      if (p.category) left[p.category] = (left[p.category] || 0) + 1;
    });
    const order = [];
    (rules || []).forEach(r => { if (r.category && !order.includes(r.category)) order.push(r.category); });
    Object.keys(left).forEach(c => { if (!order.includes(c)) order.push(c); });
    return order.map(c => ({ name: c, left: left[c] || 0 }));
  }

  /* The players a draw picks from, as { category, players }. `category` is
     the category actually used: the chosen one while it has players left,
     otherwise the next one that does. '' means every unsold player. */
  function pool(players, rules, chosen) {
    const all = unsold(players);
    if (!chosen) return { category: '', players: all };
    const cats = categories(players, rules);
    const start = Math.max(0, cats.findIndex(c => c.name === chosen));
    for (let i = 0; i < cats.length; i++) {
      const c = cats[(start + i) % cats.length];
      if (c.left) return { category: c.name, players: all.filter(p => p.category === c.name) };
    }
    // Only players without a category are left: draw from them.
    return { category: '', players: all };
  }

  /* Label for a category choice: "Diamond · 12 left", "Diamond · done". */
  function label(cat) {
    return cat.name + (cat.left ? ' · ' + cat.left + ' left' : ' · done');
  }

  root.DrawOrder = { categories, pool, label };
})(typeof window !== 'undefined' ? window : this);

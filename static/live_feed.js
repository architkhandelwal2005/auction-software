/* The live screens' data, downloading only what changed.

   /api/live_data carries everything a screen shows: teams, rosters, sold and
   unsold lists, stats. Most of it changes only when a player is sold, passed
   or put on the block, while the stage state (the bid, the leader) changes
   on every bid. So a screen polls /api/live_state, a few hundred bytes with a
   revision of the rest, and downloads the full data again only when that
   revision moves.

   LiveFeed.get() resolves to the same object /api/live_data returns, a fresh
   copy for each call (callers may change it). LiveFeed.timerLeft(state) is
   the bid timer's seconds left, by the server's clock. */
window.LiveFeed = (function () {
  let fullText = null;   // the last /api/live_data body
  let fullRev = null;    // its revision (X-Live-Rev)
  let fullLoad = null;   // that download, while it is on its way
  const offsets = [];    // the server's clock less this one's, recent samples

  async function getOK(url) {
    // "no-cache": the browser asks every time, and an unchanged answer comes
    // back as a bodyless 304 for the copy it already has.
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r;
  }

  function download() {
    // Calls that need the full data at the same time share one download.
    if (!fullLoad) {
      fullLoad = getOK('/api/live_data')
        .then(async r => { fullText = await r.text(); fullRev = r.headers.get('X-Live-Rev'); })
        .finally(() => { fullLoad = null; });
    }
    return fullLoad;
  }

  // The server's clock (X-Now, in milliseconds), whatever this device's own
  // clock says. Averaged over recent answers, since each arrives a little
  // after it was sent.
  function learnClock(r) {
    const server = Number(r.headers.get('X-Now'));
    if (!server) return;
    offsets.push(server - Date.now());
    if (offsets.length > 20) offsets.shift();
  }
  function now() {
    return Date.now() + (offsets.length ? offsets.reduce((a, b) => a + b, 0) / offsets.length : 0);
  }
  function timerLeft(state) {
    const ends = Number((state || {}).timer_ends_at);
    return ends ? Math.max(0, (ends - now()) / 1000) : null;
  }

  async function get() {
    const r = await getOK('/api/live_state');
    learnClock(r);
    const live = await r.json();
    if (live.rev !== fullRev && fullLoad) await fullLoad.catch(() => {});   // it may be this revision
    if (live.rev !== fullRev) await download();
    const data = JSON.parse(fullText);
    // A newer revision was downloaded after the state was asked for, so it
    // keeps its own state, which is newer too.
    if (live.rev === fullRev) data.auction_state = live.auction_state;
    return data;
  }

  return { get, timerLeft };
})();

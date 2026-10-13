/* Keeps a page to the auction it was opened for.

   The auction a browser works on is kept in its session, which all its tabs
   share. Opening another auction in a second tab would quietly move the first
   tab too: its next sale or bid would land in the other auction. So every
   request from this page names its auction (X-Auction-Id). The server refuses
   one that no longer matches (409 auction_switched) without changing
   anything, and the page reloads onto the auction now open.

   The auction comes from the page itself (data-auction on this script tag),
   or, on a page that can switch auctions, from the first answer naming one.
   Opening or creating an auction from this page switches it on purpose, so
   it then learns the new one. */
(function () {
  const script = document.currentScript;
  let pinned = (script && script.dataset.auction) || '';
  let reloading = false;
  const plain = window.fetch.bind(window);

  function apiPath(input) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    return url.origin === location.origin && url.pathname.startsWith('/api/') ? url.pathname : null;
  }

  window.fetch = async function (input, init) {
    const path = apiPath(input);
    if (!path) return plain(input, init);
    const opts = Object.assign({}, init);
    if (pinned) {
      const headers = new Headers(opts.headers || (input instanceof Request ? input.headers : undefined));
      headers.set('X-Auction-Id', pinned);
      opts.headers = headers;
    }
    const res = await plain(input, opts);

    if (res.status === 409 && !reloading) {
      const body = await res.clone().json().catch(() => ({}));
      if (body.error === 'auction_switched') {
        reloading = true;
        if (body.notify) alert(body.message);
        location.reload();
        return res;
      }
    }
    if (path.startsWith('/api/auctions') && opts.method && opts.method.toUpperCase() !== 'GET') {
      pinned = '';   // this page opened, created or deleted an auction itself
    } else if (!pinned && res.ok) {
      pinned = res.headers.get('X-Auction-Id') || '';
    }
    return res;
  };
})();

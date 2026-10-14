/* The installed app's service worker. Nothing is cached: an auction is live
   data, and an old copy of a screen would show old bids. It only answers a
   page opened with no connection, with a note instead of the browser's own
   error page. Served from /sw.js so it covers every page. */
const OFFLINE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>No connection</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0d12;
color:#f1f5f9;font-family:system-ui,sans-serif;text-align:center;padding:24px}
h1{font-size:22px;margin:0 0 8px}p{color:#94a3b8;margin:0 0 20px}
button{background:#f5b72e;color:#111;border:0;border-radius:12px;padding:12px 20px;font-weight:800;font-size:15px}</style>
</head><body><div><h1>No connection</h1><p>The auction needs the internet. Check your connection.</p>
<button onclick="location.reload()">Try again</button></div></body></html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;   // everything else goes straight to the network
  event.respondWith(fetch(event.request).catch(() =>
    new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});

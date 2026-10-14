/* The app, installable to a phone's home screen: registers the service
   worker, and shows any element marked data-install-app while the browser
   offers to install (Android, desktop Chrome and Edge); a click installs.
   iPhones install from Safari's Share menu instead, so there an element
   marked data-install-ios is shown. Shown by a class on <html>, so buttons a
   screen draws later show too. */
(function () {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* the app still works as a website */ });
  }
  const style = document.createElement('style');
  style.textContent = '[data-install-app],[data-install-ios]{display:none!important}' +
    'html.can-install [data-install-app]{display:inline-flex!important}' +
    'html.ios-install [data-install-ios]{display:block!important}';
  document.head.appendChild(style);

  const root = document.documentElement;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return;   // already installed
  let offer = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    offer = e;
    root.classList.add('can-install');
  });
  window.addEventListener('appinstalled', () => root.classList.remove('can-install'));
  document.addEventListener('click', async e => {
    if (!e.target.closest('[data-install-app]') || !offer) return;
    offer.prompt();
    await offer.userChoice.catch(() => null);
    offer = null;
    root.classList.remove('can-install');
  });
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua)) {
    root.classList.add('ios-install');
  }
})();

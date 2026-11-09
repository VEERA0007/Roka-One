/* GenSolar Pro web update manager. New deployments activate a versioned cache and offer a safe reload. */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  var hadController = !!navigator.serviceWorker.controller;
  var prompted = false;

  function showUpdate() {
    if (prompted || !document.body) return;
    prompted = true;
    var bar = document.createElement('div');
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'position:fixed;z-index:99999;left:12px;right:12px;bottom:18px;max-width:560px;margin:auto;padding:14px 16px;border-radius:14px;background:#064e3b;color:#fff;box-shadow:0 8px 28px #0004;display:flex;align-items:center;gap:12px;font:600 14px system-ui';
    var label = document.createElement('span');
    label.textContent = 'A new GenSolar Pro update is ready.';
    label.style.flex = '1';
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Refresh';
    button.style.cssText = 'border:0;border-radius:9px;padding:9px 14px;background:#f5c800;color:#10261f;font-weight:700';
    button.addEventListener('click', function () { location.reload(); });
    bar.appendChild(label);
    bar.appendChild(button);
    document.body.appendChild(bar);
  }

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    /* no update prompt on the website: the new version is used the next time the app opens */
    hadController = true;
  });

  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(function (registration) {
    registration.update().catch(function () {});
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') registration.update().catch(function () {});
    });
    window.addEventListener('online', function () { registration.update().catch(function () {}); });
  }).catch(function (error) {
    console.warn('GenSolar update check unavailable', error);
  });
})();

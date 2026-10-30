// Shelf interactions: open a panel per object, wiggle the plant, lamp toggles night mode.
(function () {
  var root = document.documentElement;

  // Open panels (also used by the 3D room in js/room.js)
  function openPanel(name) {
    var dlg = document.getElementById('panel-' + name);
    if (!dlg || dlg.open) return;
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
    history.replaceState(null, '', '#' + name);
  }
  window.openPanel = openPanel;
  document.querySelectorAll('[data-panel]').forEach(function (btn) {
    btn.addEventListener('click', function () { openPanel(btn.dataset.panel); });
  });

  // 2D shelf <-> 3D room
  document.querySelectorAll('[data-view-toggle]').forEach(function (toggle) {
    toggle.addEventListener('click', function () {
      var to3d = !document.body.classList.contains('mode-3d');
      document.body.classList.toggle('mode-3d', to3d);
      try { localStorage.setItem('vaw-view', to3d ? '3d' : '2d'); } catch (e) {}
      window.dispatchEvent(new Event('resize'));
    });
  });

  // 3D overlay: menu drawer, hints, quick links
  var menu = document.getElementById('menuPanel');
  var menuBtn = document.getElementById('menu3d');
  function setMenu(open) {
    if (!menu) return;
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) menu.querySelector('button').focus();
  }
  if (menuBtn) menuBtn.addEventListener('click', function () { setMenu(menu.hidden); });
  var menuClose = document.querySelector('.menu3d-close');
  if (menuClose) menuClose.addEventListener('click', function () { setMenu(false); menuBtn.focus(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu && !menu.hidden) setMenu(false); });
  document.querySelectorAll('[data-open]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setMenu(false);
      if (window.room3dOpen && document.body.classList.contains('mode-3d')) window.room3dOpen(btn.dataset.open);
      else openPanel(btn.dataset.open);
    });
  });
  var hintsBtn = document.getElementById('hints3d');
  if (hintsBtn) hintsBtn.addEventListener('click', function () {
    var on = hintsBtn.getAttribute('aria-pressed') !== 'true';
    hintsBtn.setAttribute('aria-pressed', String(on));
    window.dispatchEvent(new CustomEvent('vaw:hints', { detail: on }));
  });

  // Close panels (close button, backdrop click, Esc)
  function closePanel(dlg) {
    dlg.classList.add('closing');
    setTimeout(function () {
      dlg.classList.remove('closing');
      dlg.close ? dlg.close() : dlg.removeAttribute('open');
    }, 180);
  }
  document.querySelectorAll('.panel').forEach(function (dlg) {
    dlg.querySelector('.close').addEventListener('click', function () { closePanel(dlg); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) closePanel(dlg); });
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); closePanel(dlg); });
    dlg.addEventListener('close', function () { history.replaceState(null, '', location.pathname); });
  });

  // Deep link: visualartworld.com/#about opens that panel
  var hash = location.hash.slice(1);
  var initial = hash && document.querySelector('.item[data-panel="' + hash + '"]');
  if (initial) initial.click();

  // Plant
  document.querySelectorAll('[data-action="wiggle"]').forEach(function (el) {
    el.addEventListener('click', function () {
      el.classList.remove('wiggle');
      void el.offsetWidth;
      el.classList.add('wiggle');
    });
  });

  // Lamp: day / night, remembered per visitor
  var lamp = document.getElementById('lamp');
  function setTheme(night) {
    if (night) root.setAttribute('data-theme', 'night');
    else root.removeAttribute('data-theme');
    lamp.setAttribute('aria-pressed', String(night));
    try { localStorage.setItem('vaw-theme', night ? 'night' : 'day'); } catch (e) {}
  }
  var saved = null;
  try { saved = localStorage.getItem('vaw-theme'); } catch (e) {}
  setTheme(saved === 'night');
  lamp.addEventListener('click', function () { setTheme(root.getAttribute('data-theme') !== 'night'); });

  // Until a photo is uploaded, show a labelled placeholder naming the file to add
  document.querySelectorAll('.panel img').forEach(function (img) {
    img.addEventListener('error', function onErr() {
      // first try the copy still hosted on the old Webflow site, if one is listed
      var fb = img.getAttribute('data-fallback');
      if (fb && img.getAttribute('src') !== fb) { img.setAttribute('data-local', img.getAttribute('src')); img.src = fb; return; }
      img.removeEventListener('error', onErr);
      var name = (img.getAttribute('data-local') || img.getAttribute('src') || '').split('/').pop();
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">' +
        '<rect width="300" height="300" fill="#efe3cf"/>' +
        '<text x="150" y="140" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#8a5a33">add photo</text>' +
        '<text x="150" y="168" text-anchor="middle" font-family="monospace" font-size="16" fill="#8a5a33">images/' + name + '</text></svg>';
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  });

  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();

// Admin for visualartworld.com: edit [data-editable] sections, read contact messages, manage photos.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var LABELS = {
    'intro-title': 'Welcome title', 'intro-lede': 'Welcome text', about: 'About me', painting: 'Painting', photo: 'Photography',
    film: 'Filmmaking', dj: 'Music & DJ', animation: 'Animation', coding: 'Web & games', inventions: 'Inventions',
    security: 'Ethical hacking', impact: 'Awards & impact', mentors: 'Mentors', wookie: 'Wookie', contact: 'Contact',
  };
  var PLAIN = { 'intro-title': true, 'intro-lede': true }; // edited as plain text, not rich content

  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ 'x-vaw': '1' }, opts.headers || {});
    if (opts.json !== undefined) { headers['content-type'] = 'application/json'; opts.body = JSON.stringify(opts.json); }
    return fetch(path, { method: opts.method || 'GET', headers: headers, body: opts.body, credentials: 'same-origin' }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) {
        if (r.status === 401 && path !== '/api/login') { showLogin(); }
        if (!r.ok) throw new Error(b.error || 'Request failed (' + r.status + ')');
        return b;
      });
    });
  }
  function toast(t) { var el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, 2600); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ---------- sign in ----------
  function showLogin(note) { $('app').hidden = true; $('login').hidden = false; if (note) $('loginNote').textContent = note; $('password').focus(); }
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    $('loginErr').textContent = '';
    api('/api/login', { method: 'POST', json: { password: $('password').value } })
      .then(function () { $('password').value = ''; start(); })
      .catch(function (err) { $('loginErr').textContent = err.message; });
  });
  $('logout').addEventListener('click', function () { api('/api/logout', { method: 'POST' }).then(function () { location.reload(); }); });

  // ---------- tabs ----------
  document.querySelectorAll('[data-tab]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('[data-tab]').forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      document.querySelectorAll('[data-panel]').forEach(function (p) { p.hidden = p.dataset.panel !== b.dataset.tab; });
      if (b.dataset.tab === 'inbox') loadInbox();
      if (b.dataset.tab === 'photos') loadPhotos();
    });
  });

  // ---------- content ----------
  var originals = {}, edits = {}, order = [], current = null, dirty = false, codeMode = false;
  var frame = $('canvas');

  function loadContent() {
    return Promise.all([
      fetch('/', { cache: 'no-store' }).then(function (r) { return r.text(); }),
      api('/api/content/all'),
    ]).then(function (res) {
      var doc = new DOMParser().parseFromString(res[0], 'text/html');
      order = []; originals = {};
      doc.querySelectorAll('[data-editable]').forEach(function (el) {
        var k = el.getAttribute('data-editable');
        if (originals[k] !== undefined) return;
        order.push(k);
        originals[k] = PLAIN[k] ? el.textContent.trim() : el.innerHTML.trim();
      });
      edits = {};
      Object.keys(res[1]).forEach(function (k) { edits[k] = res[1][k].html; });
      renderSections();
      if (!current && order.length) select(order[0]);
    });
  }
  function renderSections() {
    $('sections').innerHTML = order.map(function (k) {
      return '<button type="button" data-key="' + k + '"' + (k === current ? ' aria-current="true"' : '') + '><span>' + esc(LABELS[k] || k) + '</span>' +
        (edits[k] !== undefined ? '<span class="tag">edited</span>' : '') + '</button>';
    }).join('');
    $('sections').querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { select(b.dataset.key); }); });
  }
  function htmlFor(k) {
    if (edits[k] === undefined) return originals[k];
    if (!PLAIN[k]) return edits[k];
    var d = document.createElement('div'); d.innerHTML = edits[k]; return d.textContent;
  }
  function select(k) {
    if (dirty && !confirm('You have unsaved changes. Leave this section without saving?')) return;
    current = k; dirty = false; setCode(false);
    $('secTitle').textContent = LABELS[k] || k;
    $('saveStatus').textContent = edits[k] !== undefined ? 'Edited' : 'Original';
    $('saveStatus').className = 'status';
    $('revert').disabled = edits[k] === undefined;
    renderSections();
    var plain = !!PLAIN[k];
    $('plain').hidden = !plain; frame.hidden = plain; $('toolbar').hidden = plain; $('code').hidden = true;
    if (plain) { $('plainText').value = htmlFor(k); return; }
    frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><base href="/">' +
      '<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=Inter:wght@400;500;600&family=Caveat:wght@500;700&family=Playfair+Display:wght@400;600&family=Karla:wght@400;500;600;700&display=swap" rel="stylesheet">' +
      '<link rel="stylesheet" href="css/style.css"><style>html,body{overflow:auto!important;height:auto!important}body{padding:24px 12px;background:#272c52;margin:0}' +
      '.panel{position:static;display:block;max-height:none;margin:0 auto;animation:none!important}.panel-body{outline:none;min-height:300px}img{max-width:100%}</style></head>' +
      '<body class="mode-3d"><dialog class="panel" id="panel-' + k + '" open><div class="panel-body" contenteditable="true"></div></dialog></body></html>';
    frame.onload = function () {
      var body = editable();
      body.innerHTML = htmlFor(k);
      body.addEventListener('input', markDirty);
      frame.contentDocument.addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); } });
    };
  }
  function editable() { return frame.contentDocument && frame.contentDocument.querySelector('.panel-body'); }
  function markDirty() { dirty = true; $('saveStatus').textContent = 'Unsaved changes'; $('saveStatus').className = 'status bad'; }
  $('plainText').addEventListener('input', markDirty);
  $('code').addEventListener('input', markDirty);
  function setCode(on) {
    var body = editable();
    if (on && body) $('code').value = body.innerHTML;
    if (!on && codeMode && body) body.innerHTML = $('code').value;
    codeMode = on;
    $('code').hidden = !on; frame.hidden = on || !!PLAIN[current];
  }
  function currentHTML() {
    if (PLAIN[current]) return esc($('plainText').value.trim());
    return codeMode ? $('code').value : editable().innerHTML;
  }
  function save() {
    if (!current) return;
    var k = current;
    $('save').disabled = true; $('saveStatus').textContent = 'Saving…'; $('saveStatus').className = 'status';
    api('/api/content/' + k, { method: 'PUT', json: { html: currentHTML() } }).then(function (b) {
      edits[k] = b.html; dirty = false;
      $('saveStatus').textContent = 'Saved · live on the site'; $('saveStatus').className = 'status ok';
      $('revert').disabled = false; renderSections();
    }).catch(function (err) { $('saveStatus').textContent = err.message; $('saveStatus').className = 'status bad'; })
      .then(function () { $('save').disabled = false; });
  }
  $('save').addEventListener('click', save);
  $('revert').addEventListener('click', function () {
    if (!current || !confirm('Restore the original text for "' + (LABELS[current] || current) + '"? Your edits to this section will be removed.')) return;
    var k = current;
    api('/api/content/' + k, { method: 'DELETE' }).then(function () { delete edits[k]; dirty = false; select(k); toast('Original restored'); });
  });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // toolbar
  function exec(cmd, val) { frame.contentWindow.focus(); frame.contentDocument.execCommand(cmd, false, val); markDirty(); }
  function insertHTML(html) {
    if (codeMode) { var c = $('code'); c.setRangeText(html, c.selectionStart, c.selectionEnd, 'end'); markDirty(); return; }
    exec('insertHTML', html);
  }
  $('toolbar').addEventListener('mousedown', function (e) { if (e.target.closest('button')) e.preventDefault(); }); // keep the text selection
  $('toolbar').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'html') { setCode(!codeMode); return; }
    if (codeMode && (b.dataset.cmd || b.dataset.block || b.dataset.act === 'link')) { toast('Switch off HTML view to use this'); return; }
    if (b.dataset.cmd) exec(b.dataset.cmd);
    else if (b.dataset.block) exec('formatBlock', '<' + b.dataset.block + '>');
    else if (b.dataset.act === 'link') {
      var u = prompt('Link address (https://… or mailto:…)'); if (!u) return;
      if (!/^(https?:|mailto:|tel:|\/|#)/i.test(u)) u = 'https://' + u;
      exec('createLink', u);
      frame.contentDocument.querySelectorAll('a[href^="http"]').forEach(function (a) { a.target = '_blank'; a.rel = 'noopener'; });
    } else if (b.dataset.act === 'image') pickFiles(function (urls) {
      urls.forEach(function (u) { insertHTML('<p><img src="' + u + '" alt="" loading="lazy" style="max-width:100%;border-radius:6px"></p>'); });
    }, false);
    else if (b.dataset.act === 'video') {
      var v = prompt('Paste a YouTube, Vimeo or SoundCloud link'); if (!v) return;
      var src = embedURL(v.trim());
      if (!src) { toast('That link isn\'t a YouTube, Vimeo or SoundCloud link'); return; }
      insertHTML('<div style="aspect-ratio:' + (/soundcloud/.test(src) ? '4/1' : '16/9') + ';margin:16px 0"><iframe src="' + esc(src) + '" style="width:100%;height:100%;border:0;border-radius:6px" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div><p></p>');
    }
  });
  function embedURL(u) {
    var m;
    if ((m = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/))) return 'https://www.youtube-nocookie.com/embed/' + m[1];
    if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return 'https://player.vimeo.com/video/' + m[1];
    if (/soundcloud\.com\//.test(u)) return 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(u) + '&color=%239a7b48';
    return null;
  }

  // ---------- photos ----------
  function shrink(file) {
    // keep animated GIFs and already-small files as they are; otherwise resize to 2000px and re-encode
    if (file.type === 'image/gif' || (file.size < 900e3 && /image\/(jpeg|webp|png)/.test(file.type))) return Promise.resolve(file);
    return createImageBitmap(file).then(function (bmp) {
      var k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      var c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(function (b) { res(b); }, 'image/webp', 0.85); }).then(function (b) {
        return b && b.type === 'image/webp' ? b : new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.85); });
      });
    });
  }
  function upload(file) {
    return shrink(file).then(function (blob) {
      return api('/api/media', { method: 'POST', body: blob, headers: { 'content-type': blob.type || file.type, 'x-filename': encodeURIComponent(file.name) } });
    }).then(function (b) { return b.url; });
  }
  function pickFiles(done) {
    var input = $('fileInput');
    input.value = '';
    input.onchange = function () {
      var files = Array.prototype.slice.call(input.files); if (!files.length) return;
      toast('Uploading ' + files.length + (files.length > 1 ? ' photos…' : ' photo…'));
      files.reduce(function (p, f) { return p.then(function (acc) { return upload(f).then(function (u) { return acc.concat(u); }); }); }, Promise.resolve([]))
        .then(function (urls) { toast('Uploaded'); done(urls); })
        .catch(function (err) { toast(err.message); });
    };
    input.click();
  }
  function loadPhotos() {
    api('/api/media').then(function (list) {
      $('photos').innerHTML = list.length ? list.map(function (m) {
        return '<div class="ph"><img src="/api/media/' + m.id + '" alt="' + esc(decodeURIComponent(m.name || '')) + '" loading="lazy">' +
          '<div><button class="btn" data-copy="' + m.id + '">Copy link</button><button class="btn danger" data-del="' + m.id + '">Delete</button></div></div>';
      }).join('') : '<div class="empty">No photos yet. Upload some to use them on your site.</div>';
    });
  }
  $('uploadBtn').addEventListener('click', function () { pickFiles(function () { loadPhotos(); }); });
  $('photos').addEventListener('click', function (e) {
    var c = e.target.closest('[data-copy]'), d = e.target.closest('[data-del]');
    if (c) { navigator.clipboard.writeText(location.origin + '/api/media/' + c.dataset.copy).then(function () { toast('Link copied'); }); }
    if (d && confirm('Delete this photo? Anywhere it is used on the site will show a broken image.')) api('/api/media/' + d.dataset.del, { method: 'DELETE' }).then(loadPhotos);
  });

  // ---------- inbox ----------
  function setUnread(n) { $('unread').hidden = !n; $('unread').textContent = n; }
  function loadInbox() {
    return api('/api/messages').then(function (list) {
      setUnread(list.filter(function (m) { return !m.read; }).length);
      $('inbox').innerHTML = list.length ? list.map(function (m) {
        var when = new Date(m.created).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        var reply = m.email ? '<a class="btn" href="mailto:' + esc(m.email) + '?subject=' + encodeURIComponent('Re: your message on visualartworld.com') + '">Reply</a>' : '';
        return '<article class="msg' + (m.read ? '' : ' unread') + '" data-id="' + m.id + '">' +
          '<header><span class="who">' + esc(m.name || 'No name') + '</span><span class="muted">' + esc(m.email || 'no email given') + '</span><span class="when">' + when + '</span></header>' +
          '<div class="body">' + esc(m.body) + '</div>' +
          '<div class="actions">' + reply + '<button class="btn" data-read="' + (m.read ? 0 : 1) + '">' + (m.read ? 'Mark unread' : 'Mark read') + '</button><button class="btn danger" data-delmsg>Delete</button></div></article>';
      }).join('') : '<div class="empty">No messages yet. When someone uses the contact form on your site, it shows up here.</div>';
    });
  }
  $('inbox').addEventListener('click', function (e) {
    var art = e.target.closest('.msg'); if (!art) return;
    var id = art.dataset.id, r = e.target.closest('[data-read]');
    if (r) api('/api/messages/' + id, { method: 'PATCH', json: { read: r.dataset.read === '1' } }).then(loadInbox);
    if (e.target.closest('[data-delmsg]') && confirm('Delete this message?')) api('/api/messages/' + id, { method: 'DELETE' }).then(loadInbox);
  });

  // ---------- start ----------
  function start() {
    $('login').hidden = true; $('app').hidden = false;
    loadContent().catch(function (err) { toast(err.message); });
    loadInbox().catch(function () {});
  }
  api('/api/me').then(function (me) {
    $('emailNote').textContent = me.email ? 'New messages are also emailed to you.' : 'Messages are saved here. Email alerts are not switched on yet.';
    if (me.admin) start();
    else showLogin(me.passwordSet ? null : 'No password is set yet. Add an ADMIN_PASSWORD secret to the Worker in Cloudflare, then sign in here.');
  }).catch(function () { showLogin('Could not reach the server. Try again in a minute.'); });
})();

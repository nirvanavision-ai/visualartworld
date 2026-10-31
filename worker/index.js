// Backend for visualartworld.com: editable site content, photo uploads and a contact inbox.
// Static files are served from the repo root; only /api/* reaches this Worker.
// Everything is stored in one SQLite-backed Durable Object, so no databases need creating.
import { DurableObject } from 'cloudflare:workers';

const COOKIE = 'vaw_admin';
const SESSION_DAYS = 14;
const MAX_FILE = 95 * 1024 * 1024; // Workers accept request bodies up to 100 MB
const CHUNK = 1536 * 1024; // a single SQLite value tops out at 2 MB, so files are stored in chunks
// shown in the browser; anything else (html, svg, scripts, zips…) is only offered as a download
const INLINE = /^(image\/(jpeg|png|webp|gif|avif)|audio\/[\w.+-]+|video\/[\w.+-]+|application\/pdf)$/;

export class SiteStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS content (key TEXT PRIMARY KEY, html TEXT NOT NULL, updated INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT, size INTEGER, data BLOB NOT NULL, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, body TEXT NOT NULL, created INTEGER NOT NULL, read INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS hits (bucket TEXT PRIMARY KEY, n INTEGER NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS media_chunks (id TEXT NOT NULL, n INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (id, n));
    `);
    try { this.sql.exec('ALTER TABLE media ADD COLUMN chunks INTEGER NOT NULL DEFAULT 0'); } catch (e) { /* already added */ }
  }

  // content
  getContent() {
    const out = {};
    for (const r of this.sql.exec('SELECT key, html, updated FROM content')) out[r.key] = { html: r.html, updated: r.updated };
    return out;
  }
  setContent(key, html) {
    this.sql.exec('INSERT INTO content (key, html, updated) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET html = excluded.html, updated = excluded.updated', key, html, Date.now());
  }
  resetContent(key) { this.sql.exec('DELETE FROM content WHERE key = ?', key); }

  // media: small early uploads live in media.data; everything else in media_chunks (chunks > 0)
  beginMedia(type, name) {
    const id = crypto.randomUUID().replace(/-/g, '');
    this.sql.exec('INSERT INTO media (id, type, name, size, data, created, chunks) VALUES (?, ?, ?, 0, ?, ?, -1)', id, type, name, new Uint8Array(0), Date.now());
    return id;
  }
  putChunk(id, n, data) { this.sql.exec('INSERT OR REPLACE INTO media_chunks (id, n, data) VALUES (?, ?, ?)', id, n, data); }
  finishMedia(id, size, chunks) { this.sql.exec('UPDATE media SET size = ?, chunks = ? WHERE id = ?', size, chunks, id); }
  mediaInfo(id) {
    const r = this.sql.exec('SELECT type, name, size, chunks FROM media WHERE id = ? AND chunks >= 0', id).toArray()[0];
    return r || null;
  }
  getChunk(id, n) {
    const r = n < 0 ? this.sql.exec('SELECT data FROM media WHERE id = ?', id).toArray()[0] : this.sql.exec('SELECT data FROM media_chunks WHERE id = ? AND n = ?', id, n).toArray()[0];
    return r ? r.data : null;
  }
  listMedia() { return this.sql.exec('SELECT id, type, name, size, created FROM media WHERE chunks >= 0 ORDER BY created DESC').toArray(); }
  deleteMedia(id) { this.sql.exec('DELETE FROM media_chunks WHERE id = ?', id); this.sql.exec('DELETE FROM media WHERE id = ?', id); }

  // contact messages
  addMessage(name, email, body) {
    this.sql.exec('INSERT INTO messages (name, email, body, created) VALUES (?, ?, ?, ?)', name, email, body, Date.now());
  }
  listMessages() { return this.sql.exec('SELECT id, name, email, body, created, read FROM messages ORDER BY created DESC LIMIT 500').toArray(); }
  markMessage(id, read) { this.sql.exec('UPDATE messages SET read = ? WHERE id = ?', read ? 1 : 0, id); }
  deleteMessage(id) { this.sql.exec('DELETE FROM messages WHERE id = ?', id); }

  // simple fixed-window rate limit: true while under the limit
  hit(bucket, limit, windowMs) {
    const now = Date.now();
    this.sql.exec('DELETE FROM hits WHERE expires < ?', now);
    const r = this.sql.exec('SELECT n FROM hits WHERE bucket = ?', bucket).toArray()[0];
    if (r && r.n >= limit) return false;
    if (r) this.sql.exec('UPDATE hits SET n = n + 1 WHERE bucket = ?', bucket);
    else this.sql.exec('INSERT INTO hits (bucket, n, expires) VALUES (?, 1, ?)', bucket, now + windowMs);
    return true;
  }
}

// ---------- helpers ----------
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const fail = (status, error) => json({ error }, status);
const enc = new TextEncoder();

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// compare two strings without leaking where they differ
async function same(a, b) {
  const k = 'compare';
  const [x, y] = await Promise.all([hmac(k, a), hmac(k, b)]);
  let d = x.length ^ y.length;
  for (let i = 0; i < x.length && i < y.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}
function cookieValue(req, name) {
  const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}
async function isAdmin(req, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const v = cookieValue(req, COOKIE);
  if (!v) return false;
  const [exp, sig] = v.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return same(sig, await hmac(env.ADMIN_PASSWORD, 'session:' + exp));
}

// Strip anything that could run code from edited HTML; keep normal formatting, images, links and video embeds.
const BLOCKED = 'script,style,object,embed,form,input,button,textarea,select,base,meta,link,frame,frameset,svg,math,template';
const EMBED_HOSTS = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|open\.spotify\.com|w\.soundcloud\.com|bandcamp\.com)\//;
async function sanitize(html) {
  const clean = new HTMLRewriter()
    .on(BLOCKED, { element(e) { e.remove(); } })
    .on('iframe', { element(e) { if (!EMBED_HOSTS.test(e.getAttribute('src') || '')) e.remove(); } })
    .on('*', {
      element(e) {
        for (const [name, value] of [...e.attributes]) {
          const n = name.toLowerCase();
          const v = (value || '').replace(/[\s\u0000-\u001f]/g, '').toLowerCase();
          if (n.startsWith('on') || n === 'srcdoc' || n === 'formaction' || n === 'style' && /expression|url\(/.test(v)) e.removeAttribute(name);
          else if (['href', 'src', 'xlink:href', 'action', 'poster'].includes(n) && /^(javascript|vbscript|data):/.test(v) && !/^data:image\/(png|jpe?g|gif|webp);/.test(v)) e.removeAttribute(name);
        }
        if (e.tagName === 'a' && e.getAttribute('target') === '_blank') e.setAttribute('rel', 'noopener');
      },
    })
    .transform(new Response(html, { headers: { 'content-type': 'text/html' } }));
  return clean.text();
}

async function notify(env, msg) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_EMAIL) return;
  const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.NOTIFY_FROM || 'Visual Art World <onboarding@resend.dev>',
      to: [env.NOTIFY_EMAIL],
      reply_to: msg.email || undefined,
      subject: 'New message from ' + (msg.name || 'your website'),
      html: `<p><strong>${esc(msg.name)}</strong> &lt;${esc(msg.email)}&gt; wrote via visualartworld.com:</p><p style="white-space:pre-wrap">${esc(msg.body)}</p>`,
    }),
  }).catch(() => {});
}

// stream a stored file, with Range support so audio and video can seek
async function serveMedia(req, store, id) {
  const info = await store.mediaInfo(id);
  if (!info) return fail(404, 'Not found');
  const inline = INLINE.test(info.type);
  const headers = {
    'content-type': inline ? info.type : 'application/octet-stream',
    'cache-control': 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
    'accept-ranges': 'bytes',
  };
  if (info.type !== 'application/pdf') headers['content-security-policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
  if (!inline) headers['content-disposition'] = 'attachment; filename="' + (decodeURIComponent(info.name || 'file').replace(/[^\w. -]/g, '_') || 'file') + '"';
  if (info.chunks === 0) { // stored whole, from before chunking
    const data = await store.getChunk(id, -1);
    headers['content-length'] = String(data.byteLength);
    return new Response(req.method === 'HEAD' ? null : data, { headers });
  }
  let start = 0, end = info.size - 1, status = 200;
  const m = (req.headers.get('range') || '').match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    if (m[1]) { start = Number(m[1]); if (m[2]) end = Math.min(Number(m[2]), info.size - 1); }
    else start = Math.max(0, info.size - Number(m[2]));
    if (start > end || start >= info.size) return new Response(null, { status: 416, headers: { 'content-range': 'bytes */' + info.size } });
    status = 206;
    headers['content-range'] = `bytes ${start}-${end}/${info.size}`;
  }
  headers['content-length'] = String(end - start + 1);
  if (req.method === 'HEAD') return new Response(null, { status, headers });
  let n = Math.floor(start / CHUNK);
  const last = Math.floor(end / CHUNK);
  const body = new ReadableStream({
    async pull(ctrl) {
      if (n > last) { ctrl.close(); return; }
      const data = new Uint8Array(await store.getChunk(id, n));
      const from = n === Math.floor(start / CHUNK) ? start % CHUNK : 0;
      const to = n === last ? (end % CHUNK) + 1 : data.byteLength;
      ctrl.enqueue(data.subarray(from, to));
      n++;
    },
  });
  return new Response(body, { status, headers });
}

// ---------- routes ----------
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname;
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(req);
    const store = env.STORE.get(env.STORE.idFromName('site'));
    const ip = req.headers.get('cf-connecting-ip') || 'local';
    const method = req.method;

    // every state-changing call must come from our own pages (blocks cross-site form posts)
    if (method !== 'GET' && method !== 'HEAD') {
      const origin = req.headers.get('origin');
      if (origin && origin !== url.origin) return fail(403, 'Wrong origin');
      if (!req.headers.get('x-vaw')) return fail(403, 'Missing header');
    }

    try {
      // public
      if (path === '/api/content' && method === 'GET') {
        const all = await store.getContent();
        const out = {};
        for (const k in all) out[k] = all[k].html;
        return json(out, 200, { 'cache-control': 'public, max-age=30' });
      }
      const mediaMatch = path.match(/^\/api\/media\/([a-f0-9]{32})$/);
      if (mediaMatch && (method === 'GET' || method === 'HEAD')) return serveMedia(req, store, mediaMatch[1]);
      if (path === '/api/contact' && method === 'POST') {
        const b = await req.json().catch(() => ({}));
        if (b.website) return json({ ok: true }); // honeypot field filled in: a bot
        const name = String(b.name || '').trim().slice(0, 120);
        const email = String(b.email || '').trim().slice(0, 200);
        const body = String(b.message || '').trim().slice(0, 5000);
        if (!body || body.length < 2) return fail(400, 'Please write a message.');
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, 'That email address looks off.');
        if (!(await store.hit('contact:' + ip, 5, 3600e3))) return fail(429, 'Too many messages, please try again later.');
        await store.addMessage(name, email, body);
        ctx.waitUntil(notify(env, { name, email, body }));
        return json({ ok: true });
      }

      // login
      if (path === '/api/login' && method === 'POST') {
        if (!env.ADMIN_PASSWORD) return fail(503, 'No admin password is set yet. Add ADMIN_PASSWORD as a secret in Cloudflare.');
        if (!(await store.hit('login:' + ip, 8, 15 * 60e3))) return fail(429, 'Too many tries. Wait 15 minutes.');
        const b = await req.json().catch(() => ({}));
        if (!(await same(String(b.password || ''), env.ADMIN_PASSWORD))) return fail(401, 'Wrong password.');
        const exp = String(Date.now() + SESSION_DAYS * 864e5);
        const sig = await hmac(env.ADMIN_PASSWORD, 'session:' + exp);
        const secure = url.protocol === 'https:' ? '; Secure' : '';
        return json({ ok: true }, 200, { 'set-cookie': `${COOKIE}=${exp}.${sig}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}${secure}` });
      }
      if (path === '/api/logout' && method === 'POST') {
        return json({ ok: true }, 200, { 'set-cookie': `${COOKIE}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0` });
      }
      if (path === '/api/me') return json({ admin: await isAdmin(req, env), passwordSet: !!env.ADMIN_PASSWORD, email: !!(env.RESEND_API_KEY && env.NOTIFY_EMAIL) });

      // everything below needs the admin session
      if (!(await isAdmin(req, env))) return fail(401, 'Please sign in.');

      const contentMatch = path.match(/^\/api\/content\/([a-z0-9-]{1,40})$/);
      if (contentMatch && method === 'PUT') {
        const b = await req.json().catch(() => ({}));
        if (typeof b.html !== 'string' || b.html.length > 200000) return fail(400, 'Content missing or too long.');
        const html = await sanitize(b.html);
        await store.setContent(contentMatch[1], html);
        return json({ ok: true, html });
      }
      if (contentMatch && method === 'DELETE') { await store.resetContent(contentMatch[1]); return json({ ok: true }); }
      if (path === '/api/content/all' && method === 'GET') return json(await store.getContent());

      if (path === '/api/media' && method === 'POST') {
        const type = ((req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()) || 'application/octet-stream';
        if (Number(req.headers.get('content-length') || 0) > MAX_FILE) return fail(413, 'That file is too large (max 95 MB).');
        if (!req.body) return fail(400, 'Empty file.');
        const id = await store.beginMedia(type, (req.headers.get('x-filename') || '').slice(0, 200));
        try {
          // split the upload into chunks as it streams in
          const reader = req.body.getReader();
          let buf = new Uint8Array(CHUNK), fill = 0, n = 0, size = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > MAX_FILE) throw new RangeError('too large');
            let off = 0;
            while (off < value.byteLength) {
              const take = Math.min(CHUNK - fill, value.byteLength - off);
              buf.set(value.subarray(off, off + take), fill);
              fill += take; off += take;
              if (fill === CHUNK) { await store.putChunk(id, n++, buf); buf = new Uint8Array(CHUNK); fill = 0; }
            }
          }
          if (fill) await store.putChunk(id, n++, buf.slice(0, fill));
          if (!size) throw new TypeError('empty');
          await store.finishMedia(id, size, n);
        } catch (e) {
          await store.deleteMedia(id);
          if (e instanceof RangeError) return fail(413, 'That file is too large (max 95 MB).');
          if (e instanceof TypeError && e.message === 'empty') return fail(400, 'Empty file.');
          throw e;
        }
        return json({ ok: true, id, type, url: '/api/media/' + id });
      }
      if (path === '/api/media' && method === 'GET') return json(await store.listMedia());
      if (mediaMatch && method === 'DELETE') { await store.deleteMedia(mediaMatch[1]); return json({ ok: true }); }

      if (path === '/api/messages' && method === 'GET') return json(await store.listMessages());
      const msgMatch = path.match(/^\/api\/messages\/(\d+)$/);
      if (msgMatch && method === 'PATCH') {
        const b = await req.json().catch(() => ({}));
        await store.markMessage(Number(msgMatch[1]), !!b.read);
        return json({ ok: true });
      }
      if (msgMatch && method === 'DELETE') { await store.deleteMessage(Number(msgMatch[1])); return json({ ok: true }); }

      return fail(404, 'Not found');
    } catch (err) {
      console.error(err);
      return fail(500, 'Something went wrong.');
    }
  },
};

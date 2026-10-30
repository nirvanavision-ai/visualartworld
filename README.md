# visualartworld.com

A one-page "about me" site: an illustrated shelf where each object opens a panel.
Plain HTML, CSS and JavaScript. No build step, no plugins, works on any host.

```
index.html      all text and panels (edit this)
css/style.css   colors, fonts, layout (colors are at the top under :root)
js/main.js      clicks, panels, lamp night mode
images/         your photos go here
```

## What to fill in

Most text now comes from Angelica's resume and the Nirvana Vision Webflow site. Anything still in `[square brackets]`
in `index.html` is a placeholder.

| Shelf object | Panel | Still needed | Photos to add (in `images/`) |
|---|---|---|---|
| Books | About me | (done) | `portrait.jpg` (3:4) |
| Picture frame | Painting | heading, one line, 3 captions | `painting-1.jpg` … `painting-3.jpg` (4:5) |
| Camera | Photography | (done) | `photo-1.jpg` … `photo-4.jpg` (3:2) |
| Clapperboard | Filmmaking | (done) | `cahuenga-poster.jpg`* |
| Record player | Music & DJ | your sound, song titles, DJ sets, SoundCloud/Spotify link | none |
| Zoetrope | Animation | a few lines about your own work, 3 captions | `animation-1.jpg` … `animation-3.jpg` |
| Laptop | Web & games | game title, description, link | `site-nicolette.gif`*, `site-regaljade.jpg`*, `site-hfa.jpg`, `game-1.jpg` |
| Padlock | Ethical hacking & OSINT | what you focus on, 2 focus areas | none |
| Light bulb | Inventions | heading, one line, 3 inventions | `invention-1.jpg` … `invention-3.jpg` |
| Trophy | Awards & impact | (done) | none |
| Envelope | Say hello | Instagram (or remove that line) | none |
| (link previews) | | | `og.jpg` 1200×630 |

\* These load from the old Webflow site for now (`data-fallback`). Save a copy into `images/`
with that name before you shut the Webflow site down.

Until a photo is added, its spot shows a beige box naming the exact file it expects.
Keep photos under ~500 KB each (export at 1600px on the long side).

The plant just wiggles, and the hanging lamp switches the room to night mode.
To change what an object opens, edit its `data-panel` in `index.html` and the matching
`<dialog id="panel-...">` below it.

## Upload to Hostinger

1. Log in to **hPanel** → **Websites** → **visualartworld.com** → **Dashboard**.
2. Open **Files → File Manager** and go into **public_html**.
3. If there's a default `default.php` or `index.php` there, delete it (otherwise it may load instead of your site).
4. Upload the contents of this folder: `index.html`, and the `css`, `js` and `images` folders.
   Easiest way: zip them, upload the zip, right-click it → **Extract** into `public_html`, then delete the zip.
   `index.html` must sit directly in `public_html`, not in a subfolder.
5. In hPanel → **Security → SSL**, make sure SSL is active, and turn on **Force HTTPS**.
6. Visit https://visualartworld.com (hard-refresh with Ctrl/Cmd + Shift + R).

To update later, re-upload only the files you changed.

Optional: hPanel → **Advanced → Git** can pull this GitHub repo straight into `public_html`
(repo `https://github.com/nirvanavision-ai/visualartworld.git`, branch `main`, install path empty),
then press **Deploy** after each change.

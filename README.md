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

Open `index.html` and replace everything in `[square brackets]`. Look for `EDIT:` comments too.

| Shelf object | Panel | Text to write | Photos to add (in `images/`) |
|---|---|---|---|
| Books | About me | name, one-line intro, 2 paragraphs, city, mediums, "currently" | `portrait.jpg` (portrait, 3:4) |
| Picture frame | My art | heading, one line about your style, 6 captions | `art-1.jpg` … `art-6.jpg` (4:5) |
| Camera | Photography | heading, one line | `photo-1.jpg` … `photo-4.jpg` (3:2) |
| Paint jar | Hobbies | 3 hobbies, 2 lines each | `hobby-1.jpg` … `hobby-3.jpg` (square) |
| Record player | Music I love | 5 artists / albums (or a Spotify embed) | none |
| Globe | Places | 4 places and why | none |
| Envelope | Say hello | one line, email, Instagram, one more link | none |
| (link previews) | | | `og.jpg` 1200×630, shown when the link is shared |

Until a photo is added, its spot shows a beige box naming the exact file it expects.
Keep photos under ~500 KB each (export at 1600px on the long side).

The plant just wiggles, and the hanging lamp switches the room to night mode.
To change what an object opens, edit its `data-panel` in `index.html`, and the matching
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

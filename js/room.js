// 3D studio wall. A front-on room built from primitives: floating shelf, wall
// pieces, a stepped bookcase, the DJ table and the Pomeranian. Every clickable
// object carries userData.panel (opens <dialog id="panel-...">) or userData.action.
import * as THREE from 'three';

const root = document.documentElement;
const stage = document.getElementById('room3d');
const chip = document.getElementById('chip3d');
const toastEl = document.getElementById('toast3d');
const counterEl = document.getElementById('found3d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;

// ---------- renderer / scene / camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(stage.clientWidth, stage.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b231d);
const camera = new THREE.PerspectiveCamera(30, stage.clientWidth / stage.clientHeight, 0.1, 120);

// ---------- palette & helpers ----------
const C = {
  wall: 0x56473a, floor: 0x3a2a20, skirting: 0x5a4a3e, shelf: 0xe0b12a, shelfDark: 0xc79a1c,
  ink: 0x231d18, paper: 0xf6eedf, cork: 0xb98a55, coral: 0xe0705a, navy: 0x23395f,
  plum: 0x5a2f4a, teal: 0x2f6f6a, metal: 0xb8bcc2, black: 0x16151a, pom: 0xe4954a, pomLight: 0xf6c58c,
};
const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...opts }));
  return matCache.get(key);
}
function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const asMat = (c, opts) => (typeof c === 'object' ? c : mat(c, opts));
const box = (w, h, d, c, x, y, z, opts) => mesh(new THREE.BoxGeometry(w, h, d), asMat(c, opts), x, y, z);
const cyl = (rt, rb, h, c, x, y, z, seg = 24, opts) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), asMat(c, opts), x, y, z);
const sphere = (r, c, x, y, z, opts) => mesh(new THREE.SphereGeometry(r, 24, 16), asMat(c, opts), x, y, z);

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// image file with a drawn stand-in until it loads (or if it is missing)
function imageTexture(url, w, h, draw) {
  const t = canvasTexture(w, h, draw);
  new THREE.TextureLoader().load(url, img => { t.dispose(); t.image = img.image; t.needsUpdate = true; });
  return t;
}
// seeded random so the books look the same on every visit
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------- room shell ----------
const wallTex = canvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = '#5a4a3c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${rand() > 0.5 ? '255,240,220' : '0,0,0'},${0.025 + rand() * 0.03})`;
    g.fillRect(rand() * w, rand() * h, 2, 2);
  }
});
wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
wallTex.repeat.set(14, 10);
const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 });
const wallMesh = mesh(new THREE.PlaneGeometry(70, 40), wallMat, 0, 15, 0);
wallMesh.castShadow = false;
scene.add(wallMesh);

const floorTex = canvasTexture(512, 512, (g, w, h) => {
  for (let i = 0; i < 8; i++) {
    const s = 52 + ((i * 29) % 14);
    g.fillStyle = `rgb(${s},${Math.round(s * 0.72)},${Math.round(s * 0.55)})`;
    g.fillRect(0, i * 64, w, 64);
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fillRect(0, i * 64, w, 2);
    g.fillRect((i * 173) % w, i * 64, 2, 64);
  }
});
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
floorTex.repeat.set(10, 4);
const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 });
const floor = mesh(new THREE.PlaneGeometry(70, 24), floorMat, 0, 0, 12);
floor.rotation.x = -Math.PI / 2;
floor.castShadow = false;
scene.add(floor);
scene.add(box(70, 0.32, 0.06, C.skirting, 0, 0.16, 0.03));

// ---------- lights ----------
const hemi = new THREE.HemisphereLight(0xfff1dc, 0x3a2a1c, 0.8);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe0b0, 3.0);
sun.position.set(-9, 14, 11);
sun.castShadow = true;
sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 16, bottom: -6, near: 1, far: 50 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xbcd0ff, 0.35);
fill.position.set(8, 6, 10);
scene.add(fill);

// ---------- clickable registry ----------
// key -> { group, panel?, action?, label }
const things = new Map();
const pickables = [];
function register(group, key, label, opts = {}) {
  group.userData.thing = key;
  // own materials, so hover/hint glow only touches this object
  group.traverse(o => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.userData.baseEmissive = o.material.emissive ? o.material.emissive.clone() : null;
      o.userData.thing = key;
      pickables.push(o);
    }
  });
  things.set(key, { group, label, panel: opts.panel, action: opts.action, lift: opts.lift ?? 0.05 });
}

// Each piece is placed by layout() (wide desktop vs tall phone arrangement)
const pieces = {};

// ---------- floating shelf: plant + two photos ----------
function photoTexture(kind) {
  return canvasTexture(256, 320, (g, w, h) => {
    if (kind === 0) { // desert dusk
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#2b3d6b'); sky.addColorStop(0.55, '#e48a5a'); sky.addColorStop(0.75, '#f2c27a');
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f8e3b0'; g.beginPath(); g.arc(170, 200, 26, 0, 7); g.fill();
      g.fillStyle = '#3b2a2a';
      g.beginPath(); g.moveTo(0, 250); g.lineTo(60, 205); g.lineTo(110, 235); g.lineTo(180, 190); g.lineTo(256, 240); g.lineTo(256, 320); g.lineTo(0, 320); g.fill();
      g.fillRect(60, 160, 8, 100); g.fillRect(44, 190, 16, 6); g.fillRect(44, 176, 6, 18); g.fillRect(68, 180, 14, 6); g.fillRect(78, 166, 6, 18);
    } else { // ocean + camera silhouette
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#8ec5d6'); sky.addColorStop(0.5, '#e9e2cf'); sky.addColorStop(0.52, '#3c7d8f'); sky.addColorStop(1, '#1f4f5f');
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2;
      for (let y = 180; y < h; y += 18) { g.beginPath(); g.moveTo(10, y); g.lineTo(w - 10, y + 4); g.stroke(); }
      g.fillStyle = '#20232a';
      g.fillRect(70, 210, 120, 80); g.fillRect(100, 196, 40, 18);
      g.fillStyle = '#5a6170'; g.beginPath(); g.arc(130, 250, 28, 0, 7); g.fill();
      g.fillStyle = '#9fb7c9'; g.beginPath(); g.arc(130, 250, 16, 0, 7); g.fill();
    }
  });
}
function pictureFrame(w, h, tex, frameColor) {
  const g = new THREE.Group();
  g.add(box(w, h, 0.08, frameColor, 0, h / 2, 0));
  g.add(box(w - 0.14, h - 0.14, 0.02, C.paper, 0, h / 2, 0.045));
  const pic = mesh(new THREE.PlaneGeometry(w - 0.34, h - 0.38), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), 0, h / 2 + 0.02, 0.058);
  g.add(pic);
  return g;
}
const leafGeo = new THREE.SphereGeometry(0.075, 8, 6);
leafGeo.scale(1, 0.55, 0.3);
function trailingPlant() {
  const g = new THREE.Group();
  g.add(cyl(0.42, 0.32, 0.6, C.black, 0, 0.3, 0, 28, { roughness: 0.5 }));
  g.add(cyl(0.4, 0.4, 0.04, 0x2a1c12, 0, 0.58, 0));
  const leafMats = [mat(0x6f9a3a), mat(0x8fb850), mat(0x557d2c), mat(0xb7cf7a)];
  const vine = mat(0x5f7d2c);
  // upright tuft
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2, r = rand() * 0.35;
    const l = mesh(leafGeo, leafMats[i % 4], Math.cos(a) * r, 0.65 + rand() * 0.45, Math.sin(a) * r * 0.6);
    l.rotation.set(rand() * 2, rand() * 3, rand() * 2);
    l.scale.setScalar(1.3 + rand());
    g.add(l);
  }
  // vines spilling over the shelf edge
  const vines = new THREE.Group();
  for (let v = 0; v < 13; v++) {
    const startX = -0.5 + rand() * 1.0 + (v % 2 ? 0.3 : -0.3) * rand();
    const len = 0.9 + rand() * 1.9;
    const drift = (rand() - 0.5) * 0.9;
    const pts = [];
    for (let s = 0; s <= 10; s++) {
      const t = s / 10;
      pts.push(new THREE.Vector3(startX * (1 + t * 0.6) + drift * t * t, 0.55 - t * len + Math.sin(t * 3) * 0.12 + (t < 0.15 ? 0.25 * (1 - t / 0.15) : 0), 0.25 + t * 0.35));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    vines.add(mesh(new THREE.TubeGeometry(curve, 18, 0.012, 5), vine));
    const n = Math.floor(len * 9);
    for (let k = 1; k < n; k++) {
      const p = curve.getPoint(k / n);
      const l = mesh(leafGeo, leafMats[(k + v) % 4], p.x + (k % 2 ? 0.06 : -0.06), p.y, p.z + 0.02);
      l.rotation.set(rand() - 0.5, rand() * 3, (k % 2 ? 1 : -1) * (0.6 + rand() * 0.5));
      l.scale.setScalar(0.9 + rand() * 0.6);
      vines.add(l);
    }
  }
  g.add(vines);
  g.userData.vines = vines;
  return g;
}
(function floatingShelf() {
  const g = new THREE.Group();
  g.add(box(6.6, 0.24, 0.85, C.shelf, 0, 0, 0.43, { roughness: 0.55 }));
  const plant = trailingPlant();
  plant.position.set(-2.35, 0.12, 0.4);
  g.add(plant);
  pieces.plant = plant;
  register(plant, 'plant', 'Water the plant', { action: 'wiggle', lift: 0 });
  const photos = new THREE.Group();
  const f1 = pictureFrame(0.92, 1.12, photoTexture(0), C.ink);
  f1.position.set(0, 0.12, 0.35); f1.rotation.x = -0.08;
  const f2 = pictureFrame(0.78, 0.92, photoTexture(1), 0xf2ede3);
  f2.position.set(1.15, 0.12, 0.45); f2.rotation.set(-0.08, -0.12, 0);
  photos.add(f1, f2);
  photos.position.set(0.55, 0, 0);
  g.add(photos);
  register(photos, 'photo', 'Photography', { panel: 'photo' });
  pieces.shelf = g;
  scene.add(g);
})();

// ---------- wall pieces: film poster, awards board, painting ----------
(function poster() {
  const tex = imageTexture('images/cahuenga-poster.jpg', 240, 320, (g, w, h) => {
    g.fillStyle = '#a7774a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4b2e1a'; g.font = 'bold 34px Georgia'; g.textAlign = 'center'; g.fillText('CAHUENGA', w / 2, 60);
  });
  const g = new THREE.Group();
  g.add(box(1.16, 1.54, 0.03, 0xf3ead8, 0, 0, 0.015));
  g.add(mesh(new THREE.PlaneGeometry(1.08, 1.44), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), 0, 0, 0.032));
  g.rotation.z = 0.015;
  register(g, 'film', 'Filmmaking', { panel: 'film' });
  pieces.poster = g;
  scene.add(g);
})();
(function awardsBoard() {
  const notes = [
    ['Winner', 'Best Film', 'PAH Film Festival'], ['Winner', 'Best Score', 'PAH Film Festival'],
    ['Official selection', 'Los Angeles', 'CineFest'], ['Best of', 'Flicker', 'Film Fest'],
    ['Winner', 'Attack of the', '50 Foot Reels'], ['Recognized by', '29 tribes', 'The Bridge Project'],
    ['Exhibited', 'LACMA', 'and more'], ['Founder', 'Nirvana', 'Vision'],
  ];
  const tex = canvasTexture(640, 420, (g, w, h) => {
    g.fillStyle = '#b98a55'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) { g.fillStyle = `rgba(${rand() > 0.5 ? '80,45,15' : '235,200,150'},.35)`; g.fillRect(rand() * w, rand() * h, 3, 2); }
    g.fillStyle = '#f6eedf'; g.save(); g.translate(40, 22); g.rotate(-0.02); g.fillRect(0, 0, 150, 38);
    g.fillStyle = '#3a2a20'; g.font = '600 22px Georgia'; g.fillText('Awards', 26, 27); g.restore();
    const cols = ['#f7e9a8', '#f3d1c8', '#d7e7c4', '#cfe0ef', '#f6eedf', '#f7e9a8', '#e7d3ef', '#f3d1c8'];
    const pins = ['#d9583b', '#2f4a6d', '#e3a838', '#2f6f6a'];
    notes.forEach((n, i) => {
      const x = 40 + (i % 4) * 148, y = 92 + Math.floor(i / 4) * 160;
      g.save(); g.translate(x + 60, y + 55); g.rotate((rand() - 0.5) * 0.12);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-56, -48, 120, 108);
      g.fillStyle = cols[i]; g.fillRect(-60, -52, 120, 108);
      g.fillStyle = '#3a2a20'; g.textAlign = 'center';
      g.font = '500 13px Georgia'; g.fillText(n[0], 0, -14);
      g.font = '600 18px Georgia'; g.fillText(n[1], 0, 10);
      g.font = '500 13px Georgia'; g.fillText(n[2], 0, 32);
      g.fillStyle = pins[i % 4]; g.beginPath(); g.arc(0, -40, 7, 0, 7); g.fill();
      g.restore();
    });
  });
  const g = new THREE.Group();
  g.add(box(2.7, 1.78, 0.08, 0x9c6b3d, 0, 0, 0.04));
  g.add(mesh(new THREE.PlaneGeometry(2.56, 1.66), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), 0, 0, 0.082));
  register(g, 'impact', 'Awards & impact', { panel: 'impact' });
  pieces.board = g;
  scene.add(g);
})();
(function painting() {
  const tex = canvasTexture(320, 256, (g, w, h) => {
    g.fillStyle = '#f2e6cf'; g.fillRect(0, 0, w, h);
    const strokes = ['#e0705a', '#e3a838', '#2f6f6a', '#23395f', '#e7a3a0', '#8daa7d', '#5a2f4a'];
    for (let i = 0; i < 46; i++) {
      g.strokeStyle = strokes[i % strokes.length]; g.globalAlpha = 0.75; g.lineCap = 'round';
      g.lineWidth = 8 + rand() * 22;
      g.beginPath();
      const x = rand() * w, y = rand() * h;
      g.moveTo(x, y); g.quadraticCurveTo(x + (rand() - 0.5) * 160, y + (rand() - 0.5) * 120, x + (rand() - 0.5) * 200, y + (rand() - 0.5) * 80);
      g.stroke();
    }
    g.globalAlpha = 1; g.fillStyle = '#f8e3b0'; g.beginPath(); g.arc(230, 70, 30, 0, 7); g.fill();
  });
  const g = new THREE.Group();
  g.add(box(1.3, 1.04, 0.07, 0xf2e6cf, 0, 0, 0.035));
  g.add(mesh(new THREE.PlaneGeometry(1.24, 0.98), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), 0, 0, 0.072));
  // masking tape corners
  [[-0.58, 0.46, 0.7], [0.58, 0.46, -0.7]].forEach(([x, y, r]) => { const t = box(0.32, 0.09, 0.005, 0xefe1b8, x, y, 0.078); t.rotation.z = r; g.add(t); });
  g.rotation.z = -0.06;
  register(g, 'painting', 'Painting', { panel: 'painting' });
  pieces.painting = g;
  scene.add(g);
})();

// ---------- stepped bookcase ----------
const COLS = [{ w: 1.7, h: 5.5, n: 3 }, { w: 1.2, h: 4.2, n: 3 }, { w: 1.85, h: 7.2, n: 4 }, { w: 1.45, h: 6.05, n: 4 }];
const CASE_W = COLS.reduce((s, c) => s + c.w, 0);
const CASE_D = 1.05, T = 0.09, PLINTH = 0.14;
const bookcase = new THREE.Group();
const slots = []; // slots[col][row] = { x, y, w, h } in bookcase space, y = top of the shelf board
(function buildCase() {
  const yellow = mat(C.shelf, { roughness: 0.6 });
  const inner = mat(C.shelfDark, { roughness: 0.7 });
  let x = -CASE_W / 2;
  COLS.forEach((c, ci) => {
    const cx = x + c.w / 2;
    bookcase.add(box(c.w, c.h, T, inner, cx, c.h / 2, T / 2)); // back
    bookcase.add(box(T, c.h, CASE_D, yellow, x + T / 2, c.h / 2, CASE_D / 2));
    bookcase.add(box(T, c.h, CASE_D, yellow, x + c.w - T / 2, c.h / 2, CASE_D / 2));
    bookcase.add(box(c.w, PLINTH, CASE_D, yellow, cx, PLINTH / 2, CASE_D / 2));
    const cub = (c.h - PLINTH) / c.n;
    slots[ci] = [];
    for (let r = 0; r < c.n; r++) {
      const y = PLINTH + r * cub;
      if (r > 0) bookcase.add(box(c.w - T, T, CASE_D, yellow, cx, y, CASE_D / 2));
      slots[ci].push({ x: cx, y: y + (r > 0 ? T / 2 : 0), w: c.w - 2 * T, h: cub - T });
    }
    bookcase.add(box(c.w, T, CASE_D, yellow, cx, c.h - T / 2, CASE_D / 2)); // top
    slots[ci].top = { x: cx, y: c.h, w: c.w };
    x += c.w;
  });
  scene.add(bookcase);
  pieces.bookcase = bookcase;
})();

const bookPalettes = [
  [0x2e4a3a, 0xe8dcc4, 0x7a2e2e, 0x23395f, 0x3d2b2b, 0xb04a3a],
  [0x3f8f5a, 0x9ccf9a, 0x2e6b45, 0x7fb98a, 0x1f5a3a, 0xcfe3b8],
  [0xd9a35a, 0xe8c27a, 0xf0d8a0, 0xc9884a, 0xb8733a],
  [0x2a2622, 0x5a2f4a, 0x3a4a5a, 0x7a2e2e, 0x2e4a3a, 0x4a3a5a],
  [0xe0705a, 0xd9583b, 0xe7a3a0, 0xc9704a, 0xf2a07a],
];
function books(slot, from, to, pal, opts = {}) {
  const g = new THREE.Group();
  const p = bookPalettes[pal];
  let x = slot.x - slot.w / 2 + from * slot.w;
  const end = slot.x - slot.w / 2 + to * slot.w;
  const z = CASE_D / 2 + 0.08;
  while (x < end - 0.08) {
    const bw = 0.09 + rand() * 0.07;
    const bh = Math.min(slot.h * (0.62 + rand() * 0.28), slot.h - 0.05);
    const bd = 0.55 + rand() * 0.18;
    const col = p[Math.floor(rand() * p.length)];
    const b = box(bw, bh, bd, col, x + bw / 2, slot.y + bh / 2, z, { roughness: 0.8 });
    if (rand() > 0.55) b.add(box(bw + 0.004, 0.035, bd + 0.004, 0xe8c66a, 0, bh * 0.32, 0, { metalness: 0.4, roughness: 0.4 }));
    g.add(b);
    x += bw + 0.008;
  }
  if (opts.lean && x < end) { // one book leaning into the gap
    const bh = slot.h * 0.7;
    const b = box(0.1, bh, 0.6, p[0], x + 0.25, slot.y + bh / 2 - 0.02, z);
    b.rotation.z = -0.32;
    g.add(b);
  }
  bookcase.add(g);
  return g;
}
function bookStack(slot, cx, n, pal) {
  const g = new THREE.Group();
  const p = bookPalettes[pal];
  for (let i = 0; i < n; i++) {
    const w = 0.55 + rand() * 0.15;
    const b = box(w, 0.08, 0.5, p[i % p.length], cx + (rand() - 0.5) * 0.06, slot.y + 0.04 + i * 0.085, CASE_D / 2 + 0.1);
    b.rotation.y = (rand() - 0.5) * 0.2;
    g.add(b);
  }
  bookcase.add(g);
  return g;
}

// column 1: moon lamp on top, About me books, then decor
let s;
(function aboutBooks() {
  s = slots[0][2];
  const g = books(s, 0.04, 0.82, 4, { lean: true });
  register(g, 'about', 'About me', { panel: 'about' });
})();
books(slots[0][1], 0.04, 0.9, 1);
books(slots[0][0], 0.04, 0.78, 3);
(function moonLamp() {
  const t = slots[0].top;
  const g = new THREE.Group();
  g.add(cyl(0.12, 0.15, 0.08, 0x8a6a4a, 0, 0.04, 0));
  const moonTex = canvasTexture(256, 128, (c, w, h) => {
    c.fillStyle = '#efe8da'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(150,140,120,${0.1 + rand() * 0.2})`; c.beginPath(); c.arc(rand() * w, rand() * h, 3 + rand() * 12, 0, 7); c.fill(); }
  });
  const moon = mesh(new THREE.SphereGeometry(0.34, 32, 20), new THREE.MeshStandardMaterial({ map: moonTex, roughness: 0.9, emissive: 0xffe6b0, emissiveIntensity: 0, emissiveMap: moonTex }), 0, 0.42, 0);
  g.add(moon);
  g.position.set(t.x - 0.2, t.y, CASE_D / 2);
  bookcase.add(g);
  pieces.moon = moon;
  register(g, 'lamp', 'Moon lamp: change the light', { action: 'lamp' });
})();

// column 2: zoetrope (animation), books
(function zoetrope() {
  s = slots[1][2];
  const g = new THREE.Group();
  g.add(cyl(0.05, 0.05, 0.3, C.ink, 0, 0.15, 0));
  g.add(cyl(0.2, 0.24, 0.04, C.ink, 0, 0.02, 0));
  const drumTex = canvasTexture(512, 64, (c, w, h) => {
    c.fillStyle = '#c94f3a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1b1612';
    for (let i = 0; i < 16; i++) c.fillRect(i * 32 + 12, 4, 8, 30);
    c.fillStyle = '#f6eedf';
    for (let i = 0; i < 16; i++) { const y = 46 + Math.sin(i / 16 * Math.PI * 2) * 6; c.beginPath(); c.arc(i * 32 + 16, y, 5, 0, 7); c.fill(); }
  });
  const drum = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.36, 32, 1, true), new THREE.MeshStandardMaterial({ map: drumTex, side: THREE.DoubleSide, roughness: 0.6 }), 0, 0.5, 0);
  g.add(drum);
  g.add(cyl(0.34, 0.34, 0.02, 0x1b1612, 0, 0.32, 0));
  g.position.set(s.x, s.y, CASE_D / 2 + 0.05);
  bookcase.add(g);
  pieces.drum = drum;
  register(g, 'animation', 'Animation', { panel: 'animation' });
})();
books(slots[1][1], 0.1, 0.85, 2, { lean: true });
books(slots[1][0], 0.05, 0.7, 3);

// column 3: mini arcade (web & games), blueprint tube (inventions), globe (OSINT)
(function arcade() {
  s = slots[2][3];
  const g = new THREE.Group();
  const body = mat(0x2b2f6b, { roughness: 0.5 });
  g.add(box(0.7, 1.15, 0.6, body, 0, 0.575, 0));
  g.add(box(0.74, 0.18, 0.64, 0xe0705a, 0, 1.2, 0));
  const screenTex = canvasTexture(128, 112, (c, w, h) => {
    c.fillStyle = '#0d1630'; c.fillRect(0, 0, w, h);
    const px = (x, y, col) => { c.fillStyle = col; c.fillRect(x * 8, y * 8, 8, 8); };
    [[3, 3], [4, 3], [5, 3], [2, 4], [6, 4], [2, 5], [6, 5]].forEach(([x, y]) => px(x, y, '#f2c94c'));
    [[10, 6], [11, 6], [10, 7], [11, 7]].forEach(([x, y]) => px(x, y, '#e0705a'));
    for (let x = 0; x < 16; x++) px(x, 12, '#3fa36b');
    c.fillStyle = '#fff'; c.font = '10px monospace'; c.fillText('ANGIE 1UP', 6, 12);
  });
  const screen = mesh(new THREE.PlaneGeometry(0.52, 0.44), new THREE.MeshStandardMaterial({ map: screenTex, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0.9 }), 0, 0.86, 0.302);
  g.add(screen);
  g.add(box(0.7, 0.08, 0.3, 0x1b1d40, 0, 0.55, 0.42));
  g.add(cyl(0.015, 0.015, 0.12, C.ink, -0.15, 0.65, 0.45, 8));
  g.add(sphere(0.04, 0xd9583b, -0.15, 0.72, 0.45));
  g.add(cyl(0.035, 0.035, 0.03, 0xf2c94c, 0.08, 0.6, 0.45, 12));
  g.add(cyl(0.035, 0.035, 0.03, 0x3fa36b, 0.2, 0.6, 0.45, 12));
  g.position.set(s.x, s.y, CASE_D / 2 - 0.05);
  g.scale.setScalar(0.92);
  bookcase.add(g);
  register(g, 'coding', 'Web & games', { panel: 'coding' });
})();
(function blueprint() {
  s = slots[2][2];
  books(s, 0.03, 0.55, 2);
  const g = new THREE.Group();
  g.add(cyl(0.12, 0.12, 1.25, C.navy, 0, 0.625, 0, 24, { roughness: 0.4 }));
  g.add(cyl(0.13, 0.13, 0.07, 0xd9b45a, 0, 1.25, 0, 24, { metalness: 0.6, roughness: 0.3 }));
  g.add(cyl(0.13, 0.13, 0.07, 0xd9b45a, 0, 0.035, 0, 24, { metalness: 0.6, roughness: 0.3 }));
  const sheet = new THREE.Group();
  const bpTex = canvasTexture(128, 96, (c, w, h) => {
    c.fillStyle = '#1f4f8f'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 2;
    c.strokeRect(14, 20, 50, 40); c.beginPath(); c.arc(90, 46, 20, 0, 7); c.stroke();
    c.beginPath(); c.moveTo(64, 40); c.lineTo(70, 40); c.stroke();
  });
  const sh = mesh(new THREE.PlaneGeometry(0.42, 0.32), new THREE.MeshStandardMaterial({ map: bpTex, side: THREE.DoubleSide }), 0, 0, 0);
  sheet.add(sh);
  sheet.position.set(0.32, 0.25, 0.1); sheet.rotation.set(-1.2, 0, 0.15);
  g.add(sheet);
  g.position.set(s.x + s.w * 0.28, s.y, CASE_D / 2 + 0.1);
  g.rotation.z = -0.08;
  bookcase.add(g);
  register(g, 'inventions', 'Inventions', { panel: 'inventions' });
})();
(function globe() {
  s = slots[2][1];
  const g = new THREE.Group();
  g.add(cyl(0.2, 0.26, 0.06, 0x6a4a2a, 0, 0.03, 0));
  g.add(cyl(0.025, 0.025, 0.25, 0x6a4a2a, 0, 0.18, 0, 8));
  const earth = canvasTexture(512, 256, (c, w, h) => {
    c.fillStyle = '#2f6fa8'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#7fb069';
    const blob = (x, y, rx, ry) => { c.beginPath(); c.ellipse(x, y, rx, ry, rand(), 0, 7); c.fill(); };
    blob(110, 80, 60, 40); blob(140, 170, 35, 55); blob(280, 75, 70, 35); blob(300, 150, 40, 50); blob(400, 90, 75, 40); blob(430, 190, 35, 22);
    c.fillStyle = '#e9e2cf'; c.fillRect(0, 0, w, 14); c.fillRect(0, h - 14, w, 14);
  });
  const ball = mesh(new THREE.SphereGeometry(0.4, 32, 20), new THREE.MeshStandardMaterial({ map: earth, roughness: 0.5 }), 0, 0.72, 0);
  ball.rotation.z = 0.4;
  g.add(ball);
  const ring = mesh(new THREE.TorusGeometry(0.45, 0.018, 8, 40, Math.PI * 1.2), mat(0xd9b45a, { metalness: 0.6, roughness: 0.3 }), 0, 0.72, 0);
  ring.rotation.set(0, Math.PI / 2, 0.4 - 0.35);
  g.add(ring);
  g.position.set(s.x - 0.15, s.y, CASE_D / 2 + 0.05);
  bookcase.add(g);
  pieces.globe = ball;
  register(g, 'security', 'Ethical hacking & OSINT', { panel: 'security' });
  bookStack(s, s.x + 0.5, 3, 0);
})();
books(slots[2][0], 0.04, 0.72, 3, { lean: true });

// column 4: mailbox (contact), books
(function mailbox() {
  s = slots[3][3];
  const g = new THREE.Group();
  const red = mat(C.coral, { roughness: 0.45 });
  g.add(box(0.5, 0.42, 0.62, red, 0, 0.21, 0));
  const top = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.62, 24), red, 0, 0.42, 0);
  top.rotation.x = Math.PI / 2;
  g.add(top);
  g.add(box(0.42, 0.5, 0.02, 0xf6eedf, 0, 0.36, 0.315));
  g.add(box(0.12, 0.03, 0.03, C.ink, 0, 0.4, 0.33));
  const flag = new THREE.Group();
  flag.add(box(0.03, 0.42, 0.03, 0xf2c94c, 0, 0.21, 0));
  flag.add(box(0.03, 0.12, 0.16, 0xf2c94c, 0, 0.38, -0.08));
  flag.position.set(0.27, 0.15, 0.05);
  g.add(flag);
  // a letter peeking out
  const letter = box(0.3, 0.2, 0.01, 0xfffaf1, 0, 0.62, 0.2);
  letter.rotation.x = -0.3;
  g.add(letter);
  g.position.set(s.x, s.y, CASE_D / 2);
  bookcase.add(g);
  pieces.flag = flag;
  register(g, 'contact', 'Say hello', { panel: 'contact' });
})();
books(slots[3][2], 0.05, 0.75, 4);
books(slots[3][1], 0.05, 0.6, 0, { lean: true });
bookStack(slots[3][1], slots[3][1].x + 0.38, 4, 3);
books(slots[3][0], 0.04, 0.85, 2);

// ---------- DJ table: controller + speakers ----------
(function djTable() {
  const g = new THREE.Group();
  const black = mat(C.black, { roughness: 0.5 });
  // table: solid front panel with an LED strip
  g.add(box(2.7, 1.2, 0.95, 0x1d1b22, 0, 0.6, 0, { roughness: 0.6 }));
  g.add(box(2.8, 0.07, 1.05, 0x2c2a33, 0, 1.235, 0));
  const led = mesh(new THREE.BoxGeometry(2.5, 0.05, 0.02), new THREE.MeshStandardMaterial({ color: 0xff5fa2, emissive: 0xff5fa2, emissiveIntensity: 1.2 }), 0, 1.06, 0.48);
  g.add(led);
  const logoTex = canvasTexture(256, 64, (c, w, h) => {
    c.fillStyle = '#1d1b22'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f6eedf'; c.font = '600 30px Georgia'; c.textAlign = 'center'; c.fillText('ANGIE', w / 2, 42);
  });
  g.add(mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshStandardMaterial({ map: logoTex, roughness: 0.6 }), 0, 0.6, 0.477));
  // controller
  const ctrl = new THREE.Group();
  ctrl.add(box(1.5, 0.08, 0.62, 0x2a2a30, 0, 0.04, 0, { roughness: 0.4 }));
  const platters = [];
  [-0.48, 0.48].forEach(x => {
    ctrl.add(cyl(0.24, 0.24, 0.02, 0x0f0f12, x, 0.09, 0.02, 40));
    const p = new THREE.Group();
    p.add(cyl(0.21, 0.21, 0.02, 0x3a3a44, 0, 0, 0, 40, { metalness: 0.5, roughness: 0.3 }));
    p.add(box(0.03, 0.022, 0.18, 0xf6eedf, 0, 0.005, 0.08));
    p.add(cyl(0.05, 0.05, 0.025, 0xff5fa2, 0, 0.005, 0, 20));
    p.position.set(x, 0.105, 0.02);
    ctrl.add(p);
    platters.push(p);
    // pads
    for (let i = 0; i < 4; i++) ctrl.add(box(0.07, 0.02, 0.07, i % 2 ? 0x55d6be : 0xff5fa2, x - 0.135 + i * 0.09, 0.09, 0.27, { emissive: i % 2 ? 0x55d6be : 0xff5fa2, emissiveIntensity: 0.5 }));
  });
  // mixer: knobs and faders
  for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) ctrl.add(cyl(0.025, 0.025, 0.04, 0xdedede, -0.06 + k * 0.12, 0.1, -0.2 + r * 0.1, 12));
  ctrl.add(box(0.02, 0.01, 0.16, 0x111111, -0.06, 0.085, 0.14));
  ctrl.add(box(0.02, 0.01, 0.16, 0x111111, 0.06, 0.085, 0.14));
  const faders = [box(0.05, 0.03, 0.03, 0xf6eedf, -0.06, 0.1, 0.12), box(0.05, 0.03, 0.03, 0xf6eedf, 0.06, 0.1, 0.18)];
  faders.forEach(f => ctrl.add(f));
  ctrl.add(box(0.14, 0.03, 0.04, 0xf6eedf, 0, 0.1, 0.27));
  ctrl.position.set(0, 1.27, 0.05);
  ctrl.rotation.x = 0.08;
  g.add(ctrl);
  // headphones resting on the table
  const hp = new THREE.Group();
  hp.add(mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 24, Math.PI), black, 0, 0, 0));
  hp.add(cyl(0.07, 0.07, 0.06, 0x2a2a30, -0.16, 0, 0, 16));
  hp.add(cyl(0.07, 0.07, 0.06, 0x2a2a30, 0.16, 0, 0, 16));
  hp.children[1].rotation.z = hp.children[2].rotation.z = Math.PI / 2;
  hp.position.set(0.95, 1.33, 0.25); hp.rotation.set(-1.35, 0, 0.3);
  g.add(hp);
  // studio monitors on stands at both ends
  const cones = [];
  [-1.55, 1.55].forEach(x => {
    const sp = new THREE.Group();
    sp.add(box(0.12, 1.1, 0.12, 0x2a2a30, 0, 0.55, 0));
    sp.add(box(0.5, 0.05, 0.5, 0x2a2a30, 0, 0.025, 0));
    const cab = box(0.62, 0.95, 0.58, 0x2b2530, 0, 1.58, 0, { roughness: 0.5 });
    sp.add(cab);
    sp.add(box(0.64, 0.97, 0.02, 0x3a3340, 0, 1.58, 0.29));
    const woofer = new THREE.Group();
    woofer.add(cyl(0.22, 0.22, 0.03, 0x111111, 0, 0, 0, 32));
    woofer.add(cyl(0.16, 0.2, 0.04, 0x2f2f36, 0, 0.02, 0, 32, { roughness: 0.9 }));
    woofer.add(cyl(0.06, 0.06, 0.05, 0x55d6be, 0, 0.03, 0, 20, { emissive: 0x55d6be, emissiveIntensity: 0.3 }));
    woofer.rotation.x = Math.PI / 2;
    woofer.position.set(0, 1.45, 0.3);
    sp.add(woofer);
    cones.push(woofer);
    const tw = cyl(0.07, 0.07, 0.03, 0x111111, 0, 1.85, 0.3, 20);
    tw.rotation.x = Math.PI / 2;
    sp.add(tw);
    sp.position.set(x, 0, 0.05);
    sp.rotation.y = x < 0 ? 0.18 : -0.18;
    g.add(sp);
  });
  // a crate of records under the table edge
  const crate = new THREE.Group();
  crate.add(box(0.62, 0.42, 0.5, 0xb07a45, 0, 0.21, 0));
  [0x5a2f4a, 0x23395f, 0xe0705a, 0x2f6f6a, 0xe3a838, 0x16151a].forEach((c, i) => {
    const r = box(0.5, 0.5, 0.02, c, 0, 0.33, -0.18 + i * 0.07);
    r.rotation.x = -0.18;
    crate.add(r);
  });
  crate.position.set(-0.85, 0, 0.85);
  crate.rotation.y = 0.15;
  g.add(crate);
  pieces.dj = g;
  pieces.platters = platters;
  pieces.cones = cones;
  pieces.led = led;
  scene.add(g);
  register(g, 'dj', 'Music & DJ', { panel: 'dj', lift: 0.02 });
})();

// ---------- the Pomeranian ----------
(function pomeranian() {
  const g = new THREE.Group();
  const fur = mat(C.pom, { roughness: 1 });
  const light = mat(C.pomLight, { roughness: 1 });
  const dark = mat(0x1b1410, { roughness: 0.4 });
  const fluffGeo = new THREE.IcosahedronGeometry(1, 1);
  const tuft = (r, m, x, y, z) => { const t = mesh(fluffGeo, m, x, y, z); t.scale.setScalar(r); t.rotation.set(rand() * 3, rand() * 3, 0); return t; };
  // sitting body: a pear of fluffy tufts
  const body = new THREE.Group();
  body.add(tuft(0.42, fur, 0, 0.4, -0.05));
  body.add(tuft(0.36, fur, 0, 0.72, 0.02));
  for (let i = 0; i < 14; i++) { // ruff around the chest
    const a = (i / 14) * Math.PI * 2;
    body.add(tuft(0.15 + rand() * 0.05, i % 3 ? fur : light, Math.cos(a) * 0.32, 0.86 + Math.sin(a * 2) * 0.04, Math.sin(a) * 0.24 + 0.06));
  }
  body.add(tuft(0.24, light, 0, 0.66, 0.24));
  // front legs and paws
  [-0.13, 0.13].forEach(x => { body.add(cyl(0.065, 0.075, 0.38, fur, x, 0.2, 0.24, 10)); body.add(tuft(0.085, light, x, 0.05, 0.3)); });
  // back haunches
  [-0.3, 0.3].forEach(x => body.add(tuft(0.2, fur, x, 0.2, -0.05)));
  g.add(body);
  // head
  const head = new THREE.Group();
  head.add(tuft(0.27, fur, 0, 0, 0));
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; head.add(tuft(0.1, fur, Math.cos(a) * 0.24, Math.sin(a) * 0.2, -0.04)); }
  head.add(tuft(0.15, light, 0, -0.07, 0.17)); // muzzle
  head.add(sphere(0.045, dark, 0, -0.03, 0.31)); // nose
  [-0.1, 0.1].forEach(x => {
    head.add(sphere(0.045, dark, x, 0.07, 0.22));
    head.add(sphere(0.013, mat(0xffffff), x + 0.015, 0.085, 0.262));
    const ear = mesh(new THREE.ConeGeometry(0.075, 0.17, 10), fur, x * 1.5, 0.27, -0.02);
    ear.rotation.z = -x * 2.2;
    head.add(ear);
  });
  const tongue = mesh(new THREE.SphereGeometry(0.035, 10, 8), mat(0xe86a7a), 0, -0.15, 0.25);
  tongue.scale.set(1, 0.6, 0.6);
  head.add(tongue);
  head.position.set(0, 1.18, 0.1);
  g.add(head);
  // plumed tail curled over the back
  const tail = new THREE.Group();
  for (let i = 0; i < 7; i++) { const t = i / 6; tail.add(tuft(0.12 + Math.sin(t * Math.PI) * 0.09, i % 2 ? fur : light, Math.sin(t * 2.4) * 0.22, 0.1 + t * 0.4 - t * t * 0.25, -t * 0.15)); }
  tail.position.set(0.18, 0.6, -0.35);
  g.add(tail);
  g.scale.setScalar(0.85);
  pieces.pom = g;
  pieces.pomHead = head;
  pieces.pomTail = tail;
  scene.add(g);
  register(g, 'pup', 'Meet the studio pup', { action: 'pup', lift: 0.02 });
})();

// ---------- layout: wide (desktop) and tall (phone) arrangements ----------
let mode = '';
const view = { cx: 0, cy: 4.4, dist: 30 };
function place(obj, x, y, z, s = 1) { obj.position.set(x, y, z); obj.scale.setScalar(s); }
function layout() {
  const aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
  mode = aspect < 0.9 ? 'tall' : 'wide';
  let rect;
  if (mode === 'wide') {
    place(pieces.shelf, -4.1, 7.1, 0);
    place(pieces.poster, -5.75, 4.45, 0);
    place(pieces.board, -3.25, 4.55, 0);
    place(pieces.painting, -0.75, 4.45, 0);
    place(pieces.bookcase, 4.05, 0, 0);
    place(pieces.dj, -1.35, 0, 0.75, 0.9);
    place(pieces.pom, 0.45, 0, 1.6, 0.85);
    pieces.pom.rotation.y = -0.35;
    rect = { x0: -8.1, x1: 8.1, y0: -1.3, y1: 9.1 };
  } else {
    place(pieces.shelf, -0.4, 12.2, 0, 0.9);
    place(pieces.poster, -2.6, 9.6, 0, 0.9);
    place(pieces.board, 0.1, 9.55, 0, 0.75);
    place(pieces.painting, 2.6, 9.8, 0, 0.75);
    place(pieces.bookcase, 0, 0, 0, 0.95);
    place(pieces.dj, -0.85, 0, 2.6, 0.85);
    place(pieces.pom, 1.85, 0, 3.0, 0.8);
    pieces.pom.rotation.y = -0.5;
    rect = { x0: -3.7, x1: 3.7, y0: -2.8, y1: 14.8 };
  }
  // fit the rectangle on the wall plane
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const h = rect.y1 - rect.y0, w = rect.x1 - rect.x0;
  const distH = h / 2 / Math.tan(vfov / 2);
  const distW = w / 2 / (Math.tan(vfov / 2) * aspect);
  view.dist = Math.max(distH, distW);
  view.cx = (rect.x0 + rect.x1) / 2;
  view.cy = (rect.y0 + rect.y1) / 2;
  sun.target.position.set(view.cx + 2, 3, 0);
  sun.position.set(view.cx - 9, 14, 11);
}

// ---------- discovery counter ----------
const STORE = 'vaw-found';
let found = new Set();
try { found = new Set(JSON.parse(localStorage.getItem(STORE) || '[]')); } catch (e) {}
function markFound(key) {
  found.add(key);
  try { localStorage.setItem(STORE, JSON.stringify([...found])); } catch (e) {}
  renderCounter();
}
function renderCounter() {
  const n = [...found].filter(k => things.has(k)).length;
  if (counterEl) counterEl.textContent = `${n} of ${things.size} discovered`;
}
renderCounter();

// ---------- toast ----------
let toastTimer;
function toast(text, ms = 2600) {
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

// ---------- day / night (moon lamp) ----------
const moonLight = new THREE.PointLight(0xffd9a0, 0, 9, 1.6);
scene.add(moonLight);
let night = root.getAttribute('data-theme') === 'night';
function applyTheme() {
  night = root.getAttribute('data-theme') === 'night';
  sun.intensity = night ? 0.25 : 3.0;
  hemi.intensity = night ? 0.18 : 0.8;
  fill.intensity = night ? 0.12 : 0.35;
  moonLight.intensity = night ? 6 : 0;
  pieces.moon.material.emissiveIntensity = night ? 1.1 : 0.05;
  scene.background.set(night ? 0x15110e : 0x2b231d);
}
new MutationObserver(applyTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
applyTheme();

// ---------- hover / hints ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovered = null;
let hints = false;
function pick(clientX, clientY) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickables, false)[0];
  return hit ? hit.object.userData.thing : null;
}
function glow(key, amount, color = 0xffc94d) {
  const t = things.get(key);
  t.group.traverse(o => {
    if (!o.isMesh || !o.material.emissive) return;
    const base = o.material.userData.baseEmissive;
    if (amount > 0) { o.material.emissive.set(color); o.material.emissiveIntensity = amount; }
    else if (base) { o.material.emissive.copy(base); o.material.emissiveIntensity = o.material.userData.baseIntensity ?? o.material.emissiveIntensity; }
  });
}
// remember each material's own emissive intensity (screens, LEDs, moon)
for (const t of things.values()) t.group.traverse(o => { if (o.isMesh) o.material.userData.baseIntensity = o.material.emissiveIntensity; });
function setHover(key) {
  if (hovered === key) return;
  if (hovered && !hints) glow(hovered, 0);
  hovered = key;
  renderer.domElement.style.cursor = key ? 'pointer' : '';
  if (key) {
    glow(key, 0.1);
    chip.textContent = things.get(key).label;
    chip.classList.add('show');
  } else chip.classList.remove('show');
}
function setHints(on) {
  hints = on;
  for (const k of things.keys()) glow(k, 0);
  if (hovered) glow(hovered, 0.1);
}
window.addEventListener('vaw:hints', e => setHints(e.detail));

// ---------- activating things ----------
let busy = false;
function activate(key) {
  const t = things.get(key);
  if (!t || busy) return;
  markFound(key);
  setHover(null);
  if (t.action === 'lamp') { document.getElementById('lamp')?.click(); toast(night ? 'Lights on' : 'Moonlight'); return; }
  if (t.action === 'wiggle') { anim.wiggle = 1; toast('Thanks for the water!'); return; }
  if (t.action === 'pup') { anim.wag = 1; toast('Woof! The studio pup approves of you.'); return; }
  // ease the camera toward the object, then open its panel
  const c = new THREE.Box3().setFromObject(t.group).getCenter(new THREE.Vector3());
  busy = true;
  flyTo(c, 0.55, 650, () => { busy = false; window.openPanel(t.panel); });
}
window.room3dOpen = activate;
document.querySelectorAll('.panel').forEach(d => d.addEventListener('close', () => {
  if (document.body.classList.contains('mode-3d')) flyTo(null, 0, 700);
}));

// camera: from home view toward a point (0 = home, 1 = at the point)
const cam = { from: new THREE.Vector3(), to: new THREE.Vector3(), t0: 0, ms: 1, done: null, focus: new THREE.Vector3(), k: 0, kFrom: 0, kTo: 0 };
function flyTo(point, k, ms, done) {
  if (point) cam.focus.copy(point);
  cam.kFrom = cam.k; cam.kTo = k; cam.t0 = performance.now(); cam.ms = reduceMotion ? 1 : ms; cam.done = done || null;
}

// ---------- pointer ----------
const parallax = new THREE.Vector2();
let down = null;
renderer.domElement.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') {
    parallax.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    if (!busy) setHover(pick(e.clientX, e.clientY));
  }
});
renderer.domElement.addEventListener('pointerleave', () => setHover(null));
renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 10) return;
  const key = pick(e.clientX, e.clientY);
  if (key) activate(key);
});

// ---------- loop ----------
const anim = { wiggle: 0, wag: 0 };
const tmp = new THREE.Vector3();
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  // camera
  const p = Math.min(1, (performance.now() - cam.t0) / cam.ms);
  const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  cam.k = cam.kFrom + (cam.kTo - cam.kFrom) * e;
  if (p === 1 && cam.done) { const d = cam.done; cam.done = null; d(); }
  const sway = reduceMotion || coarse ? 0 : 1;
  const home = tmp.set(view.cx + parallax.x * 0.35 * sway, view.cy - parallax.y * 0.2 * sway + view.dist * 0.07, view.dist);
  const look = new THREE.Vector3(view.cx, view.cy, 0).lerp(cam.focus, cam.k);
  const focusPos = cam.focus.clone().add(new THREE.Vector3(0, 0.3, view.dist * 0.45));
  camera.position.copy(home).lerp(focusPos, cam.k);
  camera.lookAt(look);

  if (!reduceMotion) {
    pieces.drum.rotation.y += dt * 1.6;
    pieces.globe.rotation.y += dt * 0.25;
    pieces.platters.forEach((pl, i) => { pl.rotation.y -= dt * (i ? 3.5 : 3.2); });
    const beat = Math.pow(Math.max(0, Math.sin(time * Math.PI * 2 * 2)), 8);
    pieces.cones.forEach(c => { c.scale.y = 1 + beat * 0.6; });
    pieces.led.material.emissiveIntensity = 0.8 + beat * 0.8;
    pieces.pomHead.rotation.z = Math.sin(time * 0.8) * 0.06;
    pieces.pomTail.rotation.y = Math.sin(time * (anim.wag > 0 ? 18 : 2)) * (anim.wag > 0 ? 0.5 : 0.12);
    pieces.flag.rotation.x = hovered === 'contact' ? -1.2 : 0;
  }
  if (anim.wag > 0) {
    anim.wag = Math.max(0, anim.wag - dt / 1.8);
    pieces.pom.position.y = Math.abs(Math.sin(anim.wag * Math.PI * 4)) * 0.25 * anim.wag;
  }
  if (anim.wiggle > 0) {
    anim.wiggle = Math.max(0, anim.wiggle - dt / 1.2);
    pieces.plant.userData.vines.rotation.z = Math.sin(anim.wiggle * 18) * 0.06 * anim.wiggle;
  } else if (!reduceMotion) pieces.plant.userData.vines.rotation.z = Math.sin(time * 0.7) * 0.008;
  // hover lift + hint pulse
  for (const [k, t] of things) {
    const target = k === hovered ? 1 : 0;
    t.h = (t.h || 0) + (target - (t.h || 0)) * Math.min(1, dt * 10);
    t.group.position.z = (t.baseZ ??= t.group.position.z) + t.h * t.lift * 3;
    if (hints && k !== hovered) {
      const amt = found.has(k) ? 0.08 : 0.22 + Math.sin(time * 3) * 0.12;
      glow(k, amt);
    }
  }
  // label chip follows the hovered object's top
  if (hovered) {
    const b = new THREE.Box3().setFromObject(things.get(hovered).group);
    const top = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, b.max.z).project(camera);
    chip.style.transform = `translate(${(top.x * 0.5 + 0.5) * stage.clientWidth}px, ${(-top.y * 0.5 + 0.5) * stage.clientHeight}px) translate(-50%, -130%)`;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  for (const t of things.values()) t.baseZ = undefined;
  layout();
}
window.addEventListener('resize', resize);
resize();
document.body.classList.add('room-ready');
requestAnimationFrame(frame);

// time-of-day greeting, like a note on the door
const hr = new Date().getHours();
setTimeout(() => toast(hr < 12 ? 'good morning' : hr < 18 ? 'good afternoon' : 'good evening'), 900);

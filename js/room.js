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
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x24171a);
// soft studio reflections: a small room of light panels baked into an env map
(function environment() {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(12, 7, 12), new THREE.MeshBasicMaterial({ color: 0x9a8f82, side: THREE.BackSide })));
  const panel = (w, h, x, y, z, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.96, 0.9).multiplyScalar(k) }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
  };
  panel(5, 3, -5.9, 1.5, 2, 6); panel(4, 4, 0, 3.4, 0, 3); panel(3, 2, 5.9, 1, -1, 1.5); panel(6, 2, 0, 0.5, 5.9, 1.2);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, 0.04).texture;
  scene.environmentIntensity = 0.55;
})();
const camera = new THREE.PerspectiveCamera(30, stage.clientWidth / stage.clientHeight, 0.1, 120);

// ---------- palette & helpers ----------
const C = {
  wall: 0xe6dfd3, floor: 0xc4a684, skirting: 0x1f1517, oak: 0xc9a982, oakDark: 0xb28f68,
  ink: 0x2a2724, paper: 0xf5f1ea, linen: 0xd9cfbf, stone: 0xd8cbb6, travertine: 0xe2d6c2,
  black: 0x1d1c1b, brass: 0xb89a62, white: 0xf3f1ec, pom: 0xe4954a, pomLight: 0xf6c58c,
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
// box with softly rounded edges, for anything that should read as a real product
function rbox(w, h, d, r, c, x, y, z, opts) {
  const sh = new THREE.Shape();
  const hw = w / 2 - r, hh = h / 2 - r;
  sh.moveTo(-hw, -h / 2); sh.lineTo(hw, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -hh);
  sh.lineTo(w / 2, hh); sh.quadraticCurveTo(w / 2, h / 2, hw, h / 2); sh.lineTo(-hw, h / 2);
  sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, hh); sh.lineTo(-w / 2, -hh); sh.quadraticCurveTo(-w / 2, -h / 2, -hw, -h / 2);
  const b = Math.min(r, d / 2) * 0.9;
  const geo = new THREE.ExtrudeGeometry(sh, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b * 0.6, bevelSegments: 4, curveSegments: 6 });
  geo.translate(0, 0, -(d - 2 * b) / 2);
  return mesh(geo, asMat(c, opts), x, y, z);
}
// fine noise used as a roughness / bump map so surfaces don't look like plastic
function grainTexture(size, lines) {
  const t = canvasTexture(size, size, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < size * 12; i++) {
      const v = Math.floor(100 + rand() * 80);
      g.fillStyle = `rgba(${v},${v},${v},.35)`;
      if (lines) g.fillRect(0, rand() * h, w, 1 + rand() * 1.5); else g.fillRect(rand() * w, rand() * h, 2, 2);
    }
  });
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
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
// dark designer wallpaper: original baroque damask in antique gold on a deep oxblood-black ground
const wallTex = canvasTexture(512, 512, (g, w, h) => {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#2b1a1c'); bg.addColorStop(1, '#22151a');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(${rand() > 0.5 ? '255,220,180' : '0,0,0'},${0.015 + rand() * 0.03})`; g.fillRect(0, y, w, 1); }
  // one half of the ornament; drawn twice, mirrored, for a symmetric damask
  const half = () => {
    g.beginPath();
    g.moveTo(0, -150); g.bezierCurveTo(40, -120, 70, -80, 30, -40);
    g.bezierCurveTo(90, -60, 120, -10, 80, 30);
    g.bezierCurveTo(130, 40, 120, 110, 60, 120);
    g.bezierCurveTo(50, 150, 20, 160, 0, 170);
    g.stroke();
    g.beginPath(); g.moveTo(30, -40); g.bezierCurveTo(10, -10, 20, 20, 0, 40); g.stroke();
    g.beginPath(); g.moveTo(80, 30); g.bezierCurveTo(50, 50, 40, 80, 60, 120); g.stroke();
    // curling acanthus leaves
    for (const [x, y, r, a] of [[95, -55, 16, 0.4], [118, 70, 20, -0.3], [55, -105, 12, 0.9], [35, 150, 12, -0.8]]) {
      g.beginPath(); g.arc(x, y, r, a, a + Math.PI * 1.5); g.stroke();
      g.beginPath(); g.arc(x + r * 0.35, y, r * 0.45, a, a + Math.PI * 1.4); g.stroke();
    }
    g.beginPath(); g.ellipse(26, 70, 9, 22, 0.3, 0, 7); g.fill();
    g.beginPath(); g.ellipse(48, -12, 6, 15, -0.6, 0, 7); g.fill();
  };
  const ornament = (cx, cy, k) => {
    g.save(); g.translate(cx, cy); g.scale(k, k);
    g.strokeStyle = 'rgba(196,158,92,.62)'; g.fillStyle = 'rgba(196,158,92,.5)'; g.lineWidth = 3.2 / k; g.lineCap = 'round';
    half(); g.scale(-1, 1); half();
    g.beginPath(); g.ellipse(0, 10, 12, 30, 0, 0, 7); g.fill();
    g.beginPath(); g.arc(0, -150, 7, 0, 7); g.fill();
    g.restore();
  };
  ornament(128, 128, 0.62); ornament(384, 384, 0.62);
  ornament(384, -128, 0.62); ornament(128, 640, 0.62); ornament(-128, 384, 0.62); ornament(640, 128, 0.62);
  // small fleurons between the medallions
  g.fillStyle = 'rgba(196,158,92,.45)';
  for (const [x, y] of [[384, 128], [128, 384], [0, 0], [512, 0], [0, 512], [512, 512], [256, 256]]) {
    for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(x + Math.cos(k * Math.PI / 2) * 9, y + Math.sin(k * Math.PI / 2) * 9, 4, 8, k * Math.PI / 2, 0, 7); g.fill(); }
  }
});
wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
wallTex.repeat.set(26, 15);
const wallBump = grainTexture(256, true);
wallBump.repeat.set(26, 15);
const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.7, metalness: 0.08, bumpMap: wallBump, bumpScale: 0.6 });
const wallMesh = mesh(new THREE.PlaneGeometry(70, 40), wallMat, 0, 15, 0);
wallMesh.castShadow = false;
scene.add(wallMesh);

const floorTex = canvasTexture(1024, 1024, (g, w, h) => {
  const plank = 128;
  for (let i = 0; i < w / plank; i++) {
    const s = 92 + Math.floor(rand() * 16);
    g.fillStyle = `rgb(${s},${Math.round(s * 0.66)},${Math.round(s * 0.46)})`;
    g.fillRect(0, i * plank, w, plank);
    for (let k = 0; k < 90; k++) { // grain
      g.strokeStyle = `rgba(30,18,10,${0.06 + rand() * 0.1})`; g.lineWidth = 0.6 + rand() * 1.4;
      const y = i * plank + rand() * plank;
      g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (rand() - 0.5) * 8, w * 0.7, y + (rand() - 0.5) * 8, w, y + (rand() - 0.5) * 4); g.stroke();
    }
    g.fillStyle = 'rgba(20,12,6,.5)'; g.fillRect(0, i * plank, w, 2);
    g.fillRect(((i * 397) % w), i * plank, 2, plank);
  }
});
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
floorTex.repeat.set(6, 3);
const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.38 });
const floor = mesh(new THREE.PlaneGeometry(70, 24), floorMat, 0, 0, 12);
floor.rotation.x = -Math.PI / 2;
floor.castShadow = false;
scene.add(floor);
scene.add(box(70, 0.42, 0.05, C.skirting, 0, 0.21, 0.025, { roughness: 0.6 }));

// ---------- lights ----------
const hemi = new THREE.HemisphereLight(0xfffaf2, 0x9c8a74, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0dc, 2.4);
sun.position.set(-9, 14, 11);
sun.castShadow = true;
sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 16, bottom: -6, near: 1, far: 50 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 9;
sun.shadow.blurSamples = 16;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xe8eefc, 0.5);
fill.position.set(8, 6, 10);
scene.add(fill);

const oakTex = canvasTexture(512, 512, (g, w, h) => {
  g.fillStyle = '#c9a982'; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 160; k++) {
    g.strokeStyle = `rgba(${rand() > 0.5 ? '140,100,62' : '232,212,182'},${0.08 + rand() * 0.12})`; g.lineWidth = 0.5 + rand() * 2;
    const y = rand() * h;
    g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (rand() - 0.5) * 14, w * 0.6, y + (rand() - 0.5) * 14, w, y + (rand() - 0.5) * 6); g.stroke();
  }
});
oakTex.wrapS = oakTex.wrapT = THREE.RepeatWrapping;
const oak = new THREE.MeshStandardMaterial({ map: oakTex, roughness: 0.62 });
const oakShade = new THREE.MeshStandardMaterial({ map: oakTex, color: 0xd9cbb8, roughness: 0.7 });
const lacquer = new THREE.MeshPhysicalMaterial({ color: 0xf6f4ef, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
const lacquerShade = new THREE.MeshPhysicalMaterial({ color: 0xebe7df, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.12 });

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
  g.add(cyl(0.42, 0.36, 0.6, C.travertine, 0, 0.3, 0, 40, { roughness: 0.85 }));
  g.add(cyl(0.39, 0.39, 0.04, 0x4a3a2c, 0, 0.58, 0));
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
  g.add(rbox(6.6, 0.22, 0.8, 0.03, lacquer, 0, 0, 0.4));
  const plant = trailingPlant();
  plant.position.set(-2.35, 0.12, 0.4);
  g.add(plant);
  pieces.plant = plant;
  register(plant, 'plant', 'Water the plant', { action: 'wiggle', lift: 0 });
  // two more of ANGIE's film posters, gallery framed
  const posterTex = (url) => imageTexture(url, 150, 210, (c, w, h) => { c.fillStyle = '#2a2724'; c.fillRect(0, 0, w, h); });
  const films = new THREE.Group();
  const f1 = pictureFrame(0.92, 1.24, posterTex('images/poster-hydra.jpg'), C.black);
  f1.position.set(0, 0.12, 0.35); f1.rotation.x = -0.08;
  const f2 = pictureFrame(0.86, 1.14, posterTex('images/poster-tomiris.jpg'), 0xf6f4ef);
  f2.position.set(1.05, 0.12, 0.45); f2.rotation.set(-0.08, -0.12, 0);
  films.add(f1, f2);
  films.position.set(0.15, 0, 0);
  g.add(films);
  register(films, 'films', 'More of my films', { panel: 'film' });
  // a vintage rangefinder camera for Photography
  const cam = new THREE.Group();
  cam.add(rbox(0.62, 0.36, 0.22, 0.04, C.black, 0, 0.18, 0, { roughness: 0.55 }));
  cam.add(rbox(0.6, 0.1, 0.2, 0.02, mat(0xc9ccd0, { metalness: 0.9, roughness: 0.3 }), 0, 0.4, 0));
  const lens = cyl(0.12, 0.13, 0.16, mat(0xc9ccd0, { metalness: 0.9, roughness: 0.25 }), 0.04, 0.18, 0.16, 40);
  lens.rotation.x = Math.PI / 2;
  cam.add(lens);
  const glassL = cyl(0.085, 0.085, 0.02, mat(0x223344, { metalness: 0.3, roughness: 0.05 }), 0.04, 0.18, 0.245, 32);
  glassL.rotation.x = Math.PI / 2;
  cam.add(glassL);
  cam.add(box(0.1, 0.06, 0.02, 0x8fa0b0, -0.2, 0.36, 0.11, { metalness: 0.3, roughness: 0.1 }));
  cam.add(cyl(0.035, 0.035, 0.05, mat(0xc9ccd0, { metalness: 0.9, roughness: 0.3 }), 0.2, 0.47, 0, 20));
  cam.position.set(2.75, 0.12, 0.4); cam.rotation.y = -0.35;
  g.add(cam);
  register(cam, 'photo', 'Photography', { panel: 'photo' });
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
  g.add(box(1.5, 1.94, 0.06, C.black, 0, 0, 0.03, { roughness: 0.4 }));
  g.add(box(1.42, 1.86, 0.02, C.paper, 0, 0, 0.065));
  g.add(mesh(new THREE.PlaneGeometry(1.08, 1.44), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), 0, 0, 0.077));
  const glass = mesh(new THREE.PlaneGeometry(1.42, 1.86), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.05, metalness: 0 }), 0, 0, 0.08);
  glass.castShadow = false;
  g.add(glass);
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
    g.fillStyle = '#d6ccbb'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 640; i++) { g.fillStyle = `rgba(${i % 2 ? '120,105,85' : '245,238,226'},.18)`; g.fillRect(0, i * 0.66, w, 0.5); g.fillRect(i, 0, 0.5, h); }
    g.fillStyle = '#f6eedf'; g.save(); g.translate(40, 22); g.rotate(-0.02); g.fillRect(0, 0, 150, 38);
    g.fillStyle = '#3a2a20'; g.font = '600 22px Georgia'; g.fillText('Awards', 26, 27); g.restore();
    const cols = ['#faf7f1', '#efe8dc', '#faf7f1', '#e9e2d6', '#efe8dc', '#faf7f1', '#e9e2d6', '#faf7f1'];
    const pins = ['#b89a62', '#1d1c1b', '#b89a62', '#1d1c1b'];
    notes.forEach((n, i) => {
      const x = 40 + (i % 4) * 148, y = 92 + Math.floor(i / 4) * 160;
      g.save(); g.translate(x + 60, y + 55); g.rotate((rand() - 0.5) * 0.12);
      g.fillStyle = 'rgba(60,45,30,.18)'; g.fillRect(-56, -46, 120, 108);
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
  g.add(rbox(2.7, 1.78, 0.08, 0.02, oak, 0, 0, 0.04));
  g.add(mesh(new THREE.PlaneGeometry(2.56, 1.66), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), 0, 0, 0.082));
  register(g, 'impact', 'Awards & impact', { panel: 'impact' });
  pieces.board = g;
  scene.add(g);
})();
(function painting() {
  const tex = canvasTexture(320, 256, (g, w, h) => {
    g.fillStyle = '#ece5d8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c9b79c'; g.beginPath(); g.ellipse(120, 150, 110, 70, -0.2, 0, 7); g.fill();
    g.fillStyle = '#b5673f'; g.beginPath(); g.arc(225, 90, 42, 0, 7); g.fill();
    g.strokeStyle = '#1d1c1b'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(40, 60); g.bezierCurveTo(120, 20, 170, 200, 290, 190); g.stroke();
    g.globalAlpha = 0.5; g.fillStyle = '#8f9a86'; g.fillRect(30, 200, 140, 30); g.globalAlpha = 1;
  });
  const g = new THREE.Group();
  g.add(box(1.5, 1.22, 0.1, oak, 0, 0, 0.05));
  g.add(box(1.4, 1.12, 0.02, 0x2a2724, 0, 0, 0.1));
  g.add(box(1.3, 1.02, 0.08, 0xece5d8, 0, 0, 0.12));
  g.add(mesh(new THREE.PlaneGeometry(1.3, 1.02), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), 0, 0, 0.161));
  register(g, 'painting', 'Painting', { panel: 'painting' });
  pieces.painting = g;
  scene.add(g);
})();

// ---------- stepped bookcase ----------
const COLS = [{ w: 1.7, h: 5.5, n: 3 }, { w: 1.2, h: 4.2, n: 3 }, { w: 1.85, h: 7.2, n: 4 }, { w: 1.45, h: 6.05, n: 4 }];
const CASE_W = COLS.reduce((s, c) => s + c.w, 0);
const CASE_D = 1.05, T = 0.07, PLINTH = 0.12;
const bookcase = new THREE.Group();
const slots = []; // slots[col][row] = { x, y, w, h } in bookcase space, y = top of the shelf board
(function buildCase() {
  const yellow = lacquer;
  const inner = lacquerShade;
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
  [0xe9e2d4, 0xd8cbb6, 0x2a2724, 0x8b7d6b, 0xf3efe7, 0xb9a88f],
  [0xa7ad9a, 0x8f9a86, 0xd8d2c2, 0x6f7a6a, 0xe9e2d4],
  [0xe2d3bb, 0xcbb595, 0xf1e9dc, 0xb39a77, 0xddd2c0],
  [0x2a2724, 0x45403a, 0x6b625a, 0x8b7d6b, 0x1d1c1b],
  [0xb5673f, 0xc98b65, 0xe2d3bb, 0x8f4e33, 0xeae1d2],
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
    if (rand() > 0.7) b.add(box(bw + 0.004, 0.025, bd + 0.004, C.brass, 0, bh * 0.32, 0, { metalness: 0.7, roughness: 0.35 }));
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

function vessel(slot, dx, hRatio, r, color) {
  const h = slot.h * hRatio;
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new THREE.Vector2(r * (0.55 + 0.6 * Math.sin(Math.PI * (0.15 + t * 0.75))) * (t > 0.92 ? 0.7 : 1), t * h));
  }
  const v = mesh(new THREE.LatheGeometry(pts, 48), new THREE.MeshPhysicalMaterial({ color, roughness: 0.75, clearcoat: 0.15, side: THREE.DoubleSide }), slot.x + dx, slot.y, CASE_D / 2 + 0.05);
  bookcase.add(v);
  return v;
}
vessel(slots[0][0], 0.45, 0.55, 0.2, C.paper);

// column 1: moon lamp on top, About me books, then decor
let s;
(function aboutBooks() {
  s = slots[0][2];
  const g = books(s, 0.04, 0.82, 4, { lean: true });
  register(g, 'about', 'About me', { panel: 'about' });
})();
books(slots[0][1], 0.04, 0.9, 1);
books(slots[0][0], 0.04, 0.55, 3);
(function moonLamp() {
  const t = slots[0].top;
  const g = new THREE.Group();
  g.add(cyl(0.13, 0.16, 0.08, C.brass, 0, 0.04, 0, 32, { metalness: 0.8, roughness: 0.35 }));
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
  g.add(cyl(0.04, 0.04, 0.3, C.brass, 0, 0.15, 0, 16, { metalness: 0.8, roughness: 0.35 }));
  g.add(cyl(0.2, 0.24, 0.05, C.travertine, 0, 0.025, 0, 40, { roughness: 0.8 }));
  const drumTex = canvasTexture(512, 64, (c, w, h) => {
    c.fillStyle = '#26231f'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#0c0b0a';
    for (let i = 0; i < 16; i++) c.fillRect(i * 32 + 12, 4, 8, 30);
    c.fillStyle = '#e9e2d4';
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
vessel(slots[1][0], 0, 0.62, 0.18, C.black);

// column 3: mini arcade (web & games), blueprint tube (inventions), globe (OSINT)
(function arcade() {
  s = slots[2][3];
  const g = new THREE.Group();
  const body = mat(C.white, { roughness: 0.45 });
  g.add(rbox(0.7, 1.15, 0.6, 0.04, body, 0, 0.575, 0));
  g.add(rbox(0.74, 0.16, 0.64, 0.03, oakShade, 0, 1.2, 0));
  const screenTex = canvasTexture(128, 112, (c, w, h) => {
    c.fillStyle = '#0d1630'; c.fillRect(0, 0, w, h);
    const px = (x, y, col) => { c.fillStyle = col; c.fillRect(x * 8, y * 8, 8, 8); };
    [[3, 3], [4, 3], [5, 3], [2, 4], [6, 4], [2, 5], [6, 5]].forEach(([x, y]) => px(x, y, '#f2c94c'));
    [[10, 6], [11, 6], [10, 7], [11, 7]].forEach(([x, y]) => px(x, y, '#e0705a'));
    for (let x = 0; x < 16; x++) px(x, 12, '#3fa36b');
    c.fillStyle = '#fff'; c.font = '10px monospace'; c.fillText('ANGIE 1UP', 6, 12);
  });
  const screen = mesh(new THREE.PlaneGeometry(0.52, 0.44), new THREE.MeshStandardMaterial({ map: screenTex, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0.7, roughness: 0.15 }), 0, 0.86, 0.302);
  g.add(screen);
  g.add(rbox(0.7, 0.08, 0.3, 0.02, C.black, 0, 0.55, 0.42));
  g.add(cyl(0.015, 0.015, 0.12, C.ink, -0.15, 0.65, 0.45, 8));
  g.add(sphere(0.04, C.black, -0.15, 0.72, 0.45));
  g.add(cyl(0.035, 0.035, 0.03, C.white, 0.08, 0.6, 0.45, 16));
  g.add(cyl(0.035, 0.035, 0.03, C.white, 0.2, 0.6, 0.45, 16));
  g.position.set(s.x, s.y, CASE_D / 2 - 0.05);
  g.scale.setScalar(0.92);
  bookcase.add(g);
  register(g, 'coding', 'Web & games', { panel: 'coding' });
})();
(function blueprint() {
  s = slots[2][2];
  books(s, 0.03, 0.55, 2);
  const g = new THREE.Group();
  g.add(cyl(0.12, 0.12, 1.25, C.black, 0, 0.625, 0, 32, { roughness: 0.5 }));
  g.add(cyl(0.13, 0.13, 0.07, C.brass, 0, 1.25, 0, 32, { metalness: 0.8, roughness: 0.3 }));
  g.add(cyl(0.13, 0.13, 0.07, C.brass, 0, 0.035, 0, 32, { metalness: 0.8, roughness: 0.3 }));
  const sheet = new THREE.Group();
  const bpTex = canvasTexture(128, 96, (c, w, h) => {
    c.fillStyle = '#f3efe7'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(40,40,40,.7)'; c.lineWidth = 1.5;
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
  g.add(cyl(0.2, 0.26, 0.06, C.black, 0, 0.03, 0, 40, { roughness: 0.4 }));
  g.add(cyl(0.022, 0.022, 0.25, C.brass, 0, 0.18, 0, 12, { metalness: 0.8, roughness: 0.3 }));
  const earth = canvasTexture(512, 256, (c, w, h) => {
    c.fillStyle = '#8b9ba3'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e3d6c0';
    const blob = (x, y, rx, ry) => { c.beginPath(); c.ellipse(x, y, rx, ry, rand(), 0, 7); c.fill(); };
    blob(110, 80, 60, 40); blob(140, 170, 35, 55); blob(280, 75, 70, 35); blob(300, 150, 40, 50); blob(400, 90, 75, 40); blob(430, 190, 35, 22);
    c.fillStyle = '#f3efe7'; c.fillRect(0, 0, w, 14); c.fillRect(0, h - 14, w, 14);
  });
  const ball = mesh(new THREE.SphereGeometry(0.4, 32, 20), new THREE.MeshPhysicalMaterial({ map: earth, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 }), 0, 0.72, 0);
  ball.rotation.z = 0.4;
  g.add(ball);
  const ring = mesh(new THREE.TorusGeometry(0.45, 0.018, 8, 40, Math.PI * 1.2), mat(C.brass, { metalness: 0.8, roughness: 0.3 }), 0, 0.72, 0);
  ring.rotation.set(0, Math.PI / 2, 0.4 - 0.35);
  g.add(ring);
  g.position.set(s.x - 0.15, s.y, CASE_D / 2 + 0.05);
  bookcase.add(g);
  pieces.globe = ball;
  register(g, 'security', 'Ethical hacking & OSINT', { panel: 'security' });
  bookStack(s, s.x + 0.5, 3, 0);
})();
books(slots[2][0], 0.04, 0.5, 3);
vessel(slots[2][0], 0.45, 0.48, 0.22, C.travertine);
vessel(slots[2][0], 0.68, 0.3, 0.16, 0xb5673f);

// column 4: mailbox (contact), books
(function mailbox() {
  s = slots[3][3];
  const g = new THREE.Group();
  const red = mat(C.black, { roughness: 0.5, metalness: 0.2 });
  g.add(box(0.5, 0.42, 0.62, red, 0, 0.21, 0));
  const top = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.62, 24), red, 0, 0.42, 0);
  top.rotation.x = Math.PI / 2;
  g.add(top);
  g.add(box(0.44, 0.52, 0.02, 0x2a2826, 0, 0.36, 0.315, { roughness: 0.45 }));
  g.add(box(0.14, 0.03, 0.03, C.brass, 0, 0.42, 0.33, { metalness: 0.8, roughness: 0.3 }));
  const flag = new THREE.Group();
  flag.add(box(0.03, 0.42, 0.03, C.brass, 0, 0.21, 0, { metalness: 0.8, roughness: 0.3 }));
  flag.add(box(0.03, 0.12, 0.16, C.brass, 0, 0.38, -0.08, { metalness: 0.8, roughness: 0.3 }));
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
bookStack(slots[3][0], slots[3][0].x - 0.25, 5, 0);
vessel(slots[3][0], 0.3, 0.72, 0.2, C.stone);

// ---------- DJ table: white controller + white speakers ----------
(function djTable() {
  const g = new THREE.Group();
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf4f3ef, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  const satin = mat(0x2b2b2e, { roughness: 0.45, metalness: 0.2 });
  const alu = mat(0xc9ccd0, { metalness: 0.9, roughness: 0.28 });
  const stone = mat(C.travertine, { roughness: 0.8 });
  // console: white lacquer slab on two lacquer plinths, travertine footing
  g.add(rbox(2.9, 0.12, 1.0, 0.04, lacquer, 0, 1.02, 0));
  [-1.05, 1.05].forEach(x => { g.add(rbox(0.5, 0.92, 0.8, 0.05, lacquer, x, 0.5, 0)); g.add(rbox(0.54, 0.05, 0.84, 0.02, stone, x, 0.025, 0)); });
  // controller body, tilted toward the room
  const ctrl = new THREE.Group();
  ctrl.add(rbox(1.9, 0.09, 0.72, 0.04, white, 0, 0.045, 0));
  ctrl.add(box(1.82, 0.012, 0.64, 0xeeede8, 0, 0.096, 0, { roughness: 0.5 }));
  const platters = [];
  [-0.6, 0.6].forEach((x, i) => {
    // jog wheel: white rim, brushed aluminium platter, black display ring
    ctrl.add(cyl(0.27, 0.27, 0.03, satin, x, 0.105, -0.02, 64));
    const p = new THREE.Group();
    p.add(cyl(0.255, 0.255, 0.02, white, 0, 0, 0, 64));
    p.add(cyl(0.22, 0.22, 0.024, alu, 0, 0.003, 0, 64));
    p.add(cyl(0.085, 0.085, 0.028, satin, 0, 0.004, 0, 40));
    p.add(box(0.012, 0.03, 0.1, 0xf4f3ef, 0, 0.006, -0.15));
    p.position.set(x, 0.125, -0.02);
    ctrl.add(p);
    platters.push(p);
    // performance pads (2 x 4), play / cue, pitch fader
    for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) ctrl.add(rbox(0.07, 0.016, 0.07, 0.01, satin, x - 0.135 + k * 0.09, 0.105, 0.26 + r * 0.085));
    const outer = i ? 0.33 : -0.33;
    ctrl.add(cyl(0.035, 0.035, 0.02, 0x2b2b2e, x + outer * 0.2 - 0.06, 0.105, 0.27, 24));
    ctrl.add(cyl(0.035, 0.035, 0.02, 0x2b2b2e, x + outer * 0.2 - 0.06, 0.105, 0.36, 24));
    ctrl.add(cyl(0.02, 0.02, 0.004, 0x7fe08a, x + outer * 0.2 - 0.06, 0.117, 0.27, 16, { emissive: 0x7fe08a, emissiveIntensity: 0.9 }));
    ctrl.add(cyl(0.02, 0.02, 0.004, 0xffa040, x + outer * 0.2 - 0.06, 0.117, 0.36, 16, { emissive: 0xffa040, emissiveIntensity: 0.9 }));
    ctrl.add(box(0.012, 0.006, 0.4, 0x1d1c1b, x + outer * 0.95, 0.103, 0.0));
    ctrl.add(rbox(0.06, 0.03, 0.04, 0.01, satin, x + outer * 0.95, 0.115, 0.05));
  });
  // mixer: EQ knobs, channel faders, crossfader, level meters
  for (let ch = 0; ch < 2; ch++) {
    const x = -0.09 + ch * 0.18;
    for (let r = 0; r < 4; r++) ctrl.add(cyl(0.028, 0.03, 0.04, satin, x, 0.115, -0.26 + r * 0.095, 24));
    ctrl.add(box(0.012, 0.006, 0.2, 0x1d1c1b, x, 0.103, 0.2));
    ctrl.add(rbox(0.05, 0.035, 0.035, 0.01, satin, x, 0.118, 0.17 + ch * 0.05));
    for (let m = 0; m < 6; m++) ctrl.add(box(0.012, 0.004, 0.012, m > 4 ? 0xff5a4a : 0x7fe08a, x + (ch ? -0.045 : 0.045), 0.103, 0.0 + m * 0.022, { emissive: m > 4 ? 0xff5a4a : 0x7fe08a, emissiveIntensity: 0.8 }));
  }
  ctrl.add(box(0.2, 0.006, 0.012, 0x1d1c1b, 0, 0.103, 0.335));
  ctrl.add(rbox(0.035, 0.035, 0.05, 0.01, satin, 0, 0.118, 0.335));
  ctrl.position.set(0, 1.08, 0.05);
  ctrl.rotation.x = 0.32;
  g.add(ctrl);
  // white over-ear headphones
  const hp = new THREE.Group();
  hp.add(mesh(new THREE.TorusGeometry(0.17, 0.022, 10, 32, Math.PI), white, 0, 0, 0));
  [-0.17, 0.17].forEach(x => { const cup = rbox(0.1, 0.15, 0.07, 0.03, white, x, -0.02, 0); hp.add(cup); });
  hp.position.set(1.18, 1.14, 0.2); hp.rotation.set(-1.4, 0, 0.35);
  g.add(hp);
  // two white studio speakers on slim lacquer stands
  const cones = [];
  [-1.95, 1.95].forEach(x => {
    const sp = new THREE.Group();
    sp.add(rbox(0.4, 0.04, 0.4, 0.015, lacquer, 0, 0.02, 0));
    sp.add(cyl(0.035, 0.035, 1.25, lacquer, 0, 0.66, 0, 16));
    sp.add(rbox(0.36, 0.04, 0.36, 0.015, lacquer, 0, 1.3, 0));
    const cabinet = rbox(0.66, 1.0, 0.6, 0.07, white, 0, 1.82, 0);
    sp.add(cabinet);
    const woofer = new THREE.Group();
    woofer.add(mesh(new THREE.TorusGeometry(0.2, 0.025, 12, 48), alu, 0, 0, 0));
    const cone = mesh(new THREE.ConeGeometry(0.2, 0.08, 48, 1, true), mat(0xe9e6df, { roughness: 0.85, side: THREE.DoubleSide }), 0, 0, -0.03);
    cone.rotation.x = -Math.PI / 2;
    woofer.add(cone);
    woofer.add(sphere(0.055, mat(0xdedad2, { roughness: 0.6 }), 0, 0, -0.02));
    woofer.position.set(0, 1.7, 0.305);
    sp.add(woofer);
    cones.push(woofer);
    const tw = new THREE.Group();
    tw.add(mesh(new THREE.TorusGeometry(0.075, 0.015, 10, 32), alu, 0, 0, 0));
    tw.add(sphere(0.045, alu, 0, 0, -0.025));
    tw.position.set(0, 2.08, 0.305);
    sp.add(tw);
    sp.position.set(x, 0, 0.05);
    sp.rotation.y = x < 0 ? 0.2 : -0.2;
    g.add(sp);
  });
  // lacquer crate of records
  const crate = new THREE.Group();
  crate.add(rbox(0.62, 0.42, 0.5, 0.02, lacquer, 0, 0.21, 0));
  [0x2a2724, 0xe9e2d4, 0xb5673f, 0x8f9a86, 0xd8cbb6, 0x1d1c1b].forEach((c, i) => {
    const r = box(0.5, 0.5, 0.02, c, 0, 0.33, -0.18 + i * 0.07);
    r.rotation.x = -0.18;
    crate.add(r);
  });
  crate.position.set(-0.5, 0, 0.75);
  crate.rotation.y = 0.15;
  g.add(crate);
  pieces.dj = g;
  pieces.platters = platters;
  pieces.cones = cones;
  scene.add(g);
  register(g, 'dj', 'Music & DJ', { panel: 'dj', lift: 0.02 });
})();

// ---------- the Pomeranian ----------
(function pomeranian() { // Wookie: orange sable Pomeranian, cream face and tail plume
  const g = new THREE.Group();
  const fur = mat(0xc8692a, { roughness: 1 });
  const chest = mat(0xdc8f4c, { roughness: 1 });
  const sable = mat(0x7d3f1a, { roughness: 1 });
  const cream = mat(0xf1dfbf, { roughness: 1 });
  const dark = mat(0x14100d, { roughness: 0.25 });
  const fluffGeo = new THREE.IcosahedronGeometry(1, 1);
  const tuft = (r, m, x, y, z) => { const t = mesh(fluffGeo, m, x, y, z); t.scale.set(r * (0.9 + rand() * 0.2), r * (0.9 + rand() * 0.2), r); t.rotation.set(rand() * 3, rand() * 3, 0); return t; };
  // sitting body
  const body = new THREE.Group();
  body.add(tuft(0.4, fur, 0, 0.38, -0.06));
  body.add(tuft(0.34, chest, 0, 0.7, 0.04));
  for (let i = 0; i < 18; i++) { // big mane around the chest and neck
    const a = (i / 18) * Math.PI * 2;
    const m = Math.sin(a) > 0.3 ? chest : (i % 4 ? fur : sable);
    body.add(tuft(0.14 + rand() * 0.07, m, Math.cos(a) * 0.36, 0.9 + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.26 + 0.06));
  }
  body.add(tuft(0.22, chest, 0, 0.62, 0.26));
  body.add(tuft(0.16, sable, 0, 0.62, -0.32)); // darker sable along the back
  // slim front legs, cream-tipped paws
  [-0.12, 0.12].forEach(x => { body.add(cyl(0.055, 0.065, 0.4, chest, x, 0.2, 0.24, 10)); body.add(tuft(0.075, mat(0xe8c79a, { roughness: 1 }), x, 0.04, 0.3)); });
  [-0.29, 0.29].forEach(x => body.add(tuft(0.19, fur, x, 0.2, -0.04)));
  g.add(body);
  // head: fox-like face, cream muzzle mask, dark eyes and nose, tongue out
  const head = new THREE.Group();
  head.add(tuft(0.25, fur, 0, 0, 0));
  for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2; head.add(tuft(0.1, i % 3 ? fur : sable, Math.cos(a) * 0.25, Math.sin(a) * 0.21, -0.05)); }
  head.add(tuft(0.065, sable, 0, 0.16, 0.14)); // darker forehead
  head.add(tuft(0.12, cream, 0, -0.08, 0.17)); // muzzle
  const snout = sphere(0.07, cream, 0, -0.07, 0.25);
  snout.scale.set(1, 0.8, 1);
  head.add(snout);
  head.add(sphere(0.04, dark, 0, -0.035, 0.32)); // nose
  head.add(sphere(0.03, mat(0x3a2418, { roughness: 1 }), -0.06, -0.13, 0.24)); // dark lip shading
  head.add(sphere(0.03, mat(0x3a2418, { roughness: 1 }), 0.06, -0.13, 0.24));
  [-0.095, 0.095].forEach(x => {
    head.add(sphere(0.042, dark, x, 0.055, 0.22));
    head.add(sphere(0.012, mat(0xffffff), x + 0.014, 0.07, 0.258));
    const ear = new THREE.Group();
    ear.add(mesh(new THREE.ConeGeometry(0.08, 0.19, 10), fur, 0, 0, 0));
    ear.add(mesh(new THREE.ConeGeometry(0.035, 0.08, 8), sable, 0, 0.07, 0));
    ear.position.set(x * 1.55, 0.27, -0.02);
    ear.rotation.z = -x * 2.3;
    head.add(ear);
  });
  const tongue = mesh(new THREE.SphereGeometry(0.045, 12, 8), mat(0xe57a90, { roughness: 0.4 }), 0, -0.17, 0.26);
  tongue.scale.set(0.9, 1.1, 0.45);
  head.add(tongue);
  head.position.set(0, 1.17, 0.1);
  g.add(head);
  // cream plumed tail curled over the back, sable tips
  const tail = new THREE.Group();
  for (let i = 0; i < 9; i++) { const t = i / 8; tail.add(tuft(0.11 + Math.sin(t * Math.PI) * 0.1, i > 6 ? sable : (i % 2 ? cream : mat(0xe9d0a8, { roughness: 1 })), Math.sin(t * 2.4) * 0.24, 0.1 + t * 0.45 - t * t * 0.28, -t * 0.16)); }
  tail.position.set(0.16, 0.6, -0.36);
  g.add(tail);
  pieces.pom = g;
  pieces.pomHead = head;
  pieces.pomTail = tail;
  scene.add(g);
  register(g, 'pup', 'Wookie', { panel: 'wookie', lift: 0.02 });
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
    place(pieces.bookcase, 4.75, 0, 0);
    place(pieces.dj, -1.05, 0, 0.9, 1.12);
    place(pieces.pom, 1.35, 0, 2.3, 0.72);
    pieces.pom.rotation.y = -0.35;
    rect = { x0: -8.3, x1: 8.5, y0: -1.3, y1: 9.1 };
  } else {
    place(pieces.shelf, -0.4, 12.2, 0, 0.9);
    place(pieces.poster, -2.6, 9.6, 0, 0.9);
    place(pieces.board, 0.1, 9.55, 0, 0.75);
    place(pieces.painting, 2.6, 9.8, 0, 0.75);
    place(pieces.bookcase, 0, 0, 0, 0.95);
    place(pieces.dj, -0.6, 0, 2.6, 1.0);
    place(pieces.pom, 2.1, 0, 3.2, 0.68);
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
  sun.intensity = night ? 0.15 : 2.4;
  hemi.intensity = night ? 0.15 : 0.9;
  fill.intensity = night ? 0.08 : 0.5;
  moonLight.intensity = night ? 6 : 0;
  pieces.moon.material.emissiveIntensity = night ? 1.1 : 0.05;
  scene.background.set(night ? 0x120b0d : 0x24171a);
  scene.environmentIntensity = night ? 0.15 : 0.55;
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
function glow(key, amount, color = 0xffe2a8) {
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
  if (key === 'pup') { anim.wag = 1; toast('Woof! Wookie says hi'); }
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
    pieces.cones.forEach(c => { c.position.z = 0.305 + beat * 0.012; });
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

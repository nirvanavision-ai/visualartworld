// 3D studio room. Every clickable object carries userData.panel, which opens
// the matching <dialog id="panel-..."> already in index.html.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const root = document.documentElement;
const stage = document.getElementById('room3d');
const labelLayer = document.getElementById('labels3d');
const isSmall = () => window.innerWidth < 720;

// ---------- renderer / scene / camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(stage.clientWidth, stage.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = !isSmall();
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, stage.clientWidth / stage.clientHeight, 0.1, 60);

const HOME_TARGET = new THREE.Vector3(0, 1.55, -1.8);
function homePosition() {
  const portrait = camera.aspect < 1;
  return new THREE.Vector3(0.4, portrait ? 2.6 : 2.3, portrait ? 7.4 : 4.6);
}
camera.position.copy(homePosition());

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 1.2;
controls.maxDistance = 9;
controls.minPolarAngle = 0.95;
controls.maxPolarAngle = 1.62;
controls.minAzimuthAngle = -0.95;
controls.maxAzimuthAngle = 0.95;
controls.rotateSpeed = 0.6;

// ---------- palette & helpers ----------
const C = {
  wall: 0xf1e7d6, floor: 0xb98352, wood: 0xc48a55, woodDark: 0x8a5a33, ink: 0x2a2622,
  paper: 0xfffaf1, red: 0xd9583b, navy: 0x2f4a6d, mustard: 0xe3a838, sage: 0x8daa7d,
  sageDark: 0x6d8c60, rose: 0xe7a3a0, terracotta: 0xc9704a, metal: 0xb8bcc2,
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
const box = (w, h, d, color, x, y, z, opts) => mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'object' ? color : mat(color, opts), x, y, z);
const cyl = (rt, rb, h, color, x, y, z, seg = 24, opts) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof color === 'object' ? color : mat(color, opts), x, y, z);

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------- room shell ----------
const W = 12, D = 10, H = 4.2;

const floorTex = canvasTexture(512, 512, (g, w, h) => {
  for (let i = 0; i < 8; i++) {
    const shade = 180 + ((i * 37) % 30);
    g.fillStyle = `rgb(${shade},${Math.round(shade * 0.68)},${Math.round(shade * 0.42)})`;
    g.fillRect(0, i * 64, w, 64);
    g.fillStyle = 'rgba(80,45,20,.35)';
    g.fillRect(0, i * 64, w, 2);
    g.fillRect(((i * 173) % w), i * 64, 2, 64);
  }
});
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
floorTex.repeat.set(3, 3);
const floor = mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const wallTex = canvasTexture(128, 128, (g, w, h) => {
  g.fillStyle = '#f1e7d6'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#e3d4bb';
  for (let y = 16; y < h; y += 32) for (let x = 16; x < w; x += 32) { g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); }
});
wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 });
function wall(width, x, z, rotY) {
  const t = wallTex.clone(); t.needsUpdate = true; t.repeat.set(width / 0.9, H / 0.9);
  const m = mesh(new THREE.PlaneGeometry(width, H), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }), x, H / 2, z);
  m.rotation.y = rotY;
  scene.add(m);
  return m;
}
const wallMats = [wall(W, 0, -D / 2, 0).material, wall(D, -W / 2, 0, Math.PI / 2).material, wall(D, W / 2, 0, -Math.PI / 2).material];
const ceiling = mesh(new THREE.PlaneGeometry(W, D), mat(0xf6efe3), 0, H, 0);
ceiling.rotation.x = Math.PI / 2;
scene.add(ceiling);
// skirting boards
scene.add(box(W, 0.12, 0.03, C.woodDark, 0, 0.06, -D / 2 + 0.015));
scene.add(box(0.03, 0.12, D, C.woodDark, -W / 2 + 0.015, 0.06, 0));
scene.add(box(0.03, 0.12, D, C.woodDark, W / 2 - 0.015, 0.06, 0));

// rug
const rugTex = canvasTexture(512, 512, (g, w, h) => {
  const cols = ['#2f4a6d', '#e3a838', '#d9583b', '#8daa7d', '#fffaf1'];
  for (let r = 6; r > 0; r--) { g.fillStyle = cols[r % cols.length]; g.beginPath(); g.arc(w / 2, h / 2, r * 40, 0, 7); g.fill(); }
});
const rug = mesh(new THREE.CircleGeometry(2.1, 48), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }), 0.4, 0.005, -0.6);
rug.rotation.x = -Math.PI / 2;
scene.add(rug);

// neon sign on back wall
const neonTex = canvasTexture(1024, 192, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.font = '700 92px "Caveat", "Comic Sans MS", cursive';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#ff5fa2'; g.shadowBlur = 28;
  g.fillStyle = '#ffd1e6';
  g.fillText('visual art world', w / 2, h / 2);
});
const neonMat = new THREE.MeshBasicMaterial({ map: neonTex, transparent: true, toneMapped: false });
const neon = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.6), neonMat);
neon.position.set(-1.3, 3.55, -D / 2 + 0.02);
scene.add(neon);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight(0xfff4e0, 0x8a6a4a, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 1.4);
sun.position.set(-4, 6, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 6, bottom: -2, near: 1, far: 20 });
sun.shadow.bias = -0.0005;
scene.add(sun);
const lampLight = new THREE.PointLight(0xffc77a, 0.6, 10, 1.6);
lampLight.position.set(0.4, H - 1.1, -0.6);
scene.add(lampLight);
const djGlow = new THREE.PointLight(0xb05cff, 0, 5, 2);
djGlow.position.set(3, 1.6, -3.4);
scene.add(djGlow);

// ---------- clickable registry ----------
const clickables = [];   // top-level groups
const animators = [];    // per-frame callbacks
function register(group, panel, label, normal, viewDist = 1.7) {
  group.userData = { panel, label, normal: normal.clone(), viewDist };
  clickables.push(group);
  scene.add(group);
  const btn = document.createElement('button');
  btn.className = 'label3d';
  btn.type = 'button';
  btn.textContent = label;
  btn.addEventListener('click', () => focusOn(group));
  labelLayer.appendChild(btn);
  group.userData.labelEl = btn;
  return group;
}
const N_BACK = new THREE.Vector3(0, 0, 1), N_LEFT = new THREE.Vector3(1, 0, 0), N_RIGHT = new THREE.Vector3(-1, 0, 0);

// ---------- furniture ----------
// Back-wall bookshelf
const SHELF_X = -1.3, SHELF_Z = -D / 2 + 0.25, SHELF_W = 4.2, SHELF_D = 0.46;
const levels = [0.85, 1.65, 2.45];
(function bookshelf() {
  const g = new THREE.Group();
  g.add(box(SHELF_W, 3.2, 0.04, C.woodDark, SHELF_X, 1.6, SHELF_Z - SHELF_D / 2));
  g.add(box(0.06, 3.2, SHELF_D, C.wood, SHELF_X - SHELF_W / 2, 1.6, SHELF_Z));
  g.add(box(0.06, 3.2, SHELF_D, C.wood, SHELF_X + SHELF_W / 2, 1.6, SHELF_Z));
  g.add(box(0.06, 3.2, SHELF_D, C.wood, SHELF_X - SHELF_W / 6 * 1, 1.6, SHELF_Z));
  g.add(box(0.06, 3.2, SHELF_D, C.wood, SHELF_X + SHELF_W / 6 * 1, 1.6, SHELF_Z));
  [0.05, ...levels, 3.2].forEach(y => g.add(box(SHELF_W, 0.05, SHELF_D, C.wood, SHELF_X, y, SHELF_Z)));
  scene.add(g);
})();
const col = i => SHELF_X + (i - 1) * (SHELF_W / 3);   // 0,1,2 columns
const onShelf = (lvl) => levels[lvl] + 0.025;

// Left-wall floating shelves
const LX = -W / 2 + 0.2;
[1.25, 1.95].forEach(y => {
  scene.add(box(0.36, 0.05, 1.8, C.wood, LX, y, -0.6));
  scene.add(box(0.06, 0.18, 0.04, C.woodDark, LX - 0.13, y - 0.11, -1.3));
  scene.add(box(0.06, 0.18, 0.04, C.woodDark, LX - 0.13, y - 0.11, 0.1));
});
// Right-wall shelf over the desk
const RX = W / 2 - 0.2;
scene.add(box(0.36, 0.05, 2.0, C.wood, RX, 2.0, 0.6));

// ---------- objects ----------
// About: books
(function books() {
  const g = new THREE.Group();
  const cols = [C.red, C.navy, C.mustard, C.sage, C.rose, C.terracotta];
  let x = -0.36;
  cols.forEach((c, i) => {
    const h = 0.34 + ((i * 7) % 5) * 0.03, w = 0.07 + (i % 2) * 0.03;
    const b = box(w, h, 0.28, c, x + w / 2, h / 2, 0);
    if (i === 5) { b.rotation.z = -0.32; b.position.x += 0.06; b.position.y -= 0.02; }
    g.add(b);
    g.add(box(w * 0.7, 0.03, 0.281, C.paper, x + w / 2, h * 0.75, 0));
    x += w + 0.01;
  });
  g.position.set(col(0), onShelf(2), SHELF_Z + 0.02);
  register(g, 'about', 'About me', N_BACK);
})();

// Awards & impact: trophy
(function trophy() {
  const g = new THREE.Group();
  const gold = mat(C.mustard, { metalness: 0.7, roughness: 0.3 });
  const pts = [[0.02, 0], [0.13, 0.02], [0.15, 0.12], [0.12, 0.2], [0.06, 0.25], [0.025, 0.27]].map(([r, y]) => new THREE.Vector2(r, 0.5 - y));
  const cup = mesh(new THREE.LatheGeometry(pts.reverse(), 32), gold, 0, -0.02, 0);
  g.add(cup);
  const hL = mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 24, Math.PI), gold, -0.14, 0.4, 0); hL.rotation.z = Math.PI / 2; g.add(hL);
  const hR = mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 24, Math.PI), gold, 0.14, 0.4, 0); hR.rotation.z = -Math.PI / 2; g.add(hR);
  g.add(cyl(0.025, 0.03, 0.12, gold, 0, 0.17, 0));
  g.add(box(0.2, 0.05, 0.14, C.woodDark, 0, 0.09, 0));
  g.add(box(0.26, 0.07, 0.18, C.ink, 0, 0.035, 0));
  g.position.set(col(1), onShelf(2), SHELF_Z + 0.02);
  g.userData.spin = true;
  register(g, 'impact', 'Awards & impact', N_BACK);
})();

// decor on top shelf: vase + plant
(function vase() {
  const g = new THREE.Group();
  g.add(cyl(0.08, 0.1, 0.24, C.navy, 0, 0.12, 0));
  for (let i = 0; i < 5; i++) {
    const leaf = mesh(new THREE.SphereGeometry(0.05, 12, 8), mat(i % 2 ? C.sage : C.sageDark), Math.sin(i * 1.3) * 0.07, 0.32 + (i % 3) * 0.05, Math.cos(i * 1.3) * 0.05);
    leaf.scale.set(0.6, 2.2, 0.6); leaf.rotation.z = Math.sin(i * 1.3) * 0.5;
    g.add(leaf);
  }
  g.position.set(col(2) + 0.3, onShelf(2), SHELF_Z);
  scene.add(g);
  const stack = new THREE.Group();
  [C.rose, C.sage, C.navy].forEach((c, i) => stack.add(box(0.36 - i * 0.04, 0.05, 0.26, c, 0, 0.025 + i * 0.05, 0)));
  stack.position.set(col(2) - 0.3, onShelf(2), SHELF_Z);
  scene.add(stack);
})();

// Filmmaking: clapperboard
(function clapper() {
  const g = new THREE.Group();
  g.add(box(0.42, 0.3, 0.03, C.ink, 0, 0.15, 0));
  g.add(box(0.36, 0.006, 0.031, C.paper, 0, 0.12, 0.001));
  g.add(box(0.36, 0.006, 0.031, C.paper, 0, 0.07, 0.001));
  const arm = new THREE.Group();
  arm.position.set(-0.21, 0.31, 0);
  const bar = box(0.42, 0.06, 0.03, C.ink, 0.21, 0.03, 0);
  arm.add(bar);
  for (let i = 0; i < 4; i++) { const s = box(0.05, 0.062, 0.032, C.paper, 0.06 + i * 0.1, 0.03, 0); s.rotation.z = 0.5; arm.add(s); }
  arm.rotation.z = 0.28;
  g.add(arm);
  g.rotation.y = 0.15;
  g.position.set(col(0), onShelf(1), SHELF_Z + 0.05);
  animators.push((t, hovered) => { arm.rotation.z = hovered === g ? 0.28 * Math.abs(Math.sin(t * 8)) : 0.28; });
  register(g, 'film', 'Filmmaking', N_BACK);
})();

// Animation: zoetrope
(function zoetrope() {
  const g = new THREE.Group();
  g.add(cyl(0.03, 0.05, 0.16, C.woodDark, 0, 0.08, 0));
  g.add(box(0.24, 0.02, 0.24, C.woodDark, 0, 0.01, 0));
  const drum = new THREE.Group();
  drum.position.y = 0.24;
  drum.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 32, 1, true), mat(C.red, { side: THREE.DoubleSide })));
  drum.add(cyl(0.2, 0.2, 0.01, C.ink, 0, -0.08, 0, 32));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const slit = box(0.02, 0.06, 0.012, C.ink, Math.sin(a) * 0.201, 0.04, Math.cos(a) * 0.201);
    slit.rotation.y = a;
    drum.add(slit);
    const fig = mesh(new THREE.SphereGeometry(0.018, 8, 6), mat(C.paper), Math.sin(a) * 0.17, -0.03 + Math.abs(Math.sin(i * 0.9)) * 0.03, Math.cos(a) * 0.17);
    drum.add(fig);
  }
  g.add(drum);
  g.position.set(col(1), onShelf(1), SHELF_Z + 0.02);
  animators.push((t, hovered, dt) => { drum.rotation.y += dt * (hovered === g ? 6 : 0.8); });
  register(g, 'animation', 'Animation', N_BACK);
})();

// decor: little book stacks on middle shelf
(function decorMid() {
  const g = new THREE.Group();
  [C.mustard, C.navy, C.red, C.paper].forEach((c, i) => g.add(box(0.07, 0.3 + i * 0.02, 0.24, c, i * 0.08, 0.15 + i * 0.01, 0)));
  g.position.set(col(2) - 0.15, onShelf(1), SHELF_Z);
  scene.add(g);
})();

// Inventions: glowing bulb with gears
(function bulb() {
  const g = new THREE.Group();
  const glass = mesh(new THREE.SphereGeometry(0.15, 32, 24), new THREE.MeshStandardMaterial({ color: 0xffe7a3, emissive: 0xffb938, emissiveIntensity: 0.9, roughness: 0.2 }), 0, 0.42, 0);
  g.add(glass);
  g.add(cyl(0.07, 0.06, 0.12, C.metal, 0, 0.25, 0, 20, { metalness: 0.8, roughness: 0.3 }));
  g.add(cyl(0.11, 0.13, 0.18, C.woodDark, 0, 0.09, 0));
  const gear1 = mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 10), mat(C.metal, { metalness: 0.7, roughness: 0.35 }), -0.27, 0.12, 0);
  const gear2 = mesh(new THREE.TorusGeometry(0.055, 0.02, 6, 8), mat(C.mustard, { metalness: 0.6, roughness: 0.35 }), -0.16, 0.06, 0.06);
  g.add(gear1, gear2);
  const glow = new THREE.PointLight(0xffc35a, 0.5, 1.6, 2);
  glow.position.set(0, 0.42, 0.1);
  g.add(glow);
  g.position.set(col(0) + 0.1, onShelf(0), SHELF_Z + 0.04);
  animators.push((t, hovered, dt) => {
    gear1.rotation.z += dt * 1.2; gear2.rotation.z -= dt * 1.8;
    const k = hovered === g ? 1.6 : 0.9 + Math.sin(t * 2) * 0.1;
    glass.material.emissiveIntensity = k; glow.intensity = k * 0.6;
  });
  register(g, 'inventions', 'Inventions', N_BACK);
})();

// decor: plant + boxes on bottom shelf
(function decorLow() {
  const p = new THREE.Group();
  p.add(cyl(0.12, 0.09, 0.2, C.terracotta, 0, 0.1, 0));
  for (let i = 0; i < 7; i++) {
    const leaf = mesh(new THREE.SphereGeometry(0.06, 12, 8), mat(i % 2 ? C.sage : C.sageDark), Math.sin(i) * 0.08, 0.3 + (i % 3) * 0.06, Math.cos(i) * 0.06);
    leaf.scale.set(0.6, 2.4, 0.5); leaf.rotation.z = Math.sin(i) * 0.6; leaf.rotation.x = Math.cos(i) * 0.3;
    p.add(leaf);
  }
  p.position.set(col(1), onShelf(0), SHELF_Z);
  scene.add(p);
  scene.add(box(0.5, 0.26, 0.34, C.navy, col(2) - 0.25, onShelf(0) + 0.13, SHELF_Z));
  scene.add(box(0.4, 0.2, 0.3, C.rose, col(2) + 0.3, onShelf(0) + 0.1, SHELF_Z));
})();

// Photography: camera on left-wall top shelf
(function cameraObj() {
  const g = new THREE.Group();
  g.add(box(0.36, 0.22, 0.16, C.ink, 0, 0.11, 0));
  g.add(box(0.362, 0.07, 0.162, C.rose, 0, 0.12, 0));
  g.add(box(0.12, 0.05, 0.1, C.ink, -0.09, 0.245, 0));
  const lens = cyl(0.075, 0.08, 0.12, C.ink, 0, 0.11, 0.12); lens.rotation.x = Math.PI / 2; g.add(lens);
  const glass = cyl(0.055, 0.055, 0.01, C.navy, 0, 0.11, 0.18, 24, { metalness: 0.6, roughness: 0.1 }); glass.rotation.x = Math.PI / 2; g.add(glass);
  const flash = box(0.04, 0.03, 0.01, C.mustard, 0.13, 0.19, 0.081, { emissive: 0xffd36b, emissiveIntensity: 0.2 });
  g.add(flash);
  g.rotation.y = Math.PI / 2 - 0.25;
  g.position.set(LX, 1.95 + 0.025, -0.9);
  animators.push((t, hovered) => { flash.material.emissiveIntensity = hovered === g && Math.sin(t * 14) > 0.6 ? 3 : 0.2; });
  register(g, 'photo', 'Photography', N_LEFT);
})();
// photo frames on the same shelf
(function frames() {
  [[-0.1, C.sage], [0.25, C.mustard]].forEach(([z, c], i) => {
    const f = new THREE.Group();
    f.add(box(0.03, 0.26, 0.2, C.woodDark, 0, 0.13, 0));
    f.add(box(0.032, 0.2, 0.14, c, 0, 0.13, 0));
    f.rotation.z = 0.12; f.rotation.y = i ? 0.2 : -0.2;
    f.position.set(LX - 0.05, 1.975, z);
    scene.add(f);
  });
})();

// Ethical hacking: padlock on left-wall lower shelf
(function padlock() {
  const g = new THREE.Group();
  g.add(box(0.26, 0.22, 0.1, C.navy, 0, 0.11, 0, { metalness: 0.3, roughness: 0.5 }));
  const shackle = mesh(new THREE.TorusGeometry(0.085, 0.018, 10, 24, Math.PI), mat(C.metal, { metalness: 0.9, roughness: 0.25 }), 0, 0.22, 0);
  g.add(shackle);
  g.add(cyl(0.025, 0.025, 0.02, C.mustard, 0, 0.13, 0.05, 16, { emissive: 0xe3a838, emissiveIntensity: 0.3 }).rotateX(Math.PI / 2));
  g.add(box(0.016, 0.05, 0.02, C.mustard, 0, 0.09, 0.05));
  // little binary screen
  const scr = canvasTexture(128, 64, (c, w, h) => { c.fillStyle = '#0d1a12'; c.fillRect(0, 0, w, h); c.fillStyle = '#5cff9a'; c.font = '16px monospace'; for (let r = 0; r < 4; r++) c.fillText('01101 0011'.slice(r % 3, r % 3 + 8), 6, 16 + r * 15); });
  const term = mesh(new THREE.PlaneGeometry(0.24, 0.12), new THREE.MeshBasicMaterial({ map: scr, toneMapped: false }), 0.3, 0.12, 0.0);
  term.rotation.y = -0.2;
  g.add(term);
  g.rotation.y = Math.PI / 2 - 0.2;
  g.position.set(LX, 1.25 + 0.025, -0.9);
  animators.push((t, hovered) => { shackle.position.y = 0.22 + (hovered === g ? 0.05 + Math.sin(t * 6) * 0.02 : 0); });
  register(g, 'security', 'Ethical hacking', N_LEFT);
})();

// Painting: easel near the left wall
(function easel() {
  const g = new THREE.Group();
  const legMat = mat(C.woodDark);
  const l1 = box(0.05, 1.7, 0.05, legMat, -0.32, 0.85, 0); l1.rotation.z = -0.12; g.add(l1);
  const l2 = box(0.05, 1.7, 0.05, legMat, 0.32, 0.85, 0); l2.rotation.z = 0.12; g.add(l2);
  const l3 = box(0.05, 1.6, 0.05, legMat, 0, 0.8, -0.35); l3.rotation.x = -0.3; g.add(l3);
  g.add(box(0.8, 0.05, 0.1, legMat, 0, 0.62, 0.04));
  const art = canvasTexture(512, 400, (c, w, h) => {
    c.fillStyle = '#fffaf1'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e3a838'; c.beginPath(); c.arc(160, 140, 70, 0, 7); c.fill();
    c.fillStyle = '#8daa7d'; c.beginPath(); c.moveTo(0, 290); c.quadraticCurveTo(170, 200, 300, 280); c.quadraticCurveTo(420, 340, 512, 250); c.lineTo(512, 400); c.lineTo(0, 400); c.fill();
    c.fillStyle = '#2f4a6d'; c.beginPath(); c.moveTo(0, 340); c.quadraticCurveTo(220, 300, 330, 345); c.quadraticCurveTo(440, 380, 512, 330); c.lineTo(512, 400); c.lineTo(0, 400); c.fill();
    c.strokeStyle = '#d9583b'; c.lineWidth = 8; c.beginPath(); c.moveTo(330, 90); c.quadraticCurveTo(360, 70, 390, 90); c.quadraticCurveTo(420, 70, 450, 90); c.stroke();
  });
  const canvas = box(0.9, 0.72, 0.04, new THREE.MeshStandardMaterial({ color: 0xffffff, map: art, roughness: 0.9 }), 0, 1.03, 0.06);
  canvas.rotation.x = -0.1;
  g.add(canvas);
  g.add(box(0.94, 0.04, 0.05, legMat, 0, 1.4, 0.03));
  // palette on the tray
  const pal = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.01, 24), mat(C.wood), 0.25, 0.65, 0.08);
  g.add(pal);
  [C.red, C.mustard, C.navy, C.sage].forEach((c, i) => g.add(cyl(0.02, 0.02, 0.012, c, 0.2 + (i % 2) * 0.08, 0.66, 0.04 + Math.floor(i / 2) * 0.07)));
  g.rotation.y = 0.55;
  g.position.set(-4.3, 0, -3.1);
  register(g, 'painting', 'Painting', new THREE.Vector3(0.5, 0, 0.86), 2.0);
})();

// Contact: red mailbox on a post
(function mailbox() {
  const g = new THREE.Group();
  g.add(box(0.08, 1.0, 0.08, C.woodDark, 0, 0.5, 0));
  const body = new THREE.Group();
  body.position.y = 1.12;
  body.add(box(0.28, 0.2, 0.5, C.red, 0, 0, 0));
  const top = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.5, 24, 1, false, 0, Math.PI), mat(C.red), 0, 0.1, 0);
  top.rotation.x = Math.PI / 2; top.rotation.y = Math.PI / 2;
  body.add(top);
  const door = box(0.27, 0.32, 0.02, C.terracotta, 0, 0.04, 0.26);
  body.add(door);
  const flag = new THREE.Group();
  flag.position.set(0.15, 0, 0.05);
  flag.add(box(0.02, 0.22, 0.03, C.mustard, 0, 0.11, 0));
  flag.add(box(0.02, 0.08, 0.1, C.mustard, 0, 0.2, 0.05));
  body.add(flag);
  // a letter peeking out
  const letter = box(0.2, 0.01, 0.14, C.paper, 0, 0.0, 0.3);
  body.add(letter);
  g.add(body);
  g.rotation.y = 0.9;
  g.position.set(-4.7, 0, 1.4);
  animators.push((t, hovered) => { flag.rotation.x = hovered === g ? -1.3 : 0; letter.position.z = hovered === g ? 0.34 + Math.sin(t * 5) * 0.02 : 0.27; });
  register(g, 'contact', 'Say hello', new THREE.Vector3(0.78, 0, 0.62), 1.8);
})();

// Web & games: desk with laptop against right wall
(function desk() {
  const g = new THREE.Group();
  g.add(box(0.8, 0.05, 1.6, C.wood, 0, 0.76, 0));
  [[-0.35, -0.72], [0.35, -0.72], [-0.35, 0.72], [0.35, 0.72]].forEach(([x, z]) => g.add(box(0.05, 0.76, 0.05, C.woodDark, x, 0.38, z)));
  const lap = new THREE.Group();
  lap.add(box(0.32, 0.015, 0.46, C.metal, 0, 0.79, 0, { metalness: 0.6, roughness: 0.35 }));
  const codeTex = canvasTexture(512, 320, (c, w, h) => {
    c.fillStyle = '#1d2c44'; c.fillRect(0, 0, w, h);
    const cols = ['#e3a838', '#8daa7d', '#e7a3a0', '#fffaf1', '#5fb6ff'];
    for (let r = 0; r < 12; r++) { let x = 20 + (r % 3) * 24; for (let k = 0; k < 3; k++) { const len = 30 + ((r * 7 + k * 13) % 90); c.fillStyle = cols[(r + k) % cols.length]; c.fillRect(x, 20 + r * 24, len, 10); x += len + 12; } }
    // tiny game sprite
    c.fillStyle = '#d9583b'; c.fillRect(400, 220, 40, 40); c.fillStyle = '#fffaf1'; c.fillRect(410, 230, 8, 8); c.fillRect(424, 230, 8, 8);
  });
  const screen = box(0.015, 0.3, 0.46, new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 }), -0.15, 0.94, 0);
  screen.rotation.z = 0.2;
  lap.add(screen);
  const disp = mesh(new THREE.PlaneGeometry(0.42, 0.26), new THREE.MeshBasicMaterial({ map: codeTex, toneMapped: false }), -0.14, 0.94, 0);
  disp.rotation.y = Math.PI / 2; disp.rotation.x = 0; disp.rotateX(-0.2);
  disp.position.x += 0.012;
  lap.add(disp);
  g.add(lap);
  // game controller
  const pad = new THREE.Group();
  pad.add(box(0.16, 0.03, 0.09, C.navy, 0, 0.8, 0));
  pad.add(cyl(0.035, 0.035, 0.03, C.navy, -0.07, 0.8, 0.02));
  pad.add(cyl(0.035, 0.035, 0.03, C.navy, 0.07, 0.8, 0.02));
  pad.add(cyl(0.012, 0.012, 0.01, C.red, 0.05, 0.82, -0.01));
  pad.add(cyl(0.012, 0.012, 0.01, C.mustard, 0.08, 0.82, 0.0));
  pad.position.set(0.15, 0, 0.55); pad.rotation.y = -1.9;
  g.add(pad);
  g.add(cyl(0.05, 0.04, 0.12, C.paper, 0.15, 0.84, -0.6));
  g.position.set(W / 2 - 0.55, 0, 0.5);
  animators.push((t, hovered) => { codeTex.offset.y = hovered === g ? (t * 0.3) % 1 : 0; });
  codeTex.wrapT = THREE.RepeatWrapping;
  register(g, 'coding', 'Web & games', N_RIGHT, 1.6);
  // chair
  const chair = new THREE.Group();
  chair.add(box(0.46, 0.06, 0.46, C.navy, 0, 0.48, 0));
  chair.add(box(0.06, 0.5, 0.46, C.navy, -0.22, 0.75, 0));
  chair.add(cyl(0.03, 0.03, 0.45, C.metal, 0, 0.24, 0));
  chair.add(cyl(0.24, 0.24, 0.03, C.ink, 0, 0.02, 0));
  chair.position.set(W / 2 - 1.35, 0, 0.6); chair.rotation.y = Math.PI + 0.3;
  scene.add(chair);
})();

// records on the right-wall shelf (decor)
(function records() {
  const cols = [C.red, C.mustard, C.navy, C.sage, C.rose, C.ink, C.terracotta];
  cols.forEach((c, i) => { const s = box(0.31, 0.31, 0.012, c, RX - 0.02, 2.0 + 0.18, -0.2 + i * 0.1); s.rotation.y = Math.PI / 2; s.rotation.x = (i % 3 - 1) * 0.06; scene.add(s); });
  const disc = cyl(0.15, 0.15, 0.01, C.ink, RX - 0.02, 2.4 + 0.16, 1.3, 32); disc.rotation.z = Math.PI / 2; scene.add(disc);
})();

// Music & DJ: DJ booth with turntables, mixer and two speakers
(function djBooth() {
  const g = new THREE.Group();
  // booth
  g.add(box(2.2, 0.9, 0.7, C.ink, 0, 0.45, 0));
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xff4fa0, toneMapped: false });
  const led = box(2.18, 0.04, 0.01, ledMat, 0, 0.6, 0.356); led.castShadow = false;
  g.add(led);
  const ledMat2 = new THREE.MeshBasicMaterial({ color: 0x4fc3ff, toneMapped: false });
  const led2 = box(2.18, 0.02, 0.01, ledMat2, 0, 0.3, 0.356); led2.castShadow = false;
  g.add(led2);
  g.add(box(2.3, 0.05, 0.8, C.woodDark, 0, 0.925, 0));
  // turntables
  const platters = [];
  [-0.65, 0.65].forEach(x => {
    g.add(box(0.6, 0.08, 0.5, C.metal, x, 0.99, 0, { metalness: 0.5, roughness: 0.4 }));
    const pl = new THREE.Group();
    pl.position.set(x - 0.05, 1.04, 0);
    pl.add(cyl(0.2, 0.2, 0.015, C.ink, 0, 0, 0, 40, { roughness: 0.35 }));
    pl.add(cyl(0.07, 0.07, 0.017, x < 0 ? C.red : C.mustard, 0, 0, 0, 24));
    const mark = box(0.02, 0.018, 0.06, C.paper, 0, 0, 0.04); pl.add(mark);
    g.add(pl);
    platters.push(pl);
    const arm = box(0.015, 0.015, 0.3, C.paper, x + 0.2, 1.06, 0.02); arm.rotation.y = 0.35; g.add(arm);
  });
  // mixer
  g.add(box(0.34, 0.1, 0.46, C.ink, 0, 1.0, 0));
  const knobs = [];
  for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) {
    const kn = cyl(0.022, 0.022, 0.03, r === 0 ? C.red : C.metal, -0.07 + k * 0.14, 1.06, -0.14 + r * 0.09, 12);
    g.add(kn); knobs.push(kn);
  }
  const faders = [];
  [-0.06, 0.06].forEach(x => { const f = box(0.03, 0.025, 0.04, C.mustard, x, 1.06, 0.15); g.add(f); faders.push(f); });
  // headphones
  const hp = new THREE.Group();
  hp.add(mesh(new THREE.TorusGeometry(0.11, 0.015, 8, 24, Math.PI), mat(C.navy)));
  hp.add(cyl(0.05, 0.05, 0.04, C.navy, -0.11, 0, 0, 16).rotateZ(Math.PI / 2));
  hp.add(cyl(0.05, 0.05, 0.04, C.navy, 0.11, 0, 0, 16).rotateZ(Math.PI / 2));
  hp.rotation.x = -Math.PI / 2 + 0.2; hp.position.set(0.95, 0.99, 0.3);
  g.add(hp);
  // speakers
  const woofers = [];
  [-1.55, 1.55].forEach(x => {
    g.add(box(0.6, 1.5, 0.5, 0x1b1b1f, x, 0.75, 0, { roughness: 0.6 }));
    const w = new THREE.Group(); w.position.set(x, 0.55, 0.255);
    w.add(cyl(0.22, 0.22, 0.02, 0x3a3a40, 0, 0, 0, 32).rotateX(Math.PI / 2));
    const cone = cyl(0.17, 0.07, 0.06, 0x111114, 0, 0, 0.02, 32).rotateX(-Math.PI / 2); w.add(cone);
    w.add(cyl(0.05, 0.05, 0.03, C.metal, 0, 0, 0.04, 16, { metalness: 0.7 }).rotateX(Math.PI / 2));
    g.add(w); woofers.push(w);
    const tw = new THREE.Group(); tw.position.set(x, 1.15, 0.255);
    tw.add(cyl(0.1, 0.1, 0.02, 0x3a3a40, 0, 0, 0, 24).rotateX(Math.PI / 2));
    tw.add(cyl(0.06, 0.02, 0.04, 0x111114, 0, 0, 0.02, 24).rotateX(-Math.PI / 2));
    g.add(tw); woofers.push(tw);
    const strip = box(0.58, 0.02, 0.01, ledMat, x, 1.42, 0.255); strip.castShadow = false; g.add(strip);
  });
  g.position.set(3.0, 0, -D / 2 + 0.9);
  g.rotation.y = -0.15;
  animators.push((t, hovered, dt, night) => {
    const bpm = hovered === g ? 128 : 110;
    const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * bpm / 60)), 8);
    platters.forEach(p => { p.rotation.y -= dt * (hovered === g ? 7 : 3.5); });
    woofers.forEach((w, i) => { const s = 1 + beat * (i % 2 ? 0.05 : 0.12); w.scale.set(s, s, 1 + beat * 0.6); });
    const hue = (t * 0.08) % 1;
    ledMat.color.setHSL(hue, 0.9, 0.6);
    ledMat2.color.setHSL((hue + 0.5) % 1, 0.9, 0.6);
    knobs.forEach((k, i) => { k.rotation.y = Math.sin(t * 0.7 + i) * 1.5; });
    faders.forEach((f, i) => { f.position.z = 0.12 + Math.sin(t * 1.3 + i * 2) * 0.05; });
    djGlow.color.setHSL(hue, 0.8, 0.6);
    djGlow.intensity = (night ? 2.2 : 0.4) * (0.6 + beat * 0.8);
  });
  register(g, 'dj', 'Music & DJ', N_BACK, 2.6);
})();

// floor plants
function floorPlant(x, z, s = 1) {
  const p = new THREE.Group();
  p.add(cyl(0.22, 0.17, 0.45, C.terracotta, 0, 0.225, 0));
  for (let i = 0; i < 9; i++) {
    const leaf = mesh(new THREE.SphereGeometry(0.1, 12, 8), mat(i % 2 ? C.sage : C.sageDark), Math.sin(i * 2.1) * 0.14, 0.7 + (i % 4) * 0.12, Math.cos(i * 2.1) * 0.14);
    leaf.scale.set(0.55, 3, 0.45); leaf.rotation.z = Math.sin(i * 2.1) * 0.5; leaf.rotation.x = Math.cos(i * 2.1) * 0.5;
    p.add(leaf);
  }
  p.scale.setScalar(s);
  p.position.set(x, 0, z);
  scene.add(p);
}
floorPlant(-5.4, -4.4, 1.1);
floorPlant(1.0, -4.5, 0.8);
floorPlant(5.3, 3.2, 1);


// Pomeranian on the rug (click to make it hop)
const pom = new THREE.Group();
(function pomeranian() {
  const fur = mat(0xe8963c, { roughness: 1 });
  const cream = mat(0xf6d7a6, { roughness: 1 });
  const fluff = (r, x, y, z, m = fur, sx = 1, sy = 1, sz = 1) => { const b = mesh(new THREE.SphereGeometry(r, 18, 14), m, x, y, z); b.scale.set(sx, sy, sz); return b; };
  const body = new THREE.Group();
  body.add(fluff(0.2, 0, 0.22, 0, fur, 1.1, 0.95, 1.25));          // body
  body.add(fluff(0.17, 0, 0.32, 0.17, cream, 1.15, 1, 0.9));         // chest ruff
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; body.add(fluff(0.07, Math.cos(a) * 0.17, 0.3 + Math.sin(a) * 0.12, 0.12, i % 2 ? fur : cream)); }
  const head = new THREE.Group(); head.position.set(0, 0.46, 0.2);
  head.add(fluff(0.14, 0, 0, 0, fur));
  head.add(fluff(0.065, 0, -0.035, 0.12, cream, 1, 0.8, 1.1));       // muzzle
  head.add(fluff(0.022, 0, -0.01, 0.19, mat(C.ink)));                // nose
  head.add(fluff(0.022, -0.055, 0.035, 0.12, mat(C.ink)), fluff(0.022, 0.055, 0.035, 0.12, mat(C.ink)));
  [-1, 1].forEach(sx => { const ear = mesh(new THREE.ConeGeometry(0.045, 0.1, 10), fur, sx * 0.075, 0.13, -0.01); ear.rotation.z = -sx * 0.35; head.add(ear); });
  const tongue = box(0.03, 0.006, 0.03, C.rose, 0, -0.075, 0.15); head.add(tongue);
  body.add(head);
  [[-0.1, 0.12], [0.1, 0.12], [-0.1, -0.14], [0.1, -0.14]].forEach(([x, z]) => body.add(cyl(0.035, 0.035, 0.12, fur, x, 0.06, z, 10)));
  const tail = new THREE.Group(); tail.position.set(0, 0.36, -0.2);
  tail.add(fluff(0.11, 0, 0.06, 0.04, fur, 1, 0.9, 1.3), fluff(0.08, 0, 0.12, 0.12, cream));
  body.add(tail);
  pom.add(body);
  pom.position.set(-0.6, 0, 0.4);
  pom.rotation.y = 0.5;
  pom.userData = { action: 'hop', label: 'Pomeranian', normal: new THREE.Vector3(0, 0, 1) };
  let hopT = -1;
  pom.userData.hop = () => { hopT = 0; };
  animators.push((t, hovered, dt) => {
    tail.rotation.y = Math.sin(t * (hovered === pom ? 22 : 6)) * 0.35;
    head.rotation.z = Math.sin(t * 1.3) * 0.12;
    head.rotation.x = hovered === pom ? -0.25 : 0;
    if (hopT >= 0) { hopT += dt; body.position.y = Math.max(0, Math.sin(hopT * 9)) * 0.12; body.rotation.y = hopT * 6; if (hopT > 1.05) { hopT = -1; body.position.y = 0; body.rotation.y = 0; } }
  });
  scene.add(pom);
})();

// pendant lamp (click to toggle night mode)
const pendant = new THREE.Group();
(function lamp() {
  pendant.add(cyl(0.008, 0.008, 1.0, C.ink, 0, H - 0.5, 0));
  const shade = mesh(new THREE.ConeGeometry(0.32, 0.3, 32, 1, true), mat(C.navy, { side: THREE.DoubleSide }), 0, H - 1.1, 0);
  pendant.add(shade);
  const bulbM = new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffc77a, emissiveIntensity: 0.4 });
  pendant.add(mesh(new THREE.SphereGeometry(0.07, 16, 12), bulbM, 0, H - 1.25, 0));
  pendant.userData.bulb = bulbM;
  pendant.position.set(0.4, 0, -0.6);
  scene.add(pendant);
})();

// ---------- day / night ----------
let night = false;
function applyTheme() {
  night = root.getAttribute('data-theme') === 'night';
  scene.background = new THREE.Color(night ? 0x14151d : 0xf1e7d6);
  hemi.intensity = night ? 0.18 : 1.1;
  sun.intensity = night ? 0.05 : 1.4;
  lampLight.intensity = night ? 3.2 : 0.6;
  pendant.userData.bulb.emissiveIntensity = night ? 2.5 : 0.4;
  neonMat.opacity = night ? 1 : 0.85;
}
applyTheme();
new MutationObserver(applyTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

// ---------- picking ----------
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null;
function pick(clientX, clientY) {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  const hits = ray.intersectObjects([...clickables, pendant, pom], true);
  if (!hits.length) return null;
  let o = hits[0].object;
  while (o && !clickables.includes(o) && o !== pendant && o !== pom) o = o.parent;
  return o;
}
function setHover(obj) {
  if (hovered === obj) return;
  if (hovered && hovered.userData.labelEl) hovered.userData.labelEl.classList.remove('is-hover');
  hovered = obj;
  if (hovered && hovered.userData.labelEl) hovered.userData.labelEl.classList.add('is-hover');
  renderer.domElement.style.cursor = obj ? 'pointer' : '';
  if (obj === pom || obj === pendant) hovered = obj;
}
renderer.domElement.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && !flying) setHover(pick(e.clientX, e.clientY)); });
let downAt = null;
renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  const o = pick(e.clientX, e.clientY);
  if (o === pendant) { document.getElementById('lamp').click(); return; }
  if (o === pom) { pom.userData.hop(); return; }
  if (o) focusOn(o);
});

// ---------- camera flights ----------
let flying = null;
function flyTo(pos, target, ms, done) {
  flying = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, start: performance.now(), ms, done };
  controls.enabled = false;
}
const tmp = new THREE.Vector3();
function focusOn(obj) {
  const box3 = new THREE.Box3().setFromObject(obj);
  const center = box3.getCenter(new THREE.Vector3());
  const n = obj.userData.normal;
  const dist = obj.userData.viewDist * (camera.aspect < 1 ? 1.5 : 1);
  const pos = center.clone().addScaledVector(n, dist).add(new THREE.Vector3(0, 0.25, 0));
  setHover(obj);
  flyTo(pos, center, 900, () => window.openPanel(obj.userData.panel));
}
function goHome() { flyTo(homePosition(), HOME_TARGET.clone(), 900, () => { controls.enabled = true; }); }
document.querySelectorAll('.panel').forEach(d => d.addEventListener('close', () => { if (document.body.classList.contains('mode-3d')) { setHover(null); goHome(); } }));
document.getElementById('home3d')?.addEventListener('click', goHome);

// ---------- labels ----------
function updateLabels() {
  const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
  clickables.forEach(o => {
    const el = o.userData.labelEl;
    const b = new THREE.Box3().setFromObject(o);
    tmp.set((b.min.x + b.max.x) / 2, b.max.y + 0.08, (b.min.z + b.max.z) / 2).project(camera);
    const visible = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1 && !flying;
    el.style.opacity = visible ? '' : '0';
    el.style.pointerEvents = visible ? '' : 'none';
    el.style.transform = `translate(-50%, -100%) translate(${(tmp.x + 1) / 2 * w}px, ${(1 - tmp.y) / 2 * h}px)`;
  });
}

// ---------- loop ----------
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  if (flying) {
    const k = Math.min(1, (performance.now() - flying.start) / flying.ms);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(flying.p0, flying.p1, e);
    controls.target.lerpVectors(flying.t0, flying.t1, e);
    camera.lookAt(controls.target);
    if (k >= 1) { const done = flying.done; flying = null; done && done(); }
  } else {
    controls.update();
  }
  clickables.forEach(o => {
    const s = o === hovered ? 1.08 : 1;
    o.scale.lerp(tmp.set(s, s, s), 0.15);
    if (o.userData.spin) o.rotation.y = o === hovered ? Math.sin(t * 3) * 0.4 : o.rotation.y * 0.9;
  });
  pendant.rotation.z = Math.sin(t * 0.8) * 0.015;
  animators.forEach(fn => fn(t, hovered, dt, night));
  renderer.render(scene, camera);
  updateLabels();
  requestAnimationFrame(frame);
}

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  camera.aspect = w / h;
  camera.fov = w < h ? 62 : 50;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', resize);
resize();
camera.position.copy(homePosition());
document.body.classList.add('room-ready');
frame();

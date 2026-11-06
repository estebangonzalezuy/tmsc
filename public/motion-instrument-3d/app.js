// Motion Instrument 3D.
//
// The 2D instrument is not reimplemented here. It is fetched from
// ../motion-instrument/index.html and run unchanged in this document, so the
// audio engine, the look-ahead sequencer, the presets, the words and every key
// stay the 2D file's own. This module adds three things around it:
//   1. an AudioContext tap, installed before the 2D script runs, so a 3D
//      recording can carry the same sound the 2D recorder carries;
//   2. a Three.js scene that reads the 2D engine's notes (window.MI.items) and
//      gives each one a body: a rounded tag that is born at the centre of a
//      cluster, shoves the others outward and settles on springs;
//   3. a neutral HUD with the 2D | 3D tabs.
// The 2D tab is the 2D file exactly as it ships.

import {
  WebGLRenderer, Scene, Color, Fog, PerspectiveCamera, HemisphereLight, DirectionalLight, Mesh, Group, Object3D,
  PlaneGeometry, MeshStandardMaterial, ShadowMaterial, CanvasTexture, SRGBColorSpace, NeutralToneMapping,
  PCFShadowMap, NearestFilter, Raycaster, Vector2, Vector3, Quaternion, PMREMGenerator,
  OrbitControls, RoundedBoxGeometry, RoomEnvironment,
} from './vendor/three.js';

// ---------------------------------------------------------------------------------------------
// 1 · audio tap. One shared AudioContext whose `destination` is a gain that feeds both the
// speakers and a MediaStream. The 2D engine connects to `ac.destination` and never notices.
// ---------------------------------------------------------------------------------------------
const NativeAC = window.AudioContext || window.webkitAudioContext;
let sharedAC = null, audioTap = null;
if (NativeAC) {
  const destGet = Object.getOwnPropertyDescriptor(window.BaseAudioContext ? BaseAudioContext.prototype : NativeAC.prototype, 'destination').get;
  class TapAudioContext extends NativeAC {
    constructor(opts) {
      if (sharedAC) return sharedAC;
      super(opts);
      const out = this.createGain();
      out.connect(destGet.call(this));
      audioTap = this.createMediaStreamDestination();
      out.connect(audioTap);
      Object.defineProperty(this, 'destination', { get: () => out, configurable: true });
      sharedAC = this;
    }
  }
  window.AudioContext = TapAudioContext;
  if (window.webkitAudioContext) window.webkitAudioContext = TapAudioContext;
}

// ---------------------------------------------------------------------------------------------
// 2 · run the 2D instrument in this document
// ---------------------------------------------------------------------------------------------
const loadEl = document.getElementById('hud-load');
async function mount2D() {
  const src = new URL('../motion-instrument/index.html', import.meta.url);
  const res = await fetch(src);
  if (!res.ok) throw new Error(`could not load the 2D instrument (${res.status} ${src.pathname})`);
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  doc.head.querySelectorAll('style').forEach(s => document.head.insertBefore(document.importNode(s, true), document.head.querySelector('style')));
  const host = document.getElementById('mi2d');
  [...doc.body.childNodes].forEach(n => { if (n.nodeName !== 'SCRIPT') host.appendChild(document.importNode(n, true)); });
  const run = document.createElement('script');
  run.textContent = [...doc.body.querySelectorAll('script')].map(s => s.textContent).join('\n');
  document.body.appendChild(run);                       // executes now, synchronously
  if (!window.MI) throw new Error('the 2D instrument did not start (window.MI missing)');
  const t0 = performance.now();                         // the 2D file reports its font check within ~3 s
  while (window.MI.fontOK === null && performance.now() - t0 < 5000) await new Promise(r => setTimeout(r, 50));
}

// ---------------------------------------------------------------------------------------------
// helpers copied from the 2D file (pure functions, kept identical so colours and growth match)
// ---------------------------------------------------------------------------------------------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
function hash(...a) { let h = 2166136261 >>> 0; for (const v of a) { h ^= (v * 2654435761) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; h ^= h >>> 13; } return (h >>> 0) / 4294967296; }
function spring(a, w, z) {
  if (a <= 0) return 0;
  if (z >= 1) return 1 - Math.exp(-w * a) * (1 + w * a);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * a) * (Math.cos(wd * a) + z / Math.sqrt(1 - z * z) * Math.sin(wd * a));
}
const growAmt = age => (age <= 0 ? 0 : Math.max(0, spring(age, 18, 0.45)));
const PAL = { indigo:['#3D3DEB','#FFFFFF'], peri:['#ADB4F5','#000000'], yellow:['#F4C500','#000000'], orange:['#EE4B2B','#000000'],
              green:['#2E7D46','#FFFFFF'], black:['#000000','#FFFFFF'] };
const PALK = Object.keys(PAL);
const FONT = '"Archivo Narrow", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
const now = () => performance.now() / 1000;
const SOUND_NAME = { synth:'Synth', mono:'Mono + SFX', sfx:'SFX + Bass' };

function tagColours(it, th) {
  const pr = MI.DIR.P();
  if (pr.color) {
    const w = it.tg.word.toLowerCase();
    const [b, f] = PAL[PALK[Math.floor(hash(w.replace(/[^a-z]/g, '').length * 977 + w.charCodeAt(0), 3) * PALK.length)]];
    return b === th.bg ? [th.fg, th.bg] : [b, f];
  }
  if (pr.mixed) return it.ch && it.ch.ink ? ['#000000', '#FFFFFF'] : ['#FFFFFF', '#000000'];
  return [th.lb, th.lt];
}
function mix(a, b, k) { return '#' + new Color(a).lerp(new Color(b), k).getHexString(); }

// ---------------------------------------------------------------------------------------------
// 3 · the scene
// ---------------------------------------------------------------------------------------------
let MI = null, S = null;
const U = 1 / 115;                                         // 2D design px → world units
const TAG_D = 0.3;                                         // tag thickness
const CL = new Vector3(0, 5.0, -1.2);                       // cluster centre
const STUDIO = '#e4e3df';

let renderer, scene, camera, controls, padGroup, cluster, slotAnchor;
const pickables = [];
let capRatio = 0.72;

function measureCap() {
  const c = document.createElement('canvas').getContext('2d');
  c.font = `700 100px ${FONT}`;
  capRatio = c.measureText('H').actualBoundingBoxAscent / 100 || 0.72;
}

// -- shared caches -------------------------------------------------------------------------------
const geoCache = new Map(), matCache = new Map(), texCache = new Map(), planeCache = new Map();
function roundedBox(w, h, d, r, seg = 3) {
  const k = [w, h, d, r, seg].map(v => v.toFixed(3)).join('x');
  if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2)));
  return geoCache.get(k);
}
function plane(w, h) {
  const k = `${w.toFixed(3)}x${h.toFixed(3)}`;
  if (!planeCache.has(k)) planeCache.set(k, new PlaneGeometry(w, h));
  return planeCache.get(k);
}
function solid(hex, rough = 0.55, extra = {}) {
  const k = `${hex}|${rough}|${JSON.stringify(extra)}`;
  if (!matCache.has(k)) matCache.set(k, new MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0, ...extra }));
  return matCache.get(k);
}
// A printed face: transparent canvas texture with type on it, lit like the surface under it.
function printMat(key, w, h, draw, { pixel = false, opaque = false } = {}) {
  if (texCache.has(key)) return texCache.get(key);
  const sc = pixel ? 1 : 2, cv = document.createElement('canvas');
  cv.width = Math.max(2, Math.ceil(w * sc)); cv.height = Math.max(2, Math.ceil(h * sc));
  const c = cv.getContext('2d'); c.scale(sc, sc); draw(c, w, h);
  if (pixel) {                                           // hard threshold: every pixel is ink or not, then upscaled nearest
    const d = c.getImageData(0, 0, cv.width, cv.height), a = d.data;
    for (let i = 3; i < a.length; i += 4) a[i] = a[i] > 110 ? 255 : 0;
    c.putImageData(d, 0, 0);
  }
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  if (pixel) { tex.magFilter = NearestFilter; tex.minFilter = NearestFilter; tex.generateMipmaps = false; }
  else tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const mat = new MeshStandardMaterial({ map: tex, transparent: !opaque, roughness: 0.6, metalness: 0, depthWrite: opaque,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  texCache.set(key, mat);
  return mat;
}
function textOn(c, txt, x, y, size, colour, align = 'center', weight = 700) {
  c.font = `${weight} ${size}px ${FONT}`; c.fillStyle = colour; c.textAlign = align; c.textBaseline = 'alphabetic';
  c.fillText(txt, x, y + size * capRatio / 2);
}

// -- scene setup ---------------------------------------------------------------------------------
function buildScene() {
  renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.domElement.id = 'stage3d';
  renderer.domElement.tabIndex = -1;
  document.body.insertBefore(renderer.domElement, document.getElementById('hud-tabs'));

  scene = new Scene();
  scene.background = new Color(STUDIO);
  scene.fog = new Fog(STUDIO, 26, 60);
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

  camera = new PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 200);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 5; controls.maxDistance = 34;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.screenSpacePanning = true;
  controls.autoRotateSpeed = 0.45;
  resetView();

  scene.add(new HemisphereLight('#ffffff', '#b9b5ab', 0.75));
  const key = new DirectionalLight('#ffffff', 2.3);
  key.position.set(5.5, 14, 9.5);
  key.target.position.set(0, 2, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 45 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025;
  scene.add(key, key.target);
  const rim = new DirectionalLight('#ffffff', 0.55);
  rim.position.set(-8, 6, -10);
  scene.add(rim);

  const floor = new Mesh(new PlaneGeometry(220, 220), new ShadowMaterial({ opacity: 0.15 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);

  cluster = new Group(); cluster.position.copy(CL); scene.add(cluster);
  buildPad();
  buildCartridges();
}
function resetView() {
  camera.position.set(0.8, 9.2, 21.5);
  controls.target.set(0, 3.6, 0.2);
  controls.update();
}

// -- the device ------------------------------------------------------------------------------------
// Local frame: x right, y up out of the top face, z toward the player. Top face at y = TOP.
const PAD = { w: 6.6, h: 0.56, d: 5.0 };
const TOP = PAD.h / 2;
const GRID = { c: 0.3, pitch: 0.37, x0: -2.98, z0: -1.95 };
const cells = [], leds = [], noteKeys = [];
let padBody, screenMesh, playLed, recLed, playBtn, recBtn, clearBtn;
const padMats = {};
function buildPad() {
  padGroup = new Group();
  padGroup.position.set(0, 1.05, 2.7);
  padGroup.rotation.x = 0.3;
  scene.add(padGroup);

  padMats.body = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.58, metalness: 0 });
  padBody = new Mesh(roundedBox(PAD.w, PAD.h, PAD.d, 0.24, 5), padMats.body);
  padBody.castShadow = true; padBody.receiveShadow = true;
  padGroup.add(padBody);
  // a darker base plate under the shell, so the device reads as two parts
  const base = new Mesh(roundedBox(PAD.w - 0.3, 0.16, PAD.d - 0.3, 0.07, 2), solid('#2a2a28', 0.7));
  base.position.y = -TOP - 0.05; base.castShadow = true;
  padGroup.add(base);

  padMats.capOff = new MeshStandardMaterial({ color: '#dddddd', roughness: 0.5 });
  padMats.capOn = new MeshStandardMaterial({ color: '#111111', roughness: 0.42 });
  padMats.key = new MeshStandardMaterial({ color: '#cccccc', roughness: 0.5 });
  padMats.ledOff = new MeshStandardMaterial({ color: '#8a8a86', roughness: 0.4 });
  padMats.ledOn = new MeshStandardMaterial({ color: '#EE4B2B', emissive: '#EE4B2B', emissiveIntensity: 1.4, roughness: 0.4 });
  padMats.go = new MeshStandardMaterial({ color: '#2E7D46', emissive: '#2E7D46', emissiveIntensity: 1.5, roughness: 0.4 });

  // 8×8 step grid; row 0 (the lowest note) at the front, as in the 2D pad
  const capGeo = roundedBox(GRID.c, 0.13, GRID.c, 0.045, 2);
  for (let st = 0; st < 8; st++) for (let row = 0; row < 8; row++) {
    const m = new Mesh(capGeo, padMats.capOff);
    m.position.set(GRID.x0 + GRID.c / 2 + st * GRID.pitch, TOP + 0.065, GRID.z0 + GRID.c / 2 + (7 - row) * GRID.pitch);
    m.castShadow = true; m.receiveShadow = true;
    m.userData = { pick: { kind: 'cell', st, row }, rest: m.position.y };
    cells.push(m); pickables.push(m); padGroup.add(m);
  }
  const ledGeo = roundedBox(0.16, 0.05, 0.07, 0.02, 1);
  for (let st = 0; st < 8; st++) {
    const m = new Mesh(ledGeo, padMats.ledOff);
    m.position.set(GRID.x0 + GRID.c / 2 + st * GRID.pitch, TOP + 0.025, GRID.z0 + 8 * GRID.pitch + 0.05);
    leds.push(m); padGroup.add(m);
  }
  // note keys A–K along the front edge
  const keyGeo = roundedBox(0.68, 0.16, 0.5, 0.06, 2), letters = 'ASDFGHJK';
  for (let i = 0; i < 8; i++) {
    const m = new Mesh(keyGeo, padMats.key);
    m.position.set(-2.62 + i * 0.749, TOP + 0.08, 1.92);
    m.castShadow = true; m.receiveShadow = true;
    m.userData = { pick: { kind: 'note', i }, rest: m.position.y, letter: letters[i] };
    noteKeys.push(m); pickables.push(m); padGroup.add(m);
  }
  // screen: a dark bezel with pixel type on it
  const bezel = new Mesh(roundedBox(2.86, 0.06, 1.72, 0.06, 2), solid('#1b1b1a', 0.35));
  bezel.position.set(1.66, TOP + 0.02, -1.1);
  padGroup.add(bezel);
  screenMesh = new Mesh(plane(2.62, 1.48), new MeshStandardMaterial({ color: '#000000' }));
  screenMesh.rotation.x = -Math.PI / 2;
  screenMesh.position.set(1.66, TOP + 0.052, -1.1);
  padGroup.add(screenMesh);
  // pill buttons + their LEDs
  const pill = roundedBox(0.82, 0.15, 0.36, 0.08, 3);
  const mkBtn = (x, kind, label) => {
    const m = new Mesh(pill, solid('#f2f2ef', 0.5));
    m.position.set(x, TOP + 0.075, 0.46); m.castShadow = true;
    m.userData = { pick: { kind }, rest: m.position.y };
    pickables.push(m); padGroup.add(m);
    engrave(label, x, 0.86, 0.26);
    return m;
  };
  playBtn = mkBtn(0.66, 'play', 'PLAY');
  recBtn = mkBtn(1.66, 'rec', 'REC');
  clearBtn = mkBtn(2.66, 'clear', 'CLEAR');
  const dot = roundedBox(0.09, 0.05, 0.09, 0.03, 1);
  playLed = new Mesh(dot, padMats.ledOff); playLed.position.set(0.18, TOP + 0.025, 0.46); padGroup.add(playLed);
  recLed = new Mesh(dot, padMats.ledOff); recLed.position.set(1.18, TOP + 0.025, 0.46); padGroup.add(recLed);
  engrave('STEP', -1.5, -2.22, 0.2);
  engrave('PRESET', 1.66, -2.32, 0.2);
  // the cartridge slot along the back edge; the active preset stands in it
  const slot = new Mesh(roundedBox(1.22, 0.04, 0.26, 0.015, 1), solid('#121212', 0.8));
  slot.position.set(1.66, TOP + 0.005, -2.3);
  padGroup.add(slot);
  slotAnchor = new Object3D();
  slotAnchor.position.set(1.66, TOP + CART.h / 2 - 0.32, -2.3);
  padGroup.add(slotAnchor);
}
const engraved = [];
function engrave(label, x, z, size) {
  const w = size * label.length * 0.62 + 0.1, h = size * 1.3;
  const m = new Mesh(plane(w, h), null);
  m.rotation.x = -Math.PI / 2; m.position.set(x, TOP + 0.003, z);
  m.userData = { label, w, h };
  engraved.push(m); padGroup.add(m);
}

// -- cartridges: one per preset, floating in an arc; the active one flies into the slot --------------
const CART = { w: 1.0, h: 1.3, d: 0.16 };
const carts = [];
function buildCartridges() {
  const n = MI.DIR.PRESETS.length, geo = roundedBox(CART.w, CART.h, CART.d, 0.07, 3);
  const pins = roundedBox(CART.w * 0.72, 0.1, CART.d * 0.6, 0.02, 1), gold = solid('#c9a24a', 0.32, { metalness: 0.85 });
  for (let i = 0; i < n; i++) {
    const g = new Group();
    const body = new Mesh(geo, solid('#ffffff'));
    body.castShadow = true; body.receiveShadow = true;
    body.userData = { pick: { kind: 'preset', i } };
    const face = new Mesh(plane(CART.w - 0.12, CART.h - 0.2), null);
    face.position.z = CART.d / 2 + 0.002; face.position.y = 0.04;
    const back = new Mesh(plane(CART.w - 0.12, CART.h - 0.2), null);
    back.position.z = -CART.d / 2 - 0.002; back.position.y = 0.04; back.rotation.y = Math.PI;
    const contact = new Mesh(pins, gold); contact.position.y = -CART.h / 2 + 0.02;
    g.add(body, face, back, contact);
    pickables.push(body);
    const a = -1.1 + 2.2 * (i / (n - 1));
    const home = new Vector3(Math.sin(a) * 7.6, 6.4 + (i % 2) * 1.1 + (i % 3) * 0.3, CL.z - Math.cos(a) * 3.4 - 3.4);
    const homeQ = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -a * 0.75);
    g.position.copy(home); g.quaternion.copy(homeQ);
    scene.add(g);
    carts.push({ g, body, face, back, home, homeQ, v: new Vector3(), key: '', phase: hash(i, 9) * Math.PI * 2 });
  }
}
function cartFace(i) {
  const pr = MI.DIR.PRESETS[i], th = MI.THEMES[pr.theme] || MI.THEMES[0];
  const key = `cart|${i}|${th.bg}|${th.fg}`;
  return { key, bg: th.bg, mat: printMat(key, 176, 216, (c, w, h) => {
    c.fillStyle = th.bg; c.fillRect(0, 0, w, h);
    textOn(c, String(i + 1).padStart(2, '0'), 14, 40, 52, th.fg, 'left');
    c.fillStyle = th.fg; c.fillRect(14, h - 58, w - 28, 2);
    const name = pr.name.length > 16 ? pr.name.slice(0, 15) + '…' : pr.name;
    textOn(c, name, 14, h - 36, 17, th.fg, 'left');
    textOn(c, `${pr.bpm} BPM`, 14, h - 14, 14, th.fg, 'left', 400);
  }, { opaque: true }) };
}

// ---------------------------------------------------------------------------------------------
// 4 · tags: one body per note, simulated in 3D. Same rules as the 2D flow:
//     the newest tag is pinned at the centre and grows from nothing; the others are shoved by it,
//     pass the shove on, pick up a little tilt and are pulled back toward the centre.
//     On a new cycle the old pile shrinks back into the centre, outside in.
// ---------------------------------------------------------------------------------------------
const bodies = new Map();
const notePress = new Array(8).fill(-9), stepPress = new Array(8).fill(-9);
let lastStep = -1;
function tagMesh(it) {
  const g = new Group();
  const w = it.tg.w * U, h = it.tg.h * U;
  const body = new Mesh(roundedBox(w, h, TAG_D, Math.min(6 * U, h / 2), 2), solid('#ffffff'));
  body.castShadow = true; body.receiveShadow = true;
  const front = new Mesh(plane(w, h), null); front.position.z = TAG_D / 2 + 0.003;
  const back = new Mesh(plane(w, h), null); back.position.z = -TAG_D / 2 - 0.003; back.rotation.y = Math.PI;
  g.add(body, front, back);
  return { g, body, front, back, w, h };
}
function makeBody(it, t) {
  const m = tagMesh(it);
  cluster.add(m.g);
  const fresh = t - it.t0 < 0.3, a = hash(it.key || 0, 3) * Math.PI * 2, r = fresh ? 0 : 0.6 + hash(it.key || 0, 5) * 1.2;
  if (fresh && it.i >= 0 && it.i < 8) notePress[it.i] = t;
  return { it, ...m, x: Math.cos(a) * r, y: Math.sin(a) * r, z: (hash(it.key || 0, 7) - 0.5) * 0.3,
    vx: 0, vy: 0, vz: 0, ax: 0, ay: 0, az: (it.ch ? it.ch.rot0 : 0), wx: 0, wy: 0, wz: 0,
    zRest: (hash(it.key || 0, 11) - 0.5) * 0.4, sc: fresh ? 0 : 1, colKey: '', foldAt: null };
}
function dropBody(b) { cluster.remove(b.g); }
function paintBody(b, th) {
  const [bc, fc] = tagColours(b.it, th), key = `${b.it.tg.word}|${bc}|${fc}`;
  if (key === b.colKey) return;
  b.colKey = key;
  b.body.material = solid(bc, 0.52);
  const tg = b.it.tg;
  const mat = printMat(`tag|${tg.word}|${tg.d.fs}|${Math.round(tg.w)}|${fc}`, tg.w, tg.h, (c, w, h) => textOn(c, tg.word, w / 2, h / 2, tg.d.fs, fc));
  b.front.material = mat; b.back.material = mat;
}
const ANG = { z: 0.18, xy: 0.24 };
function integrate(b, dt, pull, pullZ) {
  b.vx += (-pull * b.x - 4.2 * b.vx) * dt;
  b.vy += (-pull * b.y - 4.2 * b.vy) * dt;
  b.vz += (-pullZ * (b.z - (b.zRest - DOME * (b.x * b.x + b.y * b.y))) - 6 * b.vz) * dt;
  const vmax = 1600 * U;
  b.vx = clamp(b.vx, -vmax, vmax); b.vy = clamp(b.vy, -vmax, vmax); b.vz = clamp(b.vz, -vmax, vmax);
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  b.wz += (-70 * b.az - 9 * b.wz) * dt; b.az = clamp(b.az + b.wz * dt, -ANG.z, ANG.z);
  b.wx += (-55 * b.ax - 8 * b.wx) * dt; b.ax = clamp(b.ax + b.wx * dt, -ANG.xy, ANG.xy);
  b.wy += (-55 * b.ay - 8 * b.wy) * dt; b.ay = clamp(b.ay + b.wy * dt, -ANG.xy, ANG.xy);
}
function pin(b) { b.x = 0; b.y = 0; b.z = 0; b.vx = b.vy = b.vz = 0; b.ax = b.ay = b.az = 0; b.wx = b.wy = b.wz = 0; }
// Boxes stay nearly axis-aligned (tilts stay under ~14°), so contact is tested on the scaled
// boxes' extents in the cluster's plane, exactly the 2D rule. Depth is not a collision axis:
// each tag rests on a shallow dome (further back the further out it is) plus a seeded offset,
// so the pile is round like the 2D one but has a front, a back and a curve you can orbit.
const REST = 0.32, DOME = 0.075;
function collide(a, b, fixedA, fixedB) {
  const sa = a.sc, sb = b.sc;
  if (sa < 0.04 || sb < 0.04) return;
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const ox = (a.w * sa + b.w * sb) / 2 - Math.abs(dx); if (ox <= 0) return;
  const oy = (a.h * sa + b.h * sb) / 2 - Math.abs(dy); if (oy <= 0) return;
  // Push apart along the line between the centres (a seeded direction when they coincide, as a
  // newborn does on the tag it replaces), by exactly the distance that clears the boxes on one
  // axis. Radial pushes grow a round pile; clearing one axis keeps the edges touching.
  let ux = dx, uy = dy;
  const len = Math.hypot(ux, uy);
  if (len < 1e-5) { const th = hash(b.it.key || 0, a.it.key || 0, 13) * Math.PI * 2; ux = Math.cos(th); uy = Math.sin(th); }
  else { ux /= len; uy /= len; }
  const over = Math.min(Math.abs(ux) > 1e-4 ? ox / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-4 ? oy / Math.abs(uy) : Infinity);
  const n = [ux, uy, 0];
  const mass = q => Math.max(400 * U * U, q.w * q.h);
  const iA = fixedA ? 0 : 1 / mass(a), iB = fixedB ? 0 : 1 / mass(b);
  if (iA + iB === 0) return;
  const IA = fixedA ? 0 : 12 / (mass(a) * (a.w * a.w + a.h * a.h)), IB = fixedB ? 0 : 12 / (mass(b) * (b.w * b.w + b.h * b.h));
  const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, cz = (a.z + b.z) / 2;
  const ra = [cx - a.x, cy - a.y, cz - a.z], rb = [cx - b.x, cy - b.y, cz - b.z];
  const rel = (b.vx - a.vx) * n[0] + (b.vy - a.vy) * n[1] + (b.vz - a.vz) * n[2];
  if (rel < 0) {
    const j = -(1 + REST) * rel / (iA + iB);
    a.vx -= j * n[0] * iA; a.vy -= j * n[1] * iA; a.vz -= j * n[2] * iA;
    b.vx += j * n[0] * iB; b.vy += j * n[1] * iB; b.vz += j * n[2] * iB;
    // spin: ω += I⁻¹ (r × J)
    const cross = (r, s) => [(r[1] * n[2] - r[2] * n[1]) * s, (r[2] * n[0] - r[0] * n[2]) * s, (r[0] * n[1] - r[1] * n[0]) * s];
    const ta = cross(ra, -j * IA), tb = cross(rb, j * IB);
    a.wx += ta[0]; a.wy += ta[1]; a.wz += ta[2];
    b.wx += tb[0]; b.wy += tb[1]; b.wz += tb[2];
    if (rel < -40 * U) {                                  // the 2D flow's extra tilt kick on a hard hit
      const side = dx * -n[1] + dy * n[0];
      const kick = clamp(side / (36 * U), -1, 1) * Math.min(over / U, 8) * Math.min(-rel / U, 400) / 400;
      if (!fixedA) { a.wz -= kick * 4200 * U * U / mass(a); a.wx += kick * 1400 * U * U / mass(a); }
      if (!fixedB) { b.wz += kick * 4200 * U * U / mass(b); b.wy -= kick * 1400 * U * U / mass(b); }
    }
  }
  const corr = Math.max(over - 0.8 * U, 0) * 0.7, sum = iA + iB;
  a.x -= n[0] * corr * iA / sum; a.y -= n[1] * corr * iA / sum; a.z -= n[2] * corr * iA / sum;
  b.x += n[0] * corr * iB / sum; b.y += n[1] * corr * iB / sum; b.z += n[2] * corr * iB / sum;
}
function simulate(t, dt) {
  const live = [...bodies.values()];
  const seq = live.filter(b => !b.it.fold);
  const cur = seq.length ? Math.max(...seq.map(b => b.it.gen ?? 0)) : 0;
  const group = seq.filter(b => (b.it.gen ?? 0) === cur).sort((p, q) => p.it.t0 - q.it.t0);
  const folds = live.filter(b => b.it.fold || (b.it.gen ?? 0) !== cur);
  folds.forEach(b => { if (b.foldAt == null) b.foldAt = b.it.fold || t; });
  const nb = group.at(-1) || null;
  for (const b of group) b.sc = b === nb ? growAmt(t - b.it.t0) : 1;   // as in 2D: released tags are full size
  for (const b of group) { if (b === nb) pin(b); else integrate(b, dt, 9, 26); }
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++)
      collide(group[i], group[j], group[i] === nb, group[j] === nb);
  if (nb) pin(nb);
  let foldR = 1e-3;
  for (const b of folds) foldR = Math.max(foldR, Math.hypot(b.x, b.y, b.z));
  for (const b of folds) {
    const dist = Math.hypot(b.x, b.y, b.z), delay = Math.max(0, (foldR - dist) / (1100 * U));
    if (t >= b.foldAt + delay) integrate(b, dt, 46, 46);
    b.sc = Math.min(b.sc, Math.max(0, 1 - clamp((t - b.foldAt - delay) / 0.42)));
  }
}
function syncBodies(t) {
  const items = MI.items, present = new Set();
  for (const it of items) {
    if (!it.tg || it.click || t < it.t0) continue;
    present.add(it);
    if (!bodies.has(it)) bodies.set(it, makeBody(it, t));
  }
  for (const [it, b] of bodies) if (!present.has(it) || (b.foldAt != null && b.sc <= 0.001 && t - b.foldAt > 0.3)) { dropBody(b); bodies.delete(it); }
}
function placeBodies(th) {
  for (const b of bodies.values()) {
    paintBody(b, th);
    b.g.visible = b.sc > 0.002;
    b.g.position.set(b.x, b.y, b.z);
    b.g.rotation.set(b.ax, b.ay, b.az);
    b.g.scale.setScalar(Math.max(0.0001, b.sc));
  }
}

// ---------------------------------------------------------------------------------------------
// 5 · per-frame device state: theme colours, keycaps, LEDs, screen, cartridges
// ---------------------------------------------------------------------------------------------
let themeKey = '', screenSig = '';
function paintDevice(th) {
  const k = th.bg + th.fg;
  if (k === themeKey) return;
  themeKey = k;
  padMats.body.color.set(th.bg);
  padMats.capOff.color.set(mix(th.bg, th.fg, 0.14));
  padMats.capOn.color.set(th.fg);
  padMats.key.color.set(mix(th.bg, th.fg, 0.22));
  for (const m of noteKeys) {
    m.material = solid(mix(th.bg, th.fg, 0.22), 0.5);
    const lab = m.userData.labelMesh || (m.userData.labelMesh = (() => { const p = new Mesh(plane(0.4, 0.4), null);
      p.rotation.x = -Math.PI / 2; p.position.y = 0.081; m.add(p); return p; })());
    lab.material = printMat(`key|${m.userData.letter}|${th.fg}`, 64, 64, (c, w, h) => textOn(c, m.userData.letter, w / 2, h / 2, 36, th.fg));
  }
  const ink = mix(th.bg, th.fg, 0.6);
  for (const e of engraved) {
    const { label, w, h } = e.userData;
    e.material = printMat(`eng|${label}|${ink}`, w * 100, h * 100, (c, ww, hh) => textOn(c, label, ww / 2, hh / 2, hh * 0.62, ink, 'center', 700));
  }
}
// The screen is one small canvas, redrawn only when what it shows changes, thresholded to hard
// pixels and shown with nearest filtering. One texture, updated in place.
let screenCv = null, screenCtx = null, screenTex = null;
function paintScreen() {
  const pr = MI.DIR.P();
  const last = [...bodies.values()].filter(b => !b.it.fold).sort((p, q) => p.it.t0 - q.it.t0).at(-1);
  const word = last ? last.it.tg.word : '';
  const sig = [S.preset, S.bpm, S.bpmNow || '', S.ramp, S.sub, S.scale, S.sound, S.tone, S.lastNote, S.playing, S.step, word].join('|');
  if (sig === screenSig) return;
  screenSig = sig;
  const w = 262, h = 148, lit = '#e8f0e2';
  if (!screenCv) {
    screenCv = document.createElement('canvas'); screenCv.width = w; screenCv.height = h;
    screenCtx = screenCv.getContext('2d', { willReadFrequently: true });
    screenTex = new CanvasTexture(screenCv);
    screenTex.colorSpace = SRGBColorSpace; screenTex.magFilter = NearestFilter; screenTex.minFilter = NearestFilter; screenTex.generateMipmaps = false;
    screenMesh.material = new MeshStandardMaterial({ map: screenTex, emissiveMap: screenTex, emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.3 });
  }
  const c = screenCtx;
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
  textOn(c, String(S.preset + 1).padStart(2, '0'), 8, 22, 34, lit, 'left');
  textOn(c, pr.name, 58, 16, 14, lit, 'left');
  textOn(c, `${S.ramp && S.bpmNow ? S.bpmNow : S.bpm} BPM  ${['', '', '8THS', 'TRIP', '16THS'][S.sub || 2]}  ${S.scale === 'major' ? 'MAJ' : 'MIN'}`, 58, 33, 12, lit, 'left', 400);
  textOn(c, word || (S.playing ? '…' : 'PRESS A–K'), w / 2, 78, 30, lit);
  textOn(c, `${SOUND_NAME[S.sound] || S.sound}  ${S.tone || ''}  ${S.lastNote || ''}`.toUpperCase(), 8, 116, 11, lit, 'left', 400);
  c.fillStyle = lit;
  for (let st = 0; st < 8; st++) {                      // step bar
    if (S.playing && S.step === st) c.fillRect(8 + st * 31, 132, 27, 8);
    else c.fillRect(8 + st * 31, 138, 27, 2);
  }
  const d = c.getImageData(0, 0, w, h), px = d.data;     // hard pixels: every pixel is lit or not
  for (let i = 0; i < px.length; i += 4) { const on = px[i + 1] > 110 ? 255 : 0; px[i] = px[i + 1] = px[i + 2] = on ? 232 : 0; px[i + 3] = 255; }
  c.putImageData(d, 0, 0);
  screenTex.needsUpdate = true;
}
const press = (a, depth) => (a < 0 || a > 0.5 ? 0 : (a < 0.04 ? a / 0.04 : Math.exp(-(a - 0.04) * 14)) * depth);
function animateDevice(t, dt) {
  if (S.playing && S.step !== lastStep && S.step >= 0) stepPress[S.step] = t;
  lastStep = S.playing ? S.step : -1;
  for (const m of cells) {
    const { st, row } = m.userData.pick, on = !!S.pattern[st][row];
    m.material = on ? padMats.capOn : padMats.capOff;
    m.position.y = m.userData.rest - (on ? press(t - stepPress[st], 0.06) : 0) - (on ? 0.012 : 0);
  }
  leds.forEach((m, st) => { m.material = S.playing && S.step === st ? padMats.ledOn : padMats.ledOff; });
  noteKeys.forEach((m, i) => { m.position.y = m.userData.rest - press(t - notePress[i], 0.085); });
  playLed.material = S.playing ? padMats.go : padMats.ledOff;
  recLed.material = rec3d ? padMats.ledOn : padMats.ledOff;
  for (const b of [playBtn, recBtn, clearBtn]) b.position.y = b.userData.rest - press(t - (b.userData.pressT ?? -9), 0.07);
  padGroup.position.y = 1.05 + Math.sin(t * 0.9) * 0.04;   // a slow hover, so it reads as an object in a void
  // cartridges
  const sq = new Vector3(), sqq = new Quaternion();
  slotAnchor.getWorldPosition(sq); slotAnchor.getWorldQuaternion(sqq);
  carts.forEach((c, i) => {
    const f = cartFace(i);
    if (f.key !== c.key) { c.key = f.key; c.face.material = f.mat; c.back.material = f.mat; c.body.material = solid(f.bg, 0.5); }
    const active = i === S.preset;
    const target = active ? sq : c.home.clone().setY(c.home.y + Math.sin(t * 0.8 + c.phase) * 0.18);
    const tq = active ? sqq : c.homeQ.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.sin(t * 0.5 + c.phase) * 0.12));
    c.v.addScaledVector(target.clone().sub(c.g.position), 55 * dt).multiplyScalar(Math.exp(-10 * dt));
    c.g.position.addScaledVector(c.v, dt);
    c.g.quaternion.slerp(tq, 1 - Math.exp(-8 * dt));
  });
}

// ---------------------------------------------------------------------------------------------
// 6 · input: clicks on the device, the HUD, keys
// ---------------------------------------------------------------------------------------------
const ray = new Raycaster(), ptr = new Vector2();
let down = null, userTouched = false, wasPlaying = false;
function pickAt(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects(pickables, false)[0];
  return hit ? hit.object : null;
}
function act(obj) {
  const p = obj.userData.pick, t = now();
  if (p.kind === 'note') {                               // the 2D key handler's own steps
    S.lastNote = MI.playNote(p.i, undefined, S.noteIdx); S.schedIdx = S.noteIdx + 1; MI.trigger(p.i);
  } else if (p.kind === 'cell') {                        // the 2D pad's own steps
    if (!S.playing) MI.togglePlay();
    const on = S.pattern[p.st][p.row] ? 0 : 1;
    S.pattern[p.st][p.row] = on;
    if (on) { S.lastNote = MI.playNote(p.row, undefined, S.noteIdx); MI.trigger(p.row); }
  } else if (p.kind === 'preset') { MI.DIR.setPreset(p.i); bodies.forEach(dropBody); bodies.clear(); }
  else if (p.kind === 'play') { MI.togglePlay(); obj.userData.pressT = t; }
  else if (p.kind === 'rec') { toggleRec3d(); obj.userData.pressT = t; }
  else if (p.kind === 'clear') { sendKey('x'); obj.userData.pressT = t; }
}
function bindInput() {
  const el = renderer.domElement;
  el.addEventListener('pointerdown', ev => { down = { x: ev.clientX, y: ev.clientY, b: ev.button }; });
  el.addEventListener('pointerup', ev => {
    if (!down) return;
    const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 5;
    if (moved) userTouched = true;
    else if (down.b === 0) { const o = pickAt(ev); if (o) act(o); }
    down = null;
  });
  el.addEventListener('wheel', () => { userTouched = true; }, { passive: true });
  el.addEventListener('pointermove', ev => { if (!down) el.style.cursor = pickAt(ev) ? 'pointer' : 'grab'; });
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  });
}
// HUD buttons press the same keys the keyboard does, so the 2D handler stays the one source.
function sendKey(k) { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }
function bindHud() {
  document.querySelectorAll('#hud-tabs [data-mode]').forEach(b => b.addEventListener('click', () => { setMode(b.dataset.mode); b.blur(); }));
  document.querySelectorAll('#hud-bar [data-key]').forEach(b => b.addEventListener('click', () => { sendKey(b.dataset.key); b.blur(); }));
  document.querySelectorAll('#hud-bar [data-preset]').forEach(b => b.addEventListener('click', () => {
    const n = MI.DIR.PRESETS.length; MI.DIR.setPreset((S.preset + Number(b.dataset.preset) + n) % n); b.blur();
  }));
  document.getElementById('hud-view').addEventListener('click', e => { resetView(); userTouched = false; e.currentTarget.blur(); });
  // In 3D, R records the WebGL canvas. Capture phase on window runs before the 2D listener.
  addEventListener('keydown', ev => {
    if (mode !== '3d') return;
    const tag = ev.target && ev.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.key.toLowerCase() === 'r') { ev.stopImmediatePropagation(); ev.preventDefault(); if (!ev.repeat) toggleRec3d(); }
  }, true);
}

// ---------------------------------------------------------------------------------------------
// 7 · recording the 3D view: the WebGL canvas plus the tapped audio, as the 2D recorder does it
// ---------------------------------------------------------------------------------------------
let rec3d = null, recTrack = null;
function recMime() {
  const list = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1.4D001E,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,opus',
    'video/mp4;codecs=avc1.4d002a,opus', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return list.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}
function toggleRec3d() {
  if (rec3d) { try { rec3d.requestData(); } catch (_) {} rec3d.stop(); return; }
  if (!sharedAC) new window.AudioContext();             // inside the key/click gesture; the 2D engine reuses this one
  if (sharedAC && sharedAC.state === 'suspended') sharedAC.resume();
  const mime = recMime();
  if (!mime) { warn('This browser cannot record (no MediaRecorder).'); return; }
  // captureStream(0) + requestFrame() after every render: a frame is pushed each time the scene is
  // drawn, instead of the browser sampling a WebGL buffer that may already have been cleared.
  const stream = renderer.domElement.captureStream(0);
  recTrack = stream.getVideoTracks()[0];
  if (audioTap) audioTap.stream.getAudioTracks().forEach(tr => stream.addTrack(tr));
  else warn('No audio context: the recording will be silent.');
  const chunks = [];
  const r = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10e6, audioBitsPerSecond: 128e3 });
  r.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  r.onstop = () => {
    const ext = mime.includes('mp4') ? 'mp4' : 'webm', type = mime.split(';')[0], blob = new Blob(chunks, { type });
    const name = `motion-instrument-3d-${Date.now()}.${ext}`, a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
    stream.getVideoTracks().forEach(tr => tr.stop());
    window.__last3dRecording = { name, type, size: blob.size, audioTracks: stream.getAudioTracks().length };
    window.__last3dBlob = blob;
    rec3d = null; recTrack = null;
  };
  r.start(200);
  rec3d = r;
}
function warn(msg) { const w = document.getElementById('hud-warn'); w.textContent = msg; w.hidden = false; console.warn(msg); }

// ---------------------------------------------------------------------------------------------
// 8 · modes, HUD and the loop
// ---------------------------------------------------------------------------------------------
let mode = '3d', raf = 0, lastT = 0;
const stats = { sync: 0, sim: 0, device: 0, render: 0, frames: 0 };   // ms, smoothed
function setMode(m) {
  if (m === mode) return;
  if (mode === '3d' && rec3d) rec3d.stop();
  mode = m;
  document.documentElement.dataset.mode = m;
  document.querySelectorAll('#hud-tabs [data-mode]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
  if (m === '3d') { lastT = now(); raf = requestAnimationFrame(loop); }
  else cancelAnimationFrame(raf);
  try { history.replaceState(null, '', m === '2d' ? '#2d' : location.pathname + location.search); } catch (_) {}
}
let hudSig = '';
function syncHud() {
  document.documentElement.classList.toggle('hud-off', !!S.hero);
  const th = MI.THEMES[S.theme], pr = MI.DIR.P(), lay = MI.DIR.lay();
  const sig = [S.preset, S.bpm, S.bpmNow, S.ramp, S.sub, S.scale, S.sound, S.tone, S.variety, S.theme, S.playing, !!rec3d, bodies.size].join('|');
  if (sig === hudSig) return;
  hudSig = sig;
  const set = (id, v) => { document.getElementById(id).textContent = v; };
  set('hud-preset', `${String(S.preset + 1).padStart(2, '0')} · ${pr.name}`);
  set('hud-tempo', `${S.ramp && S.bpmNow ? S.bpmNow : S.bpm} BPM · ${['', '', '8ths', 'triplets', '16ths'][S.sub || 2]}${S.ramp ? ' · ramp' : ''}`);
  set('hud-scale', S.scale);
  set('hud-sound', `${SOUND_NAME[S.sound] || S.sound} · ${S.tone || ''}`);
  set('hud-variety', `${Math.round(S.variety * 100)}%`);
  set('hud-theme', th.name);
  set('hud-tags', `${[...bodies.values()].filter(b => !b.it.fold).length} / ${lay.cap}`);
  document.getElementById('hud-rec').hidden = !rec3d;
  document.getElementById('hud-play').setAttribute('aria-pressed', String(!!S.playing));
  document.getElementById('hud-play').firstChild.textContent = S.playing ? 'Stop' : 'Play';
  document.getElementById('hud-ramp').setAttribute('aria-pressed', String(!!S.ramp));
  document.getElementById('hud-recbtn').setAttribute('aria-pressed', String(!!rec3d));
}
function loop() {
  raf = requestAnimationFrame(loop);
  const t = now(), dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
  const th = MI.THEMES[S.theme];
  const lap = (k, f) => { const a = performance.now(); f(); stats[k] = stats[k] * 0.9 + (performance.now() - a) * 0.1; };
  lap('sync', () => syncBodies(t));
  lap('sim', () => { for (let left = dt; left > 1e-6;) { const s = Math.min(1 / 120, left); simulate(t - left + s, s); left -= s; } });
  lap('device', () => { placeBodies(th); paintDevice(th); paintScreen(); animateDevice(t, dt); });
  if (S.playing && !wasPlaying) userTouched = false;   // a new take re-arms the slow orbit
  wasPlaying = S.playing;
  controls.autoRotate = !!S.playing && !userTouched;
  controls.update(dt);
  lap('render', () => renderer.render(scene, camera));    // CPU side of the draw; the GPU work is not measured here
  if (recTrack && recTrack.requestFrame) recTrack.requestFrame();
  syncHud();
  stats.frames++;
}

// ---------------------------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------------------------
(async () => {
  try {
    await mount2D();
    MI = window.MI; S = MI.S;
    measureCap();
    buildScene();
    bindInput();
    bindHud();
    if (MI.fontOK === false) warn('Archivo Narrow did not load; tags use a fallback face.');
    const start = location.hash === '#2d' ? '2d' : '3d';
    mode = start === '3d' ? '2d' : '3d';               // force setMode to run
    setMode(start);
    loadEl.hidden = true;
    window.MI3D = { stats, get bodies() { return bodies; }, scene, camera, controls, renderer, setMode, toggleRec3d, get mode() { return mode; },
      get audioTap() { return audioTap; }, get audioContext() { return sharedAC; } };
  } catch (err) {
    loadEl.textContent = `Could not start: ${err.message}. Serve this folder over http (npx serve public), not file://.`;
    console.error(err);
  }
})();

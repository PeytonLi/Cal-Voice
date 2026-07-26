import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { POIS } from './pois.js';
import { toWorld, toLatLon } from './geo.js';
import { initAudio, resumeAudio, playLine, stopLine, updateAudio } from './audio.js';

const $ = (s) => document.querySelector(s);

// ---------------------------------------------------------------- renderer --
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb8cf);
scene.fog = new THREE.Fog(0x9fb8cf, 260, 900);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 3000);
const EYE = 1.7;

scene.add(new THREE.HemisphereLight(0xcfe0f2, 0x4a4640, 2.1));
const sun = new THREE.DirectionalLight(0xfff2dc, 1.5);
sun.position.set(120, 220, -90);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x9ab4d0, 0.5);
fill.position.set(-140, 90, 130);
scene.add(fill);

// ------------------------------------------------------------------- state --
let campus = null;              // the joined campus mesh, used for raycasts
let ready = false;
let useBVH = false;
const down = new THREE.Raycaster();
down.far = 400;
const DOWN = new THREE.Vector3(0, -1, 0);

// three-mesh-bvh makes per-frame raycasts against a 700k-triangle mesh viable.
// Without it we fall back to walking at a fixed height, which still works.
try {
  const bvh = await import('https://unpkg.com/three-mesh-bvh@0.7.8/build/index.module.js');
  THREE.BufferGeometry.prototype.computeBoundsTree = bvh.computeBoundsTree;
  THREE.BufferGeometry.prototype.disposeBoundsTree = bvh.disposeBoundsTree;
  THREE.Mesh.prototype.raycast = bvh.acceleratedRaycast;
  useBVH = true;
} catch (e) {
  console.warn('three-mesh-bvh unavailable — flat walking mode', e);
}

// --------------------------------------------------------------------- load --
const draco = new DRACOLoader().setDecoderPath('https://unpkg.com/three@0.170.0/examples/jsm/libs/draco/');
const loader = new GLTFLoader().setDRACOLoader(draco);
let outerGroup = null;

const campusPromise = new Promise((resolve, reject) => {
  loader.load('./public/campus.glb',
    (gltf) => {
      scene.add(gltf.scene);
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = true;
        if (o.material) { o.material.vertexColors = true; o.material.side = THREE.DoubleSide; }
        if (!campus || o.geometry.attributes.position.count > campus.geometry.attributes.position.count) campus = o;
      });
      if (useBVH && campus) campus.geometry.computeBoundsTree();
      resolve();
    },
    (e) => {
      const pct = e.total ? Math.round((e.loaded / e.total) * 100) : Math.round(e.loaded / 1e5);
      $('#bar i').style.width = Math.min(pct, 100) + '%';
      $('#pct').textContent = Math.min(pct, 100) + '%';
    },
    (err) => { $('#pct').textContent = 'failed to load campus.glb — ' + err; reject(err); },
  );
});

// LOD3 outskirts — same coordinate system as the core, covers the broader area
const outerPromise = new Promise((resolve) => {
  loader.load('./public/outer.glb',
    (gltf) => {
      outerGroup = gltf.scene;
      outerGroup.traverse((o) => { if (o.isMesh) o.frustumCulled = true; });
      scene.add(outerGroup);
      resolve();
    },
    undefined,
    () => { console.warn('outer.glb missing — map will show core campus only'); resolve(); },
  );
});

Promise.all([campusPromise, outerPromise]).then(() => boot());

// ------------------------------------------------------------------ ground --
// A downward ray hits the roof first whenever a building is below, which would
// strand the player and the characters on rooftops. Take the LOWEST surface
// instead (ignoring foundation geometry that dips to about -3).
function groundInfo(x, z) {
  if (!campus) return null;
  down.set(new THREE.Vector3(x, 400, z), DOWN);
  const hits = down.intersectObject(campus, true);
  if (!hits.length) return null;
  const top = hits[0].point.y;
  let bottom = top;
  for (let i = hits.length - 1; i >= 0; i--) {
    if (hits[i].point.y > -1.5) { bottom = hits[i].point.y; break; }
  }
  return { top, bottom, covered: top - bottom > 1.5 };
}

// Base plane level. The campus GLB was built with createTerrain=false so that
// synthetic grey fill would not swamp the real grass and paths, which leaves
// voids between mapped features. A single plane closes them.
let BASE = 0;

function groundAt(x, z) {
  const g = groundInfo(x, z);
  return g ? g.bottom : BASE;
}

// Characters are anchored to building centroids, which would put them on the
// roof. OSM2World buildings have no floor face, so a roof hit looks identical
// to a ground hit -- "is something above me" cannot distinguish them. Instead,
// sample a spiral, treat the lowest surface found as street level, and take the
// nearest sample sitting at that level.
function openSpotNear(x, z) {
  const found = [];
  for (const r of [0, 7, 13, 19, 26, 34, 44]) {
    const n = r === 0 ? 1 : 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const g = groundInfo(px, pz);
      if (g) found.push({ x: px, z: pz, y: g.bottom, r });
    }
  }
  if (!found.length) return { x, z, y: 0 };
  const floor = Math.min(...found.map((c) => c.y));
  return found.filter((c) => c.y <= floor + 2).sort((a, b) => a.r - b.r)[0];
}

// Horizontal probe at knee height so walls stop the player. The floor is
// horizontal too, so a horizontal ray only ever catches something vertical.
const side = new THREE.Raycaster();
side.far = 1.1;
const dir = new THREE.Vector3();
function blocked(x, y, z, dx, dz) {
  if (!campus) return false;
  dir.set(dx, 0, dz);
  if (dir.lengthSq() < 1e-6) return false;
  dir.normalize();
  side.set(new THREE.Vector3(x, y, z), dir);
  return side.intersectObject(campus, true).length > 0;
}

// --------------------------------------------------------------- characters --
const labelBox = $('#labels');
const people = [];

function buildPeople() {
  for (const poi of POIS) {
    const anchor = toWorld(poi.lat, poi.lon);
    const spot = openSpotNear(anchor.x, anchor.z);
    const { x, z, y } = spot;
    const isStudent = poi.role === 'student';

    const g = new THREE.Group();
    g.position.set(x, y, z);

    const bodyH = isStudent ? 0.72 : 0.85;
    const bodyY = isStudent ? 0.84 : 0.92;
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(isStudent ? 0.30 : 0.34, bodyH, 6, 12),
      new THREE.MeshStandardMaterial({ color: poi.color, roughness: 0.75 }),
    );
    body.position.y = bodyY;
    g.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(isStudent ? 0.20 : 0.23, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xe8c9a8, roughness: 0.8 }),
    );
    head.position.y = isStudent ? 1.54 : 1.68;
    g.add(head);

    // students get a golden glow ring; staff get their body-color ring
    const ringColor = isStudent ? 0xfdb515 : poi.color;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1.05, 24),
      new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    g.add(ring);

    scene.add(g);

    const el = document.createElement('div');
    el.className = 'lbl';
    el.innerHTML = `<small>${poi.character}</small>${poi.name}`;
    labelBox.appendChild(el);

    people.push({ poi, group: g, el, pos: new THREE.Vector3(x, y + (isStudent ? 1.9 : 2.1), z) });
  }
}

// ------------------------------------------------------------------ controls --
const keys = new Set();
const vel = new THREE.Vector3();
let yaw = 0, pitch = 0, locked = false;

addEventListener('keydown', (e) => {
  const k = e.code;
  keys.add(k);
  if (k === 'KeyE' && near && !dialogOpen) openDialog(near.poi);
  else if (k === 'KeyE' && dialogOpen) advance();
  if (k === 'KeyM') { e.preventDefault(); toggleMap(); }
  if (k === 'Escape' && mapOpen) toggleMap();
  if (k === 'Space' && dialogOpen) { e.preventDefault(); advance(); }
});
addEventListener('keyup', (e) => keys.delete(e.code));

const veil = $('#veil');
// AudioContext can only start from a user gesture, so piggyback on the same
// click that captures the pointer.
veil.addEventListener('click', () => { resumeAudio(); renderer.domElement.requestPointerLock(); });
renderer.domElement.addEventListener('click', () => {
  resumeAudio();
  if (!locked && !mapOpen && !dialogOpen && ready) renderer.domElement.requestPointerLock();
});
// Opening the map or a dialog deliberately releases pointer lock, so the veil
// must stay down in those states or it covers the thing that was just opened.
function updateVeil() {
  veil.classList.toggle('hide', locked || !ready || mapOpen || dialogOpen);
}
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  updateVeil();
});
document.addEventListener('mousemove', (e) => {
  if (!locked) return;
  yaw -= e.movementX * 0.0022;
  pitch -= e.movementY * 0.0022;
  pitch = Math.max(-1.45, Math.min(1.45, pitch));
});

// ------------------------------------------------------------------- dialog --
let dialogOpen = false, dialogPoi = null, dialogLine = 0;

function openDialog(poi) {
  dialogOpen = true; dialogPoi = poi; dialogLine = 0;
  document.exitPointerLock();
  $('#dlg').classList.add('on');
  $('#dlg .dot').style.background = '#' + poi.color.toString(16).padStart(6, '0');
  $('#dlg .nm').textContent = poi.character;
  $('#dlg .at').textContent = '· ' + poi.name;
  updateVeil();
  paintLine();
}
function paintLine() {
  playLine(dialogPoi.id, dialogLine);
  $('#dlg .say').textContent = dialogPoi.lines[dialogLine];
  $('#dlg .pg').textContent = `${dialogLine + 1} / ${dialogPoi.lines.length}`;
  $('#next').textContent = dialogLine === dialogPoi.lines.length - 1 ? 'Done' : 'Continue';
}
function advance() {
  if (++dialogLine >= dialogPoi.lines.length) closeDialog();
  else paintLine();
}
function closeDialog() {
  dialogOpen = false;
  stopLine();
  $('#dlg').classList.remove('on');
  updateVeil();
  if (ready && !mapOpen) renderer.domElement.requestPointerLock();
}
$('#next').addEventListener('click', advance);

// --------------------------------------------------------------- map baking --
// The campus never changes, so the map is rendered once to an offscreen target
// and reused as a still image. Only the player dot moves after that.
let mapImg = null, mapCx = 0, mapCz = 0, mapSpan = 1;
const MAP_PX = 1024;

function bakeMap() {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of POIS) {
    const { x, z } = toWorld(p.lat, p.lon);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  mapCx = (minX + maxX) / 2; mapCz = (minZ + maxZ) / 2;
  // Landmarks cluster tightly, but the walkable world is far larger, so sizing
  // the map to the pins alone would leave most of it off the edge.
  mapSpan = Math.min(2000, Math.max(Math.max(maxX - minX, maxZ - minZ) + 260, 1300));

  // up = -Z puts north at the top; screen right then works out as +X (east)
  const cam = new THREE.OrthographicCamera(-mapSpan / 2, mapSpan / 2, mapSpan / 2, -mapSpan / 2, 1, 4000);
  cam.up.set(0, 0, -1);
  cam.position.set(mapCx, 1500, mapCz);
  cam.lookAt(mapCx, 0, mapCz);

  const rt = new THREE.WebGLRenderTarget(MAP_PX, MAP_PX);
  const oldFog = scene.fog, oldBg = scene.background;
  scene.fog = null;
  // sky blue behind the gaps would read as water on a top-down map
  scene.background = new THREE.Color(0x141922);
  for (const p of people) p.group.visible = false;
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  const buf = new Uint8Array(MAP_PX * MAP_PX * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, MAP_PX, MAP_PX, buf);
  renderer.setRenderTarget(null);
  for (const p of people) p.group.visible = true;
  scene.fog = oldFog;
  scene.background = oldBg;
  rt.dispose();

  // WebGL reads bottom-up; flip into a normal 2D canvas
  const cv = document.createElement('canvas');
  cv.width = cv.height = MAP_PX;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(MAP_PX, MAP_PX);
  for (let y = 0; y < MAP_PX; y++) {
    const src = (MAP_PX - 1 - y) * MAP_PX * 4;
    img.data.set(buf.subarray(src, src + MAP_PX * 4), y * MAP_PX * 4);
  }
  ctx.putImageData(img, 0, 0);
  mapImg = cv;
}

// world -> normalised map position, 0..1 with north at top
function mapUV(x, z) {
  return { u: (x - mapCx) / mapSpan + 0.5, v: (z - mapCz) / mapSpan + 0.5 };
}

// ------------------------------------------------------------------ minimap --
const mm = $('#minimap'), mctx = mm.getContext('2d');

function drawMinimap() {
  if (!mapImg) return;
  const S = mm.width, ZOOM = 3.1;             // crop a window around the player
  const { u, v } = mapUV(camera.position.x, camera.position.z);
  const win = MAP_PX / ZOOM;
  const sx = Math.max(0, Math.min(MAP_PX - win, u * MAP_PX - win / 2));
  const sy = Math.max(0, Math.min(MAP_PX - win, v * MAP_PX - win / 2));

  mctx.clearRect(0, 0, S, S);
  mctx.drawImage(mapImg, sx, sy, win, win, 0, 0, S, S);

  for (const p of people) {
    const uv = mapUV(p.group.position.x, p.group.position.z);
    const px = ((uv.u * MAP_PX) - sx) / win * S, py = ((uv.v * MAP_PX) - sy) / win * S;
    if (px < 0 || py < 0 || px > S || py > S) continue;
    const isStudent = p.poi.role === 'student';
    mctx.beginPath();
    mctx.arc(px, py, isStudent ? 7 : 6, 0, Math.PI * 2);
    mctx.fillStyle = '#' + p.poi.color.toString(16).padStart(6, '0');
    mctx.fill();
    mctx.lineWidth = isStudent ? 3 : 2.5;
    mctx.strokeStyle = isStudent ? '#fdb515' : 'rgba(255,255,255,.85)';
    mctx.stroke();
  }

  // player, with a facing wedge
  const cx = ((u * MAP_PX) - sx) / win * S, cy = ((v * MAP_PX) - sy) / win * S;
  mctx.save();
  mctx.translate(cx, cy);
  mctx.rotate(-yaw);
  mctx.beginPath();
  mctx.moveTo(0, -15); mctx.lineTo(9, 9); mctx.lineTo(0, 4); mctx.lineTo(-9, 9);
  mctx.closePath();
  mctx.fillStyle = '#3b6fa8'; mctx.fill();
  mctx.lineWidth = 2.5; mctx.strokeStyle = '#cfe0f2'; mctx.stroke();
  mctx.restore();
}

// ----------------------------------------------------------------- full map --
let mapOpen = false;

function toggleMap() {
  if (dialogOpen) return;
  mapOpen = !mapOpen;
  $('#map').classList.toggle('on', mapOpen);
  updateVeil();
  if (mapOpen) { document.exitPointerLock(); layoutMap(); }
  else if (ready) renderer.domElement.requestPointerLock();
}
$('#mapclose').addEventListener('click', toggleMap);

function layoutMap() {
  const side = Math.min(innerWidth * 0.86, innerHeight * 0.86);
  const wrap = $('#mapwrap'), cv = $('#mapcanvas');
  wrap.style.width = wrap.style.height = side + 'px';
  cv.width = cv.height = Math.round(side * Math.min(devicePixelRatio, 2));
  cv.style.width = cv.style.height = side + 'px';
  cv.getContext('2d').drawImage(mapImg, 0, 0, cv.width, cv.height);

  const hud = $('#maphud');
  hud.querySelectorAll('.pin').forEach((n) => n.remove());
  for (const p of people) {
    const uv = mapUV(p.group.position.x, p.group.position.z);
    const b = document.createElement('button');
    b.className = 'pin' + (p.poi.role === 'student' ? ' student' : '');
    b.style.left = uv.u * 100 + '%';
    b.style.top = uv.v * 100 + '%';
    b.innerHTML = `<div class="head"><b>${p.poi.character}</b>${p.poi.name}</div><div class="stem"></div>`;
    b.title = 'Travel here and talk to ' + p.poi.character;
    b.addEventListener('click', () => {
      // drop the player just south of the character, facing them
      const spot = openSpotNear(p.group.position.x, p.group.position.z + 6);
      camera.position.set(spot.x, spot.y + EYE, spot.z);
      yaw = 0; pitch = -0.05;
      vel.set(0, 0, 0);
      toggleMap();
      setTimeout(() => openDialog(p.poi), 260);
    });
    hud.appendChild(b);
  }
  placeYou();
}
function placeYou() {
  if (!mapOpen) return;
  const uv = mapUV(camera.position.x, camera.position.z);
  $('#you').style.left = uv.u * 100 + '%';
  $('#you').style.top = uv.v * 100 + '%';
}

// --------------------------------------------------------------------- boot --
function boot() {
  buildPeople();

  BASE = Math.min(...people.map((p) => p.group.position.y)) - 0.08;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshStandardMaterial({ color: 0x76796a, roughness: 1 }),
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = BASE;
  scene.add(plane);

  bakeMap();
  initAudio(camera, scene, toWorld(37.872060, -122.257835));   // bells at the tower

  const start = toWorld(37.869510, -122.259360);            // Sproul Plaza
  camera.position.set(start.x, (groundAt(start.x, start.z) ?? 0) + EYE, start.z + 14);
  yaw = 0; pitch = 0;

  // exposed for perf checks: time from navigation to a walkable scene
  window.__bootMs = Math.round(performance.now());
  console.log(`boot ${window.__bootMs} ms`);

  ready = true;
  $('#load').classList.add('gone');
  veil.classList.remove('hide');
  setTimeout(() => $('#load').remove(), 700);
}

// -------------------------------------------------------------------- loop --
let near = null;
const clock = new THREE.Clock();
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), wish = new THREE.Vector3();
const tmp = new THREE.Vector3();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.1);
  if (!ready) return;

  camera.rotation.set(pitch, yaw, 0, 'YXZ');

  if (locked && !dialogOpen && !mapOpen) {
    fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    wish.set(0, 0, 0);
    if (keys.has('KeyW') || keys.has('ArrowUp')) wish.add(fwd);
    if (keys.has('KeyS') || keys.has('ArrowDown')) wish.sub(fwd);
    if (keys.has('KeyD') || keys.has('ArrowRight')) wish.add(right);
    if (keys.has('KeyA') || keys.has('ArrowLeft')) wish.sub(right);

    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 13 : 5.2;
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);
    vel.lerp(wish, 1 - Math.pow(0.0015, dt));
  } else {
    vel.lerp(tmp.set(0, 0, 0), 1 - Math.pow(0.0015, dt));
  }

  if (vel.lengthSq() > 1e-5) {
    const feet = camera.position.y - EYE;
    // resolve each axis separately so hitting a wall slides along it
    for (const [ax, az] of [[vel.x, 0], [0, vel.z]]) {
      const nx = camera.position.x + ax * dt;
      const nz = camera.position.z + az * dt;
      if (blocked(camera.position.x, feet + 0.9, camera.position.z, ax, az)) continue;
      const g = groundAt(nx, nz);
      if (g === null || g - feet < 1.2) {          // null = off the mapped area
        camera.position.x = nx;
        camera.position.z = nz;
        if (g !== null) camera.position.y += (g + EYE - camera.position.y) * Math.min(1, dt * 12);
      }
    }
  }

  // nearest character
  near = null;
  let best = 11;
  for (const p of people) {
    const d = camera.position.distanceTo(p.group.position);
    if (d < best) { best = d; near = p; }
  }
  const hint = $('#hint');
  if (near && !dialogOpen && !mapOpen) {
    hint.innerHTML = `Press <b>E</b> to talk to the ${near.poi.character}`;
    hint.classList.add('on');
  } else hint.classList.remove('on');

  // character name tags
  for (const p of people) {
    tmp.copy(p.pos).project(camera);
    const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1
      && camera.position.distanceTo(p.group.position) < 120 && !mapOpen;
    p.el.style.display = vis ? 'block' : 'none';
    if (vis) {
      p.el.style.left = (tmp.x * 0.5 + 0.5) * innerWidth + 'px';
      p.el.style.top = (-tmp.y * 0.5 + 0.5) * innerHeight + 'px';
    }
  }

  const ll = toLatLon(camera.position.x, camera.position.z);
  $('#where').textContent = `${ll.lat.toFixed(5)}, ${ll.lon.toFixed(5)}`;

  updateAudio(dt, locked && !dialogOpen && !mapOpen && vel.lengthSq() > 1.5,
    keys.has('ShiftLeft') || keys.has('ShiftRight'));

  renderer.render(scene, camera);
  if (!mapOpen) drawMinimap(); else placeYou();
}
tick();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (mapOpen) layoutMap();
});

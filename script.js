const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => window.innerWidth < 860;

/* ---------- Globe ---------- */

// Nœuds du "réseau" : grandes régions cloud / points d'échange
const NODES = [
  { name: 'Paris',        lat: 48.86, lng:   2.35 },
  { name: 'Montbéliard',  lat: 47.51, lng:   6.80 },
  { name: 'Frankfurt',    lat: 50.11, lng:   8.68 },
  { name: 'London',       lat: 51.51, lng:  -0.13 },
  { name: 'Madrid',       lat: 40.42, lng:  -3.70 },
  { name: 'New York',     lat: 40.71, lng: -74.01 },
  { name: 'Toronto',      lat: 43.65, lng: -79.38 },
  { name: 'San Francisco',lat: 37.77, lng:-122.42 },
  { name: 'São Paulo',    lat:-23.55, lng: -46.63 },
  { name: 'Casablanca',   lat: 33.57, lng:  -7.59 },
  { name: 'Nouakchott',   lat: 18.08, lng: -15.98 },
  { name: 'Johannesburg', lat:-26.20, lng:  28.05 },
  { name: 'Dubai',        lat: 25.20, lng:  55.27 },
  { name: 'Mumbai',       lat: 19.08, lng:  72.88 },
  { name: 'Singapore',    lat:  1.35, lng: 103.82 },
  { name: 'Beijing',      lat: 39.90, lng: 116.40 },
  { name: 'Tokyo',        lat: 35.68, lng: 139.69 },
  { name: 'Sydney',       lat:-33.87, lng: 151.21 }
];

const HUBS = ['Paris', 'Frankfurt', 'New York', 'Singapore'];
const byName = Object.fromEntries(NODES.map(n => [n.name, n]));

const LINKS = [];
HUBS.forEach(h => {
  NODES.forEach(n => {
    if (n.name !== h && Math.random() < 0.35) LINKS.push([byName[h], n]);
  });
});
LINKS.push([byName['Montbéliard'], byName['Paris']], [byName['Montbéliard'], byName['Frankfurt']]);

const ARCS = LINKS.map(([a, b]) => ({
  startLat: a.lat, startLng: a.lng,
  endLat: b.lat, endLng: b.lng,
  color: Math.random() < 0.5 ? ['rgba(51,204,255,.9)', 'rgba(0,255,153,.9)'] : ['rgba(0,255,153,.9)', 'rgba(51,204,255,.9)'],
  dash: 2000 + Math.random() * 2500
}));

const globeEl = document.getElementById('globe');
const stage = document.getElementById('globeStage');
let globe = null;

if (globeEl && typeof Globe === 'function') {
  globe = Globe({ rendererConfig: { antialias: true, alpha: true } })(globeEl)
    .width(window.innerWidth)
    .height(window.innerHeight)
    .backgroundColor('rgba(0,0,0,0)')
    .globeImageUrl('assets/globe/earth-night.jpg')
    .bumpImageUrl('assets/globe/earth-topology.png')
    .showAtmosphere(true)
    .atmosphereColor('#33ccff')
    .atmosphereAltitude(0.2)
    .pointsData(NODES)
    .pointColor(() => '#00ff99')
    .pointAltitude(0.01)
    .pointRadius(0.45)
    .arcsData(ARCS)
    .arcColor('color')
    .arcStroke(0.45)
    .arcAltitudeAutoScale(0.45)
    .arcDashLength(0.35)
    .arcDashGap(1.2)
    .arcDashInitialGap(() => Math.random() * 2)
    .arcDashAnimateTime(d => (reduceMotion ? 0 : d.dash))
    .ringsData(reduceMotion ? [] : NODES.filter(n => HUBS.includes(n.name) || n.name === 'Montbéliard'))
    .ringColor(() => t => `rgba(0,255,153,${1 - t})`)
    .ringMaxRadius(4)
    .ringPropagationSpeed(2.2)
    .ringRepeatPeriod(1400);

  globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const mat = globe.globeMaterial();
  mat.bumpScale = 6;
  if (mat.emissive) { mat.emissive.set('#0a1626'); mat.emissiveIntensity = 0.6; }
  if (mat.shininess !== undefined) mat.shininess = 8;

  // Le globe est purement décoratif : pas d'interaction souris
  const controls = globe.controls();
  controls.enableZoom = false;
  controls.enableRotate = false;
  controls.enablePan = false;
  controls.autoRotate = false;

  document.getElementById('hudNodes').textContent = NODES.length;
  document.getElementById('hudLinks').textContent = ARCS.length;

  window.addEventListener('resize', () => {
    globe.width(window.innerWidth).height(window.innerHeight);
  });
}

/* ---------- Boucle : rotation au scroll, télémétrie, shift lights ---------- */

const BASE_LNG = 10;          // vue de départ centrée sur l'Europe
const DEG_PER_PX = 0.09;      // degrés de rotation par pixel scrollé
const AUTO_DEG_PER_SEC = reduceMotion ? 0 : 2.5;
const MAX_KMH = 340;

let currentLng = BASE_LNG;
let currentLat = 25;
let autoAngle = 0;
let lastTime = performance.now();
let lastY = window.scrollY;
let speed = 0;

const $ = id => document.getElementById(id);
const hudRot = $('hudRot');
const teleSpeed = $('teleSpeed');
const teleRpm = $('teleRpm');
const teleLap = $('teleLap');
const teleGear = $('teleGear');
const lights = document.querySelectorAll('#shiftLights i');

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(v) { return Math.max(0, Math.min(1, v)); }

function tick(now) {
  const dt = Math.max(0.001, Math.min(0.1, (now - lastTime) / 1000));
  lastTime = now;
  autoAngle += AUTO_DEG_PER_SEC * dt;

  const y = window.scrollY;
  const vh = window.innerHeight;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
  const heroP = clamp01(y / vh);
  const pageP = clamp01(y / maxScroll);

  // Vitesse de scroll → km/h (lissée)
  const instant = Math.min(MAX_KMH, Math.abs(y - lastY) / dt * 0.12);
  lastY = y;
  speed = lerp(speed, instant, 1 - Math.pow(0.02, dt));
  if (speed < 0.5) speed = 0;

  // Rotation de la Terre avec inertie
  const targetLng = BASE_LNG - y * DEG_PER_PX - autoAngle;
  const targetLat = lerp(25, -5, pageP);
  const ease = reduceMotion ? 1 : 1 - Math.pow(0.001, dt);
  currentLng = lerp(currentLng, targetLng, ease);
  currentLat = lerp(currentLat, targetLat, ease);

  if (globe) {
    const mobile = isMobile();
    globe.pointOfView({ lat: currentLat, lng: currentLng, altitude: (mobile ? 3 : 2.3) + heroP * 0.4 }, 0);
    const gx = mobile ? 0 : lerp(23, 0, heroP);
    const gy = mobile ? lerp(28, 0, heroP) : lerp(16, 0, heroP);
    stage.style.transform = `translate3d(${gx}vw, ${gy}vh, 0)`;
    stage.style.opacity = lerp(1, 0.4, heroP);
  }

  if (hudRot) hudRot.textContent = Math.round(((-currentLng % 360) + 360) % 360) + '°';
  if (teleSpeed) teleSpeed.textContent = Math.round(speed);
  if (teleRpm) teleRpm.style.width = (speed / MAX_KMH * 100).toFixed(1) + '%';
  if (teleLap) teleLap.textContent = Math.round(pageP * 100) + '%';
  const lit = Math.round(pageP * lights.length);
  lights.forEach((l, i) => l.classList.toggle('on', i < lit));

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ---------- Saisie au clavier dans le prompt ---------- */

const typedEl = $('typed');
let typedRoles = ['whoami'];
let roleIdx = 0, charIdx = 0, deleting = false, typeTimer = null;

function setTypedRoles(roles) {
  typedRoles = roles && roles.length ? roles : typedRoles;
  roleIdx = 0; charIdx = 0; deleting = false;
  clearTimeout(typeTimer);
  if (reduceMotion) { typedEl.textContent = typedRoles[0]; return; }
  typeLoop();
}

function typeLoop() {
  const word = typedRoles[roleIdx % typedRoles.length];
  charIdx += deleting ? -1 : 1;
  typedEl.textContent = word.slice(0, charIdx);

  let delay = deleting ? 35 : 70;
  if (!deleting && charIdx === word.length) { deleting = true; delay = 1800; }
  else if (deleting && charIdx === 0) { deleting = false; roleIdx++; delay = 350; }
  typeTimer = setTimeout(typeLoop, delay);
}

document.addEventListener('langchange', e => {
  if (typedEl) setTypedRoles(e.detail.roles);
});

/* ---------- Fenêtres : popin + focus façon Hyprland ---------- */

const wins = [...document.querySelectorAll('main .win')];

const popObs = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      popObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });
wins.forEach(w => {
  if (!w.closest('#top')) { w.classList.add('pop'); popObs.observe(w); }
});

// La fenêtre la plus proche du centre de l'écran prend le focus
function focusWindow() {
  const mid = window.innerHeight / 2;
  let best = null, bestD = Infinity;
  wins.forEach(w => {
    const r = w.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    const d = Math.abs((r.top + r.bottom) / 2 - mid);
    if (d < bestD) { bestD = d; best = w; }
  });
  wins.forEach(w => w.classList.toggle('active', w === best));
}
window.addEventListener('scroll', focusWindow, { passive: true });
window.addEventListener('resize', focusWindow);
focusWindow();

/* ---------- Workspaces, horloge, rapport ---------- */

const wsLinks = document.querySelectorAll('.ws');
const sections = [...document.querySelectorAll('main section[id]')];
const sectionObs = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    wsLinks.forEach(a => a.classList.toggle('active', a.dataset.ws === entry.target.id));
    if (teleGear) teleGear.textContent = sections.indexOf(entry.target) + 1;
  });
}, { rootMargin: '-45% 0px -50% 0px' });
sections.forEach(s => sectionObs.observe(s));

const clock = $('clock');
function updateClock() {
  const d = new Date();
  clock.textContent = d.toLocaleDateString('fr-FR', { weekday: 'short' }) + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
updateClock();
setInterval(updateClock, 10000);

$('year').textContent = new Date().getFullYear();

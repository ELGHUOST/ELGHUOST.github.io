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
  color: Math.random() < 0.5 ? ['rgba(34,211,238,.9)', 'rgba(167,139,250,.9)'] : ['rgba(59,130,246,.9)', 'rgba(34,211,238,.9)'],
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
    .atmosphereColor('#22d3ee')
    .atmosphereAltitude(0.22)
    .pointsData(NODES)
    .pointColor(() => '#a5f3fc')
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
    .ringColor(() => t => `rgba(34,211,238,${1 - t})`)
    .ringMaxRadius(4)
    .ringPropagationSpeed(2.2)
    .ringRepeatPeriod(1400);

  globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Teinte bleutée sur la surface pour coller à la palette
  const mat = globe.globeMaterial();
  mat.bumpScale = 6;
  if (mat.emissive) { mat.emissive.set('#0b1a33'); mat.emissiveIntensity = 0.6; }
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

/* ---------- Scroll-driven rotation + placement ---------- */

const BASE_LNG = 10;          // vue de départ centrée sur l'Europe
const DEG_PER_PX = 0.09;      // degrés de rotation par pixel scrollé
const AUTO_DEG_PER_SEC = reduceMotion ? 0 : 2.5;

let currentLng = BASE_LNG;
let currentLat = 25;
let autoAngle = 0;
let lastTime = performance.now();
const hudRot = document.getElementById('hudRot');
const progressBar = document.getElementById('scrollProgress');
const navbar = document.getElementById('navbar');

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(v) { return Math.max(0, Math.min(1, v)); }

function tick(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  autoAngle += AUTO_DEG_PER_SEC * dt;

  const y = window.scrollY;
  const vh = window.innerHeight;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
  const heroP = clamp01(y / vh);            // 0 → 1 pendant la sortie du hero
  const pageP = clamp01(y / maxScroll);     // 0 → 1 sur toute la page

  // Rotation : le scroll fait tourner la Terre, avec inertie
  const targetLng = BASE_LNG - y * DEG_PER_PX - autoAngle;
  const targetLat = lerp(25, -5, pageP);
  const ease = reduceMotion ? 1 : 1 - Math.pow(0.001, dt);   // lissage indépendant du framerate
  currentLng = lerp(currentLng, targetLng, ease);
  currentLat = lerp(currentLat, targetLat, ease);

  if (globe) {
    const mobile = isMobile();
    const baseAlt = mobile ? 2.9 : 2.1;
    globe.pointOfView({ lat: currentLat, lng: currentLng, altitude: baseAlt + heroP * 0.5 }, 0);

    // Placement : à droite dans le hero, puis reste en fond à droite, plus discret
    const gx = mobile ? 0 : lerp(22, 18, heroP);
    const gy = mobile ? lerp(18, 0, heroP) : 0;
    const go = lerp(mobile ? 0.55 : 1, mobile ? 0.3 : 0.55, heroP);
    stage.style.transform = `translate3d(${gx}vw, ${gy}vh, 0)`;
    stage.style.opacity = go;
  }

  if (hudRot) hudRot.textContent = (((-currentLng % 360) + 360) % 360).toFixed(1) + '°';
  if (progressBar) progressBar.style.transform = `scaleX(${pageP})`;
  if (navbar) navbar.classList.toggle('scrolled', y > 20);

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ---------- Typing effect ---------- */

const typedEl = document.getElementById('typed');
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

/* ---------- Reveal, nav, misc ---------- */

const revealObs = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.transitionDelay = (el.closest('.hero') ? i * 80 : 0) + 'ms';
  revealObs.observe(el);
});

const navLinks = document.querySelectorAll('.navbar-right a[href^="#"]');
const sectionObs = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('main section[id]').forEach(s => sectionObs.observe(s));

const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navLinks');
navToggle.addEventListener('click', () => {
  const open = navMenu.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', open);
});
navLinks.forEach(a => a.addEventListener('click', () => {
  navMenu.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
}));

document.getElementById('year').textContent = new Date().getFullYear();

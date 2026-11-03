const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
const ACCENT = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ffb000';
const THREAT = '#ff4d4d';

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* =========================================================
   Topologie réseau 3D en fond d'écran
   internet / clouds → fw01 → routeurs cœur → switchs VLAN → serveurs
   Les paquets légitimes passent, les attaques meurent sur le firewall.
   ========================================================= */

const HOSTS = ['web01', 'dns01', 'mail01', 'vpn-gw', 'ad-dc', 'nas01', 'siem', 'bastion',
  'k8s-n1', 'k8s-n2', 'k8s-n3', 'db01', 'ci-runner', 'pc-admin', 'pc-dev', 'backup'];

const nodes = [];
const links = [];

function addRing(kind, labels, y, r, info, phase = 0) {
  return labels.map((label, i) => {
    const a = (i / labels.length) * Math.PI * 2 + phase;
    const node = { kind, label, info: info(i), x: Math.cos(a) * r, y, z: Math.sin(a) * r, flash: 0 };
    nodes.push(node);
    return node;
  });
}

const [inet] = addRing('inet', ['internet'], -1.05, 0, () => '0.0.0.0/0');
const clouds = addRing('cloud', ['cloud-eu-west', 'cloud-us-east', 'cdn-edge'], -0.82, 0.78, i => ['vpc 172.16.0.0/16', 'vpc 172.17.0.0/16', 'anycast'][i], 0.4);
const [fw] = addRing('fw', ['fw01'], -0.42, 0, () => 'stateful · ids/ips');
const cores = addRing('core', ['core-r1', 'core-r2'], -0.1, 0.32, i => `10.0.0.${i + 1} · ospf area 0 · bgp`);
const dists = addRing('dist', ['sw-vlan10', 'sw-vlan20', 'sw-vlan30', 'sw-vlan99'], 0.26, 0.62, i => `vlan ${[10, 20, 30, 99][i]} · 10.${[10, 20, 30, 99][i]}.0.0/24`, 0.8);
const hosts = addRing('host', HOSTS, 0.64, 0.98, i => `10.${[10, 20, 30, 99][Math.floor(i / 4)]}.0.${10 + i}`, 0.2);
const threats = addRing('threat', ['unknown', 'botnet', 'scanner'], -0.98, 1.3, i => ['brute-force ssh', 'ddos syn flood', 'nmap -sS'][i], 1.9);

function link(a, b, kind = 'net') { links.push({ a, b, kind }); }
clouds.forEach(c => link(inet, c));
link(inet, fw);
threats.forEach(t => link(t, fw, 'threat'));
cores.forEach(c => link(fw, c));
link(cores[0], cores[1]);
dists.forEach(d => cores.forEach(c => link(c, d)));
hosts.forEach((h, i) => link(dists[Math.floor(i / 4)], h));

const packets = [];
let blocked = 0;
const fwBlocked = $('fwBlocked');

function spawnPacket() {
  if (Math.random() < 0.22) {
    packets.push({ path: [pick(threats), fw], seg: 0, t: 0, speed: rand(0.5, 0.9), attack: true });
    return;
  }
  const h = pick(hosts);
  const d = dists[Math.floor(hosts.indexOf(h) / 4)];
  const path = [h, d, pick(cores), fw, inet];
  if (Math.random() < 0.5) path.push(pick(clouds));
  if (Math.random() < 0.5) path.reverse();
  packets.push({ path, seg: 0, t: 0, speed: rand(0.9, 1.6), attack: false });
}

const netCanvas = $('net');
const netCtx = netCanvas.getContext('2d');
const stage = $('netStage');
const slotEl = document.querySelector('.net-slot');
const slot = { cx: 0, cy: 0, size: 400 };
let dpr = 1, W = 0, H = 0;
const mouse = { x: -9999, y: -9999 };
const stageOffset = { x: 0, y: 0 };

function resizeNet() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  netCanvas.width = W * dpr; netCanvas.height = H * dpr;
  netCanvas.style.width = W + 'px'; netCanvas.style.height = H + 'px';
  const r = slotEl.getBoundingClientRect();
  slot.cx = r.left + r.width / 2;
  slot.cy = r.top + window.scrollY + r.height / 2;
  slot.size = Math.min(r.width, r.height);
}
resizeNet();
window.addEventListener('resize', resizeNet);
window.addEventListener('load', resizeNet);
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

let yaw = 0.6, pitch = 0.32, autoYaw = 0;
let spawnClock = 0;

function project(n, R) {
  // Rotation Y (scroll + lente), puis X (souris)
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = n.x * cy - n.z * sy, z1 = n.x * sy + n.z * cy;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const y2 = n.y * cp - z1 * sp, z2 = n.y * sp + z1 * cp;
  const persp = 3 / (3 + z2);
  return { x: W / 2 + x1 * R * persp, y: H / 2 + y2 * R * persp, s: persp, depth: clamp01((1.6 - z2) / 3.2) };
}

function drawNet(dt, R, now) {
  const ctx = netCtx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const P = new Map(nodes.map(n => [n, project(n, R)]));

  // Liens
  links.forEach(l => {
    const a = P.get(l.a), b = P.get(l.b);
    const alpha = 0.12 + 0.3 * Math.min(a.depth, b.depth);
    ctx.strokeStyle = l.kind === 'threat' ? `rgba(255,77,77,${alpha})` : `rgba(220,220,220,${alpha})`;
    ctx.setLineDash(l.kind === 'threat' ? [3, 5] : []);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  });
  ctx.setLineDash([]);

  // Paquets
  for (let i = packets.length - 1; i >= 0; i--) {
    const p = packets[i];
    p.t += dt * p.speed * 1.4;
    if (p.t >= 1) {
      p.t = 0; p.seg++;
      if (p.seg >= p.path.length - 1) {
        if (p.attack) {
          fw.flash = 1;
          blocked++;
          if (fwBlocked) fwBlocked.textContent = blocked;
        }
        packets.splice(i, 1);
        continue;
      }
    }
    const a = P.get(p.path[p.seg]), b = P.get(p.path[p.seg + 1]);
    const x = lerp(a.x, b.x, p.t), y = lerp(a.y, b.y, p.t);
    ctx.fillStyle = p.attack ? THREAT : ACCENT;
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(x, y, 2.2 * lerp(a.s, b.s, p.t), 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Nœuds (du plus loin au plus proche) + survol
  let hover = null, hoverD = 16;
  const ordered = [...nodes].sort((m, n) => P.get(m).depth - P.get(n).depth);
  ordered.forEach(n => {
    const p = P.get(n);
    const a = 0.35 + 0.65 * p.depth;
    const sz = { inet: 9, cloud: 6, fw: 8, core: 6, dist: 5, host: 2.6, threat: 4 }[n.kind] * p.s;
    ctx.lineWidth = 1.2;
    if (n.kind === 'threat') {
      ctx.strokeStyle = `rgba(255,77,77,${a})`;
      ctx.beginPath(); ctx.moveTo(p.x - sz, p.y - sz); ctx.lineTo(p.x + sz, p.y + sz);
      ctx.moveTo(p.x + sz, p.y - sz); ctx.lineTo(p.x - sz, p.y + sz); ctx.stroke();
    } else if (n.kind === 'fw') {
      ctx.strokeStyle = ACCENT; ctx.fillStyle = 'rgba(10,10,10,.9)';
      ctx.beginPath(); ctx.rect(p.x - sz, p.y - sz, sz * 2, sz * 2); ctx.fill(); ctx.stroke();
      if (n.flash > 0) {
        ctx.strokeStyle = `rgba(255,77,77,${n.flash})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, sz * (3.2 - n.flash * 1.6), 0, Math.PI * 2); ctx.stroke();
        n.flash = Math.max(0, n.flash - dt * 1.8);
      }
    } else if (n.kind === 'core') {
      ctx.strokeStyle = `rgba(245,245,245,${a})`; ctx.fillStyle = 'rgba(10,10,10,.9)';
      ctx.beginPath(); ctx.moveTo(p.x, p.y - sz); ctx.lineTo(p.x + sz, p.y); ctx.lineTo(p.x, p.y + sz); ctx.lineTo(p.x - sz, p.y); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (n.kind === 'host') {
      ctx.fillStyle = `rgba(220,220,220,${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = `rgba(220,220,220,${a})`; ctx.fillStyle = 'rgba(10,10,10,.9)';
      ctx.beginPath();
      if (n.kind === 'dist') ctx.rect(p.x - sz, p.y - sz * 0.6, sz * 2, sz * 1.2);
      else ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      if (n.kind === 'inet') {
        ctx.strokeStyle = 'rgba(220,220,220,.15)';
        ctx.beginPath(); ctx.arc(p.x, p.y, sz * 1.7 + Math.sin(now / 500) * 2, 0, Math.PI * 2); ctx.stroke();
      }
    }

    if (n.kind !== 'host') {
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = n.kind === 'threat' ? `rgba(255,77,77,${a * 0.8})` : `rgba(200,200,200,${a * 0.75})`;
      ctx.fillText(n.label, p.x + sz + 6, p.y + 3);
    }
    const d = Math.hypot(mouse.x - stageOffset.x - p.x, mouse.y - stageOffset.y - p.y);
    if (d < hoverD) { hoverD = d; hover = { n, p }; }
  });

  // Info-bulle sur le nœud survolé (seulement quand le réseau est au premier plan)
  if (hover && Number(stage.style.opacity) > 0.6) {
    const { n, p } = hover;
    const lines = [n.label, n.info, n.kind === 'fw' ? `${blocked} attacks dropped` : n.kind];
    ctx.font = '11px "JetBrains Mono", monospace';
    const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 20;
    const x = Math.min(p.x + 14, W - w - 8), y = p.y - 52;
    ctx.fillStyle = 'rgba(10,10,10,.92)'; ctx.strokeStyle = n.kind === 'threat' ? THREAT : ACCENT;
    ctx.beginPath(); ctx.rect(x, y, w, 56); ctx.fill(); ctx.stroke();
    lines.forEach((l, i) => {
      ctx.fillStyle = i === 0 ? '#f5f5f5' : '#8a8a8a';
      ctx.fillText(l, x + 10, y + 18 + i * 15);
    });
  }
}

/* =========================================================
   Boucle principale : rotation au scroll, placement, shift lights
   ========================================================= */

const lights = document.querySelectorAll('#shiftLights i');
let lastTime = performance.now();

function tick(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const y = window.scrollY;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - H);
  const heroP = clamp01(y / H);
  const pageP = clamp01(y / maxScroll);

  if (!reduceMotion) autoYaw += dt * 0.12;
  const targetYaw = 0.6 + y * 0.004 + autoYaw;
  yaw = lerp(yaw, targetYaw, 1 - Math.pow(0.002, dt));
  const targetPitch = 0.32 + (mouse.y / Math.max(1, H) - 0.5) * 0.25;
  pitch = lerp(pitch, targetPitch, 1 - Math.pow(0.05, dt));

  // Dans le hero : centré dans .net-slot. Ensuite : au centre de l'écran, en fond.
  const R = lerp(slot.size * 0.42, Math.min(W, H) * 0.36, heroP);
  stageOffset.x = lerp(slot.cx - W / 2, 0, heroP);
  stageOffset.y = lerp(slot.cy - y - H / 2, 0, heroP);
  stage.style.transform = `translate3d(${stageOffset.x}px, ${stageOffset.y}px, 0)`;
  stage.style.opacity = lerp(1, 0.32, heroP);

  spawnClock -= dt;
  if (spawnClock <= 0 && packets.length < 40) { spawnPacket(); spawnClock = reduceMotion ? 1 : rand(0.08, 0.25); }
  drawNet(reduceMotion ? 0 : dt, R, now);

  const lit = Math.round(pageP * lights.length);
  lights.forEach((l, i) => l.classList.toggle('on', i < lit));

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* =========================================================
   Terminal interactif
   ========================================================= */

const typedEl = $('typed');
const input = $('termInput');
const scrollback = $('scrollback');
const hint = $('termHint');
const mainWin = document.querySelector('.win-main');
const termEl = mainWin.querySelector('.term');
let typedRoles = ['whoami'];
let roleIdx = 0, charIdx = 0, deleting = false, typeTimer = null;
let userMode = false;
const cmdHistory = [];
let histIdx = 0;

function setTypedRoles(roles) {
  typedRoles = roles && roles.length ? roles : typedRoles;
  roleIdx = 0; charIdx = 0; deleting = false;
  clearTimeout(typeTimer);
  if (userMode) return;
  if (reduceMotion) { typedEl.textContent = typedRoles[0]; return; }
  typeLoop();
}

function typeLoop() {
  if (userMode) return;
  const word = typedRoles[roleIdx % typedRoles.length];
  charIdx += deleting ? -1 : 1;
  typedEl.textContent = word.slice(0, charIdx);
  let delay = deleting ? 35 : 70;
  if (!deleting && charIdx === word.length) { deleting = true; delay = 1800; }
  else if (deleting && charIdx === 0) { deleting = false; roleIdx++; delay = 350; }
  typeTimer = setTimeout(typeLoop, delay);
}

document.addEventListener('langchange', e => setTypedRoles(e.detail.roles));

const PROJECTS = {
  sae501: 'sae501/index.html',
  ctf: 'ctf/index.html',
  stage: 'stage/stage.html',
  ra7a: 'raha/index.html',
};

function dict() {
  const lang = document.documentElement.lang;
  return (typeof translations !== 'undefined' && (translations[lang] || translations.en)) || {};
}

function esc(t) { return String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]); }

const COMMANDS = {
  help: () => [
    'available commands:',
    '  <b>whoami</b>      who is this guy',
    '  <b>about</b>       cat about.md',
    '  <b>skills</b>      tree ~/skills',
    '  <b>projects</b>    ls ~/projects   ·  <b>open</b> &lt;name&gt;',
    '  <b>btop</b>        live process monitor (projects)',
    '  <b>contact</b>     how to reach me   ·  <b>cv</b>',
    '  <b>ping</b> &lt;host&gt; · <b>nmap</b> · <b>matrix</b> · <b>clear</b>',
  ],
  whoami: () => ['mohamed salem — network admin · sysadmin · cloud · offensive security (ctf team lead)'],
  about: () => ['about_li_1', 'about_li_2', 'about_li_3', 'about_li_4'].map(k => '- ' + esc(dict()[k] || '')),
  skills: () => [
    '~/skills',
    '├── security/   ctf · forensics · web · firewall',
    '├── cloud/      vm · devops · automation · services',
    '├── sysadmin/   linux · bash · ssh · dns/dhcp',
    '└── network/    ospf · bgp · vlan · vpn',
  ],
  projects: () => Object.entries(PROJECTS).map(([k, h]) => `drwxr-xr-x  elghuost  <a href="${h}">${k}/</a>`).concat(['', 'tip: <b>open ctf</b>']),
  ls: args => args[0] && args[0].includes('project') ? COMMANDS.projects() : ['<a href="#projects">projects/</a>  <a href="#contact">contact/</a>  <a href="assets/cv.pdf" target="_blank">cv.pdf</a>  download_cv.sh'],
  open: args => {
    const key = Object.keys(PROJECTS).find(k => (args[0] || '').toLowerCase().startsWith(k.slice(0, 3)));
    if (!key) return [`open: usage: open &lt;${Object.keys(PROJECTS).join('|')}&gt;`];
    setTimeout(() => { location.href = PROJECTS[key]; }, 600);
    return [`spawning ${key}… ▍`];
  },
  btop: () => { $('projects').scrollIntoView({ behavior: 'smooth' }); return ['launching btop…']; },
  htop: () => COMMANDS.btop(),
  top: () => COMMANDS.btop(),
  contact: () => [
    'email   <a href="mailto:mohamedsalemfadili@proton.me">mohamedsalemfadili@proton.me</a>',
    'github  <a href="https://github.com/ELGHUOST" target="_blank" rel="noopener">github.com/ELGHUOST</a>',
  ],
  cv: () => { window.open('assets/cv.pdf', '_blank'); return ['opening cv.pdf…']; },
  ping: args => {
    const host = esc(args[0] || 'elghuost.dev');
    return [`PING ${host} (10.10.0.10): 56 data bytes`]
      .concat([0, 1, 2].map(i => `64 bytes from 10.10.0.10: icmp_seq=${i} ttl=64 time=${rand(0.3, 2.4).toFixed(2)} ms`))
      .concat(['--- 3 packets transmitted, 3 received, 0% packet loss']);
  },
  nmap: () => ['Starting Nmap …', 'PORT    STATE     SERVICE', '22/tcp  filtered  ssh', '80/tcp  open      http', '443/tcp open      https', `<span class="c-threat">fw01 dropped your scan. (${blocked} today)</span>`],
  matrix: () => { mainWin.classList.toggle('matrix-on'); return ['wake up, neo…']; },
  sudo: () => ['<span class="c-threat">mohamed is not in the sudoers file. This incident will be reported.</span>'],
  rm: () => ['<span class="c-threat">nice try.</span>'],
  uname: () => ['Linux elghuost 6.x hyprland #1 SMP x86_64 GNU/Linux'],
  date: () => [new Date().toString()],
  echo: args => [esc(args.join(' '))],
  history: () => cmdHistory.map((h, i) => `  ${i + 1}  ${esc(h)}`),
  fastfetch: () => ['↑ already on screen'],
  neofetch: () => COMMANDS.fastfetch(),
  exit: () => ['logout… there is no escape.'],
  clear: () => { scrollback.innerHTML = ''; return null; },
};

function printLines(cmd, lines) {
  const block = document.createElement('div');
  block.className = 'sb-block';
  block.innerHTML = `<p class="cmd"><span class="ps1">mohamed<span class="at">@</span>elghuost</span> <span class="path">~</span> <span class="arrow">❯</span> ${esc(cmd)}</p>` +
    (lines || []).map(l => `<p class="out">${l || '&nbsp;'}</p>`).join('');
  scrollback.appendChild(block);
  termEl.scrollTop = termEl.scrollHeight;
}

function run(raw) {
  const cmd = raw.trim();
  if (!cmd) { printLines('', []); return; }
  cmdHistory.push(cmd); histIdx = cmdHistory.length;
  const [name, ...args] = cmd.split(/\s+/);
  const fn = COMMANDS[name.toLowerCase()];
  const out = fn ? fn(args) : [`zsh: command not found: ${esc(name)}  —  try <b>help</b>`];
  if (out !== null) printLines(cmd, out);
}

function enterUserMode() {
  mainWin.classList.add('typing');
  if (userMode) return;
  userMode = true;
  clearTimeout(typeTimer);
  typedEl.textContent = input.value;
  hint.classList.add('hidden');
}

function syncTyped() { typedEl.textContent = input.value; }

termEl.addEventListener('click', e => {
  if (e.target.closest('a')) return;
  input.focus({ preventScroll: true });
});
input.addEventListener('focus', enterUserMode);
input.addEventListener('blur', () => mainWin.classList.remove('typing'));
input.addEventListener('input', syncTyped);
input.addEventListener('keydown', e => {
  if (e.key === 'Enter') { run(input.value); input.value = ''; syncTyped(); }
  else if (e.key === 'ArrowUp' && cmdHistory.length) { histIdx = Math.max(0, histIdx - 1); input.value = cmdHistory[histIdx]; syncTyped(); e.preventDefault(); }
  else if (e.key === 'ArrowDown' && cmdHistory.length) { histIdx = Math.min(cmdHistory.length, histIdx + 1); input.value = cmdHistory[histIdx] || ''; syncTyped(); e.preventDefault(); }
  else if (e.key === 'l' && e.ctrlKey) { scrollback.innerHTML = ''; e.preventDefault(); }
  else if (e.key === 'Tab') {
    e.preventDefault();
    const m = Object.keys(COMMANDS).filter(c => c.startsWith(input.value));
    if (m.length === 1) { input.value = m[0] + ' '; syncTyped(); }
  }
});

/* =========================================================
   Pluie « Matrix » discrète derrière le terminal d'accueil
   ========================================================= */

const rain = $('rain');
if (rain && !reduceMotion) {
  const ctx = rain.getContext('2d');
  const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789<>/{}$#';
  const SIZE = 14;
  let drops = [];

  function resizeRain() {
    const r = rain.parentElement.getBoundingClientRect();
    rain.width = r.width;
    rain.height = r.height;
    drops = Array.from({ length: Math.ceil(r.width / SIZE) }, () => Math.random() * -50);
  }
  resizeRain();
  window.addEventListener('resize', resizeRain);

  let lastDraw = 0;
  (function drawRain(t) {
    if (t - lastDraw > 55) {
      lastDraw = t;
      ctx.fillStyle = 'rgba(8, 8, 8, 0.12)';
      ctx.fillRect(0, 0, rain.width, rain.height);
      ctx.font = SIZE + 'px monospace';
      drops.forEach((y, i) => {
        ctx.fillStyle = Math.random() < 0.04 ? '#ffffff' : ACCENT;
        ctx.fillText(pick(GLYPHS), i * SIZE, y * SIZE);
        drops[i] = y * SIZE > rain.height && Math.random() > 0.975 ? 0 : y + 1;
      });
    }
    requestAnimationFrame(drawRain);
  })(0);
}

/* =========================================================
   btop : graphes CPU / réseau + liste des processus (= projets)
   ========================================================= */

const procs = [...document.querySelectorAll('.proc')];
let procSel = 0;

function selectProc(i) {
  procSel = (i + procs.length) % procs.length;
  procs.forEach((p, k) => p.classList.toggle('sel', k === procSel));
  const p = procs[procSel];
  $('procImg').src = p.dataset.img;
  $('procTitle').textContent = p.querySelector('.p-title').textContent;
  $('procDesc').textContent = p.querySelector('.p-desc').textContent;
  $('procOpen').href = p.getAttribute('href');
}
procs.forEach((p, i) => p.addEventListener('mouseenter', () => selectProc(i)));
document.addEventListener('langchange', () => selectProc(procSel));
selectProc(0);

const CORES = 8;
const coresEl = $('cpuCores');
coresEl.innerHTML = Array.from({ length: CORES }, (_, i) => `<p><span>C${i}</span><i><b></b></i><em>0%</em></p>`).join('');
const coreRows = [...coresEl.querySelectorAll('p')];
const memEl = $('memMeters');
const MEM = [['used', 0.46], ['cache', 0.22], ['avail', 0.54], ['swap', 0.04]];
memEl.innerHTML = MEM.map(([k]) => `<p><span>${k}</span><i><b></b></i><em></em></p>`).join('');
const memRows = [...memEl.querySelectorAll('p')];

// Historique pré-rempli par une marche aléatoire, pour ne pas démarrer avec des graphes plats
function walk(n, start, step, lo, hi) {
  const out = [start];
  while (out.length < n) out.push(Math.max(lo, Math.min(hi, out[out.length - 1] + rand(-step, step))));
  return out;
}
const cpuHist = walk(120, 25, 9, 4, 96), netDown = walk(120, 15, 6, 1, 90), netUp = walk(120, 4, 2, 0.5, 40);
let cpuLoad = 20;
let scrollBurst = 0;
window.addEventListener('scroll', () => { scrollBurst = 3; }, { passive: true });

function sparkline(canvas, series, max, color, fill) {
  const r = canvas.getBoundingClientRect();
  if (!r.width) return;
  canvas.width = r.width * dpr; canvas.height = r.height * dpr;
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const step = r.width / (series.length - 1);
  c.beginPath();
  series.forEach((v, i) => {
    const x = i * step, y = r.height - (v / max) * (r.height - 4) - 2;
    if (i) c.lineTo(x, y); else c.moveTo(x, y);
  });
  c.strokeStyle = color; c.lineWidth = 1.4; c.stroke();
  c.lineTo(r.width, r.height); c.lineTo(0, r.height); c.closePath();
  const g = c.createLinearGradient(0, 0, 0, r.height);
  g.addColorStop(0, fill); g.addColorStop(1, 'transparent');
  c.fillStyle = g; c.fill();
}

function meter(row, v, label) {
  row.querySelector('b').style.width = (v * 100).toFixed(1) + '%';
  row.querySelector('em').textContent = label;
}

function btopTick() {
  // Charge simulée : marche aléatoire, avec des pics quand le visiteur scrolle
  cpuLoad = Math.max(4, Math.min(96, cpuLoad + rand(-9, 9) + (scrollBurst > 0 ? 12 : 0)));
  scrollBurst = Math.max(0, scrollBurst - 1);
  cpuHist.push(cpuLoad); cpuHist.shift();
  netDown.push(Math.max(1, Math.min(90, netDown[netDown.length - 1] + rand(-6, 6) + packets.length * 0.05))); netDown.shift();
  netUp.push(Math.max(0.5, Math.min(40, netUp[netUp.length - 1] + rand(-2, 2)))); netUp.shift();
  $('cpuTotal').textContent = cpuLoad.toFixed(0) + '%';
  $('netDown').textContent = netDown[netDown.length - 1].toFixed(1);
  $('netUp').textContent = netUp[netUp.length - 1].toFixed(1);

  coreRows.forEach(r => { const v = clamp01((cpuLoad + rand(-25, 25)) / 100); meter(r, v, (v * 100).toFixed(0) + '%'); });
  memRows.forEach((r, i) => { const v = clamp01(MEM[i][1] + rand(-0.02, 0.02)); meter(r, v, (v * 16).toFixed(1) + 'G'); });
  procs.forEach(p => {
    p.querySelector('.c-cpu').textContent = rand(0.1, p.classList.contains('sel') ? 38 : 12).toFixed(1);
    p.querySelector('.c-mem').textContent = rand(0.4, 6).toFixed(1);
  });

  sparkline($('cpuGraph'), cpuHist, 100, ACCENT, 'rgba(255,176,0,.22)');
  sparkline($('netGraph'), netDown, 100, '#d4d4d4', 'rgba(212,212,212,.12)');
}
setInterval(btopTick, reduceMotion ? 2000 : 600);
btopTick();

/* =========================================================
   Fenêtres : popin, focus, boutons réduire / agrandir / fermer
   ========================================================= */

const wins = [...document.querySelectorAll('main .win')];

const popObs = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('in'); popObs.unobserve(entry.target); }
  });
}, { threshold: 0.1 });
wins.forEach(w => { if (!w.closest('#top')) { w.classList.add('pop'); popObs.observe(w); } });

let activeWin = null;
function focusWindow() {
  const mid = window.innerHeight / 2;
  let best = null, bestD = Infinity;
  wins.forEach(w => {
    const r = w.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    const d = Math.abs((r.top + r.bottom) / 2 - mid);
    if (d < bestD) { bestD = d; best = w; }
  });
  activeWin = document.querySelector('.win.max') || best;
  wins.forEach(w => w.classList.toggle('active', w === activeWin));
}
window.addEventListener('scroll', focusWindow, { passive: true });
window.addEventListener('resize', focusWindow);
focusWindow();

function unmaximize() {
  wins.forEach(w => w.classList.remove('max'));
  document.body.classList.remove('has-max');
}

wins.forEach(w => {
  const title = w.querySelector('.win-title');
  w.querySelector('.l-min').addEventListener('click', () => { unmaximize(); w.classList.toggle('min'); });
  w.querySelector('.l-close').addEventListener('click', () => { unmaximize(); w.classList.add('min', 'closed'); });
  w.querySelector('.l-max').addEventListener('click', () => {
    const wasMax = w.classList.contains('max');
    unmaximize();
    w.classList.remove('min', 'closed');
    if (!wasMax) { w.classList.add('max'); document.body.classList.add('has-max'); }
    focusWindow();
  });
  // Une fenêtre fermée redémarre quand on clique sur sa barre de titre
  title.addEventListener('click', e => {
    if (!e.target.closest('.lights')) w.classList.remove('min', 'closed');
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { unmaximize(); focusWindow(); }
  const btopActive = activeWin && activeWin.classList.contains('win-btop');
  if (!btopActive || document.activeElement === input) return;
  if (e.key === 'ArrowDown') { selectProc(procSel + 1); e.preventDefault(); }
  if (e.key === 'ArrowUp') { selectProc(procSel - 1); e.preventDefault(); }
  if (e.key === 'Enter') location.href = procs[procSel].getAttribute('href');
});

/* =========================================================
   Workspaces, horloge, last login
   ========================================================= */

const wsLinks = document.querySelectorAll('.ws');
const sections = [...document.querySelectorAll('main section[id]')];

// Workspace actif = dernière section dont le haut a passé 40 % de l'écran.
// En bas de page, la dernière section (contact) gagne même si elle est courte.
function setWorkspace(id) {
  wsLinks.forEach(a => a.classList.toggle('active', a.dataset.ws === id));
}
function updateWorkspace() {
  const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
  let current = sections[0];
  if (atBottom) current = sections[sections.length - 1];
  else sections.forEach(sec => { if (sec.getBoundingClientRect().top <= window.innerHeight * 0.4) current = sec; });
  setWorkspace(current.id);
}
window.addEventListener('scroll', updateWorkspace, { passive: true });
wsLinks.forEach(a => a.addEventListener('click', () => { unmaximize(); setWorkspace(a.dataset.ws); }));
updateWorkspace();

const clock = $('clock');
function updateClock() {
  const d = new Date();
  clock.textContent = d.toLocaleDateString('fr-FR', { weekday: 'short' }) + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
updateClock();
setInterval(updateClock, 10000);

$('year').textContent = new Date().getFullYear();

// « Last login » au format macOS, à l'heure du visiteur
const now = new Date();
$('lastLogin').textContent = 'Last login: ' +
  now.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' +
  now.toLocaleDateString('en-US', { month: 'short' }) + ' ' +
  String(now.getDate()).padStart(2, ' ') + ' ' +
  now.toTimeString().slice(0, 8) + ' on ttys001';

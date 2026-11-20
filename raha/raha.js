// RA7A — boutique : hero à deux mondes, filtres, wishlist, archive, Lab, film.
// Partagé avec les pages produit (drops/*.html) : chaque bloc vérifie que ses éléments existent.
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- En-tête : filet au défilement ---------- */
  const hdr = $('#hdr');
  if (hdr) {
    const onScroll = () => hdr.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Hero : désert (gauche) / Japon (droite) ---------- */
  // La couture diagonale suit la souris ; le monde survolé s'allume, l'autre s'assombrit.
  const hero = $('.hero');
  if (hero) {
    const japan = $('.h-japan');
    const seam = $('.h-seam');
    let target = 0.5, current = 0.5, inside = false;

    if (!reduceMotion) {
      hero.classList.add('is-intro');
      setTimeout(() => hero.classList.remove('is-intro'), 2200);
    }
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      target = Math.min(0.85, Math.max(0.15, (e.clientX - r.left) / r.width));
      inside = true;
    });
    hero.addEventListener('pointerleave', () => { inside = false; });

    (function drawSeam(t) {
      if (!inside && !reduceMotion) target = 0.5 + Math.sin(t / 2600) * 0.1;
      current = lerp(current, target, reduceMotion ? 1 : 0.07);
      const tilt = 0.08;  // la couture penche, comme sur l'image Split
      const top = (current + tilt) * 100, bottom = (current - tilt) * 100;
      japan.style.clipPath = `polygon(${top}% 0, 100% 0, 100% 100%, ${bottom}% 100%)`;
      seam.style.setProperty('--top', top + '%');
      seam.style.setProperty('--bottom', bottom + '%');
      const jp = 1 - (current - 0.15) / 0.7;   // 0 = tout désert, 1 = tout Japon
      hero.style.setProperty('--jp', jp.toFixed(3));
      hero.style.setProperty('--ds', (1 - jp).toFixed(3));
      if (window.scrollY < window.innerHeight) requestAnimationFrame(drawSeam);
      else setTimeout(() => requestAnimationFrame(drawSeam), 300);
    })(0);
  }

  /* ---------- Filtres de la boutique ---------- */
  const chips = $$('.chip');
  const cards = $$('#grid .card');
  function applyFilter(line) {
    chips.forEach(c => c.classList.toggle('is-on', c.dataset.filter === line));
    let i = 0;
    cards.forEach(card => {
      const show = line === 'all' || card.dataset.line === line;
      const wasHidden = card.classList.contains('is-hidden');
      card.classList.toggle('is-hidden', !show);
      if (show && wasHidden && !reduceMotion) {
        card.classList.add('is-entering');
        const delay = 40 * i++;
        setTimeout(() => card.classList.remove('is-entering'), 20 + delay);
      }
    });
  }
  chips.forEach(c => c.addEventListener('click', () => applyFilter(c.dataset.filter)));
  // Les tuiles « Collections » ouvrent la boutique déjà filtrée
  $$('[data-go]').forEach(a => a.addEventListener('click', () => applyFilter(a.dataset.go)));

  /* ---------- Wishlist (gardée sur l'appareil) ---------- */
  const PRODUCTS = {
    green: { name: 'Tee Étoiles — Green', img: 'shop/green-front.jpg', href: 'drops/green.html' },
    blue: { name: 'Tee Étoiles — Blue', img: 'shop/blue-front.jpg', href: 'drops/blue.html' },
    lavender: { name: 'Tee Papillon — Lavender', img: 'shop/lavender-front.jpg', href: 'drops/lavender.html' },
    beige: { name: 'Tee Désert — Beige', img: 'shop/beige-front.jpg', href: 'drops/beige.html' },
    brown: { name: 'Tee Désert — Brown', img: 'shop/brown-front.jpg', href: 'drops/earth-tones.html' },
  };
  const base = document.body.dataset.base || '';   // '../' sur les pages produit
  let wish = [];
  try { wish = JSON.parse(localStorage.getItem('ra7a-wish') || '[]').filter(id => PRODUCTS[id]); } catch (e) { wish = []; }
  const save = () => { try { localStorage.setItem('ra7a-wish', JSON.stringify(wish)); } catch (e) { /* stockage indisponible */ } };

  const countEl = $('#wishCount');
  const listEl = $('#wishList');
  const emptyEl = $('#wishEmpty');

  function render() {
    if (countEl) countEl.textContent = wish.length;
    $$('.wish[data-id], .card .wish').forEach(btn => {
      const id = btn.dataset.id || btn.closest('.card').dataset.id;
      btn.setAttribute('aria-pressed', String(wish.includes(id)));
    });
    if (!listEl) return;
    listEl.innerHTML = wish.map(id => {
      const p = PRODUCTS[id];
      return `<li><a href="${base}${p.href}"><img src="${base}assets/${p.img}" alt=""></a>` +
        `<div><b>${p.name}</b><span>Drop 01 · Bientôt</span></div>` +
        `<button type="button" data-remove="${id}">Retirer</button></li>`;
    }).join('');
    emptyEl.hidden = wish.length > 0;
  }
  function toggle(id) {
    wish = wish.includes(id) ? wish.filter(x => x !== id) : [...wish, id];
    save(); render();
    if (countEl && !reduceMotion) {
      countEl.classList.add('bump');
      setTimeout(() => countEl.classList.remove('bump'), 220);
    }
  }
  $$('.wish').forEach(btn => btn.addEventListener('click', () => toggle(btn.dataset.id || btn.closest('.card').dataset.id)));
  if (listEl) listEl.addEventListener('click', e => { const id = e.target.dataset.remove; if (id) toggle(id); });

  const drawer = $('#drawer'), scrim = $('#scrim');
  let lastFocus = null;
  function openDrawer() {
    lastFocus = document.activeElement;
    scrim.hidden = false;
    drawer.inert = false;
    drawer.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => { scrim.classList.add('on'); drawer.classList.add('on'); });
    $('#wishClose').focus();
  }
  function closeDrawer() {
    scrim.classList.remove('on'); drawer.classList.remove('on');
    drawer.inert = true;
    drawer.setAttribute('aria-hidden', 'true');
    setTimeout(() => { scrim.hidden = true; }, reduceMotion ? 0 : 300);
    if (lastFocus) lastFocus.focus();
  }
  if (drawer) {
    $('#wishOpen').addEventListener('click', openDrawer);
    $('#wishClose').addEventListener('click', closeDrawer);
    scrim.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('on')) closeDrawer(); });
  }
  render();

  /* ---------- Pages produit : choix de la taille ---------- */
  const sizes = $$('.size');
  sizes.forEach(s => s.addEventListener('click', () => {
    sizes.forEach(o => o.setAttribute('aria-pressed', String(o === s)));
    const label = $('#sizeLabel');
    if (label) label.textContent = s.textContent;
  }));

  /* ---------- Archive : boutons précédent / suivant ---------- */
  const rail = $('#arcRail');
  if (rail) {
    $$('.arc-btn').forEach(b => b.addEventListener('click', () => {
      rail.scrollBy({ left: Number(b.dataset.dir) * rail.clientWidth * 0.7, behavior: reduceMotion ? 'auto' : 'smooth' });
    }));
  }

  /* ---------- Film : lecture auto (muette) quand visible ---------- */
  const film = $('.film-video');
  if (film) {
    const soundBtn = $('.film-sound');
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) film.play().catch(() => {});
      else film.pause();
    }, { threshold: 0.35 }).observe(film);
    soundBtn.addEventListener('click', () => {
      film.muted = !film.muted;
      soundBtn.textContent = 'Son : ' + (film.muted ? 'off' : 'on');
      soundBtn.setAttribute('aria-pressed', String(!film.muted));
    });
  }

  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Lab : générateur d'affiches ---------- */
  const canvas = $('#labCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const duel = new Image();
  duel.src = 'assets/duel-cut.png';

  const WORLDS = {
    desert: { name: 'Désert / صحراء', bg: ['#3a2a14', '#0f0b06'], ink: '#d9b77a', glyphs: ['راحة', 'استراحة', 'صبر', 'نور', 'حلم', 'فارس'], font: '"Noto Naskh Arabic", serif' },
    japan: { name: 'Japon / 日本', bg: ['#3a2131', '#0c070b'], ink: '#f2a7c3', glyphs: ['休息', '安らぎ', '侍', '風', '夢', '桜', '静'], font: '"Noto Serif JP", serif' },
    split: { name: 'Split / 二つ', bg: ['#1c1b19', '#080807'], ink: '#f2f0eb', glyphs: ['راحة', '休息', '侍', 'فارس'], font: 'serif' },
  };
  let seed = '';

  function grain(alpha) {
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 255 * alpha;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }

  function generate() {
    seed = String(Math.floor(rand(1, 9999))).padStart(4, '0');
    const key = pick(Object.keys(WORLDS));
    const w = WORLDS[key];
    const glyph = pick(w.glyphs);

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, w.bg[0]); g.addColorStop(1, w.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (key === 'split') {
      ctx.save();
      ctx.beginPath(); ctx.moveTo(W * 0.62, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(W * 0.38, H); ctx.closePath();
      ctx.fillStyle = 'rgba(242,167,195,.16)'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 0.62, 0); ctx.lineTo(W * 0.38, H); ctx.lineTo(0, H); ctx.closePath();
      ctx.fillStyle = 'rgba(217,183,122,.16)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(W * 0.62, 0); ctx.lineTo(W * 0.38, H); ctx.stroke();
      ctx.restore();
    }

    // Soleil
    ctx.beginPath(); ctx.arc(rand(W * 0.25, W * 0.75), rand(H * 0.2, H * 0.34), rand(70, 130), 0, Math.PI * 2);
    ctx.fillStyle = key === 'japan' ? 'rgba(232,80,110,.6)' : key === 'desert' ? 'rgba(240,190,110,.4)' : 'rgba(255,255,255,.12)';
    ctx.fill();

    // Signe géant
    ctx.save();
    ctx.translate(W / 2, H * 0.44);
    const size = glyph.length > 4 ? 150 : glyph.length > 2 ? 200 : glyph.length === 2 ? 300 : 440;
    ctx.font = `700 ${size}px ${w.font}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = w.ink; ctx.globalAlpha = 0.92; ctx.fillText(glyph, 0, 0);
    ctx.restore();

    if (duel.complete && duel.naturalWidth) {
      const dw = W * 0.84, dh = dw * duel.naturalHeight / duel.naturalWidth;
      ctx.drawImage(duel, (W - dw) / 2, H * 0.6, dw, dh);
    }

    // Mot-symbole et mentions, dans la police de la marque
    ctx.fillStyle = '#f2f0eb';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '850 128px Archivo, sans-serif';
    ctx.fillText('RA7A', 40, 150);
    ctx.font = '700 17px Archivo, sans-serif';
    ctx.fillText(`DROP 01 — N° ${seed}`, 44, 186);
    ctx.textAlign = 'right';
    ctx.fillText(w.name.toUpperCase(), W - 40, 60);
    ctx.fillStyle = 'rgba(242,240,235,.6)';
    ctx.fillText('DEUX MONDES. UN SEUL REPOS.', W - 40, H - 40);

    let bx = 40;
    ctx.fillStyle = '#f2f0eb';
    while (bx < 220) { const bw = pick([1, 2, 3, 4]); ctx.fillRect(bx, H - 84, bw, 46); bx += bw + pick([2, 3, 5]); }

    grain(0.1);

    $('#labSeed').textContent = seed;
    $('#labWorld').textContent = w.name;
    $('#labGlyph').textContent = glyph;
  }

  function download() {
    const a = document.createElement('a');
    a.download = `ra7a-${seed}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  // Au clic : un court flou masque le changement d'affiche
  function regenerate() {
    if (reduceMotion) { generate(); return; }
    canvas.classList.add('regen');
    setTimeout(() => { generate(); canvas.classList.remove('regen'); }, 140);
  }
  $('#labGen').addEventListener('click', regenerate);
  $('#labSave').addEventListener('click', download);
  canvas.addEventListener('click', regenerate);
  // Polices (Archivo, Naskh, Serif JP) et image du duel prêtes avant la première affiche
  const fontsReady = document.fonts
    ? Promise.all(['850 20px Archivo', '700 20px "Noto Naskh Arabic"', '700 20px "Noto Serif JP"'].map(f => document.fonts.load(f, 'راحة休息')))
    : Promise.resolve();
  Promise.all([fontsReady.catch(() => {}), new Promise(res => { duel.onload = res; duel.onerror = res; if (duel.complete) res(); })]).then(generate);

})();

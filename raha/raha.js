// RA7A — interactions : deux mondes dans le hero, curseur, titres décodés,
// produits inclinables, générateur d'affiches (LAB), film en lecture auto.
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const $ = s => document.querySelector(s);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Hero : désert (gauche) / Japon (droite) ---------- */
  // La couture diagonale suit la souris ; le monde survolé s'allume, l'autre s'éteint.
  const hero = $('.r7-hero');
  const japan = $('.h-japan');
  const seam = $('.h-seam');
  let target = 0.5, current = 0.5, pointerInside = false;

  hero.addEventListener('pointermove', e => {
    const r = hero.getBoundingClientRect();
    target = Math.min(0.85, Math.max(0.15, (e.clientX - r.left) / r.width));
    pointerInside = true;
  });
  hero.addEventListener('pointerleave', () => { pointerInside = false; });

  function drawSeam(t) {
    if (!pointerInside && !reduceMotion) target = 0.5 + Math.sin(t / 2200) * 0.12;
    current = lerp(current, target, reduceMotion ? 1 : 0.08);
    const tilt = 0.08;  // la couture penche, comme sur l'image Split
    const top = (current + tilt) * 100, bottom = (current - tilt) * 100;
    japan.style.clipPath = `polygon(${top}% 0, 100% 0, 100% 100%, ${bottom}% 100%)`;
    seam.style.setProperty('--top', top + '%');
    seam.style.setProperty('--bottom', bottom + '%');
    // 0 = tout désert, 1 = tout Japon : sert à doser lumière et textes
    const side = 1 - (current - 0.15) / 0.7;
    hero.style.setProperty('--jp', side.toFixed(3));
    hero.style.setProperty('--ds', (1 - side).toFixed(3));
    requestAnimationFrame(drawSeam);
  }
  requestAnimationFrame(drawSeam);

  /* ---------- Curseur ---------- */
  const cursor = $('.r7-cursor');
  if (cursor && finePointer) {
    document.body.classList.add('has-cursor');
    const label = cursor.querySelector('span');
    let cx = innerWidth / 2, cy = innerHeight / 2, x = cx, y = cy;
    window.addEventListener('pointermove', e => { cx = e.clientX; cy = e.clientY; });
    (function move() {
      x = lerp(x, cx, 0.25); y = lerp(y, cy, 0.25);
      cursor.style.transform = `translate(${x}px, ${y}px)`;
      requestAnimationFrame(move);
    })();
    document.addEventListener('pointerover', e => {
      const el = e.target.closest('a, button, canvas, .r7-hero');
      cursor.classList.toggle('big', !!el && !el.classList.contains('r7-hero'));
      label.textContent = !el ? '' : el.matches('.r7-item') ? 'view' : el.matches('canvas') ? 'gen' :
        el.classList.contains('r7-hero') ? '← →' : '';
    });
  }

  /* ---------- Titres qui se décodent (katakana + lettres arabes) ---------- */
  const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ侍刀風夢魂桜ابتثجحخدذرزسشصضطظعغفقكلمنهوي✦';
  function scramble(el) {
    const final = el.dataset.text || (el.dataset.text = el.textContent);
    if (reduceMotion) return;
    let frame = 0;
    const total = 22;
    (function step() {
      el.textContent = [...final].map((ch, i) =>
        ch === ' ' || frame / total > i / final.length ? ch : pick(GLYPHS)).join('');
      if (++frame <= total) setTimeout(step, 38);
      else el.textContent = final;
    })();
  }
  const scrambleObs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { scramble(e.target); scrambleObs.unobserve(e.target); } });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-scramble]').forEach(el => {
    scrambleObs.observe(el);
    el.addEventListener('pointerenter', () => scramble(el));
  });

  /* ---------- Produits : inclinaison 3D au survol ---------- */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll('.r7-item:not(.r7-item-text)').forEach(item => {
      item.addEventListener('pointermove', e => {
        const r = item.getBoundingClientRect();
        item.style.setProperty('--rx', (((e.clientY - r.top) / r.height - 0.5) * -8).toFixed(2) + 'deg');
        item.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 8).toFixed(2) + 'deg');
      });
      item.addEventListener('pointerleave', () => { item.style.setProperty('--rx', '0deg'); item.style.setProperty('--ry', '0deg'); });
    });
  }

  /* ---------- LAB : générateur d'affiches ---------- */
  const canvas = $('#labCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const duel = new Image();
  duel.src = 'assets/duel-cut.png';

  const WORLDS = {
    desert: { name: 'Desert / الشرق', bg: ['#2b1c0b', '#0b0805'], ink: '#d2b26f', glyphs: ['راحة', 'صبر', 'نور', 'حلم', 'فارس', 'صحراء'], font: 'serif' },
    japan: { name: 'Japan / 日本', bg: ['#2a1630', '#08050a'], ink: '#ffb4dc', glyphs: ['休息', '安らぎ', '侍', '風', '夢', '魂', '桜', '刀', '静'], font: 'serif' },
    split: { name: 'Split / 二', bg: ['#151515', '#050505'], ink: '#efede6', glyphs: ['راحة', '侍', '刀', 'فارس', '夢'], font: 'serif' },
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
    seed = Math.random().toString(16).slice(2, 6).toUpperCase();
    const key = pick(Object.keys(WORLDS));
    const w = WORLDS[key];
    const glyph = pick(w.glyphs);

    // Fond
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, w.bg[0]); g.addColorStop(1, w.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (key === 'split') {
      ctx.save();
      ctx.beginPath(); ctx.moveTo(W * 0.62, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(W * 0.38, H); ctx.closePath();
      ctx.fillStyle = 'rgba(255,180,220,.14)'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 0.62, 0); ctx.lineTo(W * 0.38, H); ctx.lineTo(0, H); ctx.closePath();
      ctx.fillStyle = 'rgba(210,178,111,.14)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W * 0.62, 0); ctx.lineTo(W * 0.38, H); ctx.stroke();
      ctx.restore();
    }

    // Soleil
    ctx.beginPath(); ctx.arc(rand(W * 0.2, W * 0.8), rand(H * 0.12, H * 0.35), rand(60, 140), 0, Math.PI * 2);
    ctx.fillStyle = key === 'japan' ? 'rgba(255,90,120,.55)' : key === 'desert' ? 'rgba(255,200,120,.35)' : 'rgba(255,255,255,.12)';
    ctx.fill();

    // Glyphe géant
    ctx.save();
    ctx.translate(W / 2, H * 0.46);
    ctx.rotate(rand(-0.12, 0.12));
    const size = glyph.length > 2 ? rand(170, 230) : glyph.length === 2 ? rand(290, 340) : rand(380, 520);
    ctx.font = `700 ${size}px ${w.font}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (Math.random() < 0.5) {
      ctx.fillStyle = w.ink; ctx.globalAlpha = 0.9; ctx.fillText(glyph, 0, 0);
    } else {
      ctx.strokeStyle = w.ink; ctx.lineWidth = 3; ctx.strokeText(glyph, 0, 0);
    }
    ctx.restore();

    // Duel en bas
    if (duel.complete && duel.naturalWidth) {
      const dw = W * 0.86, dh = dw * duel.naturalHeight / duel.naturalWidth;
      ctx.globalAlpha = 0.95;
      ctx.drawImage(duel, (W - dw) / 2, H * 0.62, dw, dh);
      ctx.globalAlpha = 1;
    }

    // Étoiles
    for (let i = 0, n = Math.floor(rand(6, 16)); i < n; i++) {
      ctx.fillStyle = Math.random() < 0.3 ? w.ink : '#efede6';
      ctx.font = `${rand(14, 46)}px serif`;
      ctx.fillText('✦', rand(30, W - 30), rand(40, H * 0.6));
    }

    // Mot-symbole + textes
    ctx.fillStyle = '#efede6';
    ctx.font = '120px Anton, Impact, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('RA7A', 36, 150);
    ctx.font = '700 18px "Space Mono", monospace';
    ctx.fillText(`DROP 01 — #${seed}`, 40, 186);
    ctx.textAlign = 'right';
    ctx.fillText(w.name.toUpperCase(), W - 40, 60);
    ctx.fillStyle = 'rgba(239,237,230,.6)';
    ctx.fillText('TOKYO × DESERT — UNDERGROUND', W - 40, H - 40);

    // Code-barres
    let bx = 40;
    ctx.fillStyle = '#efede6';
    while (bx < 230) { const bw = pick([1, 2, 3, 4]); ctx.fillRect(bx, H - 86, bw, 50); bx += bw + pick([2, 3, 5]); }

    // Lignes de balayage + grain
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
    grain(0.12);

    $('#labSeed').textContent = '#' + seed;
    $('#labWorld').textContent = w.name;
    $('#labGlyph').textContent = glyph;
  }

  function save() {
    const a = document.createElement('a');
    a.download = `ra7a-${seed}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  $('#labGen').addEventListener('click', generate);
  $('#labSave').addEventListener('click', save);
  canvas.addEventListener('click', generate);
  document.addEventListener('keydown', e => {
    if ((e.key === 'g' || e.key === 'G') && !e.target.closest('input, textarea')) generate();
  });
  // Attendre polices + image du duel pour la première affiche
  Promise.all([document.fonts ? document.fonts.ready : null,
    new Promise(res => { duel.onload = res; duel.onerror = res; if (duel.complete) res(); })]).then(generate);

  /* ---------- Film : lecture auto (muette) quand visible ---------- */
  const film = $('.r7-film-video');
  const soundBtn = $('.r7-sound');
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) film.play().catch(() => {});
    else film.pause();
  }, { threshold: 0.35 }).observe(film);
  soundBtn.addEventListener('click', () => {
    film.muted = !film.muted;
    soundBtn.textContent = 'Sound: ' + (film.muted ? 'off' : 'on');
    soundBtn.setAttribute('aria-pressed', String(!film.muted));
  });
})();

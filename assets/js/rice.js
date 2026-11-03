// Pages projets : chaque section devient une fenêtre (kitty / nvim) avec ses boutons macOS,
// comme sur l'accueil. Le HTML de chaque page reste simple, tout est ajouté ici.
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parts = location.pathname.split('/').filter(Boolean);
  const file = (parts.pop() || 'index.html').replace(/\.html$/, '');
  const dir = parts.slice(-2).filter(p => !/github\.io$/i.test(p)).join('/');
  const here = '~/' + (dir ? dir + (file === 'index' || dir.endsWith(file) ? '' : '/' + file) : file);

  function slug(text) {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/^\d+\)\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'notes';
  }

  // Writeups : l'en-tête (titre, sous-titre, étiquettes) devient sa propre fenêtre
  const writeup = document.querySelector('.writeup');
  if (writeup) {
    const head = document.createElement('div');
    head.className = 'writeup-head';
    const firstBlock = writeup.querySelector('.block');
    [...writeup.children].filter(el => el !== firstBlock && !el.classList.contains('block') &&
      firstBlock.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING).forEach(el => head.appendChild(el));
    writeup.insertBefore(head, firstBlock);
  }

  const targets = document.querySelectorAll(
    '.sae-hero, .sae-section, .ctf-hero, .ctf-section:not(.writeup), .stage-hero, .stage-section, .writeup-head, .writeup > .block');

  const wins = [];
  targets.forEach(el => {
    const isHead = /hero|writeup-head/.test(el.className);
    const heading = el.querySelector('h2, h1');
    const title = isHead
      ? `mohamed@elghuost: ${here} — zsh`
      : `nvim — ${here}/${slug(el.id || (heading ? heading.textContent : 'notes'))}.md`;

    const win = document.createElement('article');
    win.className = 'win';
    win.innerHTML = '<div class="win-title"><span class="lights"><i class="l-close" title="close"></i>' +
      '<i class="l-min" title="minimize"></i><i class="l-max" title="zoom"></i></span><span class="wt"></span></div>' +
      '<div class="win-body"></div>';
    win.querySelector('.wt').textContent = title;
    el.parentNode.insertBefore(win, el);
    win.querySelector('.win-body').appendChild(el);
    wins.push(win);
  });

  /* ---------- Popin + focus de la fenêtre au centre de l'écran ---------- */
  const popObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('in'); popObs.unobserve(entry.target); }
    });
  }, { threshold: 0.05 });
  wins.forEach((w, i) => { if (i > 0 && !reduceMotion) { w.classList.add('pop'); popObs.observe(w); } });

  function focusWindow() {
    const mid = window.innerHeight / 2;
    let best = null, bestD = Infinity;
    wins.forEach(w => {
      const r = w.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      const d = Math.abs((r.top + r.bottom) / 2 - mid);
      if (d < bestD) { bestD = d; best = w; }
    });
    const active = document.querySelector('.win.max') || best;
    wins.forEach(w => w.classList.toggle('active', w === active));
  }
  window.addEventListener('scroll', focusWindow, { passive: true });
  window.addEventListener('resize', focusWindow);
  focusWindow();

  /* ---------- Boutons : réduire / agrandir / fermer ---------- */
  function unmaximize() { wins.forEach(w => w.classList.remove('max')); }
  wins.forEach(w => {
    w.querySelector('.l-min').addEventListener('click', () => { unmaximize(); w.classList.toggle('min'); });
    w.querySelector('.l-close').addEventListener('click', () => { unmaximize(); w.classList.add('min', 'closed'); });
    w.querySelector('.l-max').addEventListener('click', () => {
      const wasMax = w.classList.contains('max');
      unmaximize();
      w.classList.remove('min', 'closed');
      if (!wasMax) w.classList.add('max');
      focusWindow();
    });
    // Une fenêtre fermée redémarre quand on clique sur sa barre de titre
    w.querySelector('.win-title').addEventListener('click', e => {
      if (!e.target.closest('.lights')) w.classList.remove('min', 'closed');
    });
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { unmaximize(); focusWindow(); } });

  /* ---------- Horloge dans la barre du haut ---------- */
  const bar = document.querySelector('.ctf-topbar, .sae-topbar, .stage-topbar');
  if (bar) {
    const clock = document.createElement('span');
    clock.className = 'bar-clock';
    bar.appendChild(clock);
    const tick = () => {
      const d = new Date();
      clock.textContent = d.toLocaleDateString('fr-FR', { weekday: 'short' }) + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    };
    tick();
    setInterval(tick, 10000);
  }
})();

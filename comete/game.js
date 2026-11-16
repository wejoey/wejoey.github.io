'use strict';

/* =====================================================================
   COMÈTE — lance-pierre gravitationnel.
   Partie 1 : simulation, solveur et génération des niveaux (sans DOM).
   Partie 2 : rendu, son et interactions.
   ===================================================================== */

const W = 400, H = 700;          // monde logique (portrait)
const DT = 1 / 120;              // pas de simulation fixe (déterministe)
const TMAX = 9;                  // durée maximale d'un vol (s)
const CR = 4, PR = 16, SR = 15;  // rayons : comète, portail, étoile
const VMIN = 140, VMAX = 460;    // vitesses de tir
const NA = 180, NP = 10;         // grille du solveur : angles × puissances
const MARGIN = 120;              // marge hors-champ avant d'être « perdue »

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* Avance la comète d'un pas. Retour : 0 = en vol, 1 = écrasée, 2 = portail, 3 = perdue. */
function advance(L, s) {
  const B = L.bodies;
  let ax = 0, ay = 0;
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    let bx = b.x, by = b.y;
    if (b.moon) {
      const a = b.ph + b.w * s.t;
      bx = b.cx + b.R * Math.cos(a); by = b.cy + b.R * Math.sin(a);
    }
    const dx = bx - s.x, dy = by - s.y, d2 = dx * dx + dy * dy, rr = b.r + CR;
    if (d2 < rr * rr) return 1;
    if (b.gm) {
      const k = b.gm / ((d2 + 80) * Math.sqrt(d2));
      ax += dx * k; ay += dy * k;
    }
  }
  s.vx += ax * DT; s.vy += ay * DT;
  s.x += s.vx * DT; s.y += s.vy * DT;
  s.t += DT;
  const st = L.stars;
  for (let i = 0; i < st.length; i++) {
    if (s.mask & (1 << i)) continue;
    const dx = st[i].x - s.x, dy = st[i].y - s.y;
    if (dx * dx + dy * dy < SR * SR) s.mask |= 1 << i;
  }
  const px = L.portal.x - s.x, py = L.portal.y - s.y;
  if (px * px + py * py < PR * PR) return 2;
  if (s.x < -MARGIN || s.x > W + MARGIN || s.y < -MARGIN || s.y > H + MARGIN || s.t > TMAX) return 3;
  return 0;
}

function shotVel(ai, pi) {
  const a = ai / NA * Math.PI * 2, v = VMIN + pi * (VMAX - VMIN) / (NP - 1);
  return { vx: Math.cos(a) * v, vy: Math.sin(a) * v };
}

/* Le « robot » : essaie tous les tirs de la grille et retient ceux qui gagnent. */
function solve(L) {
  const win = new Uint8Array(NA * NP), time = new Float32Array(NA * NP);
  let count = 0;
  for (let ai = 0; ai < NA; ai++) for (let pi = 0; pi < NP; pi++) {
    const v = shotVel(ai, pi);
    const s = { x: L.start.x, y: L.start.y, vx: v.vx, vy: v.vy, t: 0, mask: 0 };
    let r = 0, inView = true;
    while (!(r = advance(L, s))) {
      if (s.x < 14 || s.x > W - 14 || s.y < 62 || s.y > H - 14) inView = false;
    }
    if (r === 2) { count++; win[ai * NP + pi] = inView ? 2 : 1; time[ai * NP + pi] = s.t; }
  }
  // Tir « parfait » : visible à l'écran, tolérant (voisins gagnants) et le plus acrobatique.
  let golden = null, bestScore = -1;
  for (let ai = 0; ai < NA; ai++) for (let pi = 0; pi < NP; pi++) {
    const i = ai * NP + pi;
    if (win[i] !== 2) continue;
    const robust = win[((ai + 1) % NA) * NP + pi] && win[((ai + NA - 1) % NA) * NP + pi];
    const score = (robust ? 100 : 0) + Math.min(time[i], 6);
    if (score > bestScore) { bestScore = score; golden = { ai, pi }; }
  }
  return { count, golden };
}

function candidate(n, rng) {
  const L = {
    n,
    start: { x: W * (0.2 + 0.6 * rng()), y: H - 70 - 20 * rng() },
    portal: { x: W * (0.15 + 0.7 * rng()), y: 95 + 50 * rng() },
    bodies: [], stars: []
  };
  const fits = (x, y, r) => {
    if (Math.hypot(x - L.start.x, y - L.start.y) < r + 80) return false;
    if (Math.hypot(x - L.portal.x, y - L.portal.y) < r + 55) return false;
    return L.bodies.every(b => Math.hypot(x - b.x, y - b.y) > r + b.r + 38);
  };
  const place = (r) => {
    for (let t = 0; t < 200; t++) {
      const x = 45 + rng() * (W - 90), y = 190 + rng() * (H - 400);
      if (fits(x, y, r)) return { x, y };
    }
    return null;
  };
  const np = Math.min(1 + (n >> 1), 5);
  for (let i = 0; i < np; i++) {
    const r = i === 0 ? 24 + rng() * 10 : 16 + rng() * 16;
    const p = place(r);
    const look = { hue: rng() * 360, ring: rng() < 0.3, tilt: (rng() - 0.5) * 1.2, bands: [] };
    for (let k = 0; k < 5; k++) look.bands.push({ y: (rng() * 2 - 1), h: 0.08 + rng() * 0.2, l: rng() < 0.5 ? 1 : 0, a: 0.06 + rng() * 0.12 });
    if (!p) return null;
    L.bodies.push(Object.assign({ x: p.x, y: p.y, r, gm: 1300 * r * r }, look));
  }
  if (n >= 6 && rng() < 0.6) {           // trou blanc : il repousse
    const p = place(9);
    if (p) L.bodies.push({ x: p.x, y: p.y, r: 9, gm: -7e5, rep: true });
  }
  if (n >= 9) {                           // lune en orbite autour de la plus grosse planète
    const p = L.bodies[0];
    L.bodies.push({ moon: true, cx: p.x, cy: p.y, R: p.r + 24, w: (rng() < 0.5 ? -1 : 1) * (1.2 + rng()), ph: rng() * 6.28, r: 6, gm: 0, x: 0, y: 0 });
  }
  return L;
}

/* Le tir en ligne droite est-il bloqué par une planète ? */
function blocked(L) {
  const ax = L.start.x, ay = L.start.y, dx = L.portal.x - ax, dy = L.portal.y - ay, len2 = dx * dx + dy * dy;
  return L.bodies.some(b => {
    if (b.moon || b.rep) return false;
    const t = Math.max(0, Math.min(1, ((b.x - ax) * dx + (b.y - ay) * dy) / len2));
    return Math.hypot(ax + dx * t - b.x, ay + dy * t - b.y) < b.r + 8;
  });
}

function tracePath(L, vx, vy) {
  const s = { x: L.start.x, y: L.start.y, vx, vy, t: 0, mask: 0 }, path = [];
  let i = 0;
  while (!advance(L, s)) if (i++ % 3 === 0) path.push({ x: s.x, y: s.y });
  return path;
}

/* Niveau n : on tire des candidats jusqu'à en trouver un ni trop facile ni impossible. */
function generate(n) {
  const minC = 3, maxC = n < 2 ? 1e9 : Math.max(14, 90 - 6 * n);
  let best = null, bestScore = 1e9;
  for (let a = 0; a < 60 && bestScore > 0; a++) {
    const L = candidate(n, mulberry32(n * 7919 + a * 104729 + 13));
    if (!L || (n >= 2 && a < 45 && !blocked(L))) continue;
    const S = solve(L);
    if (!S.golden) continue;
    const score = S.count < minC ? 100 + minC - S.count : S.count > maxC ? S.count - maxC : 0;
    if (score < bestScore) { bestScore = score; best = L; L.sol = S; }
  }
  // Trois étoiles posées sur la trajectoire du tir parfait.
  const g = shotVel(best.sol.golden.ai, best.sol.golden.pi);
  best.golden = g;
  const path = tracePath(best, g.vx, g.vy);
  for (const f of [0.3, 0.55, 0.8]) {
    const p = path[Math.floor(path.length * f)];
    best.stars.push({ x: p.x, y: p.y });
  }
  return best;
}

if (typeof module !== 'undefined') module.exports = { generate, advance, tracePath };

/* =====================================================================
   Partie 2 : le jeu dans le navigateur
   ===================================================================== */
if (typeof document !== 'undefined') (function () {
  const $ = id => document.getElementById(id);
  const cv = $('c'), ctx = cv.getContext('2d');
  const bg = document.createElement('canvas'), grid = document.createElement('canvas');
  const TAU = Math.PI * 2;

  /* ---------- Sauvegarde ---------- */
  const KEY = 'comete-v1';
  let save = { unlocked: 1, stars: {}, mute: false, level: 1 };
  try { Object.assign(save, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* stockage indisponible */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } };

  /* ---------- État ---------- */
  let vw = 0, vh = 0, dpr = 1, scale = 1, ox = 0, oy = 0;
  let L = null, s = null, state = 'menu';       // menu | gen | aim | fly | dead | won
  let level = Math.min(save.level || 1, save.unlocked);
  let attempts = 0, fails = 0, acc = 0, timer = 0, clock = 0, shake = 0, flash = 0;
  let drag = null, aim = null, lastAim = null, ghost = null, path = [], trail = [], parts = [];
  let showHint = 0, stepCount = 0;
  const cache = new Map();
  const twinkles = [];

  /* ---------- Son (synthétisé, aucun fichier) ---------- */
  let ac = null, master = null, noiseBuf = null;
  function audio() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain(); master.gain.value = save.mute ? 0 : 0.5; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // Nappe d'ambiance : deux notes graves qui respirent lentement.
      const pad = ac.createGain(); pad.gain.value = 0.035;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.08; lg.gain.value = 0.02;
      lfo.connect(lg); lg.connect(pad.gain); lfo.start();
      for (const f of [110, 164.8, 220.6]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); }
      lp.connect(pad); pad.connect(master);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(f, dur, vol, type, delay, slide) {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, f0, f1) {
    if (!ac) return;
    const t = ac.currentTime, n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    n.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + dur);
  }
  const sfx = {
    launch(p) { noise(0.5, 0.25, 3500, 300); tone(180 + 260 * p, 0.35, 0.15, 'triangle', 0, 520 + 500 * p); },
    star(i) { const f = [523.25, 659.25, 783.99][i % 3]; tone(f, 0.6, 0.2, 'sine'); tone(f * 2, 0.4, 0.08, 'sine', 0.02); tone(f * 3, 0.25, 0.03, 'sine', 0.03); },
    crash() { noise(0.6, 0.5, 1800, 80); tone(110, 0.5, 0.35, 'sine', 0, 35); },
    lost() { tone(330, 0.7, 0.12, 'sine', 0, 110); },
    win() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { tone(f, 0.7, 0.16, 'triangle', i * 0.09); tone(f * 2, 0.5, 0.05, 'sine', i * 0.09); }); noise(0.8, 0.12, 400, 6000); }
  };

  /* ---------- Mise à l'échelle ---------- */
  function resize() {
    vw = window.innerWidth; vh = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    for (const c of [cv, bg, grid]) { c.width = Math.round(vw * dpr); c.height = Math.round(vh * dpr); }
    scale = Math.min(vw / W, vh / H);
    ox = (vw - W * scale) / 2; oy = (vh - H * scale) / 2;
    paintBackground(); paintGrid();
  }

  function paintBackground() {
    const g = bg.getContext('2d'), rng = mulberry32(42);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const base = g.createLinearGradient(0, 0, 0, vh);
    base.addColorStop(0, '#060a1f'); base.addColorStop(1, '#03040c');
    g.fillStyle = base; g.fillRect(0, 0, vw, vh);
    const m = Math.max(vw, vh);
    for (const [x, y, r, c] of [[0.15, 0.2, 0.6, '99,102,241'], [0.9, 0.55, 0.55, '236,72,153'], [0.3, 0.95, 0.5, '14,165,233']]) {
      const n = g.createRadialGradient(x * vw, y * vh, 0, x * vw, y * vh, r * m);
      n.addColorStop(0, `rgba(${c},0.16)`); n.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = n; g.fillRect(0, 0, vw, vh);
    }
    const count = Math.round(vw * vh / 2200);
    for (let i = 0; i < count; i++) {
      const r = rng() * rng() * 1.4 + 0.25;
      g.fillStyle = `hsla(${200 + rng() * 60},80%,${80 + rng() * 20}%,${0.25 + rng() * 0.6})`;
      g.beginPath(); g.arc(rng() * vw, rng() * vh, r, 0, TAU); g.fill();
    }
    twinkles.length = 0;
    for (let i = 0; i < 40; i++) twinkles.push({ x: rng() * vw, y: rng() * vh, r: 0.8 + rng() * 1.2, p: rng() * TAU, f: 0.6 + rng() * 2 });
  }

  /* Le « tissu de l'espace-temps » : une grille déformée par la gravité de chaque astre. */
  function paintGrid() {
    const g = grid.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, grid.width, grid.height);
    if (!L) return;
    g.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    const x0 = -ox / scale, x1 = (vw - ox) / scale, y0 = -oy / scale, y1 = (vh - oy) / scale, G = 28, S = 7;
    const warp = (x, y) => {
      let wx = x, wy = y;
      for (const b of L.bodies) {
        if (!b.gm) continue;
        const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy) + 0.001;
        const pull = Math.min(3.5e-4 * Math.abs(b.gm) / (d + 20), d * 0.8) * Math.sign(b.gm);
        wx += dx / d * pull; wy += dy / d * pull;
      }
      return [wx, wy];
    };
    g.strokeStyle = 'rgba(125,160,255,0.13)'; g.lineWidth = 1 / scale;
    g.beginPath();
    for (let x = Math.floor(x0 / G) * G; x <= x1 + G; x += G) {
      for (let y = y0 - S, first = true; y <= y1 + S; y += S, first = false) { const p = warp(x, y); first ? g.moveTo(p[0], p[1]) : g.lineTo(p[0], p[1]); }
    }
    for (let y = Math.floor(y0 / G) * G; y <= y1 + G; y += G) {
      for (let x = x0 - S, first = true; x <= x1 + S; x += S, first = false) { const p = warp(x, y); first ? g.moveTo(p[0], p[1]) : g.lineTo(p[0], p[1]); }
    }
    g.stroke();
  }

  /* ---------- Particules ---------- */
  function burst(x, y, n, speed, color, life, size) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.2 + Math.random());
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.5 + Math.random() * 0.5), max: life, color, size: size * (0.5 + Math.random()) });
    }
  }

  /* ---------- Déroulement ---------- */
  const tipEl = $('tip');
  let tipTimer = 0;
  function tip(text, ms) {
    clearTimeout(tipTimer);
    if (!text) { tipEl.classList.remove('show'); return; }
    tipEl.textContent = text; tipEl.classList.add('show');
    if (ms) tipTimer = setTimeout(() => tipEl.classList.remove('show'), ms);
  }
  const starStr = n => '★'.repeat(n) + '☆'.repeat(3 - n);
  function hud() {
    $('lvl').textContent = 'Niveau ' + level;
    $('best').textContent = starStr(save.stars[level] || 0);
    $('prev').disabled = level <= 1;
    $('next').disabled = level >= save.unlocked;
    $('hint').disabled = fails < 3;
    $('hint').classList.toggle('pulse', fails >= 3 && !showHint);
    $('mute').textContent = save.mute ? '🔇' : '🔊';
  }

  function loadLevel(n) {
    level = n; save.level = n; persist();
    state = 'gen'; attempts = 0; fails = 0; ghost = null; lastAim = null; showHint = 0; drag = aim = null; parts = [];
    hud(); tip('Le robot prépare le niveau…');
    setTimeout(() => {
      if (!cache.has(n)) cache.set(n, generate(n));
      L = cache.get(n);
      paintGrid(); resetShot();
      tip(n === 1 ? 'Glisse le doigt vers l\'arrière, comme un lance-pierre, puis relâche ✨' :
          n === 6 ? 'Nouveau : les trous blancs repoussent la comète' :
          n === 9 ? 'Nouveau : attention à la lune en orbite' : '', n === 1 ? 0 : 3500);
    }, 30);
  }

  function resetShot() {
    s = { x: L.start.x, y: L.start.y, vx: 0, vy: 0, t: 0, mask: 0 };
    trail = []; acc = 0; state = 'aim';
  }

  function launch(vx, vy) {
    audio();
    s.vx = vx; s.vy = vy; state = 'fly'; attempts++; path = []; stepCount = 0;
    lastAim = { vx, vy }; tip('');
    sfx.launch((Math.hypot(vx, vy) - VMIN) / (VMAX - VMIN));
    burst(s.x, s.y, 14, 90, '125,211,252', 0.5, 2);
  }

  function endFlight(r) {
    ghost = path;
    if (r === 2) {
      state = 'won'; timer = 0.9; flash = 1;
      sfx.win();
      burst(L.portal.x, L.portal.y, 70, 260, '196,181,253', 1.1, 3);
      burst(L.portal.x, L.portal.y, 40, 140, '125,211,252', 0.9, 2.5);
      if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
      return;
    }
    state = 'dead'; timer = 0.85; fails++;
    if (r === 1) {
      shake = 12; sfx.crash();
      burst(s.x, s.y, 50, 220, '251,146,60', 0.8, 3);
      burst(s.x, s.y, 25, 120, '255,255,255', 0.5, 2);
      if (navigator.vibrate) navigator.vibrate(60);
      tip('Écrasée ! 💥', 1400);
    } else { sfx.lost(); tip('Perdue dans l\'espace…', 1400); }
    hud();
  }

  function showWin() {
    let n = 0; for (let i = 0; i < 3; i++) if (s.mask & (1 << i)) n++;
    save.stars[level] = Math.max(save.stars[level] || 0, n);
    save.unlocked = Math.max(save.unlocked, level + 1); persist(); hud();
    $('o-title').textContent = n === 3 ? 'Tir parfait !' : 'Portail atteint !';
    $('o-stars').hidden = false; $('o-stars').textContent = starStr(n);
    $('o-text').textContent = (attempts === 1 ? 'Du premier coup' : 'En ' + attempts + ' essais') +
      (n < 3 ? ' — les 3 étoiles marquent la trajectoire du robot.' : ' — aussi bien que le robot.');
    $('o-retry').hidden = false; $('o-go').textContent = 'Suivant';
    $('overlay').classList.remove('hidden');
  }

  function update(dt) {
    clock += dt;
    shake *= Math.pow(0.002, dt); flash = Math.max(0, flash - dt * 1.8);
    if (showHint > 0) showHint = Math.max(0, showHint - dt);
    if (state === 'fly') {
      acc += dt;
      while (acc >= DT && state === 'fly') {
        acc -= DT;
        const before = s.mask, r = advance(L, s);
        if (stepCount++ % 3 === 0) path.push({ x: s.x, y: s.y });
        if (s.mask !== before) {
          const i = Math.log2(s.mask ^ before) | 0, n = [1, 2, 4].filter(b => s.mask & b).length;
          sfx.star(n - 1); burst(L.stars[i].x, L.stars[i].y, 24, 130, '250,204,21', 0.7, 2.5);
        }
        if (r) endFlight(r);
      }
      trail.push({ x: s.x, y: s.y }); if (trail.length > 46) trail.shift();
      for (let i = 0; i < 2; i++) parts.push({ x: s.x, y: s.y, vx: -s.vx * 0.15 + (Math.random() - 0.5) * 50, vy: -s.vy * 0.15 + (Math.random() - 0.5) * 50, life: 0.5, max: 0.5, color: '125,211,252', size: 1.6 });
    } else if (state === 'dead' || state === 'won') {
      timer -= dt;
      if (trail.length) trail.shift();
      if (timer <= 0) { if (state === 'dead') resetShot(); else { state = 'over'; showWin(); } }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt; if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 1.5 * dt; p.vy *= 1 - 1.5 * dt;
    }
  }

  /* ---------- Dessin ---------- */
  function drawPlanet(b) {
    const { x, y, r } = b, h = b.hue;
    let g = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 2.1);
    g.addColorStop(0, `hsla(${h},85%,65%,0.4)`); g.addColorStop(1, `hsla(${h},85%,65%,0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.1, 0, TAU); ctx.fill();
    const ring = (from, to) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(b.tilt);
      ctx.strokeStyle = `hsla(${h + 30},70%,80%,0.55)`; ctx.lineWidth = r * 0.16;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.75, r * 0.42, 0, from, to); ctx.stroke();
      ctx.strokeStyle = `hsla(${h + 30},70%,90%,0.3)`; ctx.lineWidth = r * 0.06;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.45, r * 0.33, 0, from, to); ctx.stroke();
      ctx.restore();
    };
    if (b.ring) ring(Math.PI, TAU);
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.05, x - r * 0.1, y - r * 0.1, r * 1.25);
    g.addColorStop(0, `hsl(${h},80%,78%)`); g.addColorStop(0.45, `hsl(${h},68%,50%)`); g.addColorStop(1, `hsl(${h + 25},60%,10%)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.translate(x, y); ctx.rotate(b.tilt * 0.5);
    for (const k of b.bands) { ctx.fillStyle = k.l ? `rgba(255,255,255,${k.a})` : `rgba(0,0,0,${k.a})`; ctx.fillRect(-r, k.y * r, r * 2, k.h * r); }
    ctx.restore();
    if (b.ring) ring(0, Math.PI);
  }

  function drawRepulsor(b) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const p = (clock * 0.5 + i / 3) % 1;
      ctx.strokeStyle = `rgba(249,168,212,${0.5 * (1 - p)})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + p * 34, 0, TAU); ctx.stroke();
    }
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 2.2);
    g.addColorStop(0, '#fff'); g.addColorStop(0.4, 'rgba(249,168,212,0.9)'); g.addColorStop(1, 'rgba(249,168,212,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.2, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawMoon(b) {
    const t = state === 'aim' || state === 'gen' ? 0 : s.t, a = b.ph + b.w * t;
    const x = b.cx + b.R * Math.cos(a), y = b.cy + b.R * Math.sin(a);
    ctx.strokeStyle = 'rgba(203,213,225,0.18)'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.arc(b.cx, b.cy, b.R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    const g = ctx.createRadialGradient(x - 2, y - 2, 0.5, x, y, b.r);
    g.addColorStop(0, '#f1f5f9'); g.addColorStop(1, '#475569');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, b.r, 0, TAU); ctx.fill();
  }

  function drawPortal() {
    const { x, y } = L.portal;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, PR * 3);
    g.addColorStop(0, 'rgba(167,139,250,0.55)'); g.addColorStop(0.5, 'rgba(56,189,248,0.18)'); g.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, PR * 3, 0, TAU); ctx.fill();
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const r = PR * (0.45 + i * 0.25), a = clock * (2.4 - i * 0.45) * (i % 2 ? -1 : 1) + i;
      ctx.strokeStyle = i % 2 ? 'rgba(125,211,252,0.9)' : 'rgba(196,181,253,0.9)'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(x, y, r, a, a + 2.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, r, a + Math.PI, a + Math.PI + 1.3); ctx.stroke();
    }
    for (let k = 0; k < 12; k++) {
      const p = (clock * 0.45 + k / 12) % 1, rad = PR * 2.6 * (1 - p), a = k * 2.4 + p * 5;
      ctx.fillStyle = `rgba(224,231,255,${p * 0.9})`;
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * rad, y + Math.sin(a) * rad, 1.3, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawStar(st, i) {
    const pulse = 1 + 0.12 * Math.sin(clock * 4 + i * 2), R = 9 * pulse, r = 3.2 * pulse;
    ctx.save(); ctx.translate(st.x, st.y); ctx.rotate(Math.sin(clock * 1.5 + i) * 0.25);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
    g.addColorStop(0, 'rgba(250,204,21,0.5)'); g.addColorStop(1, 'rgba(250,204,21,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fde68a'; ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, d = k % 2 ? r * 1.25 : R; ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d); }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawComet() {
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 1; i < trail.length; i++) {
      const f = i / trail.length;
      ctx.strokeStyle = `rgba(125,211,252,${f * 0.6})`; ctx.lineWidth = 1 + f * 6;
      ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
    }
    if (state === 'aim' || state === 'fly') {
      const bob = state === 'aim' ? Math.sin(clock * 3) * 1.5 : 0, R = 13 + Math.sin(clock * 9) * 1.2;
      const g = ctx.createRadialGradient(s.x, s.y + bob, 0, s.x, s.y + bob, R);
      g.addColorStop(0, '#fff'); g.addColorStop(0.3, 'rgba(186,230,253,0.95)'); g.addColorStop(1, 'rgba(56,189,248,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y + bob, R, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function dashed(points, color, width, dash) {
    if (!points || points.length < 2) return;
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke(); ctx.setLineDash([]);
  }

  function drawAim() {
    const v = Math.hypot(aim.vx, aim.vy), p = (v - VMIN) / (VMAX - VMIN), ok = v >= VMIN * 0.6;
    const col = `hsl(${195 + p * 130},95%,${ok ? 72 : 45}%)`;
    const px = s.x - aim.vx * 0.3, py = s.y - aim.vy * 0.3;
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(px, py); ctx.stroke();
    ctx.beginPath(); ctx.arc(px, py, 7, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    if (!ok) return;
    // Aperçu : seulement le début du vol — le reste, c'est à toi de le deviner.
    const q = { x: s.x, y: s.y, vx: aim.vx, vy: aim.vy, t: 0, mask: 7 };
    ctx.fillStyle = col;
    for (let i = 1; i <= 110; i++) {
      if (advance(L, q)) break;
      if (i % 7 === 0) { ctx.globalAlpha = 1 - i / 125; ctx.beginPath(); ctx.arc(q.x, q.y, 2.2, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const t of twinkles) {
      ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * Math.sin(clock * t.f + t.p)})`;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, TAU); ctx.fill();
    }
    if (!L) return;
    const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
    ctx.setTransform(1, 0, 0, 1, sx * dpr, sy * dpr);
    ctx.drawImage(grid, 0, 0);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (ox + sx), dpr * (oy + sy));

    dashed(ghost, 'rgba(148,163,184,0.35)', 1.2, [2, 6]);
    if (showHint > 0) {
      const a = Math.min(1, showHint), g = L.golden, n = Math.hypot(g.vx, g.vy);
      dashed([L.start, { x: L.start.x + g.vx / n * 130, y: L.start.y + g.vy / n * 130 }], `rgba(250,204,21,${a})`, 2.5, [8, 6]);
    }
    for (const b of L.bodies) if (b.moon) drawMoon(b); else if (b.rep) drawRepulsor(b); else drawPlanet(b);
    drawPortal();
    L.stars.forEach((st, i) => { if (!(s.mask & (1 << i))) drawStar(st, i); });
    if (aim && state === 'aim') drawAim();
    drawComet();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      ctx.fillStyle = `rgba(${p.color},${Math.min(1, p.life / p.max * 1.5)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (flash > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(196,181,253,${flash * 0.35})`; ctx.fillRect(0, 0, cv.width, cv.height); }
  }

  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    update(dt); draw();
    requestAnimationFrame(frame);
  }

  /* ---------- Entrées ---------- */
  function setAim(e) {
    let vx = -(e.clientX - drag.x) / scale * 3, vy = -(e.clientY - drag.y) / scale * 3;
    const v = Math.hypot(vx, vy);
    if (v > VMAX) { vx *= VMAX / v; vy *= VMAX / v; }
    aim = v > 8 ? { vx, vy } : null;
  }
  cv.addEventListener('pointerdown', e => {
    if (state !== 'aim' || drag) return;
    audio();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  });
  cv.addEventListener('pointermove', e => { if (drag && e.pointerId === drag.id) setAim(e); });
  const release = fire => e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (fire) setAim(e);
    const a = aim; drag = aim = null;
    if (fire && a && state === 'aim') {
      if (Math.hypot(a.vx, a.vy) >= VMIN * 0.6) launch(a.vx, a.vy);
      else tip('Tire plus loin pour donner de l\'élan', 1600);
    }
  };
  cv.addEventListener('pointerup', release(true));
  cv.addEventListener('pointercancel', release(false));

  $('prev').addEventListener('click', () => { if (level > 1) loadLevel(level - 1); });
  $('next').addEventListener('click', () => { if (level < save.unlocked) loadLevel(level + 1); });
  $('mute').addEventListener('click', () => {
    save.mute = !save.mute; persist(); audio();
    if (master) master.gain.value = save.mute ? 0 : 0.5;
    hud();
  });
  $('hint').addEventListener('click', () => { showHint = 4; hud(); tip('Le robot tire dans cette direction…', 2500); });
  $('o-go').addEventListener('click', () => {
    audio();
    $('overlay').classList.add('hidden');
    loadLevel(state === 'menu' ? level : level + 1);
  });
  $('o-retry').addEventListener('click', () => { $('overlay').classList.add('hidden'); loadLevel(level); });
  document.addEventListener('visibilitychange', () => { if (ac) document.hidden ? ac.suspend() : ac.resume(); });
  window.addEventListener('resize', resize);

  resize(); hud();
  // Un niveau en fond d'écran d'accueil.
  L = generate(level); cache.set(level, L); s = { x: L.start.x, y: L.start.y, mask: 0, t: 0 }; paintGrid();
  requestAnimationFrame(frame);
})();

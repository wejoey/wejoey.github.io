'use strict';

/* =====================================================================
   COUP DE CIRCUIT — jeu de frappe au baseball, vu de derrière le marbre.
   Les règles et la physique sont dans physique.js (testées avec Node) ;
   ici : rendu, son et interactions.
   ===================================================================== */

(() => {
  const P = window.Physique;
  const { ZONE, BALL_R, DT, FIELDERS, DEG } = P;
  const $ = id => document.getElementById(id);
  const cv = $('c'), ctx = cv.getContext('2d');
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);

  const CAM = { y: 4.2, z: -6.5 };
  const PLAY_SPEED = 1.7;          // le vol de la balle est accéléré à l'écran
  const WINDUP = 0.9;

  /* ---------- Sauvegarde ---------- */
  const save = { wins: 0, games: 0, best: 0, mute: false };
  try { Object.assign(save, JSON.parse(localStorage.getItem('circuit') || '{}')); } catch (e) { /* ignore */ }
  const persist = () => { try { localStorage.setItem('circuit', JSON.stringify(save)); } catch (e) { /* ignore */ } };

  /* ---------- Son (Web Audio, rien à télécharger) ---------- */
  let ac = null, master = null, noiseBuf = null;
  function audio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = save.mute ? 0 : 0.6; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
  }
  function noise(dur, type, freq, q, gain, attack = 0.002, when = 0) {
    if (!ac) return null;
    const t = ac.currentTime + when;
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = freq; fl.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    return fl;
  }
  function tone(freq, dur, type, gain, when = 0, slide = 0) {
    if (!ac) return;
    const t = ac.currentTime + when;
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  const sfx = {
    crack(q) { noise(0.12, 'highpass', 1400, 0.7, 0.5 + q * 0.5); tone(2300, 0.07, 'triangle', 0.15 + q * 0.3); tone(850, 0.08, 'square', 0.1); },
    foul() { noise(0.07, 'bandpass', 900, 1, 0.5); tone(520, 0.05, 'triangle', 0.2); },
    mitt() { noise(0.08, 'lowpass', 800, 0.8, 0.8); tone(150, 0.12, 'sine', 0.5, 0, 70); },
    whoosh() { const f = noise(0.25, 'bandpass', 350, 2, 0.4, 0.07); if (f) f.frequency.exponentialRampToValueAtTime(1800, ac.currentTime + 0.22); },
    cheer(big) {
      noise(big ? 2.8 : 1.4, 'bandpass', 1100, 0.6, big ? 0.4 : 0.22, 0.25);
      noise(big ? 2.8 : 1.4, 'bandpass', 2500, 0.8, big ? 0.16 : 0.08, 0.3);
    },
    groan() { noise(1.1, 'lowpass', 380, 0.7, 0.22, 0.2); },
    organ(notes, step = 0.15) {
      notes.forEach((n, i) => { tone(n, step * 1.4, 'square', 0.06, i * step); tone(n * 2, step * 1.4, 'sine', 0.05, i * step); });
    },
  };

  /* ---------- Écran et projection ---------- */
  let W = 0, H = 0, dpr = 1, f = 1, cx = 0, hy = 0, s0 = 1;
  let inset = { x: 0, y: 0, S: 200 };
  const bg = document.createElement('canvas'), bgc = bg.getContext('2d');

  function proj(x, y, z) {
    const d = Math.max(0.6, z - CAM.z), s = f / d;
    return { x: cx + x * s, y: hy - (y - CAM.y) * s, s };
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = bg.width = Math.round(W * dpr); cv.height = bg.height = Math.round(H * dpr);
    cx = W / 2;
    const zoneW = Math.min(W * 0.4, H * 0.21);
    s0 = zoneW / (2 * ZONE.x);
    f = s0 * -CAM.z;
    hy = Math.min(H * 0.42, H - CAM.y * s0 - 20);
    const top = document.querySelector('.hud').getBoundingClientRect().bottom + 6;
    const S = clamp(Math.min(W * 0.62, hy - top - 6, 260), 110, 260);
    inset = { x: cx - S / 2, y: top, S };
    const zoneTop = proj(0, ZONE.y1, 0).y;
    $('banner').style.top = Math.round(Math.max(top + 30, (top + S + zoneTop) / 2 - 10)) + 'px';
    paintBackground();
  }

  /* ---------- Décor fixe (dessiné une fois) ---------- */
  function seeded(seed) {
    return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  }
  function groundPath(c, pts) {
    c.beginPath();
    pts.forEach((p, i) => { const q = proj(p.x, 0, Math.max(p.z, -3.5)); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); });
    c.closePath();
  }
  function circlePts(x, z, r, n = 48) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU; pts.push({ x: x + Math.cos(a) * r, z: z + Math.sin(a) * r }); }
    return pts;
  }
  function paintBackground() {
    const c = bgc;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Ciel de fin d'après-midi.
    let g = c.createLinearGradient(0, 0, 0, hy);
    g.addColorStop(0, '#1d4ed8'); g.addColorStop(0.6, '#60a5fa'); g.addColorStop(1, '#fde7c7');
    c.fillStyle = g; c.fillRect(0, 0, W, hy + 2);
    const rnd = seeded(7);
    c.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 6; i++) {
      const x = rnd() * W, y = hy * (0.1 + rnd() * 0.45), r = 18 + rnd() * 30;
      for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(x + (k - 1.5) * r * 0.7, y + (k % 2) * 4, r * 0.8, r * 0.38, 0, 0, TAU); c.fill(); }
    }
    // Pelouse, en bandes de tonte.
    c.fillStyle = '#2f8f3a'; c.fillRect(0, hy, W, H - hy);
    for (let z = -6; z < 420; z += 16) {
      if (Math.round((z + 6) / 16) % 2) continue;
      const a = proj(0, 0, z).y, b = proj(0, 0, z + 16).y;
      c.fillStyle = '#2a8235'; c.fillRect(0, b, W, a - b);
    }
    // Gradins et clôture.
    const arc = [];
    for (let th = -70; th <= 70; th += 2) {
      const r = P.fence(Math.min(Math.abs(th), 45) * DEG);
      arc.push({ x: Math.sin(th * DEG) * r, z: Math.cos(th * DEG) * r });
    }
    c.beginPath();
    arc.forEach((p, i) => { const q = proj(p.x * 1.25, 70, p.z * 1.25); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); });
    for (let i = arc.length - 1; i >= 0; i--) { const q = proj(arc[i].x, P.WALL_H, arc[i].z); c.lineTo(q.x, q.y); }
    c.closePath();
    g = c.createLinearGradient(0, proj(0, 70, 500).y, 0, proj(0, P.WALL_H, 400).y);
    g.addColorStop(0, '#1e293b'); g.addColorStop(1, '#334155');
    c.fillStyle = g; c.fill();
    c.save(); c.clip();
    const colors = ['#f87171', '#fbbf24', '#f8fafc', '#60a5fa', '#a78bfa', '#fb923c', '#34d399', '#e2e8f0'];
    for (let i = 0; i < 1400; i++) {
      const th = (rnd() * 140 - 70) * DEG, k = 1 + rnd() * 0.25, r = P.fence(Math.min(Math.abs(th), 45 * DEG)) * k;
      const q = proj(Math.sin(th) * r, P.WALL_H + (k - 1) * 240, Math.cos(th) * r);
      c.fillStyle = colors[Math.floor(rnd() * colors.length)];
      c.fillRect(q.x, q.y - 2, 1.6, 1.6);
    }
    c.restore();
    c.beginPath();
    arc.forEach((p, i) => { const q = proj(p.x, P.WALL_H, p.z); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); });
    for (let i = arc.length - 1; i >= 0; i--) { const q = proj(arc[i].x, 0, arc[i].z); c.lineTo(q.x, q.y); }
    c.closePath(); c.fillStyle = '#14532d'; c.fill();
    c.beginPath();
    arc.forEach((p, i) => { const q = proj(p.x, P.WALL_H, p.z); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); });
    c.strokeStyle = '#facc15'; c.lineWidth = 1.2; c.stroke();
    // Piste d'avertissement au pied de la clôture.
    const track = arc.map(p => ({ x: p.x, z: p.z })).concat(arc.slice().reverse().map(p => ({ x: p.x * 0.96, z: p.z * 0.96 })));
    groundPath(c, track); c.fillStyle = '#a16c45'; c.fill();
    // Avant-champ.
    c.fillStyle = '#b97a4b';
    c.save();
    groundPath(c, [{ x: 0, z: -12 }, { x: 312, z: 300 }, { x: -312, z: 300 }]); c.clip();
    groundPath(c, circlePts(0, 60.5, 95, 72)); c.fill();
    c.restore();
    groundPath(c, [{ x: 0, z: 9 }, { x: 54.6, z: 63.6 }, { x: 0, z: 118 }, { x: -54.6, z: 63.6 }]);
    c.fillStyle = '#2f8f3a'; c.fill();
    c.fillStyle = '#b97a4b';
    groundPath(c, circlePts(0, 60.5, 9)); c.fill();
    groundPath(c, circlePts(0, 0, 11)); c.fill();
    // Lignes de craie.
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineCap = 'round';
    for (const sx of [-1, 1]) {
      const a = proj(sx * 1.6, 0, 1.6), b = proj(sx * 233, 0, 233);
      c.lineWidth = 2; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      c.lineWidth = 1.5;
      groundPath(c, [{ x: sx * 1.4, z: -3 }, { x: sx * 5.4, z: -3 }, { x: sx * 5.4, z: 3 }, { x: sx * 1.4, z: 3 }]); c.stroke();
    }
    // Buts, marbre et plaque du lanceur.
    c.fillStyle = '#fff';
    for (const b of [P.FIRST, P.SECOND, { x: -P.FIRST.x, z: P.FIRST.z }]) {
      groundPath(c, [{ x: b.x, z: b.z - 1.1 }, { x: b.x + 1.1, z: b.z }, { x: b.x, z: b.z + 1.1 }, { x: b.x - 1.1, z: b.z }]); c.fill();
    }
    groundPath(c, [{ x: -1, z: 60 }, { x: 1, z: 60 }, { x: 1, z: 60.6 }, { x: -1, z: 60.6 }]); c.fill();
    groundPath(c, [{ x: -0.71, z: 0.71 }, { x: 0.71, z: 0.71 }, { x: 0.71, z: 0 }, { x: 0, z: -0.71 }, { x: -0.71, z: 0 }]); c.fill();
    // Voile pour assombrir légèrement le bas (profondeur).
    g = c.createLinearGradient(0, hy, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.18)');
    c.fillStyle = g; c.fillRect(0, hy, W, H - hy);
  }

  /* ---------- État du jeu ---------- */
  let lv = P.LEVELS.recrue, levelKey = 'recrue';
  let game = null;
  let state = 'menu', timer = 0, clock = 0;
  let pitch = null, swing = null, flight = null, called = false;
  let fpos = FIELDERS.map(fl => ({ x: fl.x, z: fl.z }));
  let pointerY = null, shake = 0, flashT = 0;
  const confetti = [];

  function newGame(key) {
    levelKey = key; lv = P.LEVELS[key];
    const [a, b] = lv.target;
    game = { me: 0, target: a + Math.floor(Math.random() * (b - a + 1)), manche: 1, outs: 0, balls: 0, strikes: 0, bases: [false, false, false], hits: 0, hr: 0, walkoff: false };
    $('overlay').classList.add('hidden');
    hud();
    banner(`Les Ratons ont ${game.target} point${game.target > 1 ? 's' : ''}<small>Marques-en ${game.target + 1} en 3 manches !</small>`, 'info', 2400);
    sfx.organ([392, 523, 659, 784, 659, 784], 0.14);
    nextPitch(2.6);
  }

  function nextPitch(delay) {
    state = 'ready'; timer = delay;
    pitch = swing = flight = null; called = false;
    fpos = FIELDERS.map(fl => ({ x: fl.x, z: fl.z }));
  }

  const ordinal = n => n === 1 ? '1<sup>re</sup>' : n + '<sup>e</sup>';
  function hud() {
    if (!game) return;
    $('s-me').textContent = game.me;
    $('s-op').textContent = game.target;
    const dots = (n, max) => Array.from({ length: max }, (_, i) => `<span class="d${i < n ? ' on' : ''}"></span>`).join('');
    $('c-b').innerHTML = dots(game.balls, 3);
    $('c-p').innerHTML = dots(game.strikes, 2);
    $('c-r').innerHTML = dots(game.outs, 2);
    ['b1', 'b2', 'b3'].forEach((id, i) => $(id).classList.toggle('on', game.bases[i]));
    $('inning').innerHTML = ordinal(game.manche) + (game.manche > 3 ? ' (suppl.)' : '');
  }

  let bannerTimer = 0;
  function banner(html, cls, ms = 1100) {
    const el = $('banner');
    el.className = 'banner ' + cls;
    el.innerHTML = html;
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function showPitch(text) {
    const el = $('pitch');
    el.textContent = text;
    el.classList.toggle('show', !!text);
  }

  /* ---------- Déroulement ---------- */
  function addRuns(n) {
    if (!n) return;
    game.me += n;
    if (game.manche >= 3 && game.me > game.target) game.walkoff = true;
  }
  const pts = n => n ? `<small>+${n} point${n > 1 ? 's' : ''}</small>` : '';

  function endAtBat() { game.balls = 0; game.strikes = 0; }

  function callPitch() {
    called = true;
    sfx.mitt();
    if (swing && swing.miss) return strike(true);
    if (P.inZone(pitch)) return strike(false);
    game.balls++;
    if (game.balls >= 4) {
      const r = P.walk(game.bases);
      game.bases = r.bases; addRuns(r.runs); endAtBat();
      banner('But sur balles' + pts(r.runs), 'good');
      if (r.runs) sfx.cheer(false);
    } else banner('Balle', 'info', 800);
    afterPlay(1.0);
  }

  function strike(swinging) {
    game.strikes++;
    if (game.strikes >= 3) {
      endAtBat();
      out('Retiré sur trois prises !');
      return;
    }
    banner(swinging ? 'Prise sur élan' : 'Prise !', 'bad', 800);
    afterPlay(1.0);
  }

  function out(text) {
    game.outs++;
    banner(text, 'bad', 1300);
    sfx.groan();
    afterPlay(1.4);
  }

  function afterPlay(delay) {
    hud();
    state = 'result'; timer = delay;
  }

  function finishPlay() {
    if (game.walkoff) return endGame('win', true);
    if (game.outs >= 3) {
      game.outs = 0; game.bases = [false, false, false]; endAtBat();
      if (game.manche >= 3) {
        if (game.me > game.target) return endGame('win');
        if (game.me < game.target) return endGame('loss');
        if (game.manche >= 5) return endGame('tie');
        game.manche++;
        hud();
        banner('Égalité !<small>Manche supplémentaire</small>', 'info', 1800);
        return nextPitch(2.2);
      }
      banner(`Fin de la ${ordinal(game.manche)} manche`, 'info', 1600);
      game.manche++;
      hud();
      return nextPitch(2.2);
    }
    nextPitch(0.5);
  }

  function endGame(result, walkoff) {
    state = 'over';
    showPitch('');
    save.games++;
    if (result === 'win') save.wins++;
    save.best = Math.max(save.best, game.me);
    persist();
    const title = { win: 'VICTOIRE !', loss: 'DÉFAITE', tie: 'MATCH NUL' }[result];
    const text = {
      win: walkoff ? 'Le point gagnant en fin de manche ! La foule est debout.' : 'Tu as battu les Ratons. Bravo !',
      loss: 'Les Ratons gagnent cette fois-ci. Prends ta revanche !',
      tie: 'Toujours égal après 5 manches. On se serre la main.',
    }[result];
    setTimeout(() => {
      $('o-title').textContent = title;
      const big = $('o-big');
      big.hidden = false; big.textContent = `${game.me} – ${game.target}`;
      $('o-text').textContent = text;
      $('o-stats').textContent = `${game.hits} coup${game.hits > 1 ? 's' : ''} sûr${game.hits > 1 ? 's' : ''}, ${game.hr} circuit${game.hr > 1 ? 's' : ''} · ${save.wins} victoire${save.wins > 1 ? 's' : ''} en ${save.games} match${save.games > 1 ? 's' : ''} · record : ${save.best} points`;
      $('overlay').classList.remove('hidden');
    }, walkoff ? 1200 : 400);
    if (result === 'win') { sfx.organ([523, 659, 784, 1047, 784, 1047], 0.13); sfx.cheer(true); burstConfetti(); }
    else if (result === 'loss') sfx.groan();
  }

  /* ---------- Frappe ---------- */
  function onTap(y) {
    audio();
    if (state !== 'pitch' || swing) return;
    const t = (clock - pitch.t0) / pitch.dur;
    if (t < 0.15 || t > 1.1) return;
    const tapY = CAM.y - (y - hy) / s0;
    const e = clock - (pitch.t0 + pitch.dur);
    swing = { t: clock, y: clamp(tapY, 0.9, 4.5) };
    const c = P.contact(pitch, lv, e, tapY, Math.random);
    if (!c) { swing.miss = true; sfx.whoosh(); return; }
    const p0 = P.pitchPos(pitch, Math.min(t, 1.05));
    const sim = P.simulate(p0, c);
    const foul = P.isFoul(c);
    const res = foul ? { kind: 'fausse', t: 0.5 } : P.resolve(sim, c, lv);
    flight = { sim, res, c, t: 0, done: false };
    state = 'flight';
    showPitch('');
    if (foul) sfx.foul(); else { sfx.crack(c.q); shake = 4 + c.q * 6; flashT = 0.12; }
  }

  function announce() {
    const { res, c } = flight;
    flight.done = true;
    if (res.kind === 'fausse') {
      if (game.strikes < 2) game.strikes++;
      banner('Fausse balle', 'info', 900);
      return afterPlay(1.0);
    }
    endAtBat();
    if (res.out) {
      const r = P.outPlay(game.bases, game.outs, res);
      game.bases = r.bases; addRuns(r.runs);
      const fl = FIELDERS[res.k].nom;
      const text = {
        chandelle: 'Chandelle captée',
        ballon: 'Retiré sur un ballon',
        flèche: 'Flèche captée !',
        roulant: 'Retiré sur un roulant',
      }[res.kind];
      if (r.sacrifice) {
        game.outs++;
        banner('Ballon sacrifice !' + pts(r.runs), 'good', 1500);
        sfx.cheer(false);
        return afterPlay(1.6);
      }
      game.outs++;
      banner(`${text}<small>par le ${fl}</small>` + (r.runs && game.outs < 3 ? pts(r.runs) : ''), 'bad', 1500);
      sfx.groan();
      return afterPlay(1.7);
    }
    const r = P.advance(game.bases, res.bases);
    game.bases = r.bases; addRuns(r.runs); game.hits++;
    if (res.bases === 4) {
      game.hr++;
      const label = r.runs === 4 ? 'GRAND CHELEM !' : 'COUP DE CIRCUIT !';
      banner(label + pts(r.runs), 'great', 2400);
      sfx.cheer(true); sfx.organ([523, 659, 784, 1047, 880, 1047], 0.12);
      burstConfetti();
      return afterPlay(2.6);
    }
    const label = ['', res.infield ? 'Simple à l\'avant-champ' : 'Simple !', 'Double !', 'Triple !'][res.bases];
    banner(label + pts(r.runs), 'good', 1500);
    sfx.cheer(res.bases > 1 || r.runs > 0);
    afterPlay(1.7);
  }

  /* ---------- Boucle ---------- */
  function update(dt) {
    clock += dt;
    shake = Math.max(0, shake - dt * 30);
    flashT = Math.max(0, flashT - dt);
    if (state === 'ready') {
      timer -= dt;
      if (timer <= 0) {
        state = 'windup'; timer = WINDUP;
        pitch = P.choosePitch(Math.random, lv, game.manche, game.balls);
      }
    } else if (state === 'windup') {
      timer -= dt;
      if (timer <= 0) {
        state = 'pitch'; pitch.t0 = clock;
        showPitch(`${pitch.type.nom} · ${pitch.kmh} km/h`);
      }
    } else if (state === 'pitch') {
      const t = (clock - pitch.t0) / pitch.dur;
      if (t >= 1.02 && !called) callPitch();
    } else if (state === 'flight') {
      flight.t += dt * PLAY_SPEED;
      const { res } = flight;
      if (res.k !== undefined) {
        const k = res.k, a = Math.min(1, flight.t / Math.max(res.t, 0.01));
        fpos[k] = { x: lerp(FIELDERS[k].x, res.x, ease(a)), z: lerp(FIELDERS[k].z, res.z, ease(a)) };
      }
      if (!flight.done && flight.t >= res.t) announce();
    } else if (state === 'result') {
      if (flight) flight.t += dt * PLAY_SPEED;
      timer -= dt;
      if (timer <= 0) finishPlay();
    }
    for (let i = confetti.length - 1; i >= 0; i--) {
      const p = confetti[i];
      p.life -= dt; if (p.life <= 0) { confetti.splice(i, 1); continue; }
      p.vy += 300 * dt; p.vx *= 1 - dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
    }
  }

  function burstConfetti() {
    const colors = ['#facc15', '#f97316', '#e11d48', '#38bdf8', '#4ade80', '#fff'];
    for (let i = 0; i < 90; i++) {
      confetti.push({ x: W / 2 + (Math.random() - 0.5) * W * 0.6, y: H * 0.3, vx: (Math.random() - 0.5) * 420, vy: -200 - Math.random() * 380, r: Math.random() * TAU, vr: (Math.random() - 0.5) * 12, life: 2 + Math.random(), c: colors[i % colors.length] });
    }
  }

  /* ---------- Dessin ---------- */
  // Un joueur vu de face. (px, py) : ses pieds à l'écran ; s : pixels par pied.
  function drawPlayer(px, py, s, o) {
    const X = x => px + x * s, Y = y => py - y * s;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(px, py, 1.1 * s, 0.3 * s, 0, 0, TAU); ctx.fill();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = Math.max(1, 0.45 * s);
    const lift = o.leg || 0;
    ctx.beginPath(); ctx.moveTo(X(-0.3), Y(3)); ctx.lineTo(X(-0.45), Y(0.1)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(0.3), Y(3)); ctx.lineTo(X(0.3 + lift * 0.5), Y(1.6 + lift * 1.2)); ctx.lineTo(X(0.45 + lift * 0.1), Y(0.1 + lift * 1.6)); ctx.stroke();
    ctx.fillStyle = o.color;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(X(-0.6), Y(5.15), 1.2 * s, 2.3 * s, 0.35 * s) : ctx.rect(X(-0.6), Y(5.15), 1.2 * s, 2.3 * s); ctx.fill();
    if (s > 5) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `800 ${0.8 * s}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.num || '', px, Y(4.1));
    }
    // Bras qui lance (à gauche à l'écran) et bras du gant.
    const a = o.arm === undefined ? -100 * DEG : o.arm;
    const sx = -0.6, sy = 4.9, hx = sx + Math.cos(a) * 2, hyy = sy + Math.sin(a) * 2;
    ctx.strokeStyle = o.color; ctx.lineWidth = Math.max(1, 0.36 * s);
    ctx.beginPath(); ctx.moveTo(X(sx), Y(sy)); ctx.lineTo(X(hx), Y(hyy)); ctx.stroke();
    if (o.ball) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(hx), Y(hyy), Math.max(1, 0.22 * s), 0, TAU); ctx.fill(); }
    const g = o.glove || { x: 0.7, y: 3.6 };
    ctx.beginPath(); ctx.moveTo(X(0.6), Y(4.9)); ctx.lineTo(X(g.x), Y(g.y)); ctx.stroke();
    ctx.fillStyle = '#8b5a2b'; ctx.beginPath(); ctx.arc(X(g.x), Y(g.y), Math.max(1.2, 0.38 * s), 0, TAU); ctx.fill();
    if (o.caught) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(g.x), Y(g.y + 0.1), Math.max(1, 0.2 * s), 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#f2c29b'; ctx.beginPath(); ctx.arc(px, Y(5.65), 0.42 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1f2937';
    ctx.beginPath(); ctx.arc(px, Y(5.75), 0.44 * s, Math.PI, TAU); ctx.fill();
    ctx.fillRect(X(-0.5), Y(5.78), 1.0 * s, 0.14 * s);
  }

  function pitcherPose() {
    const p = { color: '#f97316', num: '7', ball: true, arm: -100 * DEG, leg: 0, glove: { x: 0.7, y: 3.6 } };
    if (state === 'windup') {
      const w = 1 - timer / WINDUP;
      if (w < 0.35) { const u = ease(w / 0.35); p.arm = lerp(-100, -30, u) * DEG; p.leg = u; p.glove = { x: lerp(0.7, 0.1, u), y: lerp(3.6, 4.3, u) }; }
      else if (w < 0.65) { const u = ease((w - 0.35) / 0.3); p.arm = lerp(-30, -165, u) * DEG; p.leg = 1; p.glove = { x: lerp(0.1, 1.4, u), y: lerp(4.3, 4.9, u) }; }
      else { const u = (w - 0.65) / 0.35; p.arm = lerp(-165, -250, u * u) * DEG; p.leg = 1 - u; p.glove = { x: 1.4, y: 4.9 }; }
    } else if (pitch && pitch.t0 !== undefined) {
      const u = clamp((clock - pitch.t0) / 0.35, 0, 1);
      p.arm = lerp(-250, -400, ease(u)) * DEG; p.ball = false; p.glove = { x: lerp(1.4, 0.8, u), y: lerp(4.9, 3.9, u) };
    }
    return p;
  }

  function drawField() {
    const list = FIELDERS.map((fl, k) => ({ k, x: fpos[k].x, z: fpos[k].z })).filter(o => o.k !== 1);
    list.sort((a, b) => b.z - a.z);
    for (const o of list) {
      const q = proj(o.x, 0, o.z);
      if (q.x < -40 || q.x > W + 40) continue;
      if (o.k === 0) drawPlayer(q.x, q.y, q.s, pitcherPose());
      else {
        const caught = flight && flight.res.k === o.k && flight.t >= flight.res.t;
        drawPlayer(q.x, q.y, q.s, { color: '#f97316', num: String(o.k + 1), glove: caught ? { x: 0.9, y: 5.4 } : undefined, caught });
      }
    }
  }

  function drawBall(x, y, z, alpha = 1) {
    const sh = proj(x, 0, z), q = proj(x, y, z);
    const r = Math.max(1.3, BALL_R * q.s);
    ctx.globalAlpha = alpha * 0.35; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(sh.x, sh.y, r * 1.1, r * 0.35, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(q.x - r * 0.35, q.y - r * 0.35, r * 0.1, q.x, q.y, r);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill();
    if (r > 5) {
      ctx.strokeStyle = '#dc2626'; ctx.lineWidth = Math.max(1, r * 0.1);
      const rot = clock * 30;
      ctx.beginPath(); ctx.arc(q.x - r * 0.9, q.y, r * 0.75, -0.9 + rot * 0, 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(q.x + r * 0.9, q.y, r * 0.75, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawZone() {
    const a = proj(-ZONE.x, ZONE.y1, 0), b = proj(ZONE.x, ZONE.y0, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]); ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2.5;
    const L = 12;
    for (const [x, y, dx, dy] of [[a.x, a.y, 1, 1], [b.x, a.y, -1, 1], [a.x, b.y, 1, -1], [b.x, b.y, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(x + dx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * L); ctx.stroke();
    }
  }

  // Aide du niveau Recrue : un cercle à l'endroit où passera la balle, qui
  // se resserre jusqu'au moment de frapper.
  function drawAid(t) {
    if (!lv.aid || swing) return;
    const q = proj(pitch.tx, pitch.ty, 0), r = BALL_R * q.s;
    const al = clamp((t - 0.1) * 2, 0, 0.9) * clamp((1.08 - t) * 10, 0, 1);
    if (al <= 0) return;
    ctx.globalAlpha = al;
    ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(q.x, q.y, r * 1.3, 0, TAU); ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(q.x, q.y, r * 1.3 + Math.max(0, 1 - t) * r * 7, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawBat() {
    let ang = 108 * DEG, hand = proj(-1.45, 3.3, 0.4), alpha = 1;
    if (swing) {
      const u = clock - swing.t;
      const target = proj(-1.25, swing.y, 0.4);
      if (u < 0.06) { const k = ease(u / 0.06); ang = lerp(108, 0, k) * DEG; hand = { x: lerp(hand.x, target.x, k), y: lerp(hand.y, target.y, k) }; }
      else if (u < 0.3) { const k = ease((u - 0.06) / 0.24); ang = lerp(0, -205, k) * DEG; hand = { x: target.x - k * 0.5 * s0, y: target.y - k * 0.6 * s0 }; }
      else { ang = -205 * DEG; hand = { x: target.x - 0.5 * s0, y: target.y - 0.6 * s0 }; alpha = clamp(1 - (u - 0.7) * 3, 0, 1); }
    } else if (state === 'windup' || state === 'pitch') {
      ang = (108 + Math.sin(clock * 6) * 4) * DEG;
    }
    if (alpha <= 0) return;
    const L = 2.6 * s0, dx = Math.cos(ang), dy = -Math.sin(ang), nx = -dy, ny = dx;
    const w1 = 0.07 * s0, w2 = 0.2 * s0;
    const tip = { x: hand.x + dx * L, y: hand.y + dy * L };
    const k = hand;
    ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(k.x + nx * w2, k.y + ny * w2, k.x - nx * w2, k.y - ny * w2);
    g.addColorStop(0, '#f1c27d'); g.addColorStop(0.5, '#d29a52'); g.addColorStop(1, '#8a5a2b');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(k.x + nx * w1, k.y + ny * w1);
    ctx.lineTo(k.x + dx * L * 0.45 + nx * w1 * 1.3, k.y + dy * L * 0.45 + ny * w1 * 1.3);
    ctx.lineTo(tip.x + nx * w2, tip.y + ny * w2);
    ctx.arc(tip.x, tip.y, w2, ang < 0 ? 0 : 0, 0);
    ctx.lineTo(tip.x - nx * w2, tip.y - ny * w2);
    ctx.lineTo(k.x + dx * L * 0.45 - nx * w1 * 1.3, k.y + dy * L * 0.45 - ny * w1 * 1.3);
    ctx.lineTo(k.x - nx * w1, k.y - ny * w1);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(tip.x, tip.y, w2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.beginPath(); ctx.arc(k.x - dx * 2, k.y - dy * 2, w1 * 1.7, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Vue du terrain d'en haut pendant le jeu.
  function drawInset() {
    const { x: ix, y: iy, S } = inset;
    const sc = S / 470, hx = ix + S / 2, hz = iy + S - 10;
    const M = (x, z) => [hx + x * sc, hz - z * sc];
    ctx.save();
    ctx.globalAlpha = clamp(flight.t * 4, 0, 1);
    ctx.fillStyle = 'rgba(10,22,44,0.78)'; ctx.strokeStyle = 'rgba(203,213,225,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(ix, iy, S, S, 14) : ctx.rect(ix, iy, S, S); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(...M(0, 0));
    for (let th = -45; th <= 45; th += 3) { const r = P.fence(th * DEG); ctx.lineTo(...M(Math.sin(th * DEG) * r, Math.cos(th * DEG) * r)); }
    ctx.closePath(); ctx.fillStyle = '#2f8f3a'; ctx.fill();
    ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let th = -45; th <= 45; th += 3) { const r = P.fence(th * DEG); ctx[th === -45 ? 'moveTo' : 'lineTo'](...M(Math.sin(th * DEG) * r, Math.cos(th * DEG) * r)); }
    ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.moveTo(...M(0, -12)); ctx.lineTo(...M(-250, 238)); ctx.lineTo(...M(250, 238)); ctx.closePath(); ctx.clip();
    ctx.fillStyle = '#b97a4b';
    ctx.beginPath(); ctx.arc(...M(0, 60.5), 95 * sc, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(...M(0, 0), 11 * sc, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2f8f3a';
    ctx.beginPath(); ctx.moveTo(...M(0, 9)); ctx.lineTo(...M(54.6, 63.6)); ctx.lineTo(...M(0, 118)); ctx.lineTo(...M(-54.6, 63.6)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    const bases = [[0, 0], [P.FIRST.x, P.FIRST.z], [P.SECOND.x, P.SECOND.z], [-P.FIRST.x, P.FIRST.z]];
    bases.forEach(([x, z], i) => {
      const [u, v] = M(x, z);
      const on = i > 0 && game.bases[i - 1];
      ctx.fillStyle = on ? '#facc15' : '#fff';
      ctx.fillRect(u - (on ? 3.5 : 2.5), v - (on ? 3.5 : 2.5), on ? 7 : 5, on ? 7 : 5);
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(...M(-233, 233)); ctx.lineTo(...M(0, 0)); ctx.lineTo(...M(233, 233)); ctx.stroke();
    // Trajectoire.
    const { sim, res } = flight;
    const n = Math.min(sim.pts.length - 1, Math.floor(flight.t / DT));
    const stop = res.k !== undefined && flight.t >= res.t ? Math.floor(res.t / DT) : n;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.setLineDash([3, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= stop; i += 2) { const p = sim.pts[i]; ctx[i ? 'lineTo' : 'moveTo'](...M(p.x, p.z)); }
    ctx.stroke(); ctx.setLineDash([]);
    // Joueurs.
    FIELDERS.forEach((fl, k) => {
      const [u, v] = M(fpos[k].x, fpos[k].z);
      ctx.fillStyle = '#f97316'; ctx.strokeStyle = '#7c2d12'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(u, v, 4, 0, TAU); ctx.fill(); ctx.stroke();
    });
    // Balle.
    const p = sim.pts[stop];
    const bx = res.k !== undefined && flight.t >= res.t ? fpos[res.k] : p;
    const [u, v] = M(bx.x, bx.z), hh = res.k !== undefined && flight.t >= res.t ? 0 : p.y;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(u, v, 2.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(u, v - hh * sc * 0.6, 2.5 + Math.min(4, hh / 25), 0, TAU); ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
    ctx.drawImage(bg, sx * dpr, sy * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
    drawField();
    if (state === 'pitch' || (state === 'result' && pitch && !flight)) {
      const t = (clock - pitch.t0) / pitch.dur;
      if (state === 'pitch') drawAid(t);
      if (t <= 1.1) { const b = P.pitchPos(pitch, t); drawBall(b.x, b.y, b.z); }
    }
    if (flight) {
      const { sim, res } = flight;
      const held = res.k !== undefined && flight.t >= res.t;
      if (!held) {
        const p = sim.pts[Math.min(sim.pts.length - 1, Math.floor(flight.t / DT))];
        drawBall(p.x, p.y, p.z, sim.hrT >= 0 && flight.t > sim.hrT + 0.8 ? clamp(1 - (flight.t - sim.hrT - 0.8) * 2, 0, 1) : 1);
      }
    }
    drawZone();
    if (game && state !== 'menu') drawBat();
    if (flight && flight.res.kind !== 'fausse') drawInset();
    if (flashT > 0) { ctx.fillStyle = `rgba(255,255,255,${flashT * 2})`; ctx.fillRect(-10, -10, W + 20, H + 20); }
    for (const p of confetti) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.globalAlpha = Math.min(1, p.life); ctx.fillStyle = p.c; ctx.fillRect(-4, -2.5, 8, 5);
      ctx.restore();
    }
  }

  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    update(dt); draw();
    requestAnimationFrame(frame);
  }

  /* ---------- Entrées ---------- */
  cv.addEventListener('pointerdown', e => { pointerY = e.clientY; onTap(e.clientY); e.preventDefault(); });
  cv.addEventListener('pointermove', e => { pointerY = e.clientY; });
  window.addEventListener('keydown', e => {
    if (e.code !== 'Space' || state === 'menu' || state === 'over') return;
    e.preventDefault();
    onTap(pointerY !== null ? pointerY : proj(0, (ZONE.y0 + ZONE.y1) / 2, 0).y);
  });
  $('mute').addEventListener('click', () => {
    save.mute = !save.mute; persist(); audio();
    if (master) master.gain.value = save.mute ? 0 : 0.6;
    $('mute').textContent = save.mute ? '🔇' : '🔊';
  });
  $('mute').textContent = save.mute ? '🔇' : '🔊';
  $('o-recrue').addEventListener('click', () => { audio(); newGame('recrue'); });
  $('o-pro').addEventListener('click', () => { audio(); newGame('pro'); });
  $('o-rules').addEventListener('click', () => { const d = $('rules'); if (d.showModal) d.showModal(); else d.setAttribute('open', ''); });
  document.addEventListener('visibilitychange', () => { if (ac) document.hidden ? ac.suspend() : ac.resume(); });
  window.addEventListener('resize', resize);

  if (save.games) $('o-stats').textContent = `${save.wins} victoire${save.wins > 1 ? 's' : ''} en ${save.games} match${save.games > 1 ? 's' : ''} · record : ${save.best} points`;
  resize();
  requestAnimationFrame(frame);
})();

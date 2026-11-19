// Coup de circuit : lancers, contact du bâton, vol de la balle, défense et
// coureurs, sans affichage, pour pouvoir les tester avec Node
// (voir tests/physique.test.js).
//
// Repère en pieds : x vers la droite (champ droit), y vers le haut,
// z de la plaque vers le lanceur. La plaque est en (0, 0, 0).
(function (root) {
  "use strict";

  const DEG = Math.PI / 180;
  const ZONE = { x: 0.83, y0: 1.6, y1: 3.5 };   // zone des prises
  const BALL_R = 0.13;
  const RELEASE = { x: -1.1, y: 5.6, z: 54 };   // main du lanceur
  const G = 47;            // gravité « effective » : tient compte de la traînée de l'air
  const WALL_H = 10;       // hauteur de la clôture
  const FOUL = 45 * DEG;   // lignes des fausses balles
  const FIRST = { x: 63.6, z: 63.6 };
  const SECOND = { x: 0, z: 127.3 };
  const DT = 1 / 60;

  // Distance de la clôture selon l'angle : 330 pi le long des lignes, 400 au centre.
  const fence = (th) => 330 + 70 * Math.cos(2 * th);

  // v : vitesse de course (pi/s). Les 6 premiers sont à l'avant-champ.
  const FIELDERS = [
    { id: "L", nom: "lanceur", x: 0, z: 60.5, v: 17 },
    { id: "R", nom: "receveur", x: 0, z: -3, v: 14 },
    { id: "1B", nom: "joueur de premier but", x: 64, z: 77, v: 20 },
    { id: "2B", nom: "joueur de deuxième but", x: 38, z: 143, v: 21 },
    { id: "AC", nom: "arrêt-court", x: -38, z: 143, v: 21 },
    { id: "3B", nom: "joueur de troisième but", x: -64, z: 77, v: 20 },
    { id: "CG", nom: "voltigeur de gauche", x: -134, z: 252, v: 24 },
    { id: "CC", nom: "voltigeur de centre", x: 0, z: 315, v: 25 },
    { id: "CD", nom: "voltigeur de droite", x: 134, z: 252, v: 24 },
  ];
  const INFIELD = 6;

  const LEVELS = {
    recrue: { slow: 1.4, win: 0.17, tol: 0.62, boost: 5, aid: true, target: [1, 3], run: 4.1, kmh: 0.75 },
    pro: { slow: 1.0, win: 0.12, tol: 0.42, boost: 0, aid: false, target: [2, 5], run: 4.3, kmh: 1 },
  };

  // time : durée du vol (s) au niveau Pro ; bx, by : bris de la balle (pi), surtout à la fin.
  const PITCHES = [
    { nom: "Rapide", time: 0.6, kmh: [142, 152], bx: 0, by: 0.3, w: 4 },
    { nom: "Glissante", time: 0.68, kmh: [128, 137], bx: 1.1, by: -0.4, w: 2 },
    { nom: "Courbe", time: 0.8, kmh: [112, 122], bx: 0.6, by: -1.5, w: 2 },
    { nom: "Changement", time: 0.86, kmh: [118, 128], bx: -0.4, by: -0.7, w: 2 },
  ];

  const lerp = (a, b, t) => a + (b - a) * t;

  function inZone(p) {
    return Math.abs(p.tx) <= ZONE.x + BALL_R && p.ty >= ZONE.y0 - BALL_R && p.ty <= ZONE.y1 + BALL_R;
  }

  // Choisit un lancer. rnd : générateur dans [0, 1[.
  function choosePitch(rnd, level, manche, balls) {
    const total = PITCHES.reduce((s, p) => s + p.w, 0);
    let r = rnd() * total, type = PITCHES[0];
    for (const p of PITCHES) { if ((r -= p.w) < 0) { type = p; break; } }
    const range = (a, b) => a + rnd() * (b - a);
    let tx = range(-0.7, 0.7), ty = range(1.8, 3.3);
    if (rnd() >= (balls === 3 ? 0.8 : 0.62)) {
      const side = Math.floor(rnd() * 4);
      if (side === 0) tx = -(ZONE.x + range(0.3, 0.9));
      else if (side === 1) tx = ZONE.x + range(0.3, 0.9);
      else if (side === 2) ty = ZONE.y0 - range(0.35, 0.9);
      else ty = ZONE.y1 + range(0.35, 0.8);
    }
    const speedUp = 1 - 0.05 * Math.min(manche - 1, 3);
    return {
      type, tx, ty, bx: type.bx, by: type.by,
      dur: type.time * level.slow * speedUp,
      kmh: Math.round(range(type.kmh[0], type.kmh[1]) * level.kmh / speedUp),
    };
  }

  // Position de la balle lancée ; t = 0 à la main du lanceur, 1 à la plaque.
  function pitchPos(p, t) {
    const k = t * t * t;
    return {
      x: lerp(RELEASE.x, p.tx - p.bx, t) + p.bx * k,
      y: lerp(RELEASE.y, p.ty - p.by, t) + p.by * k,
      z: lerp(RELEASE.z, 0, t),
    };
  }

  // Élan du frappeur. e : avance (< 0) ou retard (> 0) en secondes sur le
  // passage à la plaque ; tapY : hauteur visée (pi). Retourne null si raté.
  function contact(p, level, e, tapY, noise) {
    if (Math.abs(e) > level.win) return null;
    if (Math.abs(p.tx) > ZONE.x + 0.55) return null;            // trop loin, hors d'atteinte
    const dy = p.ty - tapY;                                      // > 0 : bâton sous la balle
    if (Math.abs(dy) > level.tol) return null;
    const n = noise || (() => 0.5);
    const qt = 1 - Math.abs(e) / level.win, qy = 1 - Math.abs(dy) / level.tol;
    const v = 60 + 50 * Math.pow(qt, 0.6) * (0.7 + 0.3 * qy) + level.boost + (n() - 0.5) * 6;
    const alpha = (16 + (dy / level.tol) * 40 + (n() - 0.5) * 8) * DEG;
    const theta = (-10 + (e / level.win) * 55 + (n() - 0.5) * 6) * DEG;
    return { v, alpha, theta, q: qt * (0.4 + 0.6 * qy) };
  }

  const isFoul = (c) => Math.abs(c.theta) > FOUL;

  // Vol de la balle frappée, pas à pas : rebonds, roulé, clôture.
  function simulate(p0, c) {
    const vf = c.v * 1.467, vh = vf * Math.cos(c.alpha);
    let x = p0.x, y = p0.y, z = Math.max(p0.z, 0.5);
    let vx = vh * Math.sin(c.theta), vz = vh * Math.cos(c.theta), vy = vf * Math.sin(c.alpha);
    const pts = [];
    let bounced = false, hrT = -1, wall = false, landT = -1;
    for (let i = 0; i <= 720; i++) {
      pts.push({ x, y, z, air: !bounced });
      if (hrT >= 0 && i * DT > hrT + 1.5) break;
      vy -= G * DT; x += vx * DT; y += vy * DT; z += vz * DT;
      if (y <= 0) {
        y = 0;
        if (!bounced) { bounced = true; landT = (i + 1) * DT; }
        if (hrT >= 0) { vx = vz = vy = 0; }
        else if (Math.abs(vy) > 4) { vy = -vy * 0.38; vx *= 0.72; vz *= 0.72; }
        else vy = 0;
      }
      if (y === 0 && vy === 0) {
        const sp = Math.hypot(vx, vz), ns = Math.max(0, sp - 14 * DT);
        if (sp > 0) { vx *= ns / sp; vz *= ns / sp; }
      }
      const r = Math.hypot(x, z), th = Math.atan2(x, z);
      if (hrT < 0 && Math.abs(th) <= FOUL + 2 * DEG && r >= fence(th)) {
        if (y > WALL_H && !bounced) hrT = (i + 1) * DT;
        else {
          // Rebond sur la clôture.
          const nx = x / r, nz = z / r, dot = vx * nx + vz * nz;
          if (dot > 0) { vx -= 1.5 * dot * nx; vz -= 1.5 * dot * nz; }
          x = nx * (fence(th) - 0.5); z = nz * (fence(th) - 0.5);
          wall = true;
        }
      }
    }
    return { pts, hrT, landT, wall };
  }

  // Qui attrape la balle, quand, et ce que ça donne.
  function resolve(sim, c, level) {
    if (sim.hrT >= 0) return { kind: "circuit", bases: 4, t: sim.hrT };
    const pts = sim.pts;
    for (let i = 0; i < pts.length; i++) {
      const t = i * DT, b = pts[i];
      if (b.y > 8) continue;
      for (let k = 0; k < FIELDERS.length; k++) {
        if (k === 1 && t < 0.6) continue;                       // le receveur se relève
        const f = FIELDERS[k];
        const reach = 4 + f.v * Math.max(0, t - 0.3);
        if (Math.hypot(b.x - f.x, b.z - f.z) > reach) continue;
        const at = { k, t, x: b.x, z: b.z };
        if (b.air && b.y > 0.3) {
          const deg = c.alpha / DEG;
          const kind = deg >= 45 ? "chandelle" : deg >= 22 ? "ballon" : "flèche";
          return Object.assign(at, { kind, bases: 0, out: true, deep: Math.hypot(b.x, b.z) });
        }
        if (k < INFIELD) {
          const throwT = t + Math.hypot(FIRST.x - b.x, FIRST.z - b.z) / 110 + 0.45;
          if (throwT < level.run) return Object.assign(at, { kind: "roulant", bases: 0, out: true });
          return Object.assign(at, { kind: "simple", bases: 1, infield: true });
        }
        const total = t + Math.hypot(SECOND.x - b.x, SECOND.z - b.z) / 100 + 0.6;
        const bases = total > 8.6 ? 3 : total > 5.6 ? 2 : 1;
        return Object.assign(at, { kind: ["", "simple", "double", "triple"][bases], bases });
      }
    }
    return { kind: "simple", bases: 1, t: pts.length * DT };
  }

  // Coureurs. bases : [1er, 2e, 3e]. Retourne { bases, runs }.
  function advance(bases, n) {
    const out = [false, false, false];
    let runs = 0;
    for (let i = 2; i >= 0; i--) {
      if (!bases[i]) continue;
      const to = i + n + (n === 1 && i === 1 ? 1 : 0);  // sur un simple, le coureur du 2e marque
      if (to >= 3) runs++; else out[to] = true;
    }
    if (n >= 4) runs++; else out[n - 1] = true;
    return { bases: out, runs };
  }

  function walk(bases) {
    const b = bases.slice();
    let runs = 0;
    if (b[0]) { if (b[1]) { if (b[2]) runs++; b[2] = true; } b[1] = true; }
    b[0] = true;
    return { bases: b, runs };
  }

  // Retrait en jeu (avant d'ajouter le retrait). Sur un roulant, les coureurs
  // avancent d'un but ; sur un ballon profond, le coureur du 3e marque.
  function outPlay(bases, outs, res) {
    if (outs >= 2) return { bases: bases.slice(), runs: 0 };
    if (res.kind === "roulant") {
      const b = [false, bases[0], bases[1]];
      return { bases: b, runs: bases[2] ? 1 : 0 };
    }
    if (res.kind === "ballon" && bases[2] && res.deep >= 200) {
      return { bases: [bases[0], bases[1], false], runs: 1, sacrifice: true };
    }
    return { bases: bases.slice(), runs: 0 };
  }

  const Physique = {
    DEG, ZONE, BALL_R, RELEASE, G, WALL_H, FOUL, FIRST, SECOND, DT, FIELDERS, INFIELD, LEVELS, PITCHES,
    fence, inZone, choosePitch, pitchPos, contact, isFoul, simulate, resolve, advance, walk, outPlay,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Physique;
  else root.Physique = Physique;
})(typeof window !== "undefined" ? window : globalThis);

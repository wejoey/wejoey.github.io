// Tests unitaires de Coup de circuit (physique, défense, coureurs).
// Lancer depuis la racine du repo : node --test circuit/tests/*.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../physique.js");

// Générateur pseudo-aléatoire reproductible (mulberry32).
function seeded(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pitch = (tx, ty) => ({ type: P.PITCHES[0], tx, ty, bx: 0, by: 0.3, dur: 0.6, kmh: 145 });
const pro = P.LEVELS.pro;

test("le lancer part de la main du lanceur et arrive au point visé", () => {
  const p = pitch(0.4, 2.2);
  assert.deepEqual(P.pitchPos(p, 0), { x: P.RELEASE.x, y: P.RELEASE.y, z: P.RELEASE.z });
  const end = P.pitchPos(p, 1);
  assert.ok(Math.abs(end.x - 0.4) < 1e-9 && Math.abs(end.y - 2.2) < 1e-9 && end.z === 0);
});

test("zone des prises", () => {
  assert.ok(P.inZone(pitch(0, 2.5)));
  assert.ok(!P.inZone(pitch(1.5, 2.5)));
  assert.ok(!P.inZone(pitch(0, 0.8)));
});

test("choosePitch donne des lancers valides", () => {
  const rnd = seeded(1);
  for (let i = 0; i < 500; i++) {
    const p = P.choosePitch(rnd, pro, 1 + (i % 4), i % 4);
    assert.ok(P.PITCHES.includes(p.type));
    assert.ok(p.dur > 0.4 && p.dur < 1.3);
    assert.ok(p.ty > 0.5 && p.ty < 4.5 && Math.abs(p.tx) < 2);
  }
});

test("contact : raté si trop tôt, trop tard ou trop loin en hauteur", () => {
  const p = pitch(0, 2.5);
  assert.equal(P.contact(p, pro, -0.2, 2.5), null);
  assert.equal(P.contact(p, pro, 0.2, 2.5), null);
  assert.equal(P.contact(p, pro, 0, 3.5), null);
  assert.equal(P.contact(pitch(1.6, 2.5), pro, 0, 2.5), null);
  assert.ok(P.contact(p, pro, 0, 2.5));
});

test("contact : en avance la balle part à gauche, sous la balle elle lève", () => {
  const p = pitch(0, 2.5);
  const early = P.contact(p, pro, -0.08, 2.5), late = P.contact(p, pro, 0.08, 2.5);
  assert.ok(early.theta < late.theta);
  const under = P.contact(p, pro, 0, 2.2), over = P.contact(p, pro, 0, 2.8);
  assert.ok(under.alpha > over.alpha);
  assert.ok(P.contact(p, pro, 0, 2.5).v > P.contact(p, pro, 0.1, 2.5).v);
});

test("un coup parfait sous la balle est un coup de circuit", () => {
  const c = { v: 108, alpha: 28 * P.DEG, theta: -10 * P.DEG };
  const sim = P.simulate({ x: 0, y: 2.5, z: 0 }, c);
  assert.ok(sim.hrT > 0);
  assert.equal(P.resolve(sim, c, pro).kind, "circuit");
});

test("une chandelle est attrapée, un roulant faible est un retrait", () => {
  const pop = { v: 75, alpha: 60 * P.DEG, theta: 5 * P.DEG };
  const r1 = P.resolve(P.simulate({ x: 0, y: 2.5, z: 0 }, pop), pop, pro);
  assert.equal(r1.kind, "chandelle"); assert.ok(r1.out);
  const weak = { v: 62, alpha: -5 * P.DEG, theta: -14 * P.DEG };
  const r2 = P.resolve(P.simulate({ x: 0, y: 2.5, z: 0 }, weak), weak, pro);
  assert.equal(r2.kind, "roulant"); assert.ok(r2.out);
});

test("une flèche dans l'allée est un coup sûr", () => {
  const c = { v: 100, alpha: 14 * P.DEG, theta: -22 * P.DEG };
  const r = P.resolve(P.simulate({ x: 0, y: 2.5, z: 0 }, c), c, pro);
  assert.ok(!r.out && r.bases >= 1, JSON.stringify(r));
});

test("fausse balle hors des lignes", () => {
  assert.ok(P.isFoul({ theta: 50 * P.DEG }));
  assert.ok(!P.isFoul({ theta: -40 * P.DEG }));
});

test("coureurs : simple, double, circuit, but sur balles", () => {
  assert.deepEqual(P.advance([false, false, false], 1), { bases: [true, false, false], runs: 0 });
  assert.deepEqual(P.advance([true, true, false], 1), { bases: [true, true, false], runs: 1 });
  assert.deepEqual(P.advance([true, false, true], 2), { bases: [false, true, true], runs: 1 });
  assert.deepEqual(P.advance([true, true, true], 4), { bases: [false, false, false], runs: 4 });
  assert.deepEqual(P.walk([true, false, true]), { bases: [true, true, true], runs: 0 });
  assert.deepEqual(P.walk([true, true, true]), { bases: [true, true, true], runs: 1 });
});

test("retraits : ballon sacrifice et roulant productif seulement avant 2 retraits", () => {
  const deep = { kind: "ballon", deep: 300 };
  assert.equal(P.outPlay([false, false, true], 1, deep).runs, 1);
  assert.equal(P.outPlay([false, false, true], 2, deep).runs, 0);
  assert.deepEqual(P.outPlay([true, false, false], 0, { kind: "roulant" }), { bases: [false, true, false], runs: 0 });
});

test("le jeu reste jouable : des coups sûrs et des circuits arrivent", () => {
  const rnd = seeded(42), lv = P.LEVELS.recrue;
  const count = {};
  for (let i = 0; i < 1500; i++) {
    const p = P.choosePitch(rnd, lv, 1, 0);
    const c = P.contact(p, lv, (rnd() * 2 - 1) * lv.win * 0.6, p.ty - (rnd() * 2 - 1) * lv.tol * 0.6, rnd);
    if (!c || P.isFoul(c)) continue;
    const r = P.resolve(P.simulate(P.pitchPos(p, 1), c), c, lv);
    count[r.kind] = (count[r.kind] || 0) + 1;
  }
  assert.ok(count.circuit > 20 && count.simple > 50 && count.roulant > 50, JSON.stringify(count));
});

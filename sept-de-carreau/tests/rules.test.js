// Tests unitaires des règles du 7 de carreau.
// Lancer depuis la racine du repo : node --test sept-de-carreau/tests/*.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../rules.js");

const card = (rank, suit) => ({ s: "SHDC".indexOf(suit), r: R.RANKS.indexOf(rank) });
const S = "S", H = "H", D = "D", C = "C";

// Générateur pseudo-aléatoire reproductible (mulberry32).
function seeded(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("le paquet a 52 cartes différentes, sans joker", () => {
  const deck = R.newDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map((c) => `${c.s}-${c.r}`)).size, 52);
});

test("la distribution répartit les 52 cartes selon le nombre de bots", () => {
  const expected = { 1: [26, 26], 2: [18, 17, 17], 3: [13, 13, 13, 13], 4: [11, 11, 10, 10, 10], 5: [9, 9, 9, 9, 8, 8] };
  for (let bots = R.MIN_BOTS; bots <= R.MAX_BOTS; bots++) {
    const hands = R.deal(R.shuffle(R.newDeck(), seeded(bots)), bots + 1);
    assert.deepEqual(hands.map((h) => h.length), expected[bots], `${bots} bot(s)`);
    assert.equal(new Set(hands.flat().map((c) => `${c.s}-${c.r}`)).size, 52);
  }
});

test("celui qui a le 7♦ commence", () => {
  const hands = [[card("2", S)], [card("7", D)], [card("R", C)]];
  assert.equal(R.startingPlayer(hands), 1);
});

test("au premier coup, seul le 7♦ peut être posé", () => {
  const board = R.emptyBoard();
  assert.ok(R.canPlay(board, card("7", D), true));
  assert.ok(!R.canPlay(board, card("7", H), true));
  assert.ok(!R.canPlay(board, card("8", D), true));
});

test("ensuite on peut ouvrir une autre couleur avec un 7", () => {
  const board = R.emptyBoard();
  R.placeCard(board, card("7", D), true);
  assert.ok(R.canPlay(board, card("7", S), false));
  assert.ok(!R.canPlay(board, card("8", S), false), "pas de 8♠ sans 7♠");
});

test("on monte et on descend une rangée une carte à la fois", () => {
  const board = R.emptyBoard();
  R.placeCard(board, card("7", D), true);
  assert.ok(R.canPlay(board, card("6", D), false));
  assert.ok(R.canPlay(board, card("8", D), false));
  assert.ok(!R.canPlay(board, card("5", D), false));
  assert.ok(!R.canPlay(board, card("9", D), false));
  R.placeCard(board, card("8", D), false);
  R.placeCard(board, card("6", D), false);
  assert.deepEqual(board[2], { low: 5, high: 7 });
  assert.ok(R.canPlay(board, card("5", D), false));
  assert.ok(R.canPlay(board, card("9", D), false));
});

function rowFrom(low, high, suit = 1) {
  // Rangée déjà posée de la position `low` à `high` (1 = le 2, 12 = le Roi),
  // par défaut en ♥.
  const board = R.emptyBoard();
  board[suit] = { low, high };
  return board;
}

test("l'As♦ n'est pas jouable tant qu'il n'y a ni 2♦ ni Roi♦", () => {
  assert.equal(R.targetPos(rowFrom(2, 11, 2), card("A", D), false), null);
});

test("l'As♦ se pose sous le 2♦", () => {
  const board = rowFrom(1, 9, 2);
  assert.equal(R.targetPos(board, card("A", D), false), 0);
  R.placeCard(board, card("A", D), false);
  assert.deepEqual(board[2], { low: 0, high: 9 });
  assert.equal(R.aceSide(board), "low");
});

test("l'As♦ se pose au-dessus du Roi♦", () => {
  const board = rowFrom(4, 12, 2);
  assert.equal(R.targetPos(board, card("A", D), false), R.ACE_HIGH);
  R.placeCard(board, card("A", D), false);
  assert.deepEqual(board[2], { low: 4, high: R.ACE_HIGH });
  assert.equal(R.aceSide(board), "high");
});

test("les autres As attendent l'As♦", () => {
  const board = rowFrom(1, 12); // ♥ complet du 2 au Roi
  board[2] = { low: 3, high: 9 }; // As♦ pas encore posé
  assert.equal(R.aceSide(board), null);
  assert.equal(R.targetPos(board, card("A", H), false), null);
});

test("As♦ sous le 2 : les autres As vont seulement sous le 2", () => {
  const board = rowFrom(1, 12); // ♥ du 2 au Roi
  board[2] = { low: 0, high: 9 }; // As♦ sous le 2♦
  assert.equal(R.targetPos(board, card("A", H), false), 0);
  board[1] = { low: 3, high: 12 }; // ♥ du 4 au Roi : pas encore de 2♥
  assert.equal(R.targetPos(board, card("A", H), false), null);
});

test("As♦ au-dessus du Roi : les autres As vont seulement au-dessus du Roi", () => {
  const board = rowFrom(1, 12); // ♥ du 2 au Roi
  board[2] = { low: 4, high: R.ACE_HIGH }; // As♦ au-dessus du Roi♦
  assert.equal(R.targetPos(board, card("A", H), false), R.ACE_HIGH);
  board[1] = { low: 1, high: 10 }; // ♥ du 2 au Valet : pas encore de Roi♥
  assert.equal(R.targetPos(board, card("A", H), false), null);
});

test("après un As en haut, le 2 reste jouable mais plus rien sous le 2", () => {
  const board = rowFrom(2, R.ACE_HIGH, 2); // du 3♦ au Roi♦, As♦ en haut
  assert.ok(R.canPlay(board, card("2", D), false));
  R.placeCard(board, card("2", D), false);
  assert.equal(R.targetPos(board, card("A", D), false), null);
});

test("poser une carte non jouable lève une erreur", () => {
  assert.throws(() => R.placeCard(R.emptyBoard(), card("8", S), false));
});

test("removeCard retire la bonne carte", () => {
  const hand = [card("2", S), card("7", D), card("R", C)];
  R.removeCard(hand, card("7", D));
  assert.deepEqual(hand, [card("2", S), card("R", C)]);
  assert.throws(() => R.removeCard(hand, card("7", D)));
});

test("le bot passe seulement s'il n'a rien à poser", () => {
  const board = R.emptyBoard();
  R.placeCard(board, card("7", D), true);
  assert.equal(R.botChoose(board, [card("2", S), card("R", C)], false), null);
  assert.deepEqual(R.botChoose(board, [card("2", S), card("8", D)], false), card("8", D));
});

test("le bot préfère la carte qui libère ses autres cartes", () => {
  const board = R.emptyBoard();
  R.placeCard(board, card("7", D), true);
  // 6♦ libère 5♦ et 4♦ ; 8♦ ne libère rien.
  const hand = [card("4", D), card("5", D), card("6", D), card("8", D)];
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(R.botChoose(board, hand, false, seeded(i)), card("6", D));
  }
});

test("le bot compte l'As quand il monte vers le Roi", () => {
  const hand = [card("D", H), card("A", H)];
  assert.equal(R.botScore(hand, card("D", H)), 1);
  assert.equal(R.botScore(hand, card("A", H)), 0);
});

test("des parties complètes entre bots se terminent toujours, pour 2 à 6 joueurs", () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rnd = seeded(seed);
    const players = 2 + (seed % 5);
    const hands = R.deal(R.shuffle(R.newDeck(), rnd), players);
    const board = R.emptyBoard();
    let firstMove = true;
    let current = R.startingPlayer(hands);
    let placed = 0;
    let turns = 0;
    let passesInARow = 0;
    while (hands[current].length > 0 || placed === 0) {
      const c = R.botChoose(board, hands[current], firstMove, rnd);
      if (c) {
        R.placeCard(board, c, firstMove);
        R.removeCard(hands[current], c);
        firstMove = false;
        placed++;
        passesInARow = 0;
        if (hands[current].length === 0) break;
      } else {
        passesInARow++;
        assert.ok(passesInARow < players, `blocage (graine ${seed})`);
      }
      current = (current + 1) % players;
      assert.ok(++turns < 1000, `partie infinie (graine ${seed})`);
    }
    const onBoard = board.reduce((n, row) => n + (row ? row.high - row.low + 1 : 0), 0);
    assert.equal(onBoard, placed, "chaque carte posée occupe une case");
    assert.equal(onBoard + hands.flat().length, 52, "aucune carte perdue");
  }
});

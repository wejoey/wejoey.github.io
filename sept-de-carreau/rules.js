// Règles du 7 de carreau (version « Sevens » / « Domino »), sans affichage,
// pour pouvoir les tester avec Node (voir tests/rules.test.js).
//
// - 52 cartes sans jokers, distribuées une à une : selon le nombre de
//   joueurs, certains ont une carte de plus.
// - Celui qui a le 7♦ commence en le posant.
// - À son tour, on pose un 7 (nouvelle rangée) ou une carte qui suit une
//   rangée en montant (8, 9… Roi) ou en descendant (6, 5… 2).
// - Variante : l'As se pose soit sous le 2, soit au-dessus du Roi.
// - On passe seulement si on ne peut rien poser.
// - Le premier qui n'a plus de cartes gagne.
(function (root) {
  "use strict";

  const SUITS = [
    { id: "S", sym: "♠", red: false },
    { id: "H", sym: "♥", red: true },
    { id: "D", sym: "♦", red: true },
    { id: "C", sym: "♣", red: false },
  ];
  // Rangs 0..12 ; le 7 est à l'index 6.
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "V", "D", "R"];
  const ACE = 0;
  const KING = 12;
  const SEVEN = 6;
  const DIAMONDS = 2;
  // Positions sur la table : 0 = As (bas), 1..12 = 2..Roi, 13 = As (haut).
  const ACE_HIGH = 13;
  const MIN_BOTS = 1;
  const MAX_BOTS = 5;

  function newDeck() {
    const deck = [];
    for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) deck.push({ s, r });
    return deck;
  }

  function shuffle(a, rnd = Math.random) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function sortHand(h) {
    return h.sort((a, b) => a.s - b.s || a.r - b.r);
  }

  // Distribue le paquet une carte à la fois, en commençant par le joueur 0.
  function deal(deck, players) {
    const hands = Array.from({ length: players }, () => []);
    deck.forEach((c, i) => hands[i % players].push(c));
    hands.forEach(sortHand);
    return hands;
  }

  const aceUsed = (row) => !!row && (row.low === 0 || row.high === ACE_HIGH);
  const isSevenOfDiamonds = (c) => c.s === DIAMONDS && c.r === SEVEN;
  const startingPlayer = (hands) => hands.findIndex((h) => h.some(isSevenOfDiamonds));
  const emptyBoard = () => [null, null, null, null];

  // Position où la carte irait sur la table, ou null si elle ne peut pas être posée.
  function targetPos(board, c, firstMove) {
    if (firstMove) return isSevenOfDiamonds(c) ? SEVEN : null; // seul le 7♦ ouvre la partie
    const row = board[c.s];
    if (!row) return c.r === SEVEN ? SEVEN : null;
    if (c.r === ACE) {
      if (aceUsed(row)) return null;            // l'As est déjà posé
      if (row.low === 1) return 0;              // As sous le 2
      if (row.high === KING) return ACE_HIGH;   // As au-dessus du Roi
      return null;
    }
    if (c.r === row.low - 1 || c.r === row.high + 1) return c.r;
    return null;
  }

  const canPlay = (board, c, firstMove) => targetPos(board, c, firstMove) !== null;
  const playableCards = (board, hand, firstMove) => hand.filter((c) => canPlay(board, c, firstMove));

  // Pose la carte sur la table (modifie board) et renvoie sa position.
  function placeCard(board, c, firstMove) {
    const pos = targetPos(board, c, firstMove);
    if (pos === null) throw new Error("Carte non jouable : " + RANKS[c.r] + SUITS[c.s].sym);
    const row = board[c.s];
    if (!row) board[c.s] = { low: pos, high: pos };
    else if (pos < row.low) row.low = pos;
    else row.high = pos;
    return pos;
  }

  // Retire la carte de la main (modifie hand).
  function removeCard(hand, c) {
    const i = hand.findIndex((x) => x.s === c.s && x.r === c.r);
    if (i < 0) throw new Error("Carte absente de la main");
    hand.splice(i, 1);
  }

  // Stratégie des bots : poser la carte qui « libère » le plus de cartes de
  // sa propre main dans la même direction ; égalités départagées au hasard.
  function botScore(hand, c) {
    if (c.r === ACE) return 0;
    const same = hand.filter((x) => x.s === c.s && !(x.r === c.r));
    if (c.r === SEVEN) return same.length;
    if (c.r > SEVEN) return same.filter((x) => x.r > c.r || x.r === ACE).length;
    return same.filter((x) => x.r < c.r).length;
  }

  function botChoose(board, hand, firstMove, rnd = Math.random) {
    const opts = shuffle(playableCards(board, hand, firstMove), rnd);
    if (!opts.length) return null;
    opts.sort((a, b) => botScore(hand, b) - botScore(hand, a));
    return opts[0];
  }

  const label = (c) => RANKS[c.r] + SUITS[c.s].sym;

  const Rules = {
    SUITS, RANKS, ACE, KING, SEVEN, DIAMONDS, ACE_HIGH, MIN_BOTS, MAX_BOTS,
    newDeck, shuffle, sortHand, deal, startingPlayer, emptyBoard,
    targetPos, canPlay, playableCards, placeCard, removeCard, aceUsed,
    botScore, botChoose, label,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Rules;
  else root.SeptRules = Rules;
})(typeof window !== "undefined" ? window : globalThis);

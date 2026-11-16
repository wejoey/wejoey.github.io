// Règles du 7 de carreau (version « Sevens » / « Domino »), sans affichage,
// pour pouvoir les tester avec Node (voir tests/rules.test.js).
//
// - 52 cartes sans jokers, distribuées une à une : selon le nombre de
//   joueurs, certains ont une carte de plus.
// - Celui qui a le 7♦ commence en le posant.
// - À son tour, on pose un 7 (nouvelle rangée) ou une carte qui suit une
//   rangée en montant (8, 9… Roi) ou en descendant (6, 5… 2).
// - Variante de l'As : l'As♦ se pose soit sous le 2♦, soit au-dessus du Roi♦.
//   Son côté décide pour les autres As : ils se posent tous du même côté,
//   et seulement après l'As♦.
// - On est obligé de poser une carte si on peut.
// - Si on ne peut rien poser, on demande une carte au joueur qui nous
//   précède (dans l'ordre du tour). Il donne la carte de son choix ; les
//   bots donnent la « pire » carte, celle qui est la plus loin d'être
//   jouable. Recevoir la carte termine le tour.
// - La partie se termine dès que le premier joueur n'a plus de cartes.
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
  // Côté choisi par l'As♦ : "low" (sous le 2), "high" (au-dessus du Roi) ou null.
  function aceSide(board) {
    const row = board[DIAMONDS];
    if (!aceUsed(row)) return null;
    return row.low === 0 ? "low" : "high";
  }
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
      const side = c.s === DIAMONDS ? null : aceSide(board);
      if (c.s !== DIAMONDS && !side) return null; // on attend l'As♦
      if (row.low === 1 && side !== "high") return 0;            // As sous le 2
      if (row.high === KING && side !== "low") return ACE_HIGH;  // As au-dessus du Roi
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

  // Les carreaux valent plus que les autres cartes pour les bots :
  // c'est la couleur du 7♦ et c'est l'As♦ qui décide du côté des As.
  const DIAMOND_WEIGHT = 2;
  const cardValue = (c) => (c.s === DIAMONDS ? DIAMOND_WEIGHT : 1);

  // Stratégie des bots : poser la carte qui « libère » le plus de cartes de
  // sa propre main dans la même direction (un carreau libéré compte double),
  // en préférant poser un carreau à égalité ; sinon au hasard.
  // Un As ne compte que s'il pourra aller de ce côté (côté de l'As♦).
  function botScore(hand, c, board = emptyBoard()) {
    if (c.r === ACE) return 0;
    const side = c.s === DIAMONDS ? null : aceSide(board);
    const same = hand.filter((x) => x.s === c.s && x.r !== c.r);
    let freed;
    if (c.r === SEVEN) freed = same;
    else if (c.r > SEVEN) freed = same.filter((x) => x.r > c.r || (x.r === ACE && side !== "low"));
    else freed = same.filter((x) => x.r < c.r && (x.r !== ACE || side !== "high"));
    const bonus = c.s === DIAMONDS ? 0.5 : 0;
    return freed.reduce((n, x) => n + cardValue(x), 0) + bonus;
  }

  function botChoose(board, hand, firstMove, rnd = Math.random) {
    const opts = shuffle(playableCards(board, hand, firstMove), rnd);
    if (!opts.length) return null;
    opts.sort((a, b) => botScore(hand, b, board) - botScore(hand, a, board));
    return opts[0];
  }

  // On ne peut demander une carte que si on n'a rien à poser.
  const mustPlay = (board, hand, firstMove) => playableCards(board, hand, firstMove).length > 0;
  const canAsk = (board, hand, firstMove) => !mustPlay(board, hand, firstMove);

  // Le joueur qui précède p dans l'ordre du tour (celui à qui on demande).
  const previousPlayer = (p, players) => (p - 1 + players) % players;

  // Nombre de cartes qui doivent encore être posées avant que c soit jouable
  // (0 = jouable tout de suite).
  function distance(board, c) {
    if (canPlay(board, c, false)) return 0;
    const row = board[c.s];
    if (c.r === ACE) {
      const lowNeed = row ? row.low - 1 : SEVEN;           // 2..(bas de la rangée)
      const highNeed = row ? KING - row.high : KING - SEVEN + 1; // (haut de la rangée)..Roi
      if (c.s === DIAMONDS) return Math.min(lowNeed, highNeed);
      const side = aceSide(board);
      if (side === "low") return lowNeed;
      if (side === "high") return highNeed;
      return Math.min(lowNeed, highNeed) + 1;              // il faut aussi l'As♦
    }
    if (!row) return Math.abs(c.r - SEVEN);                // le 7, puis les cartes entre les deux
    return c.r < row.low ? row.low - c.r - 1 : c.r - row.high - 1;
  }

  // Carte qu'un bot donne quand on lui en demande une : la plus loin d'être
  // jouable ; à égalité il garde ses carreaux (ils valent plus), puis au hasard.
  function worstCard(board, hand, rnd = Math.random) {
    const opts = shuffle(hand.slice(), rnd);
    opts.sort((a, b) => distance(board, b) - distance(board, a) || cardValue(a) - cardValue(b));
    return opts[0] || null;
  }

  // Donne la carte c du joueur `from` au joueur `to` (modifie hands).
  function giveCard(hands, from, to, c) {
    removeCard(hands[from], c);
    hands[to].push(c);
    sortHand(hands[to]);
  }

  const label = (c) => RANKS[c.r] + SUITS[c.s].sym;

  const Rules = {
    SUITS, RANKS, ACE, KING, SEVEN, DIAMONDS, ACE_HIGH, MIN_BOTS, MAX_BOTS,
    newDeck, shuffle, sortHand, deal, startingPlayer, emptyBoard,
    targetPos, canPlay, playableCards, placeCard, removeCard, aceUsed, aceSide,
    botScore, botChoose, label, cardValue,
    mustPlay, canAsk, previousPlayer, distance, worstCard, giveCard,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Rules;
  else root.SeptRules = Rules;
})(typeof window !== "undefined" ? window : globalThis);

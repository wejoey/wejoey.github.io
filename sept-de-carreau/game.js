(() => {
  "use strict";

  // Règles (version « Sevens » / « Domino ») :
  // - 52 cartes, 13 par joueur, 1 joueur contre 3 bots.
  // - Celui qui a le 7 de carreau commence en le posant.
  // - À son tour, on pose un 7 (nouvelle rangée) ou une carte qui suit
  //   une rangée en montant (8, 9… Roi) ou en descendant (6, 5… As).
  // - Si on ne peut rien poser, on passe.
  // - Le premier qui n'a plus de cartes gagne.

  const SUITS = [
    { id: "S", sym: "♠", red: false },
    { id: "H", sym: "♥", red: true },
    { id: "D", sym: "♦", red: true },
    { id: "C", sym: "♣", red: false },
  ];
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "V", "D", "R"]; // index 0..12, le 7 est à l'index 6
  const SEVEN = 6;
  const BOT_DELAY_MS = 800;
  const NAMES = ["Toi", "Bot 1", "Bot 2", "Bot 3"];

  const $ = (id) => document.getElementById(id);
  const botsEl = $("bots");
  const boardEl = $("board");
  const statusEl = $("status");
  const handEl = $("hand");
  const handCount = $("hand-count");
  const btnStart = $("btn-start");
  const btnPass = $("btn-pass");

  let hands = [];      // hands[p] = liste de cartes { s, r }
  let board = [];      // board[s] = null ou { low, high }
  let current = 0;     // joueur dont c'est le tour
  let firstMove = true;
  let over = false;
  let lastPlayed = null;
  let passed = [false, false, false, false];
  let botTimer = null;
  let lastMsg = "";      // dernière action, gardée affichée au tour suivant

  const isRed = (c) => SUITS[c.s].red;
  const label = (c) => RANKS[c.r] + SUITS[c.s].sym;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function sortHand(h) {
    h.sort((a, b) => a.s - b.s || a.r - b.r);
  }

  function canPlay(c) {
    if (firstMove) return c.s === 2 && c.r === SEVEN; // seul le 7♦ ouvre la partie
    const row = board[c.s];
    if (!row) return c.r === SEVEN;
    return c.r === row.low - 1 || c.r === row.high + 1;
  }

  const playable = (p) => hands[p].filter(canPlay);

  // ---------- Affichage ----------

  function renderBots() {
    botsEl.innerHTML = "";
    for (let p = 1; p <= 3; p++) {
      const li = document.createElement("li");
      li.className = "bot";
      if (p === current && !over) li.classList.add("turn");
      if (passed[p]) li.classList.add("passed");
      if (over && hands[p].length === 0) li.classList.add("winner");
      const n = hands[p] ? hands[p].length : 13;
      li.innerHTML = `<div class="bot-name">${NAMES[p]}</div>
        <div class="bot-info">${n} carte${n > 1 ? "s" : ""}</div>`;
      botsEl.appendChild(li);
    }
  }

  function renderBoard() {
    boardEl.innerHTML = "";
    SUITS.forEach((suit, s) => {
      const row = document.createElement("div");
      row.className = "row";
      const head = document.createElement("span");
      head.className = "row-suit";
      head.style.color = suit.red ? "#f87171" : "#f9fafb";
      head.textContent = suit.sym;
      row.appendChild(head);
      const r0 = board[s];
      for (let r = 0; r < 13; r++) {
        const slot = document.createElement("span");
        slot.className = "slot";
        const filled = r0 && r >= r0.low && r <= r0.high;
        if (filled) {
          slot.classList.add("filled");
          if (suit.red) slot.classList.add("red");
          if (lastPlayed && lastPlayed.s === s && lastPlayed.r === r) slot.classList.add("just");
        } else if (r === SEVEN) {
          slot.classList.add("seven");
        } else if (r0 && (r === r0.low - 1 || r === r0.high + 1)) {
          slot.classList.add("next");
        }
        slot.textContent = RANKS[r];
        row.appendChild(slot);
      }
      boardEl.appendChild(row);
    });
  }

  function renderHand() {
    handEl.innerHTML = "";
    const h = hands[0] || [];
    const myTurn = current === 0 && !over;
    h.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "card" + (isRed(c) ? " red" : "");
      b.innerHTML = `<span>${RANKS[c.r]}</span><span>${SUITS[c.s].sym}</span>`;
      b.setAttribute("aria-label", label(c));
      const ok = myTurn && canPlay(c);
      if (ok) {
        b.classList.add("playable");
        b.addEventListener("click", () => humanPlay(c));
      } else {
        b.disabled = true;
      }
      handEl.appendChild(b);
    });
    handCount.textContent = h.length ? `(${h.length})` : "";
    btnPass.hidden = !(myTurn && playable(0).length === 0);
  }

  function render() {
    renderBots();
    renderBoard();
    renderHand();
  }

  // ---------- Déroulement ----------

  function deal() {
    clearTimeout(botTimer);
    const deck = [];
    for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) deck.push({ s, r });
    shuffle(deck);
    hands = [0, 1, 2, 3].map((p) => deck.slice(p * 13, p * 13 + 13));
    hands.forEach(sortHand);
    board = [null, null, null, null];
    firstMove = true;
    over = false;
    lastPlayed = null;
    passed = [false, false, false, false];
    lastMsg = "";
    current = hands.findIndex((h) => h.some((c) => c.s === 2 && c.r === SEVEN));
    btnStart.hidden = true;
    startTurn();
  }

  function place(p, c) {
    const h = hands[p];
    h.splice(h.findIndex((x) => x.s === c.s && x.r === c.r), 1);
    const row = board[c.s];
    if (!row) board[c.s] = { low: c.r, high: c.r };
    else if (c.r < row.low) row.low = c.r;
    else row.high = c.r;
    firstMove = false;
    lastPlayed = c;
    passed[p] = false;
  }

  function nextTurn() {
    if (hands[current].length === 0) return finish(current);
    current = (current + 1) % 4;
    startTurn();
  }

  function startTurn() {
    render();
    const pre = lastMsg ? lastMsg + " " : "";
    if (current === 0) {
      if (firstMove) statusEl.textContent = "Tu as le 7♦ : pose-le pour commencer !";
      else if (playable(0).length) statusEl.textContent = pre + "À toi !";
      else statusEl.textContent = pre + "Aucune carte possible : passe.";
    } else {
      statusEl.textContent = pre + `${NAMES[current]} réfléchit…`;
      botTimer = setTimeout(botPlay, BOT_DELAY_MS);
    }
  }

  function humanPlay(c) {
    if (current !== 0 || over || !canPlay(c)) return;
    place(0, c);
    lastMsg = `Tu poses ${label(c)}.`;
    nextTurn();
  }

  function humanPass() {
    if (current !== 0 || over || playable(0).length) return;
    passed[0] = true;
    lastMsg = "Tu passes.";
    nextTurn();
  }

  // Stratégie simple : poser la carte qui « libère » le plus de cartes
  // de sa propre main dans la même direction ; sinon au hasard.
  function botChoose(p) {
    const opts = playable(p);
    if (!opts.length) return null;
    const h = hands[p];
    const score = (c) => {
      if (c.r === SEVEN) return h.filter((x) => x.s === c.s && x.r !== SEVEN).length;
      const up = c.r > SEVEN;
      return h.filter((x) => x.s === c.s && (up ? x.r > c.r : x.r < c.r)).length;
    };
    shuffle(opts);
    opts.sort((a, b) => score(b) - score(a));
    return opts[0];
  }

  function botPlay() {
    if (over) return;
    const p = current;
    const c = botChoose(p);
    if (c) {
      place(p, c);
      lastMsg = `${NAMES[p]} pose ${label(c)}.`;
    } else {
      passed[p] = true;
      lastMsg = `${NAMES[p]} passe.`;
    }
    render();
    statusEl.textContent = lastMsg;
    botTimer = setTimeout(nextTurn, BOT_DELAY_MS / 2);
  }

  function finish(p) {
    over = true;
    render();
    statusEl.textContent = p === 0 ? "🎉 Bravo, tu as gagné !" : `${NAMES[p]} a gagné. Tu avais encore ${hands[0].length} carte${hands[0].length > 1 ? "s" : ""}.`;
    btnStart.textContent = "Rejouer";
    btnStart.hidden = false;
    btnPass.hidden = true;
  }

  btnStart.addEventListener("click", deal);
  btnPass.addEventListener("click", humanPass);

  // Table vide au chargement
  board = [null, null, null, null];
  hands = [[], [], [], []];
  current = -1;
  render();
  botsEl.querySelectorAll(".bot-info").forEach((el) => (el.textContent = "13 cartes"));
})();

(() => {
  "use strict";

  const R = window.SeptRules; // règles : voir rules.js
  const { SUITS, RANKS, SEVEN, ACE_HIGH } = R;
  const BOT_DELAY_MS = 800;

  const $ = (id) => document.getElementById(id);
  const botsEl = $("bots");
  const boardEl = $("board");
  const statusEl = $("status");
  const handEl = $("hand");
  const handCount = $("hand-count");
  const setupEl = $("setup");
  const choicesEl = $("bot-choices");
  const btnPass = $("btn-pass");

  let players = 1;     // toi + les bots (aucun bot affiché avant la distribution)
  let hands = [];      // hands[p] = liste de cartes { s, r } ; p = 0 c'est toi
  let board = R.emptyBoard();
  let current = -1;    // joueur dont c'est le tour
  let firstMove = true;
  let over = true;
  let lastPlayed = null;
  let passed = [];
  let botTimer = null;
  let lastMsg = "";    // dernière action, gardée affichée au tour suivant

  const name = (p) => (p === 0 ? "Toi" : `Bot ${p}`);
  const playable = (p) => R.playableCards(board, hands[p], firstMove);
  const plural = (n) => `${n} carte${n > 1 ? "s" : ""}`;

  // ---------- Affichage ----------

  function renderBots() {
    botsEl.innerHTML = "";
    for (let p = 1; p < players; p++) {
      const li = document.createElement("li");
      li.className = "bot";
      if (p === current && !over) li.classList.add("turn");
      if (passed[p]) li.classList.add("passed");
      if (over && hands[p] && hands[p].length === 0) li.classList.add("winner");
      const n = hands[p] ? hands[p].length : 0;
      li.innerHTML = `<div class="bot-name">${name(p)}</div><div class="bot-info">${plural(n)}</div>`;
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
      const aceGone = R.aceUsed(r0);
      for (let pos = 0; pos <= ACE_HIGH; pos++) {
        const slot = document.createElement("span");
        slot.className = "slot";
        const filled = r0 && pos >= r0.low && pos <= r0.high;
        if (filled) {
          slot.classList.add("filled");
          if (suit.red) slot.classList.add("red");
          if (lastPlayed && lastPlayed.s === s && lastPlayed.pos === pos) slot.classList.add("just");
        } else if (pos === SEVEN) {
          slot.classList.add("seven");
        } else if ((pos === 0 || pos === ACE_HIGH) && aceGone) {
          slot.classList.add("gone"); // l'As est déjà posé de l'autre côté
        } else if (r0 && (pos === r0.low - 1 || pos === r0.high + 1)) {
          slot.classList.add("next");
        }
        slot.textContent = RANKS[pos % 13];
        row.appendChild(slot);
      }
      boardEl.appendChild(row);
    });
  }

  function renderHand() {
    handEl.innerHTML = "";
    const h = hands[0] || [];
    const myTurn = current === 0 && !over;
    handEl.classList.toggle("big", h.length > 14);
    h.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "card" + (SUITS[c.s].red ? " red" : "");
      b.innerHTML = `<span>${RANKS[c.r]}</span><span>${SUITS[c.s].sym}</span>`;
      b.setAttribute("aria-label", R.label(c));
      if (myTurn && R.canPlay(board, c, firstMove)) {
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

  function startGame(bots) {
    clearTimeout(botTimer);
    players = bots + 1;
    hands = R.deal(R.shuffle(R.newDeck()), players);
    board = R.emptyBoard();
    firstMove = true;
    over = false;
    lastPlayed = null;
    passed = new Array(players).fill(false);
    lastMsg = "";
    current = R.startingPlayer(hands);
    setupEl.hidden = true;
    startTurn();
  }

  function play(p, c) {
    const pos = R.placeCard(board, c, firstMove);
    R.removeCard(hands[p], c);
    firstMove = false;
    lastPlayed = { s: c.s, pos };
    passed[p] = false;
  }

  function nextTurn() {
    if (hands[current].length === 0) return finish(current);
    current = (current + 1) % players;
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
      statusEl.textContent = pre + `${name(current)} réfléchit…`;
      botTimer = setTimeout(botPlay, BOT_DELAY_MS);
    }
  }

  function humanPlay(c) {
    if (current !== 0 || over || !R.canPlay(board, c, firstMove)) return;
    play(0, c);
    lastMsg = `Tu poses ${R.label(c)}.`;
    nextTurn();
  }

  function humanPass() {
    if (current !== 0 || over || playable(0).length) return;
    passed[0] = true;
    lastMsg = "Tu passes.";
    nextTurn();
  }

  function botPlay() {
    if (over) return;
    const p = current;
    const c = R.botChoose(board, hands[p], firstMove);
    if (c) {
      play(p, c);
      lastMsg = `${name(p)} pose ${R.label(c)}.`;
    } else {
      passed[p] = true;
      lastMsg = `${name(p)} passe.`;
    }
    render();
    statusEl.textContent = lastMsg;
    botTimer = setTimeout(nextTurn, BOT_DELAY_MS / 2);
  }

  function finish(p) {
    over = true;
    render();
    statusEl.textContent = p === 0
      ? "🎉 Bravo, tu as gagné !"
      : `${name(p)} a gagné. Tu avais encore ${plural(hands[0].length)}.`;
    btnPass.hidden = true;
    setupEl.hidden = false;
  }

  // ---------- Choix du nombre de bots ----------

  for (let n = R.MIN_BOTS; n <= R.MAX_BOTS; n++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-choice";
    b.textContent = n;
    b.setAttribute("aria-label", `Jouer contre ${n} bot${n > 1 ? "s" : ""}`);
    b.addEventListener("click", () => startGame(n));
    choicesEl.appendChild(b);
  }
  btnPass.addEventListener("click", humanPass);

  render();
})();

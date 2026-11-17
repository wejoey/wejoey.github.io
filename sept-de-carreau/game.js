(() => {
  "use strict";

  const R = window.SeptRules; // règles : voir rules.js
  const { SUITS, RANKS, SEVEN, ACE_HIGH } = R;
  const SPEEDS = { normale: 800, rapide: 300 }; // délai de réflexion des bots (ms)

  const $ = (id) => document.getElementById(id);
  const botsEl = $("bots");
  const boardEl = $("board");
  const statusEl = $("status");
  const handEl = $("hand");
  const handCount = $("hand-count");
  const setupEl = $("setup");
  const choicesEl = $("bot-choices");
  const btnAsk = $("btn-ask");
  const btnSpeed = $("btn-speed");
  const scoreEl = $("score");
  const rulesEl = $("rules");

  let players = 1;     // toi + les bots (aucun bot affiché avant la distribution)
  let hands = [];      // hands[p] = liste de cartes { s, r } ; p = 0 c'est toi
  let board = R.emptyBoard();
  let current = -1;    // joueur dont c'est le tour
  let firstMove = true;
  let over = true;
  let lastPlayed = null;
  let asked = [];      // asked[p] : le joueur a demandé une carte à son dernier tour
  let giveTo = null;   // bot qui attend que tu lui donnes une carte
  let botTimer = null;
  let lastMsg = "";    // dernière action, gardée affichée au tour suivant

  // Préférences et victoires gardées dans le téléphone (si le navigateur le permet).
  const STORE = "sept-de-carreau";
  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(`${STORE}:${key}`)); return v ?? fallback; } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(`${STORE}:${key}`, JSON.stringify(value)); } catch (e) { /* tant pis */ }
  }
  let speed = SPEEDS[load("vitesse", "normale")] ? load("vitesse", "normale") : "normale";
  let wins = load("victoires", { toi: 0, bots: 0 });
  if (typeof wins.toi !== "number" || typeof wins.bots !== "number") wins = { toi: 0, bots: 0 };
  const delay = () => SPEEDS[speed];

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
      if (asked[p]) li.classList.add("asked");
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
      const side = R.aceSide(board); // côté choisi par l'As♦, pour toutes les couleurs
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
        } else if ((pos === 0 || pos === ACE_HIGH) &&
                   (aceGone || (side === "low" && pos === ACE_HIGH) || (side === "high" && pos === 0))) {
          slot.classList.add("gone"); // l'As est déjà posé, ou il va de l'autre côté
        } else if (r0 && (pos === r0.low - 1 || pos === r0.high + 1)) {
          // Une case n'est encadrée que si sa carte peut vraiment y aller
          // (le carreau mène, et les autres As attendent l'As♦).
          if (R.targetPos(board, { s, r: pos % 13 }, firstMove) === pos) slot.classList.add("next");
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
    const myTurn = current === 0 && !over && giveTo === null;
    const giving = giveTo !== null && !over;
    h.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "card" + (SUITS[c.s].red ? " red" : "");
      b.innerHTML = `<span>${RANKS[c.r]}</span><span>${SUITS[c.s].sym}</span>`;
      b.setAttribute("aria-label", R.label(c));
      if (giving) {
        b.classList.add("playable", "give");
        b.addEventListener("click", () => humanGive(c));
      } else if (myTurn && R.canPlay(board, c, firstMove)) {
        b.classList.add("playable");
        b.addEventListener("click", () => humanPlay(c));
      } else {
        b.disabled = true;
      }
      handEl.appendChild(b);
    });
    handCount.textContent = h.length ? `(${h.length})` : "";
    btnAsk.hidden = !(myTurn && R.canAsk(board, h, firstMove));
    btnAsk.textContent = `Demander une carte à ${name(R.previousPlayer(0, players))}`;
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
    asked = new Array(players).fill(false);
    giveTo = null;
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
    asked[p] = false;
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
      else statusEl.textContent = pre + `Aucune carte possible : demande une carte à ${name(R.previousPlayer(0, players))}.`;
    } else {
      statusEl.textContent = pre + `${name(current)} réfléchit…`;
      botTimer = setTimeout(botPlay, delay());
    }
  }

  function humanPlay(c) {
    if (current !== 0 || over || !R.canPlay(board, c, firstMove)) return;
    play(0, c);
    lastMsg = `Tu poses ${R.label(c)}.`;
    nextTurn();
  }

  // Tu ne peux rien poser : le joueur qui te précède te donne une carte.
  function humanAsk() {
    if (current !== 0 || over || giveTo !== null || !R.canAsk(board, hands[0], firstMove)) return;
    const g = R.previousPlayer(0, players);
    const c = R.worstCard(board, hands[g]);
    R.giveCard(hands, g, 0, c);
    asked[0] = true;
    lastMsg = `${name(g)} te donne ${R.label(c)}.`;
    afterGive(g);
  }

  // Un bot t'a demandé une carte : tu choisis celle que tu lui donnes.
  function humanGive(c) {
    if (giveTo === null || over) return;
    const p = giveTo;
    giveTo = null;
    R.giveCard(hands, 0, p, c);
    lastMsg = `Tu donnes ${R.label(c)} à ${name(p)}.`;
    afterGive(0);
  }

  // Celui qui donne sa dernière carte n'a plus de cartes : la partie se termine.
  function afterGive(giver) {
    if (hands[giver].length === 0) return finish(giver);
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
      asked[p] = true;
      const g = R.previousPlayer(p, players);
      if (g === 0) {
        giveTo = p;
        render();
        statusEl.textContent = `${name(p)} ne peut pas jouer et te demande une carte : touche celle que tu lui donnes.`;
        return;
      }
      R.giveCard(hands, g, p, R.worstCard(board, hands[g]));
      lastMsg = `${name(p)} ne peut pas jouer : ${name(g)} lui donne une carte.`;
      render();
      statusEl.textContent = lastMsg;
      botTimer = setTimeout(() => afterGive(g), delay() / 2);
      return;
    }
    render();
    statusEl.textContent = lastMsg;
    botTimer = setTimeout(nextTurn, delay() / 2);
  }

  function finish(p) {
    over = true;
    render();
    statusEl.textContent = p === 0
      ? "🎉 Bravo, tu as gagné !"
      : `${name(p)} a gagné. Tu avais encore ${plural(hands[0].length)}.`;
    btnAsk.hidden = true;
    if (p === 0) wins.toi++; else wins.bots++;
    save("victoires", wins);
    renderExtras();
    setupEl.hidden = false;
  }

  // ---------- Victoires, vitesse et règles ----------

  function renderExtras() {
    scoreEl.textContent = `Victoires : toi ${wins.toi} · bots ${wins.bots}`;
    btnSpeed.textContent = `Bots : vitesse ${speed}`;
  }

  btnSpeed.addEventListener("click", () => {
    speed = speed === "normale" ? "rapide" : "normale";
    save("vitesse", speed);
    renderExtras();
  });

  $("btn-rules").addEventListener("click", () => {
    if (rulesEl.showModal) rulesEl.showModal(); else rulesEl.setAttribute("open", "");
  });
  $("btn-rules-close").addEventListener("click", () => {
    if (rulesEl.close) rulesEl.close(); else rulesEl.removeAttribute("open");
  });

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
  btnAsk.addEventListener("click", humanAsk);

  renderExtras();
  render();
})();

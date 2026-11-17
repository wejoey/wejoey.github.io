(() => {
  "use strict";

  const R = window.SeptRules; // règles : voir rules.js
  const { SUITS, RANKS, SEVEN, ACE_HIGH } = R;
  const SPEEDS = { normale: 800, rapide: 300 }; // délai de réflexion des bots (ms)

  const $ = (id) => document.getElementById(id);
  const seatsEl = $("seats");
  const handZone = $("hand-zone");
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
  // \uFE0E : force l'affichage « texte » des symboles (sinon certains
  // téléphones les dessinent en emoji, avec leurs propres couleurs).
  const sym = (s) => SUITS[s].sym + "\uFE0E";
  // Petite carte dans les messages (♠ et ♣ en noir, ♥ et ♦ en rouge).
  const chip = (c) => `<span class="chip${SUITS[c.s].red ? " red" : ""}">${RANKS[c.r]}${sym(c.s)}</span>`;
  const setStatus = (html) => { statusEl.innerHTML = html; }; // contenu généré par le jeu seulement

  // ---------- Affichage ----------

  // Les joueurs sont assis autour de la table : toi en bas, les bots en arc
  // au-dessus, dans l'ordre du tour (sens des aiguilles d'une montre).
  function renderSeats() {
    seatsEl.innerHTML = "";
    if (players < 2) return;
    const bots = players - 1;
    for (let p = 0; p < players; p++) {
      const li = document.createElement("li");
      li.className = "seat" + (p === 0 ? " me" : "");
      if (p === current && !over) li.classList.add("turn");
      if (giveTo === p && !over) li.classList.add("waiting");
      if (over && hands[p] && hands[p].length === 0) li.classList.add("winner");
      if (p > 0) {
        // Sièges de même largeur, répartis de gauche à droite sans se chevaucher,
        // plus hauts au milieu pour dessiner un arc autour de la table.
        const w = `min(84px, (100% - ${(bots - 1) * 6}px) / ${bots})`;
        const t = bots === 1 ? 0.5 : (p - 1) / (bots - 1);
        li.style.width = `calc(${w})`;
        li.style.left = `calc(${t} * (100% - ${w}) + ${w} / 2)`;
        li.style.top = `${Math.round(26 * (1 - Math.sin(Math.PI * t)))}px`;
      }
      const n = hands[p] ? hands[p].length : 0;
      const tag = p === current && !over ? `<span class="seat-tag">${p === 0 ? "À toi !" : "Joue…"}</span>` : "";
      li.innerHTML = `<span class="seat-name">${name(p)}</span><span class="seat-info">${plural(n)}</span>${tag}`;
      seatsEl.appendChild(li);
    }
  }

  // La table : une colonne par couleur, et seulement 3 cases de haut :
  //   - en haut, la pile qui monte (8, 9… Roi, puis l'As s'il va en haut) ;
  //   - au milieu, le 7 ;
  //   - en bas, la pile qui descend (6, 5… 2, puis l'As s'il va en bas).
  // Seule la dernière carte de chaque pile est visible ; l'épaisseur montre
  // combien de cartes sont dessous.
  function renderBoard() {
    boardEl.innerHTML = "";
    SUITS.forEach((suit, s) => {
      const col = document.createElement("div");
      col.className = "pile-col";
      col.setAttribute("aria-label", `Couleur ${sym(s)}`);
      const r0 = board[s];
      const top = r0 && r0.high > SEVEN ? r0.high : null;       // dernière carte de la pile du haut
      const bottom = r0 && r0.low < SEVEN ? r0.low : null;      // dernière carte de la pile du bas
      const cells = [
        { pos: top, next: r0 ? r0.high + 1 : null, depth: top === null ? 0 : top - SEVEN, dir: "up" },
        { pos: r0 ? SEVEN : null, next: SEVEN, depth: 0, dir: "mid" },
        { pos: bottom, next: r0 ? r0.low - 1 : null, depth: bottom === null ? 0 : SEVEN - bottom, dir: "down" },
      ];
      for (const cell of cells) {
        const slot = document.createElement("span");
        slot.className = `slot ${cell.dir}`;
        if (cell.pos !== null) {
          slot.classList.add("filled");
          if (suit.red) slot.classList.add("red");
          if (cell.depth > 1) slot.classList.add(`stack-${Math.min(cell.depth - 1, 3)}`);
          if (lastPlayed && lastPlayed.s === s && lastPlayed.pos === cell.pos) slot.classList.add("just");
          slot.innerHTML = `<span>${RANKS[cell.pos % 13]}</span><span class="slot-suit">${sym(s)}</span>`;
          slot.setAttribute("aria-label", RANKS[cell.pos % 13] + sym(s));
        } else if (cell.dir === "mid") {
          slot.classList.add("seven");
          slot.innerHTML = `<span>7</span><span class="slot-suit">${sym(s)}</span>`;
        }
        // Encadre la pile où la prochaine carte peut aller
        // (le carreau mène, et les autres As attendent l'As♦).
        const nxt = cell.next;
        if (nxt !== null && nxt >= 0 && nxt <= ACE_HIGH &&
            R.targetPos(board, { s, r: nxt % 13 }, firstMove) === nxt) slot.classList.add("next");
        col.appendChild(slot);
      }
      boardEl.appendChild(col);
    });
  }

  function renderHand() {
    handEl.innerHTML = "";
    const h = hands[0] || [];
    const myTurn = current === 0 && !over && giveTo === null;
    const giving = giveTo !== null && !over;
    handEl.classList.toggle("many", h.length > 21); // contre 1 bot : 26 cartes, une colonne de plus
    h.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "card" + (SUITS[c.s].red ? " red" : "");
      b.innerHTML = `<span>${RANKS[c.r]}</span><span>${sym(c.s)}</span>`;
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
    renderSeats();
    handZone.classList.toggle("turn", current === 0 && !over && giveTo === null);
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
      if (firstMove) setStatus(`Tu as le ${chip({ s: R.DIAMONDS, r: SEVEN })} : pose-le pour commencer !`);
      else if (playable(0).length) setStatus(pre + "À toi !");
      else setStatus(pre + `Aucune carte possible : demande une carte à ${name(R.previousPlayer(0, players))}.`);
    } else {
      setStatus(pre + `${name(current)} réfléchit…`);
      botTimer = setTimeout(botPlay, delay());
    }
  }

  function humanPlay(c) {
    if (current !== 0 || over || !R.canPlay(board, c, firstMove)) return;
    play(0, c);
    lastMsg = `Tu poses ${chip(c)}.`;
    nextTurn();
  }

  // Tu ne peux rien poser : le joueur qui te précède te donne une carte.
  function humanAsk() {
    if (current !== 0 || over || giveTo !== null || !R.canAsk(board, hands[0], firstMove)) return;
    const g = R.previousPlayer(0, players);
    const c = R.worstCard(board, hands[g]);
    R.giveCard(hands, g, 0, c);
    asked[0] = true;
    lastMsg = `${name(g)} te donne ${chip(c)}.`;
    afterGive(g);
  }

  // Un bot t'a demandé une carte : tu choisis celle que tu lui donnes.
  function humanGive(c) {
    if (giveTo === null || over) return;
    const p = giveTo;
    giveTo = null;
    R.giveCard(hands, 0, p, c);
    lastMsg = `Tu donnes ${chip(c)} à ${name(p)}.`;
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
      lastMsg = `${name(p)} pose ${chip(c)}.`;
    } else {
      asked[p] = true;
      const g = R.previousPlayer(p, players);
      if (g === 0) {
        giveTo = p;
        render();
        setStatus(`${name(p)} ne peut pas jouer et te demande une carte : touche celle que tu lui donnes.`);
        return;
      }
      R.giveCard(hands, g, p, R.worstCard(board, hands[g]));
      lastMsg = `${name(p)} ne peut pas jouer : ${name(g)} lui donne une carte.`;
      render();
      setStatus(lastMsg);
      botTimer = setTimeout(() => afterGive(g), delay() / 2);
      return;
    }
    render();
    setStatus(lastMsg);
    botTimer = setTimeout(nextTurn, delay() / 2);
  }

  function finish(p) {
    over = true;
    render();
    setStatus(p === 0
      ? "🎉 Bravo, tu as gagné !"
      : `${name(p)} a gagné. Tu avais encore ${plural(hands[0].length)}.`);
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

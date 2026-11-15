(() => {
  "use strict";

  const QUESTIONS = 5;
  const SHOW_MS = 3000;      // durée d'affichage du nombre
  const FEEDBACK_MS = 700;   // durée du ✓ / ✗ avant la question suivante

  const $ = (id) => document.getElementById(id);
  const btnNo = $("btn-no");
  const btnYes = $("btn-yes");
  const stage = $("stage");
  const timer = $("timer");
  const dots = $("dots");

  let numbers = [];
  let index = 0;
  let score = 0;
  let accepting = false;
  let hideTimeout = null;

  // 5 nombres distincts entre 0 et 99
  function pickNumbers(count) {
    const set = new Set();
    while (set.size < count) set.add(Math.floor(Math.random() * 100));
    return [...set];
  }

  function renderDots() {
    dots.innerHTML = "";
    for (let i = 0; i < QUESTIONS; i++) dots.appendChild(document.createElement("li"));
  }

  function setBars(enabled) {
    btnNo.disabled = !enabled;
    btnYes.disabled = !enabled;
  }

  function startTimer() {
    timer.style.transition = "none";
    timer.style.width = "100%";
    void timer.offsetWidth; // force le reflow pour relancer l'animation
    timer.style.transition = `width ${SHOW_MS}ms linear`;
    timer.style.width = "0";
  }

  function stopTimer() {
    timer.style.transition = "none";
    timer.style.width = "0";
  }

  function startRound() {
    numbers = pickNumbers(QUESTIONS);
    index = 0;
    score = 0;
    renderDots();
    showQuestion();
  }

  function showQuestion() {
    const n = numbers[index];
    dots.children[index].classList.add("current");
    stage.innerHTML = `<div class="number" id="number">${n}</div>`;
    startTimer();
    btnNo.classList.remove("pressed");
    btnYes.classList.remove("pressed");
    accepting = true;
    setBars(true);

    // Le nombre disparaît après 3 s, mais le joueur peut encore répondre.
    hideTimeout = setTimeout(() => {
      const el = $("number");
      if (el) { el.textContent = "?"; el.classList.add("hidden"); }
    }, SHOW_MS);
  }

  function answer(saysEven) {
    if (!accepting) return;
    accepting = false;
    clearTimeout(hideTimeout);
    stopTimer();
    setBars(false);

    const isEven = numbers[index] % 2 === 0;
    const correct = saysEven === isEven;
    if (correct) score++;

    const dot = dots.children[index];
    dot.classList.remove("current");
    dot.classList.add(correct ? "good" : "bad");
    stage.innerHTML = `<div class="feedback ${correct ? "good" : "bad"}">${correct ? "✓" : "✗"}</div>`;
    if (navigator.vibrate) navigator.vibrate(correct ? 30 : [60, 40, 60]);

    setTimeout(() => {
      index++;
      if (index < QUESTIONS) showQuestion();
      else showScore();
    }, FEEDBACK_MS);
  }

  function showScore() {
    stage.innerHTML = `
      <div class="score">
        <div class="score-value">${score} / ${QUESTIONS}</div>
        <div class="score-label">bonne${score > 1 ? "s" : ""} réponse${score > 1 ? "s" : ""}</div>
        <button class="start" id="btn-restart" type="button">Rejouer</button>
      </div>`;
    $("btn-restart").addEventListener("click", startRound);
  }

  // pointerdown = réaction immédiate au toucher (pas de délai de "click")
  function bind(btn, value) {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (btn.disabled) return;
      btn.classList.add("pressed");
      answer(value);
    });
    // Entrée / Espace sur une barre focalisée : click sans pointeur (detail === 0)
    btn.addEventListener("click", (e) => {
      if (e.detail === 0 && !btn.disabled) answer(value);
    });
    const release = () => btn.classList.remove("pressed");
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("pointerleave", release);
  }

  bind(btnNo, false);
  bind(btnYes, true);
  $("btn-start").addEventListener("click", startRound);

  // Clavier (pratique pour tester sur ordinateur) : ← = NON, → = OUI
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") answer(false);
    if (e.key === "ArrowRight") answer(true);
  });

  renderDots();
})();

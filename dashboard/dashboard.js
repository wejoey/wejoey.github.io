(function () {
  "use strict";

  var REPO = "wejoey/wejoey.github.io";
  var API = "https://api.github.com/repos/" + REPO;
  var GO = 1024 * 1024 * 1024;
  var MO = 1024 * 1024;
  var LIMITE_FICHIER = 100 * MO;
  var LIMITE_BUILDS = 10;

  function $(id) {
    return document.getElementById(id);
  }

  function taille(octets) {
    if (octets >= GO) return (octets / GO).toFixed(2).replace(".", ",") + " Go";
    if (octets >= MO) return (octets / MO).toFixed(1).replace(".", ",") + " Mo";
    if (octets >= 1024) return Math.round(octets / 1024) + " Ko";
    return octets + " o";
  }

  function pourcent(valeur, limite) {
    var p = (valeur / limite) * 100;
    if (p > 0 && p < 0.1) return "< 0,1 %";
    return p.toFixed(1).replace(".", ",") + " %";
  }

  function barre(id, valeur, limite) {
    var el = $(id);
    var ratio = Math.min(valeur / limite, 1);
    el.style.width = (ratio * 100).toFixed(2) + "%";
    el.className = ratio >= 0.9 ? "haut" : ratio >= 0.6 ? "moyen" : "";
    el.parentNode.title = pourcent(valeur, limite);
  }

  function lire(url) {
    return fetch(url, { headers: { Accept: "application/vnd.github+json" } }).then(function (r) {
      var reste = r.headers.get("X-RateLimit-Remaining");
      var reset = r.headers.get("X-RateLimit-Reset");
      if (reste !== null) {
        $("quota").textContent =
          reste + " requêtes restantes sur " + (r.headers.get("X-RateLimit-Limit") || "60") + " cette heure";
      }
      if (!r.ok) {
        if ((r.status === 403 || r.status === 429) && reste === "0") {
          var heure = new Date(Number(reset) * 1000).toLocaleTimeString("fr-CA", {
            hour: "2-digit",
            minute: "2-digit",
          });
          throw new Error("Quota de l'API GitHub atteint. Réessaie après " + heure + ".");
        }
        throw new Error("L'API GitHub a répondu " + r.status + ".");
      }
      return r.json();
    });
  }

  function erreur(message) {
    var el = $("erreur");
    el.textContent = message;
    el.hidden = false;
  }

  function afficherFichiers(fichiers) {
    var liste = $("fichiers");
    liste.innerHTML = "";
    fichiers.slice(0, 5).forEach(function (f) {
      var li = document.createElement("li");
      var nom = document.createElement("span");
      nom.className = "nom";
      nom.textContent = f.path;
      var t = document.createElement("span");
      t.className = "taille";
      t.textContent = " · " + taille(f.size) + " (" + pourcent(f.size, LIMITE_FICHIER) + ")";
      li.appendChild(nom);
      li.appendChild(t);
      liste.appendChild(li);
    });
  }

  function charger() {
    var bouton = $("rafraichir");
    bouton.disabled = true;
    $("erreur").hidden = true;

    lire(API)
      .then(function (repo) {
        var octetsRepo = repo.size * 1024; // l'API donne des Ko
        $("repo-val").textContent = taille(octetsRepo);
        barre("repo-barre", octetsRepo, GO);

        return Promise.all([
          lire(API + "/git/trees/" + encodeURIComponent(repo.default_branch) + "?recursive=1"),
          lire(API + "/actions/runs?per_page=100&branch=" + encodeURIComponent(repo.default_branch)),
        ]);
      })
      .then(function (res) {
        var arbre = res[0];
        var fichiers = arbre.tree.filter(function (x) {
          return x.type === "blob";
        });
        var total = fichiers.reduce(function (s, f) {
          return s + f.size;
        }, 0);
        $("site-val").textContent = taille(total) + (arbre.truncated ? "+" : "");
        $("site-nb").textContent = fichiers.length;
        barre("site-barre", total, GO);
        fichiers.sort(function (a, b) {
          return b.size - a.size;
        });
        afficherFichiers(fichiers);

        var runs = res[1].workflow_runs.filter(function (r) {
          return /pages/i.test(r.name) || /pages/i.test(r.path || "");
        });
        var maintenant = Date.now();
        var heure = runs.filter(function (r) {
          return maintenant - new Date(r.created_at).getTime() < 3600 * 1000;
        }).length;
        var jour = runs.filter(function (r) {
          return maintenant - new Date(r.created_at).getTime() < 24 * 3600 * 1000;
        }).length;
        $("deploy-val").textContent = heure;
        barre("deploy-barre", heure, LIMITE_BUILDS);
        var note = "Limite souple de 10 builds par heure. " + jour + " dans les dernières 24 h.";
        if (runs.length) {
          var dernier = new Date(runs[0].created_at);
          note +=
            " Dernier déploiement : " +
            dernier.toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" }) +
            (runs[0].conclusion === "success" ? " (réussi)." : " (" + (runs[0].conclusion || "en cours") + ").");
        }
        $("deploy-note").textContent = note;

        $("maj").textContent =
          "Mis à jour à " + new Date().toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) + ".";
      })
      .catch(function (e) {
        erreur(e.message || "Impossible de joindre l'API GitHub.");
      })
      .then(function () {
        bouton.disabled = false;
      });
  }

  $("rafraichir").addEventListener("click", charger);
  charger();
})();

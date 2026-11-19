# wejoey.github.io

Petits jeux mobiles en HTML/CSS/JS, sans dépendances.

- [Oui ou Non](https://wejoey.github.io/math/) (`math/`) : le nombre est-il pair ? 5 nombres, chacun affiché 3 secondes (réponse possible ensuite).
- [Globe-trotteur](https://wejoey.github.io/globe/) (`globe/`) : 8 villes et lieux à situer sur un globe 3D ; plus on est près, plus on marque. Contours des pays : Natural Earth (domaine public).
- [Le jeu des drapeaux](https://wejoey.github.io/drapeaux/) (`drapeaux/`) : 10 drapeaux, 6 choix, 7 secondes chacun.
- [Le 7 de carreau](https://wejoey.github.io/sept-de-carreau/) (`sept-de-carreau/`) : jeu de cartes (52 cartes) contre 1 à 5 bots. On part du 7♦ et on monte ou descend chaque couleur à partir des 7 ; l'As♦ va sous le 2 ou au-dessus du Roi, et les autres As suivent le même côté. Le carreau mène : pas de 8♠ avant le 8♦. Si on ne peut pas jouer, on demande une carte au joueur précédent.
- [Comète](https://wejoey.github.io/comete/) (`comete/`) : lance-pierre gravitationnel. Niveaux infinis générés puis résolus par un solveur, 3 étoiles sur la trajectoire parfaite.
- [Coup de circuit](https://wejoey.github.io/circuit/) (`circuit/`) : baseball, vu de derrière le marbre. Touche l'écran là où passe la balle, au bon moment, pour frapper. Bats les Ratons en 3 manches. Niveau Recrue (lancers plus lents, cercle d'aide) ou Pro.

## Tester en local

```bash
python3 -m http.server 8088
```

Puis ouvrir <http://localhost:8088>.

## Tests unitaires

Les règles du 7 de carreau sont dans `sept-de-carreau/rules.js` et testées avec Node (aucune dépendance) :

```bash
node --test sept-de-carreau/tests/*.test.js
```

La physique de Coup de circuit (lancers, contact, vol de la balle, défense, coureurs) est dans `circuit/physique.js` :

```bash
node --test circuit/tests/*.test.js
```

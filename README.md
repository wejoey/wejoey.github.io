# wejoey.github.io

Petits jeux mobiles en HTML/CSS/JS, sans dépendances.

- [Oui ou Non](https://wejoey.github.io/math/) (`math/`) : le nombre est-il pair ? 5 nombres, chacun affiché 3 secondes (réponse possible ensuite).
- [Le jeu des drapeaux](https://wejoey.github.io/drapeaux/) (`drapeaux/`) : 10 drapeaux, 6 choix, 7 secondes chacun.
- [Le 7 de carreau](https://wejoey.github.io/sept-de-carreau/) (`sept-de-carreau/`) : jeu de cartes (52 cartes) contre 1 à 5 bots. On part du 7♦ et on monte ou descend chaque couleur à partir des 7 ; l'As va sous le 2 ou au-dessus du Roi.

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

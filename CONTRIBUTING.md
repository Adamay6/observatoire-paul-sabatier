# Contribuer à l’observatoire

## Proposer une correction ou un document

Ouvrir une issue avec le dossier concerné, le passage contesté et une référence publique. Préciser ce que le document établit, sa date, l’auteur, la page ou la section et le périmètre. Pour une pièce à diffusion restreinte, décrire sa nature et les démarches de consultation possibles. Masquer les données personnelles inutiles à la vérification.

Pour une pull request, regrouper les modifications autour d’un dossier ou d’une même décision. Conserver les versions qui documentent deux périmètres différents. Expliquer dans la proposition les choix de niveau de preuve et de stade.

## Mettre à jour les données

1. Ajouter la notice au bon fichier dans `sources/`. Choisir un identifiant stable, unique, composé de minuscules ASCII, chiffres et traits d’union. Utiliser `date` pour la date de la pièce, `updated` pour une date de mise à jour affichée, et `consulted` pour la consultation. Quand la publication et la décision diffèrent, préciser l’autre date dans la notice.
2. Dans `data/`, ouvrir le dossier existant ou créer un identifiant d’événement. Référencer la notice dans `finding.refs` et dans les champs précis qu’elle étaye. Les nœuds utilisent `before`, `shared` ou `after`. Chaque lien exige ses propres références et une justification explicite dans la pièce.
3. Compléter la chronologie, `questions` et `revisions`. Laisser le champ comparatif absent quand la donnée manque. Le site affiche « Donnée indisponible ».
4. Actualiser `data/meta.json`, `FINDINGS.md`, `OPEN_QUESTIONS.md` et `CHANGELOG.md` quand le constat évolue. Les sources JSON font foi pour générer `SOURCES.md`.
5. Exécuter les vérifications avant la pull request.

```sh
npm run validate -- --write-sources
npm test
npm run build
```

Les vocabulaires et les champs pris en charge sont définis dans [`src/model.js`](src/model.js). Le validateur signale les doublons, références orphelines, liens manquants, dates incohérentes et écarts entre indicateurs et corpus. Relire également les pièces et les comparaisons comme indiqué dans la [méthodologie](METHODOLOGY.md).

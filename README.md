# Observatoire des formations de Paul-Sabatier

Enquête indépendante sur l’évolution de l’offre de formation de l’Université de Toulouse. Le premier corpus porte sur une sélection de dossiers de la Faculté sciences et ingénierie (FSI), avec un suivi distinct de la rentrée 2026–2027 et de l’offre des premiers et deuxièmes cycles soumise à l’accréditation 2027–2031.

L’application comprend un tableau de bord, un graphique comparatif des fermetures et ouvertures, un atlas des transformations, un explorateur, un comparateur avant/après, des fiches et une bibliothèque documentaire. Les indicateurs comptent des dossiers uniques.

Dans **Bilan**, choisissez une période, un département, un diplôme ou un stade, puis sélectionnez une barre pour ouvrir la liste des dossiers. Dans **Atlas** et **Dossiers**, les formations s’ouvrent en aperçu. Sur ordinateur, vous pouvez déplacer les fenêtres par leur titre, les repositionner avec la commande dédiée ou les réduire pour les rouvrir depuis la barre inférieure. Sur mobile, un panneau s’ouvre en bas de l’écran. La touche Échap ferme la fenêtre active.

## Lancer l’application

Utiliser Node.js 22 ou supérieur dans le dossier du projet. L’application et les scripts fonctionnent sans installation de paquets.
Dans PowerShell, `npm.cmd` équivaut à `npm` si la politique locale bloque les scripts PowerShell.

```sh
npm run validate
npm test
npm run dev
```

Ouvrir [l’aperçu local](http://127.0.0.1:4173/). Le serveur reconstruit les données au démarrage. Après une modification, relancer le serveur ou exécuter `npm run build` dans un autre terminal et actualiser la page.

```sh
npm run build
npm run preview
```

`dist/` est un site web statique. Les chemins relatifs et la navigation par fragments permettent de le servir à la racine ou dans le sous-répertoire d’un dépôt GitHub Pages.

## Parcourir et prolonger l’enquête

| Entrée | Contenu |
| --- | --- |
| [Résultats](FINDINGS.md) | Conclusions de l’enquête et références. |
| [Enquête approfondie](research/enquete-approfondie.md) | Lecture des annexes 2027–2031, admissions de 2024 et 2025, cohortes et budget. |
| [Registre documentaire](SOURCES.md) | Notices, repères précis et accès aux documents originaux. |
| [Questions ouvertes](OPEN_QUESTIONS.md) | Pièces à retrouver, incohérences apparentes et prochaines comparaisons. |
| [Méthodologie](METHODOLOGY.md) | Fondements des niveaux de preuve, nomenclature et règles de comptage. |
| [Contribution](CONTRIBUTING.md) | Corriger un dossier, archiver une source ou proposer un nouveau cas. |
| [Historique](CHANGELOG.md) | Versions du site et du corpus. |
| [`research/`](research) | Dossiers de vérification, par champ disciplinaire et par décision. |
| [`data/`](data) et [`sources/`](sources) | Dossiers et notices JSON versionnés, éditables séparément. |
| [`src/`](src), [`scripts/`](scripts), [`tests/`](tests) | Application, traitement, validation et tests. |

Le rendu natif dans le navigateur et le SVG pour les relations limitent la maintenance et permettent une exécution locale sans dépendance téléchargée. Le même corpus alimente toutes les vues. Les choix d’interface et les variantes étudiées sont consignés dans la [note de conception](methodology/interface.md).

## Publier sur GitHub Pages

Le dépôt est prêt pour GitHub Actions. Si vous partez du fichier `observatoire-paul-sabatier.bundle`, exécutez d’abord `git clone observatoire-paul-sabatier.bundle observatoire-paul-sabatier`, puis placez-vous dans le dossier cloné. Le clone peut conserver le fichier bundle comme remote `origin`. Supprimez cette entrée locale avec `git remote remove origin` avant de créer le dépôt distant.

Avec [GitHub CLI](https://cli.github.com/) et un dépôt de ce nom encore disponible sur votre compte, exécutez ces commandes depuis la copie de travail. `--public` publie le code et le corpus dans un dépôt accessible à tous.

```sh
gh auth login --hostname github.com --web --git-protocol https --scopes workflow
gh auth setup-git
gh repo create observatoire-paul-sabatier --public --source=. --remote=origin --push
gh api --method POST 'repos/{owner}/{repo}/pages' -f build_type=workflow
gh workflow run pages.yml --ref main
gh run list --workflow pages.yml --limit 3
gh api 'repos/{owner}/{repo}/pages' --jq .html_url
```

Si Pages est déjà activé, sélectionner **GitHub Actions** dans **Settings → Pages → Build and deployment → Source** puis relancer le workflow `Vérifier et publier`. L’URL retournée par GitHub est l’adresse de publication. Pour les prochains changements, un push sur `main` suffit. [Documentation GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

Le périmètre est détaillé dans les [résultats](FINDINGS.md). Les notices renvoient aux documents originaux et précisent les conditions de conservation dans le [registre](SOURCES.md).

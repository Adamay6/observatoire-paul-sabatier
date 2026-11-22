# Conception de l’interface

La palette gris sauge et encre réduit la luminosité du fond. Le vert indique une ouverture dans le bilan, tandis qu’un ton terre distingue les fermetures. Les intitulés, valeurs, hachures et commandes conservent le sens du graphique indépendamment de la couleur.

Le bilan répartit les dossiers confirmés sur deux séries à la même échelle. Les fermetures se lisent à gauche et les créations à droite. La partie pleine indique le stade appliqué et la partie hachurée les autres stades. Une barre ouvre la liste des dossiers correspondants. Les rattachements multiples restent regroupés quand on affiche les départements. Le graphique compte les événements enregistrés dans le corpus, dont l’ouverture de la mention Professorat des écoles enregistrée dans son dossier de transition. Les échéances par niveau peuvent se lire dans les dossiers.

Dans l’atlas, les boutons des formations donnent accès aux aperçus et aux preuves. Les courbes SVG représentent des relations et n’encodent aucune quantité.

Les aperçus sont des éléments HTML `dialog`. Sur ordinateur, `show()` laisse la page et les autres fenêtres utilisables. Le titre sert de poignée de déplacement avec Pointer Events et une commande propose des positions prédéfinies. Sur mobile, `showModal()` fournit un panneau avec gestion native du focus. [HTML Standard](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element) · [Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) · [Alternative au glisser-déposer](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)

Les transitions de navigation et d’ouverture s’appuient sur View Transitions et `@starting-style` lorsque le navigateur les prend en charge. Elles sont désactivées si la réduction des animations est demandée. [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition) · [CSS `@starting-style`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40starting-style)

[Floating UI](https://floating-ui.com/docs/computePosition) fournit surtout le positionnement ancré utile aux menus et infobulles. [Interact.js](https://interactjs.io/docs/restriction/) fournit des contraintes pour le glisser-déposer. Les fenêtres, leurs positions et leur accès au clavier sont gérés par les API du navigateur et le code de l’observatoire. L’application garde ainsi son déploiement statique et son lancement local sans installation de paquets.

import { renderAtlas } from './atlas.js';
import { renderBalance } from './balance.js';
import { createWorkspace } from './workspace.js';
import {
  periods, degrees, types, proofs, stages, motives, kinds, fields, primaryKinds,
  formatDate, normalize, filterDossiers, metrics, counts, dossierRefs,
} from './model.js';
import { h, optionList, proofLabel, sourceRefs, caseHref, typeLabels, item } from './view.js';

const main = document.querySelector('main');
const header = document.querySelector('header');
const footer = document.querySelector('footer');
const workspaceHost = document.querySelector('#workspace');
const nav = { tableau: 'Vue d’ensemble', bilan: 'Bilan', atlas: 'Atlas', explorer: 'Dossiers', comparer: 'Comparer', sources: 'Sources', methode: 'Méthode' };
let catalog;
let byId;
let bySource;
let workspace;

function brand() {
  return '<a class="brand" href="#tableau"><img width="40" height="40" src="./src/signet.svg" alt=""><span><strong>Observatoire des formations</strong><small>PAUL-SABATIER · TOULOUSE</small></span></a>';
}

function layout(route) {
  const active = route === 'dossier' ? 'explorer' : route;
  header.innerHTML = `<div class="frame header-inner">${brand()}<nav aria-label="Navigation principale">${Object.entries(nav)
    .map(([key, label]) => `<a href="#${key}"${key === active ? ' aria-current="page"' : ''}>${h(label)}</a>`).join('')}</nav></div>`;
  footer.innerHTML = `<div class="frame footer-inner"><div>${brand()}<p>Enquête indépendante sur l’offre de formation de la FSI.</p></div>
    <div class="footer-meta"><a href="#methode">Méthode et critères de preuve</a><span>Mise à jour le ${formatDate(catalog.meta.updated)}</span></div></div>`;
}

function pageHead(label, title, description) {
  return `<div class="page-head"><p class="eyebrow">${h(label)}</p><h1>${h(title)}</h1><p>${h(description)}</p></div>`;
}

function panelButton(kind, entry, text, title = text, className = 'button outline') {
  return `<button type="button" class="${h(className)}" data-panel="${h(kind)}" data-entry="${h(entry)}" aria-haspopup="dialog" aria-label="${h(title)}">${h(text)}</button>`;
}

function openPanel(options) {
  workspace ??= createWorkspace(workspaceHost);
  workspace.open(options);
}

function inspectDossier(d, trigger, node) {
  const relations = node ? d.links?.filter(link => [link.from, link.to].includes(node.id)) || [] : [];
  const trajectory = relations.map(link => {
    const from = d.nodes.find(candidate => candidate.id === link.from);
    const to = d.nodes.find(candidate => candidate.id === link.to);
    return `<li><strong>${h(types[link.type])}</strong><span>${h(from.label)} → ${h(to.label)}</span>${sourceRefs(link.refs, bySource)}</li>`;
  }).join('');
  openPanel({ id: `dossier-${d.id}`, title: d.title, kind: 'Dossier · ' + degrees[d.degree], dockLabel: 'Dossier', trigger,
    content: `<div class="panel-meta">${proofLabel(d.proof)}<span>${h(periods[d.period])}</span><span>${h(stages[d.stage])}</span></div>
    ${node ? `<p class="panel-node"><strong>${h(node.label)}</strong> ${sourceRefs(node.refs, bySource)}</p>` : ''}
    <p class="panel-finding">${item(d.finding, bySource)}</p>
    ${trajectory ? `<section class="panel-section"><h3>Relations documentées</h3><ul class="atlas-relations">${trajectory}</ul></section>` : ''}
    ${d.questions.length ? `<details class="panel-questions"><summary>Ce qui reste à établir</summary><ul>${d.questions.map(question => `<li>${h(question)}</li>`).join('')}</ul></details>` : ''}
    <div class="panel-links">${panelButton('compare', d.id, 'Comparer avant / après', `Comparer ${d.title} avant et après`, 'button solid')}<a class="text-link" data-workspace-full href="${caseHref(d.id)}">Lire le dossier complet</a></div>`,
  });
}

function handlePanelClick(event) {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  if (event.target.closest('[data-workspace-full]')) workspace?.closeAll();
  const trigger = event.target.closest('[data-panel]');
  if (!trigger) return;
  const id = trigger.dataset.entry;
  const kind = trigger.dataset.panel;
  if (kind === 'source' && bySource.has(id)) {
    event.preventDefault();
    const s = bySource.get(id);
    openPanel({ id: `source-${id}`, title: s.title, kind: `${s.label} · ${kinds[s.kind]}`, dockLabel: 'Source', trigger,
      content: `${sourceDetails(s)}<div class="panel-links"><a class="button solid" href="${h(s.url)}" target="_blank" rel="noopener noreferrer">Ouvrir l’original</a>
      <a class="text-link" data-workspace-full href="#sources/${h(id)}">Voir dans la bibliothèque</a></div>`,
    });
  } else if (kind === 'compare' && byId.has(id)) {
    event.preventDefault();
    const d = byId.get(id);
    openPanel({ id: `compare-${id}`, title: d.title, kind: 'Comparaison avant / après', dockLabel: 'Comparatif', wide: true, trigger,
      content: `<div class="panel-meta">${proofLabel(d.proof)}<span>${h(periods[d.period])}</span></div>${comparison(d)}
        <div class="panel-links"><a class="text-link" data-workspace-full href="#comparer?id=${encodeURIComponent(id)}">Ouvrir la page du comparateur</a></div>`,
    });
  } else if (kind === 'dossier' && byId.has(id)) {
    event.preventDefault();
    inspectDossier(byId.get(id), trigger);
  }
}

function dashboard() {
  const grouped = Object.entries(periods).map(([period, label]) => ({ period, label, dossiers: catalog.dossiers.filter(d => d.period === period) }))
    .filter(group => group.dossiers.length);
  const latest = catalog.dossiers.filter(d => d.proof === 'confirme' && ['2026-27', '2027-31'].includes(d.period)).slice(0, 5);
  main.innerHTML = `<section class="hero" aria-labelledby="hero-title"><div class="frame hero-grid">
    <div class="hero-copy"><p class="eyebrow"><i></i> Enquête indépendante · Université de Toulouse</p>
    <h1 id="hero-title">Les formations<br>en mouvement<span>.</span></h1>
    <p>Suivez les ouvertures, les fermetures et les transformations à la Faculté sciences et ingénierie, des décisions aux sources.</p>
    <div class="actions"><a class="button hero-primary" href="#bilan">Comparer les ouvertures et fermetures</a><a class="button inverse" href="#atlas">Explorer l’atlas</a></div></div>
    <div class="hero-index" aria-label="Dossiers par période">
      <div class="index-head"><span>PÉRIODES DOCUMENTÉES</span><span>${catalog.dossiers.length} DOSSIERS</span></div>
      ${grouped.map(group => `<a class="index-row" href="#atlas?period=${group.period}"><span>${h(group.label)}</span>
        <span class="index-dots" aria-hidden="true">${group.dossiers.map((d, index) => index < 18 ? `<i class="dot-${h(d.proof)}"></i>` : '').join('')}</span>
        <b>${group.dossiers.length}</b></a>`).join('')}
    </div>
  </div></section>
  <div class="frame dashboard">
    <div class="scope-line"><span><i></i> ${h(catalog.meta.scope)}</span><span>Actualisé le ${formatDate(catalog.meta.updated)}</span><a href="#sources">${catalog.sources.length} références documentaires</a></div>
    <section aria-labelledby="dashboard-balance-title"><div class="section-title"><div><p class="eyebrow">Évolution de l’offre</p><h2 id="dashboard-balance-title">Fermetures et ouvertures</h2></div><a class="text-link" href="#bilan">Ouvrir le bilan</a></div>
    <div id="dashboard-balance"></div></section>
    <section aria-labelledby="metrics-title" class="metric-section"><div class="section-title"><div><p class="eyebrow">État de l’enquête</p><h2 id="metrics-title">Ce que le corpus établit</h2></div><label class="metric-period">Période des indicateurs<select id="metric-period">${optionList(Object.fromEntries(grouped.map(group => [group.period, group.label])), '', 'Tout le corpus')}</select></label></div>
      <p class="metric-note">Les chiffres décrivent les dossiers recensés, y compris les décisions adoptées pour une rentrée future. <a href="#methode">Comment lire ces chiffres</a></p><div class="metrics" id="metrics-values" aria-live="polite"></div>
    </section>
    <section class="dashboard-atlas" aria-labelledby="dashboard-atlas-title"><div class="section-title"><div><p class="eyebrow">Cartographie</p><h2 id="dashboard-atlas-title">Des trajectoires aux preuves</h2></div><a class="text-link" href="#atlas">Ouvrir l’atlas complet</a></div>
      <div id="atlas-preview"></div></section>
    <section class="dashboard-cases" aria-labelledby="dashboard-cases-title"><div class="section-title"><div><p class="eyebrow">Registre des formations</p><h2 id="dashboard-cases-title">Dossiers documentés</h2></div><a class="text-link" href="#explorer">Tous les dossiers</a></div>
    ${caseRows(latest)}</section>
  </div>`;
  const metricPeriod = document.querySelector('#metric-period');
  const values = document.querySelector('#metrics-values');
  function updateMetrics() {
    const tally = counts(filterDossiers(catalog.dossiers, { period: metricPeriod.value }));
    const suffix = metricPeriod.value ? `&amp;period=${encodeURIComponent(metricPeriod.value)}` : '';
    values.innerHTML = metrics.map(metric => `<a class="metric ${metric.tone}" href="#explorer?metric=${metric.id}${suffix}"><strong>${String(tally[metric.id]).padStart(2, '0')}</strong><span>${h(metric.title)}</span></a>`).join('');
  }
  metricPeriod.addEventListener('change', updateMetrics);
  updateMetrics();
  renderBalance(document.querySelector('#dashboard-balance'), catalog.dossiers, inspectDossier);
  const preview = catalog.dossiers.filter(d => d.links?.length && d.period === '2027-31');
  renderAtlas(document.querySelector('#atlas-preview'), (preview.length ? preview : catalog.dossiers.filter(d => d.nodes?.length)).slice(0, 2), inspectDossier);
}

function balance() {
  main.innerHTML = `<div class="frame inner-page">${pageHead('Évolution de l’offre', 'Fermetures et ouvertures', 'Filtrez les dossiers de la FSI, puis sélectionnez une barre pour voir les formations qui la composent.')}
    <div id="balance-view"></div></div>`;
  renderBalance(document.querySelector('#balance-view'), catalog.dossiers, inspectDossier);
}

function caseRows(dossiers) {
  if (!dossiers.length) return '<p class="empty">Aucun dossier ne correspond aux critères sélectionnés.</p>';
  return `<ul class="case-list">${dossiers.map(d => `<li class="case-row"><span class="case-code">${h(d.short)}</span>
    <span class="case-name"><a href="${caseHref(d.id)}">${h(d.title)}</a><small>${h(degrees[d.degree])} · ${h(d.departments.join(' / ') || 'Département à préciser')}</small></span>
    <span class="case-period">${h(periods[d.period])}</span><span class="case-state">${proofLabel(d.proof)}</span>
    ${panelButton('dossier', d.id, 'Aperçu', `Aperçu de ${d.title}`, 'button peek')}</li>`).join('')}</ul>`;
}

function atlas(params) {
  main.innerHTML = `<div class="frame inner-page">${pageHead('Cartographie documentaire', 'Atlas des transformations', 'Sélectionnez une formation pour examiner les sources. Chaque trait correspond à une relation dont le dossier précise la portée.')}
    <div class="control-bar"><label>Période<select id="atlas-period">${optionList(periods, params.get('period'), 'Toutes les périodes')}</select></label>
    <label>Type de changement<select id="atlas-type">${optionList(types, params.get('type'), 'Tous les types')}</select></label></div>
    <div id="atlas-live" class="sr-only" role="status"></div><div id="atlas-view"></div></div>`;
  const plot = document.querySelector('#atlas-view');
  const period = document.querySelector('#atlas-period');
  const type = document.querySelector('#atlas-type');
  function update() {
    const results = filterDossiers(catalog.dossiers, { period: period.value, type: type.value });
    const graphable = results.filter(d => d.nodes?.length);
    const unplotted = results.filter(d => !d.nodes?.length);
    renderAtlas(plot, graphable, inspectDossier);
    if (unplotted.length) plot.insertAdjacentHTML('beforeend', `<section class="unplotted"><h2>Dossiers sans trajectoire cartographiable</h2>${caseRows(unplotted)}</section>`);
    document.querySelector('#atlas-live').textContent = `${graphable.length} dossiers cartographiés, ${unplotted.length} autres dossiers.`;
  }
  period.addEventListener('change', update);
  type.addEventListener('change', update);
  update();
}

function explorer(params) {
  const departments = Object.fromEntries([...new Set(catalog.dossiers.flatMap(d => d.departments))]
    .sort((a, b) => a.localeCompare(b, 'fr')).map(department => [department, department]));
  const filters = [
    ['department', 'Département', departments, 'Tous les départements'], ['degree', 'Diplôme', degrees, 'Tous les diplômes'],
    ['period', 'Période', periods, 'Toutes les périodes'], ['type', 'Type de transformation', types, 'Tous les types'],
    ['motive', 'Motivation', { budget: motives.budget, 'hors-budget': 'Au moins un motif hors budget', inconnu: 'Motif indéterminé',
      ...Object.fromEntries(Object.entries(motives).filter(([key]) => key !== 'budget')) }, 'Tous les motifs'],
    ['proof', 'Niveau de preuve', proofs, 'Tous les niveaux'], ['stage', 'État de la décision', stages, 'Tous les états'],
    ['metric', 'Indicateur de l’enquête', Object.fromEntries(metrics.map(metric => [metric.id, metric.title])), 'Tous les dossiers'],
  ];
  main.innerHTML = `<div class="frame inner-page">${pageHead('Registre des formations', 'Explorer les dossiers', 'Interrogez le corpus par formation, période, changement ou niveau de preuve.')}
    <form id="filter-form" class="filter-box" role="search" aria-label="Filtrer les dossiers"><div class="search-row"><label for="case-query">Nom ou sigle de formation</label>
    <input id="case-query" name="q" type="search" value="${h(params.get('q') || '')}" placeholder="Ex. SECIL, CoSyA ou Recherche opérationnelle"><button type="reset" class="button outline">Réinitialiser les filtres</button></div>
    <div class="filters">${filters.map(([name, label, values, empty]) => `<label>${label}<select name="${name}">${optionList(values, params.get(name), empty)}</select></label>`).join('')}</div></form>
    <p id="filter-count" class="result-count" role="status"></p><div id="case-results"></div></div>`;
  const form = document.querySelector('#filter-form');
  function update() {
    const options = Object.fromEntries(new FormData(form));
    const results = filterDossiers(catalog.dossiers, options);
    document.querySelector('#filter-count').textContent = `${results.length} dossier${results.length === 1 ? '' : 's'} sur ${catalog.dossiers.length}`;
    document.querySelector('#case-results').innerHTML = caseRows(results);
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', update);
  form.addEventListener('reset', event => {
    event.preventDefault();
    for (const control of form.querySelectorAll('input, select')) control.value = '';
    update();
  });
  update();
}

function comparison(dossier) {
  const cells = Object.entries(fields).map(([key, label]) => `<tr><th scope="row">${h(label)}</th><td>${item(dossier.before?.[key], bySource)}</td><td>${item(dossier.after?.[key], bySource)}</td></tr>`);
  const documentedMotives = dossier.motives?.length ? dossier.motives.map(motive => `<p>${h(motives[motive.type])} · ${item(motive, bySource)}</p>`).join('') : '<span class="missing">Donnée indisponible</span>';
  return `<div class="comparison-wrap" role="region" aria-label="Tableau comparatif" tabindex="0"><table class="comparison"><caption class="sr-only">Comparaison avant et après · ${h(dossier.title)}</caption>
    <thead><tr><th scope="col">Critère</th><th scope="col">Avant</th><th scope="col">Après / évolution documentée</th></tr></thead>
    <tbody>${cells.join('')}<tr><th scope="row">Motifs documentés</th><td colspan="2">${documentedMotives}</td></tr></tbody></table></div>`;
}

function compare(params) {
  const selected = byId.has(params.get('id')) ? params.get('id') : '';
  const choices = Object.fromEntries(catalog.dossiers.map(d => [d.id, `${d.short} · ${d.title}`]));
  main.innerHTML = `<div class="frame inner-page">${pageHead('Comparaison des maquettes et de l’offre', 'Comparer avant et après', 'Les valeurs proviennent des documents rattachés à chaque cellule. Les données manquantes restent visibles.')}
    <div class="control-bar"><label>Formation ou dossier<select id="compare-case">${optionList(choices, selected, 'Sélectionner une formation')}</select></label></div>
    <div id="compare-view"></div></div>`;
  const picker = document.querySelector('#compare-case');
  const view = document.querySelector('#compare-view');
  function update() {
    const dossier = byId.get(picker.value);
    view.innerHTML = dossier ? `<div class="compare-heading"><h2>${h(dossier.title)}</h2>${proofLabel(dossier.proof)}<a class="text-link" href="${caseHref(dossier.id)}">Lire le dossier</a></div>
      <p class="compare-summary">${item(dossier.finding, bySource)}</p>${comparison(dossier)}` : '<p class="empty">Sélectionnez un dossier pour afficher les données comparables.</p>';
  }
  picker.addEventListener('change', () => {
    const suffix = picker.value ? `?id=${encodeURIComponent(picker.value)}` : '';
    history.replaceState(null, '', `#comparer${suffix}`);
    update();
  });
  update();
}

function dossier(d) {
  const sourceIds = dossierRefs(d);
  const timeline = [...(d.history || [])].sort((a, b) => a.date.localeCompare(b.date));
  main.innerHTML = `<div class="frame inner-page dossier"><a class="back-link" href="#explorer">Tous les dossiers</a>
    ${pageHead(`${degrees[d.degree]} · ${d.departments.join(' / ') || 'Département à préciser'}`, d.title, periods[d.period])}
    <div class="dossier-flags">${proofLabel(d.proof)}<span>Décision · ${h(stages[d.stage])}</span><span>${typeLabels(d.types)}</span></div>
    <div class="dossier-grid"><div>
    <section class="dossier-finding"><h2>Situation documentée</h2><p>${item(d.finding, bySource)}</p></section>
    <section><div class="section-title"><h2>Offre et enseignements</h2>${panelButton('compare', d.id, 'Comparatif flottant')}</div>${comparison(d)}</section>
    <section><h2>Conséquences documentées</h2>${d.effects?.length ? `<ul class="evidence-list">${d.effects.map(effect => `<li>${item(effect, bySource)}</li>`).join('')}</ul>` : '<p class="missing">Donnée indisponible</p>'}</section>
    <section><h2>Historique</h2>${timeline.length ? `<ol class="timeline">${timeline.map(entry => `<li><time datetime="${h(entry.date)}">${formatDate(entry.date)}</time><p>${item(entry, bySource)}</p></li>`).join('')}</ol>` : '<p class="missing">Donnée indisponible</p>'}</section>
    </div><aside aria-label="Incertitudes et références">
    <section class="side-panel"><h2>Ce qui reste à établir</h2><ul>${d.questions.map(question => `<li>${h(question)}</li>`).join('')}</ul></section>
    <section class="side-panel"><h2>Références du dossier</h2><ol class="source-side">${sourceIds.map(id => bySource.get(id)).map(s => `<li><span>${h(kinds[s.kind])}</span><a href="#sources/${h(s.id)}">${h(s.title)}</a><small>${h(s.locator)}</small></li>`).join('')}</ol></section>
    <section class="side-panel"><h2>Révisions de l’enquête</h2><ol class="timeline">${(d.revisions || [{ date: catalog.meta.updated, text: 'Dossier enregistré dans la première édition du corpus.' }]).map(r => `<li><time datetime="${h(r.date)}">${formatDate(r.date)}</time><p>${h(r.text)}</p></li>`).join('')}</ol></section>
    </aside></div></div>`;
}

function sourceDetails(s) {
  return `<p class="source-owner">${h(s.publisher)} · ${formatDate(s.date)}${s.updated ? ` · Mise à jour le ${formatDate(s.updated)}` : ''}</p>
    <p class="locator"><strong>Repère</strong> ${h(s.locator)}</p><p>${h(s.note)}</p>
    ${s.access ? `<p>${h(s.access)}</p>` : ''}<small>Consulté le ${formatDate(s.consulted)} · ${h(s.rights || 'Référence et lien vers l’original')}</small>`;
}

function sourceCard(s, current) {
  return `<article class="source-card${s.id === current ? ' selected-source' : ''}" id="ref-${h(s.id)}" tabindex="-1">
    <div class="source-meta"><span>${h(s.label)} · ${h(kinds[s.kind])}</span><span>${primaryKinds.has(s.kind) ? 'Primaire' : 'Complémentaire'}</span></div>
    <h2><a href="${h(s.url)}" target="_blank" rel="noopener noreferrer" aria-label="${h(s.title)} (nouvel onglet)">${h(s.title)}</a></h2>
    ${sourceDetails(s)}<div class="source-actions">${panelButton('source', s.id, 'Aperçu', `Aperçu de la source ${s.title}`, 'button peek')}</div></article>`;
}

function library(id) {
  main.innerHTML = `<div class="frame inner-page">${pageHead('Bibliothèque documentaire', 'Les sources de l’enquête', 'Retrouvez les décisions, fiches et documents complémentaires avec un repère pour vérifier les passages utilisés.')}
    <div class="control-bar library-controls"><label>Rechercher une source<input id="source-query" type="search" placeholder="Titre, institution ou référence"></label>
    <label>Nature du document<select id="source-kind">${optionList(kinds, '', 'Toutes les natures')}</select></label></div>
    <p id="source-count" class="result-count" role="status"></p><div id="source-results" class="source-grid"></div></div>`;
  function update() {
    const words = normalize(document.querySelector('#source-query').value).split(/\s+/).filter(Boolean);
    const kind = document.querySelector('#source-kind').value;
    const results = catalog.sources.filter(s => (!kind || s.kind === kind) && words.every(word =>
      normalize(`${s.id} ${s.label} ${s.title} ${s.publisher} ${s.locator}`).includes(word)));
    document.querySelector('#source-count').textContent = `${results.length} référence${results.length === 1 ? '' : 's'}`;
    document.querySelector('#source-results').innerHTML = results.length ? results.map(s => sourceCard(s, id)).join('') : '<p class="empty">Aucune source ne correspond à cette recherche.</p>';
  }
  document.querySelector('#source-query').addEventListener('input', update);
  document.querySelector('#source-kind').addEventListener('change', update);
  update();
  if (bySource.has(id)) {
    const chosen = document.getElementById(`ref-${id}`);
    chosen.focus({ preventScroll: true });
    chosen.scrollIntoView({ block: 'start' });
  }
}

function methodology() {
  const explanations = ['La transformation ou l’événement est décrit explicitement par une source primaire.',
    'Une partie du changement est établie. Sa portée exacte reste ouverte.',
    'Les indices justifient une vérification documentaire.', 'Des sources fiables sont incompatibles sur le même périmètre.',
    'Les documents disponibles laissent la question sans réponse.'];
  main.innerHTML = `<div class="frame inner-page methodology">${pageHead('Protocole de l’enquête', 'Comment lire l’observatoire', 'Le périmètre initial couvre les dossiers sélectionnés de la Faculté sciences et ingénierie.')}
    <div class="method-grid"><section><h2>Périodes et décisions</h2><p>La rentrée 2026–2027 est suivie séparément de l’offre des 1er et 2e cycles soumise pour 2027–2031. Pour l’École des Docteurs, les actes identifiés portent sur 2027–2032.</p>
      <p>Le statut « adoptée » décrit une décision interne documentée. L’accréditation ministérielle et l’application effective font l’objet de vérifications distinctes.</p>
      ${sourceRefs(['ca-2026-128', 'cac-2026-24', 'code-education-l613-1'].filter(id => bySource.has(id)), bySource)}</section>
    <section><h2>Indicateurs</h2><p>Les compteurs portent sur les dossiers du corpus. Un parcours rattaché à plusieurs mentions conserve un identifiant unique. Un dossier peut alimenter plusieurs catégories si elles sont étayées.</p>
      <p>Le total des fermetures compte les fermetures confirmées à la portée précisée dans chaque dossier. Les cas à approfondir regroupent les dossiers dont la conclusion principale a un autre niveau de preuve.</p></section>
    <section><h2>Échelle de preuve</h2><dl>${Object.entries(proofs).map(([key, label], i) => `<dt>${h(label)}</dt><dd>${explanations[i]}</dd>`).join('')}</dl></section>
    <section><h2>Motifs et relations</h2><p>Un lien de remplacement, de fusion, de transfert ou de mutualisation exige un passage qui établit la relation. Les écarts entre deux listes servent de pistes. Une motivation est propre au dossier seulement si une source la rattache explicitement au changement.</p>
      <p>Un motif indéterminé reflète les limites du corpus. Les sources étudiantes et la presse éclairent les positions exprimées et orientent les vérifications.</p></section></div></div>`;
}

function navigate({ focus = true } = {}) {
  const [path, query] = (location.hash.slice(1) || 'tableau').split('?', 2);
  if (path === 'contenu') return;
  const [route, id] = path.split('/', 2);
  const params = new URLSearchParams(query);
  layout(route);
  document.title = `${nav[route] || byId.get(id)?.short || 'Dossier'} · Observatoire des formations`;
  if (route === 'tableau') dashboard();
  else if (route === 'bilan') balance();
  else if (route === 'atlas') atlas(params);
  else if (route === 'explorer') explorer(params);
  else if (route === 'comparer') compare(params);
  else if (route === 'sources') library(id);
  else if (route === 'methode') methodology();
  else if (route === 'dossier' && byId.has(id)) dossier(byId.get(id));
  else main.innerHTML = `<div class="frame inner-page">${pageHead('Navigation', 'Page introuvable', 'Vérifiez l’adresse ou choisissez une section de l’observatoire.')}<a class="button outline" href="#tableau">Revenir à la vue d’ensemble</a></div>`;
  if (route === 'sources' && bySource.has(id)) return;
  if (focus) main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function followHash() {
  if (workspace && window.matchMedia('(max-width: 760px)').matches) workspace.closeAll();
  if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.startViewTransition(() => navigate());
  } else {
    navigate();
  }
}

try {
  const response = await fetch(new URL('../catalog.json', import.meta.url));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  catalog = await response.json();
  byId = new Map(catalog.dossiers.map(d => [d.id, d]));
  bySource = new Map(catalog.sources.map((s, index) => {
    s.label = `S${String(index + 1).padStart(2, '0')}`;
    return [s.id, s];
  }));
  document.querySelector('.skip').addEventListener('click', event => {
    event.preventDefault();
    main.focus();
    main.scrollIntoView();
  });
  main.addEventListener('click', handlePanelClick);
  workspaceHost.addEventListener('click', handlePanelClick);
  window.addEventListener('hashchange', followHash);
  navigate({ focus: false });
} catch (error) {
  console.error(error);
  main.innerHTML = `<div class="frame inner-page">${pageHead('Registre documentaire', 'Chargement impossible', 'Rechargez la page. En local, utilisez le serveur fourni avec le projet.')}</div>`;
}

import { periods, stages, types } from './model.js';
import { caseHref, h, item, proofLabel, sourceRefs, typeLabels } from './view.js';

const columns = {
  before: { label: 'Avant', x: 330, from: 330, to: 0 },
  shared: { label: 'En commun', x: 500, from: 622, to: 378 },
  after: { label: 'Après', x: 670, from: 1000, to: 670 },
};
const gap = 64;

function lane(dossier) {
  const nodes = dossier.nodes || [];
  const links = dossier.links || [];
  const groups = Object.keys(columns).map(side => [side, nodes.filter(node => node.side === side)]);
  const height = Math.max(...groups.map(([, nodes]) => nodes.length), 1) * gap;
  const points = new Map(groups.flatMap(([, nodes]) => nodes.map((node, index) => [node.id, {
    ...node, y: height / 2 + (index - (nodes.length - 1) / 2) * gap,
  }])));
  const paths = links.map(link => {
    const from = points.get(link.from);
    const to = points.get(link.to);
    const start = columns[from.side].from;
    const end = columns[to.side].to;
    const mid = (start + end) / 2;
    return `<path class="edge edge-${h(link.type)}" d="M ${start} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${end} ${to.y}"/>`;
  }).join('');
  const state = dossier.types.includes('fermeture') ? ' Fermeture documentée.' : '';
  return `<article class="lane" aria-label="${h(dossier.title)}"><div class="lane-heading"><div><a href="${caseHref(dossier.id)}">${h(dossier.short)}</a><span>${h(periods[dossier.period])}</span></div><p>${typeLabels(dossier.types)} · ${h(stages[dossier.stage])}</p></div>
    <div class="lane-plot" style="--plot-height:${height}px">
      ${paths ? `<svg class="lane-edges" viewBox="0 0 1000 ${height}" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>` : ''}
      ${[...points.values()].map(node => `<button type="button" class="node node-${node.side}${state ? ' node-closure' : ''}"
        style="--node-y:${node.y}px" data-case="${h(dossier.id)}" data-node="${h(node.id)}"
        title="${h(node.label)}" aria-label="${h(`${node.label} · ${columns[node.side].label}.${state}`)}" aria-pressed="false"><span>${h(node.label)}</span></button>`).join('')}
    </div><div class="lane-selection" hidden aria-live="polite"></div></article>`;
}

export function renderAtlas(container, dossiers, bySource) {
  if (!dossiers.length) {
    container.innerHTML = '<p class="empty">Aucun élément cartographiable pour ces critères.</p>';
    return;
  }
  const byId = new Map(dossiers.map(d => [d.id, d]));
  container.innerHTML = `<div class="atlas-board"><div class="atlas-plot"><div class="atlas-columns" aria-hidden="true"><span>Formation d’origine</span><span>En commun</span><span>Offre ou structure suivante</span></div>
    ${dossiers.map(lane).join('')}</div><aside class="atlas-reader" aria-label="Lecture de l’atlas"><div class="atlas-reader-sticky"><p class="eyebrow">Lecture de l’atlas</p>
    <div class="atlas-selection" aria-live="polite"><h3>Choisir une formation</h3><p>Sélectionnez un nœud pour afficher sa conclusion, ses liens et les références.</p></div>
    <ul class="legend"><li><i class="legend-edge"></i> Relation documentée</li><li><i class="legend-closure"></i> Formation concernée par une fermeture</li><li><i class="legend-node"></i> Formation ou enseignement</li></ul></div></aside></div>`;
  container.onclick = event => {
    const button = event.target.closest('[data-node]');
    if (!button) return;
    const dossier = byId.get(button.dataset.case);
    const node = dossier.nodes.find(node => node.id === button.dataset.node);
    const relations = (dossier.links || []).filter(link => [link.from, link.to].includes(node.id));
    container.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-pressed', 'true');
    const reader = container.querySelector('.atlas-selection');
    const details = `<h3 tabindex="-1">${h(node.label)}</h3>${proofLabel(dossier.proof)}<p>${item(dossier.finding, bySource)}</p>
      <p>${sourceRefs(node.refs, bySource)}</p>
      ${relations.length ? `<ul class="atlas-relations">${relations.map(link => {
        const from = dossier.nodes.find(node => node.id === link.from);
        const to = dossier.nodes.find(node => node.id === link.to);
        return `<li><strong>${h(types[link.type])}</strong><span>${h(from.label)} → ${h(to.label)}</span>${sourceRefs(link.refs, bySource)}</li>`;
      }).join('')}</ul>` : ''}<a class="text-link" href="${caseHref(dossier.id)}">Consulter le dossier</a>`;
    const inlineReader = button.closest('.lane').querySelector('.lane-selection');
    const previousReader = container.querySelector('.lane-selection:not([hidden])');
    if (previousReader && previousReader !== inlineReader) previousReader.hidden = true;
    reader.innerHTML = details;
    inlineReader.innerHTML = details;
    inlineReader.hidden = false;
    if (window.matchMedia('(max-width: 760px)').matches) inlineReader.querySelector('h3').focus();
  };
}

import { periods, stages } from './model.js';
import { caseHref, h, typeLabels } from './view.js';

const columns = {
  before: { label: 'Avant', from: 330, to: 0 },
  shared: { label: 'En commun', from: 622, to: 378 },
  after: { label: 'Après', from: 1000, to: 670 },
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
        title="${h(node.label)}" aria-haspopup="dialog" aria-label="${h(`${node.label} · ${columns[node.side].label}.${state}`)}"><span>${h(node.label)}</span></button>`).join('')}
    </div></article>`;
}

export function renderAtlas(container, dossiers, inspect) {
  if (!dossiers.length) {
    container.innerHTML = '<p class="empty">Aucun élément cartographiable pour ces critères.</p>';
    container.onclick = null;
    return;
  }
  const byId = new Map(dossiers.map(d => [d.id, d]));
  container.innerHTML = `<section class="atlas-board" aria-label="Trajectoires documentées"><div class="atlas-toolbar"><span>Sélectionnez une formation pour ouvrir son dossier</span>
    <ul class="legend" aria-label="Légende"><li><i class="legend-edge"></i> Relation documentée</li><li><i class="legend-closure"></i> Fermeture</li><li><i class="legend-node"></i> Formation ou enseignement</li></ul></div>
    <div class="atlas-plot"><div class="atlas-columns" aria-hidden="true"><span>Formation d’origine</span><span>En commun</span><span>Offre ou structure suivante</span></div>
    ${dossiers.map(lane).join('')}</div></section>`;
  container.onclick = event => {
    const button = event.target.closest('[data-node]');
    if (!button) return;
    const dossier = byId.get(button.dataset.case);
    const node = dossier.nodes.find(node => node.id === button.dataset.node);
    inspect(dossier, button, node);
  };
}

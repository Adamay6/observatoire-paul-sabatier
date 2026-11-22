import { degrees, filterDossiers, periods, stages } from './model.js';
import { caseHref, h, optionList } from './view.js';

const groupings = { period: 'Période', department: 'Département', degree: 'Diplôme' };
const series = {
  fermeture: { singular: 'fermeture', plural: 'fermetures', style: 'closure' },
  creation: { singular: 'ouverture', plural: 'ouvertures', style: 'opening' },
};
const byFrench = (a, b) => a.localeCompare(b, 'fr');

function groupKey(dossier, grouping) {
  if (grouping === 'department') {
    return [...dossier.departments].sort(byFrench).join(' / ') || 'Département à préciser';
  }
  return dossier[grouping];
}

export function buildBalance(dossiers, filters = {}, grouping = 'period') {
  const unique = [...new Map(dossiers.map(dossier => [dossier.id, dossier])).values()];
  const eligible = unique.filter(dossier => dossier.proof === 'confirme'
    && Object.keys(series).some(type => dossier.types.includes(type)));
  const rows = new Map();
  const totals = { fermeture: 0, creation: 0 };

  for (const dossier of filterDossiers(eligible, filters)) {
    const key = groupKey(dossier, grouping);
    if (!rows.has(key)) {
      const labels = grouping === 'period' ? periods : grouping === 'degree' ? degrees : {};
      rows.set(key, { key, label: labels[key] || key, fermeture: [], creation: [] });
    }
    const row = rows.get(key);
    for (const type of Object.keys(series)) {
      if (!dossier.types.includes(type)) continue;
      row[type].push(dossier);
      totals[type] += 1;
    }
  }

  const order = grouping === 'period' ? Object.keys(periods) : grouping === 'degree' ? Object.keys(degrees) : [];
  const sortedRows = [...rows.values()].sort((a, b) => order.length
    ? order.indexOf(a.key) - order.indexOf(b.key)
    : byFrench(a.label, b.label));
  const max = Math.max(0, ...sortedRows.flatMap(row => [row.fermeture.length, row.creation.length]));
  return { rows: sortedRows, totals, max };
}

function quantity(count, type) {
  return `${count} ${count === 1 ? series[type].singular : series[type].plural}`;
}

function segment(row, index, type, max) {
  const count = row[type].length;
  const applied = row[type].filter(dossier => dossier.stage === 'appliquee').length;
  const { style } = series[type];
  if (!count) return `<div class="balance-side balance-${style}"><span class="balance-zero" aria-label="${quantity(0, type)}">0</span></div>`;
  return `<button type="button" class="balance-side balance-${style}" data-balance-row="${index}" data-balance-type="${type}"
    aria-pressed="false" aria-label="${h(`${row.label} · ${quantity(count, type)}, dont ${applied} appliquée${applied === 1 ? '' : 's'}`)}">
    <span class="balance-bar" aria-hidden="true" style="--bar-width:${count / max * 100}%;--applied:${applied / count * 100}%"><span></span></span>
    <strong class="balance-value" aria-hidden="true">${count}</strong>
  </button>`;
}

function renderRows({ rows, max }) {
  if (!rows.length) return '<p class="balance-empty">Aucune fermeture ni ouverture confirmée pour ces filtres.</p>';
  return `<div class="balance-axis" aria-hidden="true"><span class="balance-axis-label balance-closure">Fermetures</span><span class="balance-axis-label balance-opening">Ouvertures</span><div><span>${max}</span><span>0</span><span>${max}</span></div></div>
    <ul class="balance-rows" aria-label="Fermetures et ouvertures par groupe">
      ${rows.map((row, index) => `<li class="balance-row">
        <span class="balance-label">${h(row.label)}</span>
        ${segment(row, index, 'fermeture', max)}${segment(row, index, 'creation', max)}
      </li>`).join('')}
    </ul>`;
}

function renderSelection(row, type) {
  return `<div class="balance-detail-header">
      <div><p class="balance-overline">${h(row.label)}</p><h3 tabindex="-1">${quantity(row[type].length, type)}</h3></div>
      <button type="button" class="balance-clear" data-balance-clear>Fermer le détail</button>
    </div>
    <ul class="balance-cases">${row[type].map(dossier => `<li>
      <div><a href="${caseHref(dossier.id)}">${h(dossier.title)}</a><small>${h(periods[dossier.period])} · ${h(stages[dossier.stage])}</small></div>
      <button type="button" class="balance-preview" aria-haspopup="dialog" data-balance-entry="${h(dossier.id)}"
        aria-label="Aperçu de ${h(dossier.title)}">Aperçu</button>
    </li>`).join('')}</ul>`;
}

export function renderBalance(container, dossiers, onInspect) {
  const entries = new Map(dossiers.map(dossier => [dossier.id, dossier]));
  const departments = [...new Set(dossiers.flatMap(dossier => dossier.departments))].sort(byFrench);
  const filters = [
    ['period', 'Période', periods, 'Toutes les périodes'],
    ['department', 'Département', Object.fromEntries(departments.map(department => [department, department])), 'Tous les départements'],
    ['degree', 'Diplôme', degrees, 'Tous les diplômes'],
    ['stage', 'Stade', stages, 'Tous les stades'],
  ];

  container.innerHTML = `<section class="balance-layout" aria-label="Comparaison des fermetures et ouvertures">
    <form class="balance-filters" aria-label="Filtres du graphique">
      ${filters.map(([id, label, values, all]) => `<label>${label}<select name="${id}">${optionList(values, '', all)}</select></label>`).join('')}
      <label>Regrouper par<select name="grouping">${Object.entries(groupings).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></label>
      <button type="reset" class="balance-clear">Réinitialiser</button>
    </form>
    <div class="balance-stats">
      <div class="balance-totals" role="status"></div>
      <div class="balance-key" aria-label="Légende de stade"><span><i></i>Appliquée</span><span><i></i>Autres stades</span></div>
    </div>
    <div class="balance-chart"></div>
    <section class="balance-detail" aria-label="Dossiers du groupe sélectionné" hidden></section>
    <p class="balance-scope">Le graphique compare les fermetures et les créations confirmées dans le corpus. Le filtre de stade distingue l’adoption de la mise en œuvre. Un dossier rattaché à plusieurs départements est compté une seule fois par type.</p>
  </section>`;

  const form = container.querySelector('.balance-filters');
  const chart = container.querySelector('.balance-chart');
  const detail = container.querySelector('.balance-detail');
  const totals = container.querySelector('.balance-totals');
  let balance;
  let selected;

  function clearSelection(restoreFocus = false) {
    selected?.setAttribute('aria-pressed', 'false');
    if (restoreFocus) selected?.focus();
    selected = null;
    detail.hidden = true;
    detail.innerHTML = '';
  }

  function update() {
    const { grouping, ...criteria } = Object.fromEntries(new FormData(form));
    balance = buildBalance(dossiers, criteria, grouping);
    clearSelection();
    totals.innerHTML = Object.keys(series).map(type => `<span class="balance-total balance-${series[type].style}">${quantity(balance.totals[type], type)}</span>`).join('');
    chart.innerHTML = renderRows(balance);
  }

  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('change', update);
  form.addEventListener('reset', () => queueMicrotask(update));
  chart.addEventListener('click', event => {
    const button = event.target.closest('[data-balance-row]');
    if (!button) return;
    if (selected === button) {
      clearSelection(true);
      return;
    }
    clearSelection();
    selected = button;
    button.setAttribute('aria-pressed', 'true');
    detail.innerHTML = renderSelection(balance.rows[Number(button.dataset.balanceRow)], button.dataset.balanceType);
    detail.hidden = false;
    detail.querySelector('h3').focus();
  });
  detail.addEventListener('click', event => {
    const button = event.target.closest('[data-balance-entry]');
    if (button) onInspect(entries.get(button.dataset.balanceEntry), button);
    if (event.target.closest('[data-balance-clear]')) clearSelection(true);
  });
  update();
}

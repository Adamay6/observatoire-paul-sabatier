import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from '../scripts/catalog.mjs';
import { buildBalance, renderBalance } from '../src/balance.js';

const { dossiers } = await loadCatalog();
const byId = new Map(dossiers.map(dossier => [dossier.id, dossier]));
const cases = (...ids) => ids.map(id => byId.get(id));

test('le bilan compare les fermetures et les ouvertures sur une échelle commune', () => {
  const balance = buildBalance(cases('ima', 'ro', 'cosya', 'uniteid', 'master-immunologie', 'pmv-mecanique', 'msi-management'));
  assert.deepEqual(balance.totals, { fermeture: 4, creation: 2 });
  assert.equal(balance.max, 3);
  assert.deepEqual(balance.rows.map(row => [row.key, row.fermeture.length, row.creation.length]), [
    ['2026-27', 3, 1], ['2027-31', 1, 1],
  ]);
});

test('chaque dossier multidépartemental compte une seule fois et reste filtrable par rattachement', () => {
  const balance = buildBalance(cases('ima', 'ima', 'ro', 'cosya'), { department: 'Mathématiques' }, 'department');
  assert.equal(balance.rows.length, 1);
  assert.equal(balance.totals.fermeture, 2);
  assert.equal(balance.rows[0].label, 'Informatique / Mathématiques');
  assert.deepEqual(balance.rows[0].fermeture.map(dossier => dossier.id), ['ima', 'ro']);
});

test('la comparaison peut isoler une période, un diplôme et les décisions appliquées', () => {
  const subset = cases('ima', 'cosya', 'issee', 'master-immunologie', 'pmv-mecanique');
  const filtered = buildBalance(subset, { period: '2026-27', degree: 'master', stage: 'appliquee' }, 'degree');
  assert.deepEqual(filtered.totals, { fermeture: 1, creation: 1 });
  assert.equal(filtered.rows[0].label, 'Master');
  assert.deepEqual(buildBalance(subset, { period: '2027-31', stage: 'appliquee' }), {
    rows: [], totals: { fermeture: 0, creation: 0 }, max: 0,
  });
});

test('sélectionner une barre donne accès à ses dossiers et permet de reprendre le graphique', t => {
  const previousFormData = globalThis.FormData;
  globalThis.FormData = class { [Symbol.iterator]() { return [][Symbol.iterator](); } };
  t.after(() => { globalThis.FormData = previousFormData; });
  const events = new Map();
  const form = { addEventListener() {} };
  const heading = { focus() { this.focused = true; } };
  const chart = { addEventListener: (name, handler) => events.set(`chart:${name}`, handler) };
  const detail = {
    querySelector: () => heading,
    addEventListener: (name, handler) => events.set(`detail:${name}`, handler),
  };
  const children = { '.balance-filters': form, '.balance-chart': chart, '.balance-detail': detail, '.balance-totals': {} };
  const container = { querySelector: selector => children[selector] };
  const opened = [];
  renderBalance(container, cases('ima', 'uniteid'), (...args) => opened.push(args));
  assert.match(chart.innerHTML, /aria-pressed="false"/);

  const bar = {
    dataset: { balanceRow: '0', balanceType: 'fermeture' },
    setAttribute(_name, value) { this.pressed = value; },
    focus() { this.focused = true; },
  };
  events.get('chart:click')({ target: { closest: () => bar } });
  assert.equal(bar.pressed, 'true');
  assert.equal(detail.hidden, false);
  assert.ok(heading.focused);
  assert.match(detail.innerHTML, /href="#dossier\/ima"/);

  const preview = { dataset: { balanceEntry: 'ima' } };
  const click = selector => ({ target: { closest: requested => requested === selector && preview } });
  events.get('detail:click')(click('[data-balance-entry]'));
  assert.deepEqual(opened, [[byId.get('ima'), preview]]);
  events.get('detail:click')(click('[data-balance-clear]'));
  assert.ok(bar.focused);
  assert.equal(bar.pressed, 'false');
  assert.equal(detail.hidden, true);
});

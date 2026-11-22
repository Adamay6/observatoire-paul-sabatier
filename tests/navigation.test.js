import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from '../scripts/catalog.mjs';

class Element {
  innerHTML = '';
  textContent = '';
  value = '';
  events = new Map();
  children = new Map();

  addEventListener(event, callback) { this.events.set(event, callback); }
  insertAdjacentHTML(_position, markup) { this.innerHTML += markup; }
  querySelector(selector) {
    if (!this.children.has(selector)) this.children.set(selector, new Element());
    return this.children.get(selector);
  }
  focus() { this.focused = true; }
  scrollIntoView() {}
}

test('les routes rendent les données, les filtres et les références de liaison', async () => {
  const catalog = await loadCatalog();
  const elements = new Map();
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  }

  globalThis.document = { querySelector: element, getElementById: id => element(`#${id}`) };
  globalThis.location = { hash: '' };
  globalThis.window = new Element();
  window.scrollTo = () => {};
  globalThis.history = { replaceState: (_state, _unused, hash) => { location.hash = hash; } };
  globalThis.fetch = async () => ({ ok: true, json: async () => catalog });
  let formData = {};
  globalThis.FormData = class { [Symbol.iterator]() { return Object.entries(formData)[Symbol.iterator](); } };

  await import('../src/app.js');
  const main = element('main');
  const go = hash => {
    location.hash = hash;
    window.events.get('hashchange')();
    assert.doesNotMatch(main.innerHTML, /Chargement impossible|Page introuvable/);
  };

  assert.match(main.innerHTML, /Les formations<br>en mouvement/);
  assert.match(main.innerHTML, /href="#bilan"/);
  assert.match(element('#dashboard-balance').querySelector('.balance-totals').innerHTML, /9 fermetures/);
  assert.match(element('#metrics-values').innerHTML, /href="#explorer\?metric=closures"/);
  element('#metric-period').value = '2026-27';
  element('#metric-period').events.get('change')();
  assert.match(element('#metrics-values').innerHTML, /metric=closures&amp;period=2026-27"><strong>06/);

  go('#explorer?metric=closures');
  formData = { q: 'recherche operationnelle', degree: 'master', period: '2026-27' };
  element('#filter-form').events.get('input')();
  assert.match(element('#filter-count').textContent, /^1 dossier sur/);
  assert.match(element('#case-results').innerHTML, /href="#dossier\/ro"/);
  assert.match(element('#case-results').innerHTML, /data-panel="dossier" data-entry="ro"/);

  go('#dossier/ro');
  assert.match(main.innerHTML, /Situation documentée/);
  assert.match(main.innerHTML, /href="#sources\/ca-2025-050"/);
  assert.match(main.innerHTML, /data-panel="compare" data-entry="ro"/);

  go('#comparer?id=ro');
  element('#compare-case').value = 'ro';
  element('#compare-case').events.get('change')();
  assert.match(element('#compare-view').innerHTML, /Après \/ évolution documentée/);
  assert.match(element('#compare-view').innerHTML, /Donnée indisponible/);
  assert.match(element('#compare-view').innerHTML, /href="#sources\/ca-2025-050"/);

  go('#sources/ca-2025-050');
  assert.match(element('#source-results').innerHTML, /selected-source" id="ref-ca-2025-050"/);
  assert.ok(element('#ref-ca-2025-050').focused);

  go('#atlas?period=2027-31');
  element('#atlas-period').value = '2027-31';
  element('#atlas-period').events.get('change')();
  assert.match(element('#atlas-view').innerHTML, /edge-remplacement/);
  assert.doesNotMatch(element('#atlas-view').innerHTML, /edge-fusion/);

  formData = { period: '2026-27', grouping: 'period' };
  go('#bilan');
  const totals = element('#balance-view').querySelector('.balance-totals').innerHTML;
  assert.match(totals, /6 fermetures/);
  assert.match(totals, /3 ouvertures/);
});

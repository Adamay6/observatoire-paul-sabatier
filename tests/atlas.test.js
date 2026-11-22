import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from '../scripts/catalog.mjs';
import { renderAtlas } from '../src/atlas.js';
import { item, proofLabel } from '../src/view.js';

const catalog = await loadCatalog();
const bySource = new Map(catalog.sources.map(source => [source.id, source]));

test('le graphe ne crée aucun trait pour une fermeture ou une création seule', () => {
  const cases = catalog.dossiers.filter(d => ['csa', 'uniteid'].includes(d.id));
  const board = {};
  renderAtlas(board, cases, () => {});
  assert.match(board.innerHTML, /node-before node-closure/);
  assert.match(board.innerHTML, /node-after/);
  assert.doesNotMatch(board.innerHTML, /class="edge /);
});

test('la fusion comporte deux relations et une lecture accessible des sources', () => {
  const fusion = catalog.dossiers.find(d => d.id === 'secil-fusion-historique');
  const board = {};
  let selection;
  renderAtlas(board, [fusion], (...args) => { selection = args; });
  assert.equal([...board.innerHTML.matchAll(/class="edge edge-fusion"/g)].length, 2);
  assert.match(board.innerHTML, /<button type="button"/);
  assert.match(board.innerHTML, /aria-haspopup="dialog"/);
  assert.match(board.innerHTML, /href="#dossier\/secil-fusion-historique"/);
  const node = fusion.nodes[0];
  const trigger = { dataset: { case: fusion.id, node: node.id } };
  board.onclick({ target: { closest: () => trigger } });
  assert.deepEqual(selection, [fusion, trigger, node]);
});

test('les champs manquants ne prennent aucune valeur numérique implicite', () => {
  assert.equal(item(undefined, bySource), '<span class="missing">Donnée indisponible</span>');
  assert.match(proofLabel('confirme'), /Confirmé/);
  assert.doesNotMatch(item({ text: '<b>test</b>', refs: [] }, bySource), /<b>/);
});

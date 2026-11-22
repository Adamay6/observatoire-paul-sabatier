import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { assertCatalog, loadCatalog, renderSources, root, validateCatalog } from '../scripts/catalog.mjs';
import { counts, filterDossiers, metrics } from '../src/model.js';

const catalog = await loadCatalog();
const byId = new Map(catalog.dossiers.map(d => [d.id, d]));

test('le corpus, le registre généré et les liens des dossiers de recherche concordent', async () => {
  assert.doesNotThrow(() => assertCatalog(catalog));
  const sourceRegistry = await readFile(new URL('SOURCES.md', root), 'utf8');
  assert.equal(sourceRegistry.replace(/\r\n/g, '\n'), renderSources(catalog.sources));
  const notebooks = (await readdir(new URL('research/', root))).filter(name => name.endsWith('.md'));
  for (const name of ['README.md', 'METHODOLOGY.md', 'FINDINGS.md', 'OPEN_QUESTIONS.md', ...notebooks.map(name => `research/${name}`)]) {
    const document = await readFile(new URL(name, root), 'utf8');
    for (const [, id] of document.matchAll(/SOURCES\.md#([a-z0-9-]+)/g)) {
      assert.ok(sourceRegistry.includes(`<a id="${id}"></a>`), `${name} cite une notice manquante : ${id}`);
    }
  }
});

test('la recherche ignore accents et casse, sans doubler les parcours transversaux', () => {
  const search = filterDossiers(catalog.dossiers, { q: 'recherche operationnelle', period: '2026-27' });
  assert.deepEqual(search.map(d => d.id), ['ro']);
  for (const department of ['Informatique', 'Mathématiques']) {
    const names = filterDossiers(catalog.dossiers, { department, period: '2026-27', type: 'fermeture' }).map(d => d.id);
    assert.ok(names.includes('ima'));
    assert.ok(names.includes('ro'));
  }
  const report = counts([byId.get('ro'), byId.get('ro'), byId.get('ima')]);
  assert.equal(report.closures, 2);
});

test('chaque compteur ouvre le même ensemble de dossiers que le tableau de bord', () => {
  for (const period of ['', '2026-27', '2027-31', '2028-29', 'historique', '2027-32', 'indetermine']) {
    const report = counts(filterDossiers(catalog.dossiers, { period }));
    for (const { id } of metrics) assert.equal(report[id], filterDossiers(catalog.dossiers, { period, metric: id }).length);
  }
  assert.equal(counts(filterDossiers(catalog.dossiers, { period: '2026-27' })).mergers, 0);
  assert.equal(counts(filterDossiers(catalog.dossiers, { period: '2027-31' })).sharing, 0);
});

test('un cadrage général est distinct des motifs propres recensés', () => {
  const results = filterDossiers(catalog.dossiers, { motive: 'hors-budget', period: '2027-31', stage: 'adoptee', type: 'remplacement' });
  assert.ok(results.some(d => d.id === 'msi-management'));
  assert.ok(filterDossiers(catalog.dossiers, { motive: 'inconnu', type: 'fermeture' }).some(d => d.id === 'csa'));
  assert.ok(!filterDossiers(catalog.dossiers, { motive: 'budget' }).some(d => d.id === 'csa'));
});

test('une confirmation sans source valide et un doublon sont rejetés', () => {
  const damaged = structuredClone(catalog);
  damaged.dossiers[0].finding.refs = ['intitule-inexistant'];
  damaged.dossiers.push(damaged.dossiers[0]);
  const errors = validateCatalog(damaged).join('\n');
  assert.match(errors, /référence orpheline/);
  assert.match(errors, /source primaire requise/);
  assert.match(errors, /identifiant de dossier dupliqué/);
});

test('un remplacement sans référence explicite ou avec une extrémité orpheline est rejeté', () => {
  const damaged = structuredClone(catalog);
  const dossier = damaged.dossiers.find(d => d.id === 'msi-management');
  const [edge] = dossier.links;
  edge.to = 'introuvable';
  edge.refs = [];
  assert.match(validateCatalog(damaged).join('\n'), /extrémité orpheline/);
  assert.match(validateCatalog(damaged).join('\n'), /références absentes/);
  dossier.links = [];
  assert.match(validateCatalog(damaged).join('\n'), /relation remplacement sans lien sourcé/);
});

test('une date impossible et un indicateur altéré sont rejetés', () => {
  const damaged = structuredClone(catalog);
  damaged.sources[0].consulted = '2026-11-31';
  assert.match(validateCatalog(damaged).join('\n'), /consultation incohérente/);
  const statistics = counts(catalog.dossiers);
  statistics.closures += 1;
  assert.match(validateCatalog({ ...catalog, statistics }).join('\n'), /valeur publiée incohérente/);
});

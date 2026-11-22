import { cp, mkdir, writeFile } from 'node:fs/promises';
import { assertCatalog, loadCatalog, root } from './catalog.mjs';
import { counts } from '../src/model.js';

const catalog = await loadCatalog();
catalog.statistics = counts(catalog.dossiers);
assertCatalog(catalog);

const dist = new URL('dist/', root);
await mkdir(dist, { recursive: true });
await Promise.all([
  cp(new URL('index.html', root), new URL('index.html', dist)),
  cp(new URL('src/', root), new URL('src/', dist), { recursive: true }),
  writeFile(new URL('catalog.json', dist), JSON.stringify(catalog), 'utf8'),
  writeFile(new URL('.nojekyll', dist), '', 'utf8'),
]);
console.log(`Site exporté dans dist/ (${catalog.dossiers.length} dossiers, ${catalog.sources.length} références).`);

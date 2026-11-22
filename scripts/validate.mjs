import { readFile, writeFile } from 'node:fs/promises';
import { assertCatalog, loadCatalog, renderSources, root } from './catalog.mjs';

try {
  const catalog = await loadCatalog();
  assertCatalog(catalog);
  const filename = new URL('SOURCES.md', root);
  const content = renderSources(catalog.sources);
  if (process.argv.includes('--write-sources')) {
    await writeFile(filename, content, 'utf8');
  } else {
    const current = await readFile(filename, 'utf8');
    if (current.replace(/\r\n/g, '\n') !== content) throw new Error('SOURCES.md est désynchronisé. Exécuter npm run validate -- --write-sources.');
  }
  console.log(`${catalog.dossiers.length} dossiers et ${catalog.sources.length} références validés.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

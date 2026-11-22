import { readdir, readFile } from 'node:fs/promises';
import {
  periods, degrees, types, proofs, stages, motives, kinds, fields, primaryKinds,
  counts, filterDossiers, metrics,
} from '../src/model.js';

export const root = new URL('../', import.meta.url);
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
const filled = value => typeof value === 'string' && value.trim().length > 0;
const validDate = value => {
  if (!/^\d{4}-\d\d-\d\d$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

async function readJson(url) {
  return JSON.parse((await readFile(url, 'utf8')).replace(/^\uFEFF/, ''));
}

async function entries(folder, exclude = []) {
  const path = new URL(`${folder}/`, root);
  const filenames = (await readdir(path)).filter(name => name.endsWith('.json') && !exclude.includes(name)).sort();
  const files = await Promise.all(filenames.map(async name => {
    const records = await readJson(new URL(name, path));
    if (!Array.isArray(records)) throw new Error(`${folder}/${name} doit contenir une liste JSON.`);
    return records;
  }));
  return files.flat();
}

export async function loadCatalog() {
  const [meta, dossiers, sources] = await Promise.all([
    readJson(new URL('data/meta.json', root)), entries('data', ['meta.json']), entries('sources'),
  ]);
  sources.sort((a, b) => a.id.localeCompare(b.id));
  return { meta, dossiers, sources };
}

export function validateCatalog({ meta, dossiers, sources, statistics }) {
  const errors = [];
  const require = (condition, message) => { if (!condition) errors.push(message); };
  const validKey = (value, vocabulary) => typeof value === 'string' && Object.hasOwn(vocabulary, value);
  const list = value => Array.isArray(value) ? value : [];
  const nonemptyStrings = values => Array.isArray(values) && values.every(filled);
  const distinct = values => new Set(values).size === values.length;
  const bySource = new Map();
  const dossierIds = new Set();

  require(validDate(meta.updated), 'Date de mise à jour du corpus invalide.');
  for (const field of ['scope', 'institution', 'version']) require(filled(meta[field]), `meta.${field} manquant.`);
  require(dossiers.length > 0 && sources.length > 0, 'Le corpus doit contenir des dossiers et des sources.');

  for (const source of sources) {
    const name = `Source ${source.id}`;
    require(slug.test(source.id || ''), `${name} : identifiant invalide.`);
    require(!bySource.has(source.id), `${name} : identifiant de source dupliqué.`);
    bySource.set(source.id, source);
    for (const key of ['title', 'publisher', 'locator', 'note']) require(filled(source[key]), `${name} : ${key} manquant.`);
    require(validKey(source.kind, kinds), `${name} : nature invalide.`);
    let url;
    try { url = new URL(source.url); } catch { /* L’erreur est signalée ci-dessous. */ }
    require(url?.protocol === 'https:' && !url.username && !url.password, `${name} : URL HTTPS attendue.`);
    require(validDate(source.consulted) && source.consulted <= meta.updated, `${name} : date de consultation incohérente.`);
    if (source.date) require(validDate(source.date) && source.date <= source.consulted, `${name} : date du document incohérente.`);
    if (source.updated) require(validDate(source.updated) && source.updated <= source.consulted
      && (!source.date || source.updated >= source.date), `${name} : date de révision de la source incohérente.`);
  }

  function checkRefs(refs, label, primary = false) {
    const ids = list(refs);
    require(Array.isArray(refs) && ids.length > 0 && distinct(ids), `${label} : références absentes ou répétées.`);
    for (const id of ids) require(bySource.has(id), `${label} : référence orpheline ${id}.`);
    if (primary) require(ids.some(id => primaryKinds.has(bySource.get(id)?.kind)), `${label} : source primaire requise.`);
  }

  function checkClaim(claim, label, primary = false) {
    require(isRecord(claim) && filled(claim.text), `${label} : texte manquant.`);
    checkRefs(claim?.refs, label, primary);
  }

  for (const dossier of dossiers) {
    const name = `Dossier ${dossier.id}`;
    require(slug.test(dossier.id || ''), `${name} : identifiant invalide.`);
    require(!dossierIds.has(dossier.id), `${name} : identifiant de dossier dupliqué.`);
    dossierIds.add(dossier.id);
    for (const key of ['title', 'short']) require(filled(dossier[key]), `${name} : ${key} manquant.`);
    for (const [key, vocabulary] of [['degree', degrees], ['period', periods], ['proof', proofs], ['stage', stages]]) {
      require(validKey(dossier[key], vocabulary), `${name} : valeur ${key} invalide.`);
    }
    const dossierTypes = list(dossier.types);
    require(Array.isArray(dossier.types) && distinct(dossierTypes) && dossierTypes.every(type => validKey(type, types)), `${name} : types invalides ou répétés.`);
    require(nonemptyStrings(dossier.departments) && distinct(list(dossier.departments)), `${name} : départements invalides ou répétés.`);
    if (dossier.mentions) require(nonemptyStrings(dossier.mentions) && distinct(list(dossier.mentions)), `${name} : mentions invalides ou répétées.`);
    require(nonemptyStrings(dossier.questions), `${name} : questions invalides.`);
    checkClaim(dossier.finding, `${name} / conclusion`, dossier.proof === 'confirme');
    for (const side of ['before', 'after']) {
      if (!dossier[side]) continue;
      require(isRecord(dossier[side]), `${name} / ${side} : comparaison invalide.`);
      for (const [field, claim] of Object.entries(dossier[side])) {
        require(validKey(field, fields), `${name} : champ comparatif inconnu ${field}.`);
        checkClaim(claim, `${name} / ${side}.${field}`);
      }
    }
    for (const key of ['nodes', 'links', 'motives', 'effects', 'history', 'revisions']) {
      if (dossier[key] !== undefined) require(Array.isArray(dossier[key]), `${name} : ${key} doit être une liste.`);
    }
    for (const effect of list(dossier.effects)) checkClaim(effect, `${name} / conséquence`);
    for (const motive of list(dossier.motives)) {
      require(validKey(motive.type, motives), `${name} : motivation invalide.`);
      checkClaim(motive, `${name} / motivation ${motive.type}`, true);
    }
    for (const entry of list(dossier.history)) {
      const date = entry.date;
      require((validDate(date) || /^\d{4}$/.test(date)) && date <= meta.updated, `${name} : date historique invalide ou future (${date}).`);
      checkClaim(entry, `${name} / historique ${date}`);
    }
    for (const entry of list(dossier.revisions)) require(validDate(entry.date) && entry.date <= meta.updated && filled(entry.text), `${name} : révision invalide.`);

    const nodeMap = new Map();
    for (const node of list(dossier.nodes)) {
      require(slug.test(node.id || '') && !nodeMap.has(node.id), `${name} : nœud invalide ou dupliqué ${node.id}.`);
      require(['before', 'shared', 'after'].includes(node.side) && filled(node.label), `${name} / nœud ${node.id} : libellé ou position manquant.`);
      checkRefs(node.refs, `${name} / nœud ${node.id}`);
      nodeMap.set(node.id, node);
    }
    const emitted = new Set();
    for (const link of list(dossier.links)) {
      const description = `${name} / lien ${link.from} → ${link.to}`;
      const from = nodeMap.get(link.from);
      const to = nodeMap.get(link.to);
      const signature = `${link.type}:${link.from}:${link.to}`;
      require(from && to && link.from !== link.to, `${description} : extrémité orpheline ou boucle.`);
      require(!emitted.has(signature) && validKey(link.type, types) && dossierTypes.includes(link.type)
        && !['fermeture', 'non-ouverture', 'creation'].includes(link.type), `${description} : type incohérent ou doublon.`);
      emitted.add(signature);
      require(from?.side === 'before' && (to?.side === 'after' || (to?.side === 'shared' && link.type === 'mutualisation'))
        || from?.side === 'shared' && to?.side === 'after' && link.type === 'mutualisation', `${description} : ordre des nœuds incohérent.`);
      checkRefs(link.refs, description, true);
    }
    for (const type of ['remplacement', 'fusion', 'mutualisation', 'transfert']) {
      if (dossier.proof === 'confirme' && dossierTypes.includes(type)) {
        require(list(dossier.links).some(link => link.type === type), `${name} : relation ${type} sans lien sourcé.`);
      }
    }
    if (dossierTypes.includes('creation') && dossierTypes.length === 1) {
      require(!list(dossier.nodes).some(node => node.side === 'before'), `${name} : création isolée avec prédécesseur.`);
    }
  }

  if (!errors.length) {
    const tally = counts(dossiers);
    for (const metric of metrics) {
      const fromExplorer = filterDossiers(dossiers, { metric: metric.id }).length;
      const byPeriod = Object.keys(periods).reduce((sum, period) => sum + counts(filterDossiers(dossiers, { period }))[metric.id], 0);
      require(tally[metric.id] === fromExplorer && tally[metric.id] === byPeriod, `Indicateur ${metric.id} : total incohérent.`);
      if (statistics !== undefined) require(tally[metric.id] === statistics[metric.id], `Indicateur ${metric.id} : valeur publiée incohérente.`);
    }
  }
  return errors;
}

export function assertCatalog(catalog) {
  const errors = validateCatalog(catalog);
  if (errors.length) throw new Error(errors.join('\n'));
}

export function renderSources(sources) {
  const intro = '# Registre documentaire\n\nCe registre est généré depuis les fichiers de `sources/`. Chaque passage est résumé et relié à son original. Les dates de consultation figurent dans les notices. Une date de décision est indiquée lorsqu’elle est disponible.\n';
  const notices = sources.map(source => [
    `<a id="${source.id}"></a>`, '', `## ${source.title}`, '',
    `- Identifiant · ${source.id}`, `- Auteur ou institution · ${source.publisher}`, `- Nature · ${kinds[source.kind]}`,
    `- Date · ${source.date || 'Non indiquée'}${source.updated ? `, mise à jour ${source.updated}` : ''}`,
    `- Consultation · ${source.consulted}`, `- Repère · ${source.locator}`, `- Résumé · ${source.note}`,
    `- [Consulter le document original](${source.url})`,
    ...(source.access ? [`- Accès · ${source.access}`] : []),
    `- Droits · ${source.rights || 'Lien et notice uniquement'}`, '',
  ].join('\n'));
  return `${intro}\n${notices.join('\n')}`;
}

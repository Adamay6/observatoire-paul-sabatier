export const periods = {
  '2026-27': 'Rentrée 2026–2027', '2027-31': 'Accréditation 2027–2031',
  '2027-32': 'Accréditation 2027–2032', historique: 'Antérieur à 2026', indetermine: 'Période indéterminée',
};
export const degrees = { licence: 'Licence', 'licence-pro': 'Licence professionnelle', master: 'Master', du: 'DU' };
export const types = {
  fermeture: 'Fermeture', remplacement: 'Remplacement', fusion: 'Fusion', mutualisation: 'Mutualisation',
  rationalisation: 'Rationalisation', transformation: 'Transformation', renommage: 'Renommage',
  creation: 'Création', transfert: 'Transfert', 'non-ouverture': 'Non-ouverture',
};
export const proofs = {
  confirme: 'Confirmé', partiel: 'Partiellement confirmé', 'a-verifier': 'À vérifier',
  contradictoire: 'Contradictoire', indetermine: 'Indéterminé',
};
export const stages = {
  envisagee: 'Envisagée', adoptee: 'Adoptée', appliquee: 'Appliquée', abandonnee: 'Abandonnée', inconnue: 'Indéterminé',
};
export const motives = {
  budget: 'Contraintes budgétaires', effectifs: 'Effectifs étudiants', mutualisation: 'Mutualisation ou économie d’échelle',
  pedagogie: 'Motifs pédagogiques', debouches: 'Débouchés professionnels', institution: 'Réorganisation institutionnelle',
  reglement: 'Obligations réglementaires', autre: 'Autre motif documenté',
};
export const kinds = {
  decision: 'Décision institutionnelle', annexe: 'Annexe ou maquette', fiche: 'Fiche de formation',
  institution: 'Communication institutionnelle', juridique: 'Texte juridique', mobilisation: 'Mobilisation', presse: 'Presse',
};
export const fields = {
  title: 'Intitulé', offer: 'Offre et recrutement', tracks: 'Parcours et rattachements',
  units: 'UE et enseignements', ects: 'Crédits ECTS', hours: 'Volumes horaires', seats: 'Capacité d’accueil',
  specialization: 'Modalités de spécialisation', outcomes: 'Débouchés et poursuite d’études',
};
export const primaryKinds = new Set(['decision', 'annexe', 'fiche', 'institution', 'juridique']);

export function formatDate(value) {
  if (!value || value.length === 4) return value || 'Date non indiquée';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`));
}

export function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

export function filterDossiers(dossiers, options = {}) {
  const words = normalize(options.q).split(/\s+/).filter(Boolean);
  return dossiers.filter(dossier => {
    const searchable = normalize([dossier.title, dossier.short, ...(dossier.mentions || []), ...dossier.departments,
      ...(dossier.nodes || []).map(node => node.label)].join(' '));
    const documentedMotives = dossier.motives || [];
    return words.every(word => searchable.includes(word))
      && (!options.department || dossier.departments.includes(options.department))
      && (!options.degree || dossier.degree === options.degree)
      && (!options.period || dossier.period === options.period)
      && (!options.type || dossier.types.includes(options.type))
      && (!options.proof || dossier.proof === options.proof)
      && (!options.stage || dossier.stage === options.stage)
      && (!options.motive || (options.motive === 'inconnu' && documentedMotives.length === 0)
        || (options.motive === 'hors-budget' && documentedMotives.some(motive => motive.type !== 'budget'))
        || documentedMotives.some(motive => motive.type === options.motive))
      && (!options.metric || metricMatches(dossier, options.metric));
  });
}

export const metrics = [
  { id: 'closures', title: 'Fermetures confirmées', filter: 'fermeture', tone: 'rust' },
  { id: 'replacements', title: 'Remplacements confirmés', filter: 'remplacement', tone: 'ink' },
  { id: 'mergers', title: 'Fusions confirmées', filter: 'fusion', tone: 'ink' },
  { id: 'sharing', title: 'Mutualisations confirmées', filter: 'mutualisation', tone: 'ink' },
  { id: 'unexplained', title: 'Changements sans motif établi', tone: 'ink' },
  { id: 'open', title: 'Cas à approfondir', tone: 'rust' },
];

export function metricMatches(dossier, id) {
  if (id === 'open') return dossier.proof !== 'confirme';
  if (id === 'unexplained') return ['confirme', 'partiel'].includes(dossier.proof)
    && dossier.types.length > 0 && !(dossier.motives || []).length;
  const type = metrics.find(metric => metric.id === id)?.filter;
  return type && dossier.proof === 'confirme' && dossier.types.includes(type);
}

export function counts(dossiers) {
  const uniqueDossiers = [...new Map(dossiers.map(dossier => [dossier.id, dossier])).values()];
  return Object.fromEntries(metrics.map(metric => [metric.id, uniqueDossiers.filter(dossier => metricMatches(dossier, metric.id)).length]));
}

export function dossierRefs(dossier) {
  const items = [dossier.finding, ...Object.values(dossier.before || {}), ...Object.values(dossier.after || {}),
    ...(dossier.history || []), ...(dossier.nodes || []), ...(dossier.links || []),
    ...(dossier.motives || []), ...(dossier.effects || [])];
  return [...new Set(items.flatMap(item => item.refs))];
}

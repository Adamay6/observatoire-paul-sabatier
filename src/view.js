import { proofs, types } from './model.js';

const htmlEntities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => htmlEntities[character]);
}

export function optionList(values, selected, empty) {
  return `<option value="">${h(empty)}</option>${Object.entries(values).map(([key, label]) =>
    `<option value="${h(key)}"${key === selected ? ' selected' : ''}>${h(label)}</option>`).join('')}`;
}

export function caseHref(id) {
  return `#dossier/${encodeURIComponent(id)}`;
}

export function proofLabel(proof) {
  return `<span class="proof proof-${h(proof)}"><i aria-hidden="true"></i>${h(proofs[proof])}</span>`;
}

export function typeLabels(items) {
  return items.length ? items.map(type => h(types[type])).join(' · ') : 'Changement à établir';
}

export function sourceRefs(refs, bySource) {
  if (!refs.length) return '';
  return `<span class="refs" aria-label="Références">${refs.map(id => {
    const source = bySource.get(id);
    return `<a href="#sources/${h(id)}" title="${h(source.title)}" aria-label="Source · ${h(source.title)}">${h(source.label || id)}</a>`;
  }).join('')}</span>`;
}

export function item(claim, bySource) {
  return claim ? `${h(claim.text)} ${sourceRefs(claim.refs, bySource)}` : '<span class="missing">Donnée indisponible</span>';
}

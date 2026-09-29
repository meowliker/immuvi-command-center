import { VARIATION_AXES } from './tracker-editing.js';

export const VARIATION_TEMPLATES = [
  { label: '5 Hook tests', axis: 'Hook', count: 5 },
  { label: '3 Production-style tests', axis: 'Production Style', count: 3 },
  { label: '4 Music tests', axis: 'Music', count: 4 },
  { label: '3 CTA tests', axis: 'CTA', count: 3 },
  { label: 'Full Remake set', axis: 'Full Remake', count: 3 },
];
export function variationAxes(value) {
  const custom = Array.isArray(value) ? value.filter((axis) => typeof axis === 'string' && axis.trim() && axis.trim().length <= 80) : [];
  return [...new Set([...VARIATION_AXES, ...custom.map((axis) => axis.trim())])];
}
export function canSpawnVariations(creative) {
  return !!creative && !creative.deletedAt && !creative._productBoundaryQuarantined && !creative.productBoundaryQuarantined
    && ['winner', 'mild winner', 'scale'].includes(String(creative.status).trim().toLowerCase());
}
export function variationRows(rows, defaults) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 20) throw new Error('Choose 1 to 20 variations.');
  return rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Variation ${index + 1}: invalid draft.`);
    const axis = String(row.axis === '__custom__' ? row.customAxis || '' : row.axis || '').trim();
    if (!axis || axis.length > 80) throw new Error(`Variation ${index + 1}: enter an axis of 1 to 80 characters.`);
    const dueDate = row.dueDate || defaults.dueDate || '';
    if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isFinite(Date.parse(`${dueDate}T12:00:00Z`))
      || new Date(`${dueDate}T12:00:00Z`).toISOString().slice(0, 10) !== dueDate)) throw new Error(`Variation ${index + 1}: invalid due date.`);
    const people = (key) => {
      if (row[key] != null && !Array.isArray(row[key])) throw new Error(`Variation ${index + 1}: invalid assignees.`);
      const ids = row[key]?.length ? row[key] : defaults[key] || [];
      if (!Array.isArray(ids) || ids.some((id) => !/^[1-9]\d*$/.test(String(id)))) throw new Error(`Variation ${index + 1}: invalid assignees.`);
      return [...new Set(ids.map(String))];
    };
    return { axis, from: String(row.from || ''), to: row.mode === 'note' ? '' : String(row.to || ''),
      hypothesis: String(row.hypothesis || ''), brief: String(row.brief || ''), dueDate,
      editorIds: people('editorIds'), reviewerIds: people('reviewerIds') };
  });
}

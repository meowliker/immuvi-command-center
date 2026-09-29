import { taxonomyKey, normalizeTaxonomyRow } from './taxonomy.js';
import { normalizeCreativeRow } from './creative-tracker.js';
import { indexMatrix, matrixKey, matrixBucket } from './creative-matrix.js';

export function inspirationPlacementIndex(productId, angles, personas, ads, cells, deleted) {
  const tombstones = new Set(deleted.filter((row) => row.product_id === productId).flatMap((row) => [row.id,row.clickup_task_id]).filter(Boolean));
  const creatives = ads.filter((row) => !tombstones.has(row.id) && !tombstones.has(row.clickup_task_id || row.meta?._clickupId || row.meta?.clickupTaskId)).map(normalizeCreativeRow);
  return indexMatrix({productId,angles:angles.map(normalizeTaxonomyRow),personas:personas.map(normalizeTaxonomyRow),creatives,cells});
}
export function suggestedInspirationCell(row, index) {
  const matches = (rows, name) => rows.filter((axis) => taxonomyKey(axis.name) === taxonomyKey(name));
  const angles = matches(index.angles,row.angle), personas = matches(index.personas,row.persona);
  return angles.length === 1 && personas.length === 1 ? {angleId:angles[0].id,personaId:personas[0].id} : null;
}
export function inspirationCellSummary(row, index, cell) {
  const ads = cell ? index.byCell.get(matrixKey(cell.angleId,cell.personaId)) || [] : [];
  return {total:ads.length,winners:ads.filter((ad) => matrixBucket(ad.status) === 'winner').length,
    testing:ads.filter((ad) => ad.status === 'Testing').length,
    placed:ads.some((ad) => (ad.fromInspoId || ad.sourceInsId) === row.id)};
}
export function inspirationPlacementReason(row) {
  if (!row || row.queueOnly || !row.version) return 'A saved inspiration is required.';
  return ['saved','classified','approved','testing'].includes(String(row.status).toLowerCase()) ? '' : 'This inspiration is not ready for Matrix placement.';
}
export function inspirationPlacementRequest(productId, row, index, cell, requestId = crypto.randomUUID()) {
  const reason = inspirationPlacementReason(row);
  if (reason) throw new Error(reason);
  if (row.productId !== productId || !index.angles.some((axis) => axis.id === cell?.angleId && axis.productId === productId)
    || !index.personas.some((axis) => axis.id === cell?.personaId && axis.productId === productId)) throw new Error('Choose an active angle and persona in this product.');
  return {p_product_id:productId,p_angle_id:cell.angleId,p_persona_id:cell.personaId,p_kind:'inspiration',p_items:[{sourceId:row.id,version:row.version}],p_request_id:requestId};
}

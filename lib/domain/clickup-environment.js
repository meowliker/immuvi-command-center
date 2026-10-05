import { assertQaClickUpList } from './clickup-sync.js';

export function assertClickUpEnvironmentList(listId, environment = 'qa', productId) {
  if (environment === 'qa') return assertQaClickUpList(listId, productId);
  if (environment !== 'production' || String(listId) !== '901613447211') throw new Error('ClickUp destination boundary mismatch.');
}

export function clickUpCreationMarker(id, environment = 'qa') {
  if (!['qa', 'production'].includes(environment)) throw new Error('Unknown creation environment.');
  return `${environment === 'production' ? 'IMMUVI_PRODUCTION_JOB' : 'IMMUVI_QA_JOB'}:${id}`;
}

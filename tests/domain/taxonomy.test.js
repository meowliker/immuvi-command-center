import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveTaxonomyStatus,
  filterTaxonomyRows,
  newTaxonomyId,
  normalizeTaxonomyName,
  normalizeTaxonomyRow,
  sameTaxonomyName,
  findTaxonomyMergeSuggestions,
  summarizeTaxonomyRows,
  taxonomySimilarityScore,
  taxonomyKey,
  taxonomyStats,
} from '../../lib/domain/taxonomy.js';

test('normalizeTaxonomyName strips bullets and list markers', () => {
  assert.equal(normalizeTaxonomyName('- Emotional Pain / Trauma'), 'Emotional Pain / Trauma');
  assert.equal(normalizeTaxonomyName('1. Young Couples'), 'Young Couples');
  assert.equal(normalizeTaxonomyName('[x] Skeptic - Proof'), 'Skeptic - Proof');
});

test('taxonomyKey normalizes dash variants and case for comparison', () => {
  assert.equal(taxonomyKey('Transformation \u2014 Skeptic'), 'transformation - skeptic');
  assert.equal(taxonomyKey(' transformation - skeptic '), 'transformation - skeptic');
});

test('sameTaxonomyName compares cleaned names without accepting blanks', () => {
  assert.equal(sameTaxonomyName('\u2022 Emotional Pain / Trauma', 'emotional pain / trauma'), true);
  assert.equal(sameTaxonomyName('', 'emotional pain / trauma'), false);
});

test('normalizeTaxonomyRow maps database columns to UI shape', () => {
  const row = normalizeTaxonomyRow({
    id: 'ang-1',
    product_id: 'immuvi',
    name: '- Proof Angles',
    status: '',
    source_link: 'https://example.com',
    notes: 'note',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    archived_at: null,
  });

  assert.deepEqual(row, {
    id: 'ang-1',
    productId: 'immuvi',
    name: 'Proof Angles',
    status: 'Untested',
    sourceLink: 'https://example.com',
    notes: 'note',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    archivedAt: '',
  });
});

test('newTaxonomyId follows the legacy manual id shape', () => {
  const id = newTaxonomyId('persona', [], 1700000000000, () => 0.123456789);
  assert.match(id, /^per-manual-[a-z0-9]+-[a-z0-9]+$/);
});

test('taxonomy stats and status are derived from top-level creatives', () => {
  const creatives = [
    { id: 'ad-1', angle: 'Proof', persona: 'Skeptic', status: 'Testing' },
    { id: 'ad-2', angle: 'Proof', persona: 'Skeptic', status: 'Winner' },
    { id: 'ad-3', angle: 'Proof', persona: 'Busy Mom', status: 'Loser' },
    { id: 'ad-4', angle: 'Proof', persona: 'Busy Mom', status: 'Winner', parentAdId: 'ad-1' },
    { id: 'ad-5', angle: 'Other', persona: 'Skeptic', status: 'Scale' },
  ];

  assert.equal(deriveTaxonomyStatus('angle', 'Proof', creatives), 'Winner');
  assert.deepEqual(taxonomyStats('angle', 'Proof', creatives), {
    creatives: 3,
    relatedCount: 2,
    winners: 1,
    winRate: 33,
  });
  assert.equal(deriveTaxonomyStatus('persona', 'Skeptic', creatives), 'Winner');
  assert.deepEqual(taxonomyStats('persona', 'Skeptic', creatives), {
    creatives: 3,
    relatedCount: 2,
    winners: 2,
    winRate: 67,
  });
});

test('taxonomy summary and archive filters mirror legacy tracker views', () => {
  const rows = [
    { id: 'ang-1', name: 'Proof', archivedAt: '' },
    { id: 'ang-2', name: 'Speed', archivedAt: '2026-01-01T00:00:00Z' },
    { id: 'ang-3', name: 'Empty', archivedAt: '' },
  ];
  const creatives = [
    { id: 'ad-1', angle: 'Proof', persona: 'Skeptic', status: 'Testing' },
    { id: 'ad-2', angle: 'Speed', persona: 'Skeptic', status: 'Scale' },
  ];

  assert.deepEqual(filterTaxonomyRows(rows, 'active').map((row) => row.id), ['ang-1', 'ang-3']);
  assert.deepEqual(filterTaxonomyRows(rows, 'archived').map((row) => row.id), ['ang-2']);
  assert.deepEqual(summarizeTaxonomyRows('angle', rows, creatives), {
    total: 3,
    active: 2,
    archived: 1,
    winners: 1,
    testing: 1,
    untested: 1,
    totalCreatives: 2,
  });
});

test('taxonomy semantic scoring ignores shallow persona modifiers', () => {
  assert.ok(taxonomySimilarityScore('Side-Hustle Sellers', 'Side-Hustle Sellers 22-45') >= 0.9);
  assert.ok(taxonomySimilarityScore('ADHD Adults Seeking Tools', 'Adults Seeking Medication-Free ADHD Help') >= 0.72);
});

test('taxonomy merge suggestions choose the stronger canonical row', () => {
  const rows = [
    { id: 'per-1', name: 'Side-Hustle Sellers', archivedAt: '', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'per-2', name: 'Side-Hustle Sellers 22-45', archivedAt: '', createdAt: '2026-01-02T00:00:00Z' },
    { id: 'per-3', name: 'Busy Parents', archivedAt: '', createdAt: '2026-01-03T00:00:00Z' },
  ];
  const creatives = [
    { id: 'ad-1', persona: 'Side-Hustle Sellers', status: 'Winner' },
    { id: 'ad-2', persona: 'Side-Hustle Sellers 22-45', status: 'Testing' },
  ];

  const suggestions = findTaxonomyMergeSuggestions('persona', rows, creatives);
  assert.equal(suggestions[0].keep.name, 'Side-Hustle Sellers');
  assert.equal(suggestions[0].merge.name, 'Side-Hustle Sellers 22-45');
});

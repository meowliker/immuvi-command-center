import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeTaxonomyName, sameTaxonomyName, taxonomyKey } from '../../lib/domain/taxonomy.js';

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

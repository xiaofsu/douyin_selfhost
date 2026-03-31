import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRecommendedVideosPath } from '../dist/assets/js/core/api.mjs';

test('buildRecommendedVideosPath defaults to five-item batches and carries the pagination seed', () => {
  assert.equal(
    buildRecommendedVideosPath({ seed: 'session-1' }),
    '/video/recommended?start=0&pageSize=5&seed=session-1',
  );
  assert.equal(
    buildRecommendedVideosPath({ start: 10, pageSize: 5, seed: 'session-1' }),
    '/video/recommended?start=10&pageSize=5&seed=session-1',
  );
});

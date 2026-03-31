import test from 'node:test';
import assert from 'node:assert/strict';

import { parseRoute } from '../dist/assets/js/core/router.mjs';

test('parseRoute resolves home and likes routes', () => {
  assert.deepEqual(parseRoute(new URL('http://localhost/')), {
    name: 'home',
    playId: '',
  });

  assert.deepEqual(parseRoute(new URL('http://localhost/likes')), {
    name: 'likes-grid',
    playId: '',
  });

  assert.deepEqual(parseRoute(new URL('http://localhost/likes?play=abc123')), {
    name: 'likes-player',
    playId: 'abc123',
  });
});

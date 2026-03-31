import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clamp,
  createSessionFeed,
  deriveNextLikedPlayerState,
  normalizeVideo,
  resolvePlayerEntry,
} from '../dist/assets/js/core/state.mjs';

test('normalizeVideo extracts the client shape and liked status', () => {
  const raw = {
    aweme_id: 'abc123',
    desc: 'Night drive',
    author: {
      nickname: 'Local User',
      avatar_thumb: {
        url_list: ['avatar.png'],
      },
    },
    video: {
      play_addr: {
        url_list: ['/media/night-drive.mp4'],
      },
    },
  };

  const video = normalizeVideo(raw, new Set(['abc123']));

  assert.deepEqual(video, {
    awemeId: 'abc123',
    desc: 'Night drive',
    authorName: 'Local User',
    avatarUrl: 'avatar.png',
    src: '/media/night-drive.mp4',
    liked: true,
    raw,
  });
});

test('createSessionFeed returns a shuffled copy without mutating input', () => {
  const list = [
    { awemeId: '1' },
    { awemeId: '2' },
    { awemeId: '3' },
  ];

  const feed = createSessionFeed(list, () => 0);

  assert.deepEqual(list.map((item) => item.awemeId), ['1', '2', '3']);
  assert.deepEqual(feed.map((item) => item.awemeId), ['2', '3', '1']);
});

test('resolvePlayerEntry prefers the requested aweme id and falls back to the first item', () => {
  const videos = [{ awemeId: 'one' }, { awemeId: 'two' }, { awemeId: 'three' }];

  assert.deepEqual(resolvePlayerEntry(videos, 'two'), {
    index: 1,
    video: videos[1],
  });
  assert.deepEqual(resolvePlayerEntry(videos, 'missing'), {
    index: 0,
    video: videos[0],
  });
  assert.deepEqual(resolvePlayerEntry([], 'missing'), {
    index: -1,
    video: null,
  });
});

test('deriveNextLikedPlayerState removes the current liked video and advances to the next valid item', () => {
  const videos = [{ awemeId: 'one' }, { awemeId: 'two' }, { awemeId: 'three' }];

  assert.deepEqual(deriveNextLikedPlayerState(videos, 1), {
    list: [{ awemeId: 'one' }, { awemeId: 'three' }],
    nextIndex: 1,
    isEmpty: false,
  });

  assert.deepEqual(deriveNextLikedPlayerState([{ awemeId: 'solo' }], 0), {
    list: [],
    nextIndex: -1,
    isEmpty: true,
  });
});

test('clamp limits values for draggable seek calculations', () => {
  assert.equal(clamp(-0.5, 0, 1), 0);
  assert.equal(clamp(0.25, 0, 1), 0.25);
  assert.equal(clamp(1.5, 0, 1), 1);
});

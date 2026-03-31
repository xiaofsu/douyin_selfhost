import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateTransferSpeedMbps,
  clamp,
  createHomeRefreshState,
  createSessionFeed,
  describeVideoPath,
  deriveNextLikedPlayerState,
  resolveNetworkSpeedLabel,
  normalizeVideo,
  resolveHomeNavigationIntent,
  resolvePlayerVideoFit,
  resolvePlayerVideoObjectPositionY,
  resolveSoundPreference,
  resolvePlayerEntry,
  seekRatioFromPointer,
  shouldAttachVideoSource,
  shouldLoadMoreFeed,
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

test('createHomeRefreshState resets home feed paging and playback for a full replay', () => {
  assert.deepEqual(createHomeRefreshState('seed-next'), {
    homeFeed: [],
    homeFeedSeed: 'seed-next',
    homeFeedTotal: 0,
    homeHasMore: false,
    homeIsLoadingMore: false,
    homeActiveIndex: 0,
    homePlaybackSnapshot: null,
    soundEnabled: false,
  });
});

test('resolveHomeNavigationIntent refreshes only when the viewer is already on home', () => {
  assert.equal(resolveHomeNavigationIntent('home'), 'refresh');
  assert.equal(resolveHomeNavigationIntent('likes-grid'), 'resume');
  assert.equal(resolveHomeNavigationIntent('likes-player'), 'resume');
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

test('describeVideoPath extracts filename and directory from local media src', () => {
  assert.deepEqual(
    describeVideoPath({
      src: '/media/piano/classroom/lesson-07.mp4',
    }),
    {
      fileName: 'lesson-07.mp4',
      directory: '/media/piano/classroom',
    },
  );
});

test('resolvePlayerVideoFit uses cover for portrait videos and contain for landscape videos', () => {
  assert.equal(resolvePlayerVideoFit(720, 1280), 'cover');
  assert.equal(resolvePlayerVideoFit(1280, 720), 'contain');
  assert.equal(resolvePlayerVideoFit(1080, 1080), 'cover');
  assert.equal(resolvePlayerVideoFit(0, 0), 'contain');
});

test('resolvePlayerVideoObjectPositionY shifts wide videos upward based on aspect ratio', () => {
  assert.equal(resolvePlayerVideoObjectPositionY(720, 1280), 50);
  assert.equal(resolvePlayerVideoObjectPositionY(1280, 720), 47.3);
  assert.equal(resolvePlayerVideoObjectPositionY(1024, 768), 48.8);
  assert.equal(resolvePlayerVideoObjectPositionY(5120, 1440), 45);
  assert.equal(resolvePlayerVideoObjectPositionY(0, 0), 50);
});

test('seekRatioFromPointer clamps the drag position to the progress bar width', () => {
  assert.equal(seekRatioFromPointer(0, 100, 200), 0);
  assert.equal(seekRatioFromPointer(200, 100, 200), 0.5);
  assert.equal(seekRatioFromPointer(400, 100, 200), 1);
});

test('resolveSoundPreference keeps user-enabled audio across playback failures', () => {
  assert.equal(resolveSoundPreference(false, 'enable'), true);
  assert.equal(resolveSoundPreference(true, 'playback-error'), true);
  assert.equal(resolveSoundPreference(true, 'disable'), false);
});

test('calculateTransferSpeedMbps converts bytes and duration into Mbps', () => {
  assert.equal(calculateTransferSpeedMbps(1_250_000, 1000), 10);
  assert.equal(calculateTransferSpeedMbps(0, 1000), 0);
  assert.equal(calculateTransferSpeedMbps(1_250_000, 0), 0);
});

test('resolveNetworkSpeedLabel prefers measured speed and falls back to connection downlink', () => {
  assert.equal(
    resolveNetworkSpeedLabel({
      measuredMbps: 12.36,
      connectionDownlinkMbps: 8.8,
    }),
    '12.4 Mbps',
  );
  assert.equal(
    resolveNetworkSpeedLabel({
      measuredMbps: null,
      connectionDownlinkMbps: 0.78,
    }),
    '780 Kbps',
  );
  assert.equal(resolveNetworkSpeedLabel({}), '测速中');
});

test('shouldLoadMoreFeed triggers when the viewer reaches the third item of the loaded batch', () => {
  assert.equal(shouldLoadMoreFeed(1, 5, true, false), false);
  assert.equal(shouldLoadMoreFeed(2, 5, true, false), true);
  assert.equal(shouldLoadMoreFeed(6, 10, true, false), false);
  assert.equal(shouldLoadMoreFeed(7, 10, true, false), true);
  assert.equal(shouldLoadMoreFeed(7, 10, false, false), false);
  assert.equal(shouldLoadMoreFeed(7, 10, true, true), false);
});

test('shouldAttachVideoSource only keeps the active video and its immediate neighbors ready', () => {
  assert.equal(shouldAttachVideoSource(0, 0), true);
  assert.equal(shouldAttachVideoSource(1, 0), true);
  assert.equal(shouldAttachVideoSource(2, 0), false);
  assert.deepEqual(
    [0, 1, 2, 3, 4].filter((index) => shouldAttachVideoSource(index, 2)),
    [1, 2, 3],
  );
});

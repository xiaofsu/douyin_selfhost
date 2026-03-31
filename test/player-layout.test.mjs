import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canCommitPendingSeek,
  renderPlayerMarkup,
  resolveDisplayedProgressSnapshot,
} from '../dist/assets/js/components/player.mjs';
import { renderLikesGridMarkup } from '../dist/assets/js/components/likes-grid.mjs';

const sampleVideo = {
  awemeId: 'abc123',
  desc: 'Night drive',
  authorName: 'Local User',
  avatarUrl: 'avatar.png',
  src: '/media/piano/classroom/lesson-07.mp4',
  liked: false,
};

test('renderPlayerMarkup uses fullscreen overlay nav and minimal metadata', () => {
  const html = renderPlayerMarkup({
    videos: [sampleVideo],
    activeTab: 'home',
    startIndex: 0,
    soundEnabled: false,
  });

  assert.equal(html.includes('按住 2x 倍速'), false);
  assert.equal(html.includes('player-header'), false);
  assert.equal(html.includes('bottom-nav'), false);
  assert.equal(html.includes('player-avatar'), false);
  assert.equal(html.includes('Night drive'), false);
  assert.equal(html.includes('Local User'), false);
  assert.equal(html.includes('首页'), true);
  assert.equal(html.includes('我的'), true);
  assert.equal(html.includes('2 倍速播放中'), true);
  assert.equal(html.includes('data-toggle-mute'), true);
  assert.equal(html.includes('lesson-07.mp4'), true);
  assert.equal(html.includes('/media/piano/classroom'), true);
});

test('renderPlayerMarkup highlights 我的 on liked-player routes', () => {
  const html = renderPlayerMarkup({
    videos: [sampleVideo],
    activeTab: 'likes',
    startIndex: 0,
    soundEnabled: false,
  });

  assert.equal(html.includes('data-nav-home'), true);
  assert.equal(html.includes('data-nav-likes'), true);
  assert.equal(html.includes('data-player-top-nav'), true);
  assert.match(html, /floating-nav-link is-active"[\s\S]*data-nav-likes[\s\S]*>我的<\/button>/);
});

test('renderPlayerMarkup hides the mute toggle after audio is enabled', () => {
  const html = renderPlayerMarkup({
    videos: [sampleVideo],
    activeTab: 'home',
    startIndex: 0,
    soundEnabled: true,
  });

  assert.match(html, /action-button action-button--mute is-hidden/);
});

test('resolveDisplayedProgressSnapshot keeps the confirmed time until the seek target is ready', () => {
  const committedSnapshot = {
    ratio: 0.2,
    currentTime: 12,
    duration: 60,
  };

  const liveSnapshot = {
    ratio: 0.75,
    currentTime: 45,
    duration: 60,
  };

  assert.deepEqual(
    resolveDisplayedProgressSnapshot({
      committedSnapshot,
      liveSnapshot,
      previewRatio: 0.75,
      awaitingSeekCommit: true,
    }),
    {
      ratio: 0.75,
      currentTime: 12,
      duration: 60,
    },
  );

  assert.deepEqual(
    resolveDisplayedProgressSnapshot({
      committedSnapshot,
      liveSnapshot,
      previewRatio: 0.75,
      awaitingSeekCommit: false,
    }),
    liveSnapshot,
  );
});

test('canCommitPendingSeek waits until the browser has current frame data for the seek target', () => {
  assert.equal(canCommitPendingSeek(null), false);
  assert.equal(canCommitPendingSeek({ seeking: true, readyState: 4 }), false);
  assert.equal(canCommitPendingSeek({ seeking: false, readyState: 1 }), false);
  assert.equal(canCommitPendingSeek({ seeking: false, readyState: 2 }), true);
});

test('renderLikesGridMarkup removes hero copy and keeps compact top nav', () => {
  const html = renderLikesGridMarkup({
    videos: [sampleVideo],
  });

  assert.equal(html.includes('likes-hero'), false);
  assert.equal(html.includes('screen-header'), false);
  assert.equal(html.includes('bottom-nav'), false);
  assert.equal(html.includes('Night drive'), false);
  assert.equal(html.includes('Local User'), false);
  assert.equal(html.includes('lesson-07.mp4'), true);
  assert.equal(html.includes('/media/piano/classroom'), true);
  assert.equal(html.includes('首页'), true);
  assert.equal(html.includes('我的'), true);
});

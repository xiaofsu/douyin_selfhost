import test from 'node:test';
import assert from 'node:assert/strict';

import { renderPlayerMarkup } from '../dist/assets/js/components/player.mjs';
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
  assert.equal(html.includes('lesson-07.mp4'), true);
  assert.equal(html.includes('/media/piano/classroom'), true);
});

test('renderPlayerMarkup highlights 我的 on liked-player routes', () => {
  const html = renderPlayerMarkup({
    videos: [sampleVideo],
    activeTab: 'likes',
    startIndex: 0,
  });

  assert.equal(html.includes('data-nav-home'), true);
  assert.equal(html.includes('data-nav-likes'), true);
  assert.equal(html.includes('data-player-top-nav'), true);
  assert.match(html, /floating-nav-link is-active"[\s\S]*data-nav-likes[\s\S]*>我的<\/button>/);
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

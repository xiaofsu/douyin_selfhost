import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  canCommitPendingSeek,
  createPlaybackSnapshot,
  renderPlayerMarkup,
  resolveFastModeViewState,
  resolvePlaybackResumeTime,
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
const playerScript = readFileSync(new URL('../dist/assets/js/components/player.mjs', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../dist/assets/styles.css', import.meta.url), 'utf8');

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
  assert.equal(html.includes('data-network-speed'), true);
  assert.equal(html.includes('0 Mbps'), true);
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

test('player video styles show the full frame instead of cropping it', () => {
  assert.match(
    styles,
    /\.player-video\s*\{[\s\S]*object-fit:\s*contain;[\s\S]*object-position:\s*center var\(--player-video-object-position-y,\s*50%\);/,
  );
  assert.match(styles, /\.player-video\.is-portrait\s*\{[\s\S]*object-fit:\s*cover;/);
  assert.match(styles, /\.player-video\.is-landscape\s*\{[\s\S]*object-fit:\s*contain;/);
});

test('player scrim removes the dark gradient overlay', () => {
  const scrimRules = Array.from(styles.matchAll(/(?:^|\n)\.player-scrim\s*\{([\s\S]*?)\}/g));

  assert.ok(scrimRules.length > 0, 'expected .player-scrim rule to exist');
  assert.equal(scrimRules.some(([, rule]) => rule.includes('linear-gradient')), false);
});

test('player shell includes ios fill-available fallback for fullscreen coverage', () => {
  assert.match(
    styles,
    /\.app-shell--player\s*\{[\s\S]*position:\s*fixed;[\s\S]*inset:\s*0;/,
  );
  assert.match(styles, /\.phone-frame--player\s*\{[\s\S]*height:\s*-webkit-fill-available;/);
  assert.match(styles, /\.phone-frame--player\s*\{[\s\S]*height:\s*100%;/);
});

test('player top nav uses text shadow for readability', () => {
  assert.match(
    styles,
    /\.floating-nav-link\s*\{[\s\S]*text-shadow:\s*0\s+2px\s+12px\s+rgba\(0,\s*0,\s*0,\s*0\.45\);/,
  );
});

test('resolveFastModeViewState hides player chrome during long-press playback', () => {
  assert.deepEqual(resolveFastModeViewState(false), {
    chromeHidden: false,
    speedChipActive: false,
  });
  assert.deepEqual(resolveFastModeViewState(true), {
    chromeHidden: true,
    speedChipActive: true,
  });
});

test('createPlaybackSnapshot captures the active video progress for home resume', () => {
  assert.deepEqual(
    createPlaybackSnapshot({ awemeId: 'abc123' }, { currentTime: 18.4 }),
    {
      awemeId: 'abc123',
      currentTime: 18.4,
    },
  );
  assert.equal(createPlaybackSnapshot({ awemeId: '' }, { currentTime: 18.4 }), null);
});

test('resolvePlaybackResumeTime only restores matching videos and clamps the target time', () => {
  assert.equal(
    resolvePlaybackResumeTime({ awemeId: 'abc123', currentTime: 18.4 }, { awemeId: 'abc123' }, 60),
    18.4,
  );
  assert.equal(
    resolvePlaybackResumeTime({ awemeId: 'abc123', currentTime: 100 }, { awemeId: 'abc123' }, 60),
    60,
  );
  assert.equal(
    resolvePlaybackResumeTime({ awemeId: 'else', currentTime: 18.4 }, { awemeId: 'abc123' }, 60),
    null,
  );
});

test('player fast mode styles hide chrome and scrim while keeping the video visible', () => {
  assert.match(
    styles,
    /\.player-stage\.is-fast-mode\s+\.player-top-nav,\s*\.player-stage\.is-fast-mode\s+\.network-speed,\s*\.player-stage\.is-fast-mode\s+\.player-meta,\s*\.player-stage\.is-fast-mode\s+\.player-actions,\s*\.player-stage\.is-fast-mode\s+\.player-progress,\s*\.player-stage\.is-fast-mode\s+\.player-scrim\s*\{[\s\S]*opacity:\s*0;[\s\S]*pointer-events:\s*none;/,
  );
  assert.match(
    styles,
    /\.player-stage\.is-fast-mode\s+\.player-slide\.is-active\s+\.player-meta,\s*\.player-stage\.is-fast-mode\s+\.player-slide\.is-active\s+\.player-actions\s*\{[\s\S]*opacity:\s*0;/,
  );
});

test('player network speed is pinned to the top-left with readable text styling', () => {
  assert.match(
    styles,
    /\.network-speed\s*\{[\s\S]*top:\s*max\(18px,\s*calc\(env\(safe-area-inset-top\)\s*\+\s*6px\)\);[\s\S]*left:\s*18px;[\s\S]*text-shadow:\s*0\s+2px\s+12px\s+rgba\(0,\s*0,\s*0,\s*0\.45\);/,
  );
});

test('player network speed refresh interval is fixed to 500ms', () => {
  assert.equal(playerScript.includes('const SPEED_PROBE_INTERVAL_MS = 500;'), true);
});

test('player requests a screen wake lock and re-acquires it when the page becomes visible again', () => {
  assert.equal(playerScript.includes("wakeLock.request('screen')"), true);
  assert.equal(playerScript.includes('releaseWakeLock()'), true);
  assert.equal(playerScript.includes('void ensureWakeLock();'), true);
});

test('player action rail is bottom-aligned and uses compact button sizing', () => {
  assert.match(
    styles,
    /\.player-actions\s*\{[\s\S]*bottom:\s*max\(64px,\s*calc\(env\(safe-area-inset-bottom\)\s*\+\s*46px\)\);[\s\S]*top:\s*auto;[\s\S]*transform:\s*none;/,
  );
  assert.match(
    styles,
    /\.action-button\s*\{[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;/,
  );
});

test('player action buttons render as standalone icons without background chrome', () => {
  assert.match(
    styles,
    /\.action-button\s*\{[\s\S]*border:\s*0;[\s\S]*background:\s*transparent;[\s\S]*backdrop-filter:\s*none;/,
  );
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
  assert.equal(html.includes('<span>/media/piano/classroom</span>'), false);
  assert.equal(html.includes('首页'), true);
  assert.equal(html.includes('我的'), true);
});

test('likes card file name uses single-line ellipsis instead of overflowing the card', () => {
  assert.match(
    styles,
    /\.likes-card-copy\s*\{[\s\S]*min-width:\s*0;/,
  );
  assert.match(
    styles,
    /\.likes-card-copy strong\s*\{[\s\S]*overflow:\s*hidden;[\s\S]*text-overflow:\s*ellipsis;[\s\S]*white-space:\s*nowrap;/,
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

async function read(path) {
  return fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('release workflow no longer clones or builds the legacy frontend', async () => {
  const workflow = await read('.github/workflows/release.yml');

  assert.equal(workflow.includes('git clone https://github.com/zyronon/douyin.git'), false);
  assert.equal(workflow.includes('pnpm install'), false);
  assert.equal(workflow.includes('pnpm build'), false);
  assert.equal(workflow.includes('frontend/dist'), false);
  assert.equal(workflow.includes('posts6.json'), false);
});

test('readme only documents the built-in local frontend flow', async () => {
  const readme = await read('README.md');

  assert.equal(readme.includes('zyronon/douyin'), false);
  assert.equal(readme.includes('src/assets/data/posts6.json'), false);
  assert.equal(readme.includes('不需要额外准备外部前端工程'), true);
});

test('backend startup code does not reference legacy posts6 fallback paths', async () => {
  const mainGo = await read('main.go');

  assert.equal(mainGo.includes('src/assets/data/posts6.json'), false);
  assert.equal(mainGo.includes('Trying src path'), false);
});

test('backend only keeps the API routes used by the built-in frontend', async () => {
  const mainGo = await read('main.go');

  const removedRoutes = [
    '/video/long/recommended',
    '/video/comments',
    '/video/private',
    '/video/my',
    '/video/history',
    '/api/video/list',
    '/user/panel',
    '/user/collect',
    '/user/video_list',
    '/user/friends',
    '/historyOther',
    '/post/recommended',
    '/shop/recommended',
    '/music',
  ];

  for (const route of removedRoutes) {
    assert.equal(mainGo.includes(route), false, `expected legacy route ${route} to be removed`);
  }
});

test('home navigation refreshes only on the home route and resumes from likes routes', async () => {
  const appScript = await read('dist/assets/js/app.mjs');

  assert.equal(appScript.includes('async function handleOpenHomeRequest()'), true);
  assert.equal(appScript.includes('const navigationIntent = resolveHomeNavigationIntent(currentRoute.name);'), true);
  assert.equal(appScript.includes("bind('[data-open-home]', handleOpenHomeRequest);"), true);
  assert.equal(appScript.includes('onOpenHome: handleOpenHomeRequest,'), true);
  assert.equal(appScript.includes("if (navigationIntent === 'resume') {"), true);
  assert.equal(appScript.includes("navigate('home');"), true);
  assert.equal(appScript.includes('loadInitialData({ force: true })'), true);
  assert.equal(appScript.includes('homePlaybackSnapshot'), true);
});

test('ios standalone metadata is present for status-bar coverage', async () => {
  const indexHtml = await read('dist/index.html');
  const manifest = JSON.parse(await read('dist/manifest.webmanifest'));

  assert.equal(indexHtml.includes('viewport-fit=cover'), true);
  assert.equal(indexHtml.includes('apple-mobile-web-app-capable'), true);
  assert.equal(indexHtml.includes('apple-mobile-web-app-status-bar-style'), true);
  assert.equal(indexHtml.includes('rel="manifest"'), true);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.name, '本地抖音播放器');
});

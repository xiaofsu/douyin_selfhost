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

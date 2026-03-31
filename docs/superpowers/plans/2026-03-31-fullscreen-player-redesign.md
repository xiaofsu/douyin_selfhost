# Fullscreen Player Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把首页播放器改成真正的全屏极简样式，并把“我的喜欢”列表页收成同一套导航语言，同时修复长按 2 倍速时的浏览器默认选中/弹框问题。

**Architecture:** 继续复用现有 `app.mjs` 路由切换、`player.mjs` 播放器实例和 `likes-grid.mjs` 列表页结构，不引入新框架。把可测试的界面决策下沉为纯函数和纯 markup helper，再由组件函数消费，这样可以用现有 `node --test` 基础设施做 TDD。

**Tech Stack:** 原生 ES modules、现有 Node 内置测试、现有 CSS 文件、浏览器原生事件。

---

### Task 1: 建立可测试的界面辅助函数与失败测试

**Files:**
- Modify: `test/frontend-core.test.mjs`
- Create: `test/player-layout.test.mjs`
- Modify: `dist/assets/js/core/state.mjs`
- Modify: `dist/assets/js/components/player.mjs`
- Modify: `dist/assets/js/components/likes-grid.mjs`

- [ ] **Step 1: 写失败测试，覆盖文件名/目录解析**

```js
test('describeVideoPath extracts filename and directory from local media src', () => {
  assert.deepEqual(describeVideoPath({
    src: '/media/piano/classroom/lesson-07.mp4',
  }), {
    fileName: 'lesson-07.mp4',
    directory: '/media/piano/classroom',
  });
});
```

- [ ] **Step 2: 运行测试确认红灯**

Run: `node --test test/frontend-core.test.mjs test/player-layout.test.mjs`
Expected: FAIL，提示缺少 `describeVideoPath` / `renderPlayerMarkup` / `renderLikesGridMarkup`

- [ ] **Step 3: 写失败测试，覆盖播放器新结构**

```js
test('renderPlayerMarkup uses fullscreen overlay nav and minimal metadata', () => {
  const html = renderPlayerMarkup({
    videos: [{ awemeId: '1', src: '/media/piano/classroom/lesson-07.mp4' }],
    activeTab: 'home',
  });

  assert.equal(html.includes('按住 2x 倍速'), false);
  assert.equal(html.includes('bottom-nav'), false);
  assert.equal(html.includes('player-avatar'), false);
  assert.equal(html.includes('首页'), true);
  assert.equal(html.includes('我的'), true);
  assert.equal(html.includes('2 倍速播放中'), true);
});
```

- [ ] **Step 4: 写失败测试，覆盖喜欢列表页新结构**

```js
test('renderLikesGridMarkup removes hero copy and keeps compact top nav', () => {
  const html = renderLikesGridMarkup({ videos: [] });
  assert.equal(html.includes('likes-hero'), false);
  assert.equal(html.includes('bottom-nav'), false);
  assert.equal(html.includes('首页'), true);
  assert.equal(html.includes('我的'), true);
});
```

- [ ] **Step 5: 先补最小实现，让测试能运行到真正断言**

```js
export function describeVideoPath(video) {
  return { fileName: '', directory: '' };
}
```

### Task 2: 落实播放器全屏结构与长按行为

**Files:**
- Modify: `dist/assets/js/components/player.mjs`
- Modify: `dist/assets/js/core/state.mjs`
- Modify: `dist/assets/styles.css`

- [ ] **Step 1: 在 `state.mjs` 中完成路径描述函数**

```js
export function describeVideoPath(video) {
  const pathname = new URL(video?.src || '/', 'http://localhost').pathname;
  const parts = pathname.split('/').filter(Boolean);
  const fileName = parts.at(-1) || '未知文件';
  const directory = parts.length > 1 ? `/${parts.slice(0, -1).join('/')}` : '/';
  return { fileName, directory };
}
```

- [ ] **Step 2: 在 `player.mjs` 中提取 `renderPlayerMarkup()`，移除旧 header / avatar / desc / caption**

```js
export function renderPlayerMarkup({ videos, activeTab }) {
  return `
    <div class="player-top-nav">...</div>
    <div class="player-meta-compact">...</div>
    <div class="player-actions"><button ...>...</button></div>
  `;
}
```

- [ ] **Step 3: 把长按提示改成固定文案 `2 倍速播放中`，并删除旧提示文案**

```js
<div class="speed-chip" data-speed-chip>2 倍速播放中</div>
```

- [ ] **Step 4: 给播放器表层补禁默认长按行为**

```js
stage.addEventListener('contextmenu', (event) => event.preventDefault());
stage.addEventListener('selectstart', (event) => event.preventDefault());
```

- [ ] **Step 5: 在 `styles.css` 中更新全屏浮层样式**

```css
.player-stage { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.player-top-nav { position: absolute; top: ...; right: ...; }
.speed-chip { top: 72px; left: 50%; transform: translateX(-50%); }
```

### Task 3: 落实喜欢列表页极简样式并回归验证

**Files:**
- Modify: `dist/assets/js/components/likes-grid.mjs`
- Modify: `dist/assets/styles.css`
- Modify: `test/player-layout.test.mjs`
- Modify: `test/frontend-core.test.mjs`

- [ ] **Step 1: 提取 `renderLikesGridMarkup()`，移除 hero 区和底部导航**

```js
export function renderLikesGridMarkup({ videos }) {
  return `
    <div class="likes-page">
      <div class="top-nav">...</div>
      <section class="likes-scroll">...</section>
    </div>
  `;
}
```

- [ ] **Step 2: 把卡片文案压缩到最少，只保留必要识别信息**

```js
<span class="likes-card-copy">
  <strong>${fileName}</strong>
  <span>${directory}</span>
</span>
```

- [ ] **Step 3: 跑 targeted tests，确认从红到绿**

Run: `node --test test/frontend-core.test.mjs test/player-layout.test.mjs`
Expected: PASS

- [ ] **Step 4: 跑全量前端测试**

Run: `node --test test/*.test.mjs`
Expected: PASS

- [ ] **Step 5: 跑静态语法检查**

Run:
`node --check dist/assets/js/components/player.mjs`
`node --check dist/assets/js/components/likes-grid.mjs`
`node --check dist/assets/js/app.mjs`

Expected: 全部退出码 0

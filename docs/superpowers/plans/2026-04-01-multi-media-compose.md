# Multi-Media Compose Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the repository so Docker Compose usage is explicitly documented for mounting multiple host media directories into `/app/media` subdirectories.

**Architecture:** Keep the backend unchanged and rely on its existing recursive scan of `/app/media`. Enforce the new documented behavior with a repository consistency test, then update `README.md` to show a copy-pasteable multi-directory Compose example and clarify that Compose is the path for multi-directory mounts.

**Tech Stack:** Markdown documentation, Node.js `node:test` repository consistency checks

---

### Task 1: Lock the documentation requirement with a failing repository test

**Files:**
- Modify: `test/repo-consistency.test.mjs`
- Test: `test/repo-consistency.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
test('readme documents multi-directory docker compose mounts under app media subdirectories', async () => {
  const readme = await read('README.md');

  assert.equal(readme.includes('/app/media/anime'), true);
  assert.equal(readme.includes('/app/media/movie'), true);
  assert.equal(readme.includes('多个宿主目录'), true);
  assert.equal(readme.includes('docker compose'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/repo-consistency.test.mjs`
Expected: FAIL in the new README multi-directory assertion because the current README only shows a single `./data:/app/media` mount.

- [ ] **Step 3: Commit**

```bash
git add test/repo-consistency.test.mjs
git commit -m "test: require multi-directory compose docs"
```

### Task 2: Update README to document the supported multi-directory Compose pattern

**Files:**
- Modify: `README.md`
- Test: `test/repo-consistency.test.mjs`

- [ ] **Step 1: Write minimal implementation**

```md
## Docker Compose 部署

### 1. 准备目录

你可以挂载单个目录，也可以把多个宿主目录分别挂到 `/app/media` 下的不同子目录。

```yaml
services:
  backend:
    image: ghcr.io/xiaofsu/douyin_selfhost:latest
    container_name: douyin_backend
    volumes:
      - "/data/anime:/app/media/anime:ro"
      - "/data/movie:/app/media/movie:ro"
      - "./app-data:/app/data"
```

播放器会递归扫描 `/app/media`，因此会自动发现这些子目录里的视频文件。
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --test test/repo-consistency.test.mjs`
Expected: PASS with the new README documentation assertions satisfied.

- [ ] **Step 3: Commit**

```bash
git add README.md test/repo-consistency.test.mjs
git commit -m "docs: document multi-directory compose mounts"
```

### Task 3: Final verification

**Files:**
- Test: `test/repo-consistency.test.mjs`
- Test: `main_test.go`

- [ ] **Step 1: Run repository documentation regression tests**

Run: `node --test test/repo-consistency.test.mjs`
Expected: PASS with all repository consistency assertions green.

- [ ] **Step 2: Run backend tests to confirm no incidental regressions**

Run: `go test ./...`
Expected: PASS with `ok` for the module test run.

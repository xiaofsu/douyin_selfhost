# Media Snapshot Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cached media index so `/video/recommended` stops rescanning the full media tree on every request.

**Architecture:** Build a full in-memory snapshot at startup, serve recommendation requests from the cached snapshot, and refresh that snapshot in the background via debounced `fsnotify` events plus a 10-minute fallback full rescan. Keep refreshes full-scan and swap snapshots atomically so request handling stays simple and stable.

**Tech Stack:** Go 1.24, `github.com/fsnotify/fsnotify`, `testing`

---

### Task 1: Add failing tests for snapshot refresh and recursive watch discovery

**Files:**
- Modify: `main_test.go`
- Test: `main_test.go`

- [ ] **Step 1: Write the failing tests**

```go
func TestRefreshMediaSnapshotCachesSortedVideos(t *testing.T) {}
func TestCollectMediaWatchDirsIncludesNestedDirectories(t *testing.T) {}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./...`
Expected: FAIL because the new cache helpers and watch-directory collector do not exist yet.

### Task 2: Implement cached media snapshot and background refresh loop

**Files:**
- Modify: `main.go`
- Modify: `go.mod`
- Test: `main_test.go`

- [ ] **Step 1: Add minimal implementation**

```go
type mediaSnapshot struct {
	videos    []map[string]interface{}
	scannedAt time.Time
}
```

- [ ] **Step 2: Serve `/video/recommended` from cached snapshot instead of rescanning**

Run: `go test ./...`
Expected: PASS for snapshot-related tests after the cache helpers exist.

- [ ] **Step 3: Add recursive `fsnotify` watcher sync and 10-minute fallback rescan**

Run: `go test ./...`
Expected: PASS with watcher helper tests still green.

### Task 3: Final verification

**Files:**
- Test: `main_test.go`
- Test: `test/*.test.mjs`

- [ ] **Step 1: Run Go tests**

Run: `go test ./...`
Expected: PASS

- [ ] **Step 2: Run repository tests**

Run: `node --test test/*.test.mjs`
Expected: PASS

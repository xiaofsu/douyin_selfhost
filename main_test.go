package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestShuffleVideosReturnsShuffledCopyWithoutMutatingInput(t *testing.T) {
	original := []map[string]interface{}{
		{"aweme_id": "1"},
		{"aweme_id": "2"},
		{"aweme_id": "3"},
	}

	shuffled := shuffleVideos(original, func(n int, swap func(int, int)) {
		if n != 3 {
			t.Fatalf("expected shuffle length 3, got %d", n)
		}
		swap(0, 2)
	})

	if got := original[0]["aweme_id"]; got != "1" {
		t.Fatalf("expected original first item to stay 1, got %v", got)
	}
	if got := original[1]["aweme_id"]; got != "2" {
		t.Fatalf("expected original second item to stay 2, got %v", got)
	}
	if got := original[2]["aweme_id"]; got != "3" {
		t.Fatalf("expected original third item to stay 3, got %v", got)
	}

	expectedOrder := []string{"3", "2", "1"}
	for i, expected := range expectedOrder {
		if got := shuffled[i]["aweme_id"]; got != expected {
			t.Fatalf("expected shuffled[%d] to be %s, got %v", i, expected, got)
		}
	}
}

func TestNormalizeCollectPayloadKeepsMockShape(t *testing.T) {
	payload := CollectPayload{}
	normalizeCollectPayload(&payload)

	if payload.Code != 200 {
		t.Fatalf("expected code 200, got %d", payload.Code)
	}
	if payload.Msg != "" {
		t.Fatalf("expected empty msg, got %q", payload.Msg)
	}
	if payload.Data.Video.Total != 0 {
		t.Fatalf("expected empty video total, got %d", payload.Data.Video.Total)
	}
	if payload.Data.Video.List == nil {
		t.Fatal("expected video list to be initialized")
	}
	if payload.Data.Music.Total != 0 {
		t.Fatalf("expected empty music total, got %d", payload.Data.Music.Total)
	}
	if len(payload.Data.Music.List) != 0 {
		t.Fatalf("expected empty music list, got %d", len(payload.Data.Music.List))
	}
	if payload.Data.Music.List == nil {
		t.Fatal("expected music list to be initialized")
	}
}

func TestUpsertCollectedVideoPrependsAndDeduplicates(t *testing.T) {
	payload := CollectPayload{
		Data: CollectPayloadData{
			Video: CollectBucket{
				Total: 1,
				List: []map[string]interface{}{
					{"aweme_id": "old", "desc": "older"},
				},
			},
		},
	}

	if err := upsertCollectedVideo(&payload, map[string]interface{}{"aweme_id": "new", "desc": "first"}); err != nil {
		t.Fatalf("expected insert to succeed, got %v", err)
	}
	if err := upsertCollectedVideo(&payload, map[string]interface{}{"aweme_id": "new", "desc": "updated"}); err != nil {
		t.Fatalf("expected dedupe insert to succeed, got %v", err)
	}

	if payload.Data.Video.Total != 2 {
		t.Fatalf("expected total 2, got %d", payload.Data.Video.Total)
	}
	if got := payload.Data.Video.List[0]["aweme_id"]; got != "new" {
		t.Fatalf("expected newest video first, got %v", got)
	}
	if got := payload.Data.Video.List[0]["desc"]; got != "updated" {
		t.Fatalf("expected latest payload to replace duplicate, got %v", got)
	}
	if got := payload.Data.Video.List[1]["aweme_id"]; got != "old" {
		t.Fatalf("expected old video to stay after new one, got %v", got)
	}
}

func TestRemoveCollectedVideoDeletesByAwemeID(t *testing.T) {
	payload := CollectPayload{
		Data: CollectPayloadData{
			Video: CollectBucket{
				Total: 2,
				List: []map[string]interface{}{
					{"aweme_id": "1"},
					{"aweme_id": "2"},
				},
			},
		},
	}

	removeCollectedVideo(&payload, "1")

	if payload.Data.Video.Total != 1 {
		t.Fatalf("expected total 1 after delete, got %d", payload.Data.Video.Total)
	}
	if len(payload.Data.Video.List) != 1 {
		t.Fatalf("expected one video left, got %d", len(payload.Data.Video.List))
	}
	if got := payload.Data.Video.List[0]["aweme_id"]; got != "2" {
		t.Fatalf("expected remaining video id 2, got %v", got)
	}
}

func TestRefreshMediaSnapshotCachesSortedVideos(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "nested"), 0o755); err != nil {
		t.Fatalf("expected nested directory to be created, got %v", err)
	}

	olderPath := filepath.Join(root, "older.mp4")
	if err := os.WriteFile(olderPath, []byte("older"), 0o644); err != nil {
		t.Fatalf("expected older video to be created, got %v", err)
	}
	olderTime := time.Now().Add(-2 * time.Hour)
	if err := os.Chtimes(olderPath, olderTime, olderTime); err != nil {
		t.Fatalf("expected older video timestamp to be updated, got %v", err)
	}

	newerPath := filepath.Join(root, "nested", "newer.webm")
	if err := os.WriteFile(newerPath, []byte("newer"), 0o644); err != nil {
		t.Fatalf("expected newer video to be created, got %v", err)
	}
	newerTime := time.Now().Add(-1 * time.Hour)
	if err := os.Chtimes(newerPath, newerTime, newerTime); err != nil {
		t.Fatalf("expected newer video timestamp to be updated, got %v", err)
	}

	if err := refreshMediaSnapshot(root, "test"); err != nil {
		t.Fatalf("expected media snapshot refresh to succeed, got %v", err)
	}

	videos := getCachedMediaVideos()
	if len(videos) != 2 {
		t.Fatalf("expected two cached videos, got %d", len(videos))
	}

	if got := videos[0]["desc"]; got != "newer" {
		t.Fatalf("expected newest video first, got %v", got)
	}
	if got := videos[1]["desc"]; got != "older" {
		t.Fatalf("expected older video second, got %v", got)
	}

	playAddr, ok := videos[0]["video"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected cached video payload to contain video info, got %T", videos[0]["video"])
	}
	playURL, ok := playAddr["play_addr"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected cached video payload to contain play address, got %T", playAddr["play_addr"])
	}
	urlList, ok := playURL["url_list"].([]string)
	if !ok {
		t.Fatalf("expected play address url list, got %T", playURL["url_list"])
	}
	if len(urlList) != 1 || urlList[0] != "/media/nested/newer.webm" {
		t.Fatalf("expected nested media url to be preserved, got %v", urlList)
	}

	videos[0] = map[string]interface{}{"aweme_id": "mutated"}
	refetched := getCachedMediaVideos()
	if got := refetched[0]["aweme_id"]; got == "mutated" {
		t.Fatalf("expected cached snapshot reads to return a copied slice")
	}
}

func TestFindVideoByAwemeIDReadsCachedSnapshot(t *testing.T) {
	replaceMediaSnapshot([]map[string]interface{}{
		{"aweme_id": "target", "desc": "cached"},
	})

	video, found, err := findVideoByAwemeID("target")
	if err != nil {
		t.Fatalf("expected cached lookup to succeed, got %v", err)
	}
	if !found {
		t.Fatal("expected cached video to be found")
	}
	if got := video["desc"]; got != "cached" {
		t.Fatalf("expected cached video payload to be returned, got %v", got)
	}

	video["desc"] = "mutated"
	refetched, found, err := findVideoByAwemeID("target")
	if err != nil {
		t.Fatalf("expected cached lookup after mutation to succeed, got %v", err)
	}
	if !found {
		t.Fatal("expected cached video to still be found")
	}
	if got := refetched["desc"]; got != "cached" {
		t.Fatalf("expected cached lookup to return a cloned payload, got %v", got)
	}
}

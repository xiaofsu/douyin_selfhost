package main

import "testing"

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
	originalMusic := jsonMusic
	t.Cleanup(func() {
		jsonMusic = originalMusic
	})

	jsonMusic = []map[string]interface{}{
		{"id": 1, "title": "Song A"},
	}

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
	if payload.Data.Music.Total != 1 {
		t.Fatalf("expected music total 1, got %d", payload.Data.Music.Total)
	}
	if len(payload.Data.Music.List) != 1 {
		t.Fatalf("expected one music item, got %d", len(payload.Data.Music.List))
	}
	if got := payload.Data.Music.List[0]["title"]; got != "Song A" {
		t.Fatalf("expected music title Song A, got %v", got)
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

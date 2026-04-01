package main

import (
	"bytes"
	"crypto/md5"
	"embed"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type spaHandler struct {
	fileSystem fs.FS
	indexPath  string
}

func (h spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Clean the path
	path := r.URL.Path
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	path = strings.TrimPrefix(path, "/")

	if path == "" {
		path = h.indexPath
	}

	// Try to open the file
	f, err := h.fileSystem.Open(path)
	if err != nil {
		// File not found, serve index.html
		h.serveIndex(w, r)
		return
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if info.IsDir() {
		// If directory, serve index.html
		h.serveIndex(w, r)
		return
	}

	// File exists and is not a dir, serve it
	http.FileServer(http.FS(h.fileSystem)).ServeHTTP(w, r)
}

func (h spaHandler) serveIndex(w http.ResponseWriter, r *http.Request) {
	f, err := h.fileSystem.Open(h.indexPath)
	if err != nil {
		http.Error(w, "Index file not found", http.StatusInternalServerError)
		return
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		http.Error(w, "Index file stat failed", http.StatusInternalServerError)
		return
	}

	content, err := io.ReadAll(f)
	if err != nil {
		http.Error(w, "Failed to read index file", http.StatusInternalServerError)
		return
	}

	http.ServeContent(w, r, h.indexPath, info.ModTime(), bytes.NewReader(content))
}

// Response structure
type Response struct {
	Code int          `json:"code"`
	Data ResponseData `json:"data"`
	Msg  string       `json:"msg"`
}

type ResponseData struct {
	Total int         `json:"total"`
	List  interface{} `json:"list"`
}

type CollectBucket struct {
	Total int                      `json:"total"`
	List  []map[string]interface{} `json:"list"`
}

type CollectPayloadData struct {
	Video CollectBucket `json:"video"`
	Music CollectBucket `json:"music"`
}

type CollectPayload struct {
	Code int                `json:"code"`
	Data CollectPayloadData `json:"data"`
	Msg  string             `json:"msg"`
}


var mediaDir string
var collectFilePath = filepath.Join("data", "user_collect.json")

//go:embed dist/*
var embedDist embed.FS
var fileSystem fs.FS

var collectFileMu sync.Mutex
var mediaSnapshotMu sync.RWMutex
var cachedMediaSnapshot = mediaSnapshot{videos: []map[string]interface{}{}}

const mediaSnapshotRescanInterval = 10 * time.Minute

type mediaSnapshot struct {
	videos    []map[string]interface{}
	scannedAt time.Time
}

func scanMediaVideos() ([]map[string]interface{}, error) {
	return scanMediaVideosFromRoot(mediaDir)
}

func scanMediaVideosFromRoot(root string) ([]map[string]interface{}, error) {
	videos := make([]map[string]interface{}, 0)

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			// If the root itself doesn't exist, we'll treat it as empty.
			if os.IsNotExist(err) && path == root {
				return nil // Treat as empty
			}
			return err
		}
		if d.IsDir() {
			return nil
		}

		fileName := d.Name()
		lowerName := strings.ToLower(fileName)
		if !strings.HasSuffix(lowerName, ".mp4") && !strings.HasSuffix(lowerName, ".webm") && !strings.HasSuffix(lowerName, ".ogg") {
			return nil
		}

		// Get relative path
		relPath, err := filepath.Rel(root, path)
		if err != nil {
			return nil
		}

		info, _ := d.Info()
		var ct int64
		if info != nil {
			ct = info.ModTime().Unix()
		}

		// Use filename as description, remove extension
		desc := strings.TrimSuffix(fileName, filepath.Ext(fileName))

		// Generate a fake ID
		hash := md5.Sum([]byte(relPath))
		id := hex.EncodeToString(hash[:])

		parts := strings.Split(relPath, string(os.PathSeparator))
		for i, part := range parts {
			parts[i] = url.PathEscape(part)
		}
		videoUrl := fmt.Sprintf("/media/%s", strings.Join(parts, "/"))
		// Use a placeholder for cover
		coverUrl := "" // Could be a default image

		video := map[string]interface{}{
			"type":        "recommend-video",
			"aweme_id":    id,
			"desc":        desc,
			"create_time": ct,
			"music": map[string]interface{}{
				"id":     123456789,
				"title":  "Original Sound",
				"author": "Local Artist",
				"cover_medium": map[string]interface{}{
					"url_list": []string{""},
				},
				"cover_thumb": map[string]interface{}{
					"url_list": []string{""},
				},
				"cover_large": map[string]interface{}{
					"url_list": []string{""},
				},
				"play_url": map[string]interface{}{
					"uri":     "music_uri",
					"url_list": []string{""},
				},
			},
			"video": map[string]interface{}{
				"play_addr": map[string]interface{}{
					"uri":     id,
					"url_list": []string{videoUrl},
					"width":   720,
					"height":  1280,
				},
				"cover": map[string]interface{}{
					"url_list": []string{coverUrl},
				},
				"width":  720,
				"height": 1280,
			},
			"author": map[string]interface{}{
				"uid":       "local_user",
				"nickname":  "Local User",
				"unique_id": "local_user_id",
				"avatar_thumb": map[string]interface{}{
					"url_list": []string{""},
				},
				"avatar_medium": map[string]interface{}{
					"url_list": []string{""},
				},
				"avatar_large": map[string]interface{}{
					"url_list": []string{""},
				},
				"avatar_168x168": map[string]interface{}{
					"url_list": []string{""},
				},
				"avatar_larger": map[string]interface{}{
					"url_list": []string{""},
				},
				"cover_url": []map[string]interface{}{
					{
						"url_list": []string{""},
					},
				},
				"share_info": map[string]interface{}{
					"share_qrcode_url": map[string]interface{}{
						"url_list": []string{""},
					},
					"share_url": "",
					"share_image_url": map[string]interface{}{
						"url_list": []string{""},
					},
				},
			},
			"statistics": map[string]interface{}{
				"digg_count":    0,
				"comment_count": 0,
				"share_count":   0,
				"play_count":    0,
			},
			"share_info": map[string]interface{}{
				"share_url": "",
			},
			"status": map[string]interface{}{
				"is_delete": false,
			},
			"aweme_control": map[string]interface{}{
				"can_forward":      true,
				"can_share":        true,
				"can_comment":      true,
				"can_show_comment": true,
			},
		}
		videos = append(videos, video)
		return nil
	})

	if err != nil {
		if os.IsNotExist(err) {
			return videos, nil
		}
		return nil, err
	}

	sort.Slice(videos, func(i, j int) bool {
		vi := int64(0)
		vj := int64(0)
		switch x := videos[i]["create_time"].(type) {
		case int64:
			vi = x
		case int:
			vi = int64(x)
		case float64:
			vi = int64(x)
		}
		switch y := videos[j]["create_time"].(type) {
		case int64:
			vj = y
		case int:
			vj = int64(y)
		case float64:
			vj = int64(y)
		}
		return vi > vj
	})

	return videos, nil
}

func replaceMediaSnapshot(videos []map[string]interface{}) {
	mediaSnapshotMu.Lock()
	cachedMediaSnapshot = mediaSnapshot{
		videos:    append([]map[string]interface{}(nil), videos...),
		scannedAt: time.Now(),
	}
	mediaSnapshotMu.Unlock()
}

func getCachedMediaVideos() []map[string]interface{} {
	mediaSnapshotMu.RLock()
	defer mediaSnapshotMu.RUnlock()
	return append([]map[string]interface{}(nil), cachedMediaSnapshot.videos...)
}

func refreshMediaSnapshot(root, reason string) error {
	videos, err := scanMediaVideosFromRoot(root)
	if err != nil {
		return err
	}

	replaceMediaSnapshot(videos)
	log.Printf("Refreshed media snapshot (%s): %d videos", reason, len(videos))
	return nil
}

func startMediaSnapshotLoop(root string) {
	if err := refreshMediaSnapshot(root, "startup"); err != nil {
		log.Printf("Failed to build initial media snapshot: %v", err)
	}

	go func() {
		ticker := time.NewTicker(mediaSnapshotRescanInterval)
		defer ticker.Stop()

		for {
			<-ticker.C
			if err := refreshMediaSnapshot(root, "periodic-rescan"); err != nil {
				log.Printf("Failed to refresh media snapshot (periodic-rescan): %v", err)
			}
		}
	}()
}

func shuffleVideos(videos []map[string]interface{}, shuffle func(int, func(int, int))) []map[string]interface{} {
	shuffled := append([]map[string]interface{}(nil), videos...)
	if shuffle == nil {
		return shuffled
	}

	shuffle(len(shuffled), func(i, j int) {
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	})

	return shuffled
}

func shuffleVideosWithSeed(videos []map[string]interface{}, seed string) []map[string]interface{} {
	if seed == "" {
		return append([]map[string]interface{}(nil), videos...)
	}

	hash := md5.Sum([]byte(seed))
	var seedValue int64
	for _, b := range hash[:8] {
		seedValue = (seedValue << 8) | int64(b)
	}

	rng := rand.New(rand.NewSource(seedValue))
	return shuffleVideos(videos, rng.Shuffle)
}

func cloneJSONObject(src map[string]interface{}) map[string]interface{} {
	if src == nil {
		return map[string]interface{}{}
	}

	data, err := json.Marshal(src)
	if err != nil {
		return src
	}

	var cloned map[string]interface{}
	if err := json.Unmarshal(data, &cloned); err != nil {
		return src
	}
	return cloned
}

func stringValue(v interface{}) string {
	switch value := v.(type) {
	case string:
		return value
	case float64:
		return fmt.Sprintf("%.0f", value)
	case float32:
		return fmt.Sprintf("%.0f", value)
	case int:
		return fmt.Sprintf("%d", value)
	case int64:
		return fmt.Sprintf("%d", value)
	case int32:
		return fmt.Sprintf("%d", value)
	default:
		return ""
	}
}

func defaultCollectPayload() CollectPayload {
	payload := CollectPayload{}
	normalizeCollectPayload(&payload)
	return payload
}

func normalizeCollectPayload(payload *CollectPayload) {
	payload.Code = 200
	payload.Msg = ""
	if payload.Data.Video.List == nil {
		payload.Data.Video.List = []map[string]interface{}{}
	}
	payload.Data.Video.Total = len(payload.Data.Video.List)
	if payload.Data.Music.List == nil {
		payload.Data.Music.List = []map[string]interface{}{}
	}
	payload.Data.Music.Total = len(payload.Data.Music.List)
}

func upsertCollectedVideo(payload *CollectPayload, video map[string]interface{}) error {
	normalizeCollectPayload(payload)

	awemeID := stringValue(video["aweme_id"])
	if awemeID == "" {
		return fmt.Errorf("missing aweme_id")
	}

	videoCopy := cloneJSONObject(video)
	videoCopy["aweme_id"] = awemeID

	list := make([]map[string]interface{}, 0, len(payload.Data.Video.List)+1)
	list = append(list, videoCopy)
	for _, item := range payload.Data.Video.List {
		if stringValue(item["aweme_id"]) == awemeID {
			continue
		}
		list = append(list, item)
	}
	payload.Data.Video.List = list
	payload.Data.Video.Total = len(list)
	return nil
}

func removeCollectedVideo(payload *CollectPayload, awemeID string) {
	normalizeCollectPayload(payload)
	if awemeID == "" {
		return
	}

	list := make([]map[string]interface{}, 0, len(payload.Data.Video.List))
	for _, item := range payload.Data.Video.List {
		if stringValue(item["aweme_id"]) == awemeID {
			continue
		}
		list = append(list, item)
	}
	payload.Data.Video.List = list
	payload.Data.Video.Total = len(list)
}

func saveCollectPayloadLocked(payload CollectPayload) error {
	normalizeCollectPayload(&payload)

	if err := os.MkdirAll(filepath.Dir(collectFilePath), 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}

	tempPath := collectFilePath + ".tmp"
	if err := os.WriteFile(tempPath, data, 0644); err != nil {
		return err
	}
	return os.Rename(tempPath, collectFilePath)
}

func loadCollectPayloadLocked() (CollectPayload, error) {
	payload := defaultCollectPayload()

	data, err := os.ReadFile(collectFilePath)
	if err != nil {
		if os.IsNotExist(err) {
			if err := saveCollectPayloadLocked(payload); err != nil {
				return CollectPayload{}, err
			}
			return payload, nil
		}
		return CollectPayload{}, err
	}

	if len(bytes.TrimSpace(data)) == 0 {
		if err := saveCollectPayloadLocked(payload); err != nil {
			return CollectPayload{}, err
		}
		return payload, nil
	}

	if err := json.Unmarshal(data, &payload); err != nil {
		return CollectPayload{}, err
	}

	normalizeCollectPayload(&payload)
	if err := saveCollectPayloadLocked(payload); err != nil {
		return CollectPayload{}, err
	}
	return payload, nil
}

func loadCollectPayload() (CollectPayload, error) {
	collectFileMu.Lock()
	defer collectFileMu.Unlock()
	return loadCollectPayloadLocked()
}

func normalizeLikeAction(action string) string {
	switch strings.ToLower(strings.TrimSpace(action)) {
	case "like", "digg", "collect", "favorite":
		return "like"
	case "unlike", "undigg", "uncollect", "cancel", "remove", "delete":
		return "unlike"
	default:
		return ""
	}
}

func extractVideoFromLikePayload(payload map[string]interface{}, action string) map[string]interface{} {
	if rawVideo, ok := payload["video"].(map[string]interface{}); ok {
		return cloneJSONObject(rawVideo)
	}
	if action != "like" || len(payload) == 0 {
		return nil
	}
	if _, ok := payload["aweme_id"]; !ok {
		return nil
	}

	video := make(map[string]interface{}, len(payload))
	for key, value := range payload {
		switch key {
		case "action", "liked", "type":
			continue
		default:
			video[key] = value
		}
	}
	if len(video) <= 1 {
		return nil
	}
	return cloneJSONObject(video)
}

func parseVideoLikeMutation(r *http.Request) (string, string, map[string]interface{}, error) {
	var payload map[string]interface{}
	if r.Body != nil {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			return "", "", nil, err
		}
		if len(bytes.TrimSpace(body)) > 0 {
			if err := json.Unmarshal(body, &payload); err != nil {
				return "", "", nil, fmt.Errorf("invalid json body: %w", err)
			}
		}
	}

	action := normalizeLikeAction(r.URL.Query().Get("action"))
	if action == "" {
		action = normalizeLikeAction(stringValue(payload["action"]))
	}
	if action == "" {
		action = normalizeLikeAction(stringValue(payload["type"]))
	}
	if action == "" {
		if liked, ok := payload["liked"].(bool); ok {
			if liked {
				action = "like"
			} else {
				action = "unlike"
			}
		}
	}

	video := extractVideoFromLikePayload(payload, action)
	awemeID := r.URL.Query().Get("aweme_id")
	if awemeID == "" {
		awemeID = stringValue(payload["aweme_id"])
	}
	if awemeID == "" && video != nil {
		awemeID = stringValue(video["aweme_id"])
	}

	return action, awemeID, video, nil
}

func findVideoByAwemeID(awemeID string) (map[string]interface{}, bool, error) {
	if awemeID == "" {
		return nil, false, nil
	}

	for _, video := range getCachedMediaVideos() {
		if stringValue(video["aweme_id"]) == awemeID {
			return cloneJSONObject(video), true, nil
		}
	}

	return nil, false, nil
}

func updateCollectPayload(action, awemeID string, video map[string]interface{}) (CollectPayload, error) {
	collectFileMu.Lock()
	defer collectFileMu.Unlock()

	payload, err := loadCollectPayloadLocked()
	if err != nil {
		return CollectPayload{}, err
	}

	switch action {
	case "like":
		if video == nil {
			var found bool
			video, found, err = findVideoByAwemeID(awemeID)
			if err != nil {
				return CollectPayload{}, err
			}
			if !found {
				return CollectPayload{}, fmt.Errorf("video not found for aweme_id %s", awemeID)
			}
		}
		if err := upsertCollectedVideo(&payload, video); err != nil {
			return CollectPayload{}, err
		}
	case "unlike":
		if awemeID == "" && video != nil {
			awemeID = stringValue(video["aweme_id"])
		}
		if awemeID == "" {
			return CollectPayload{}, fmt.Errorf("missing aweme_id")
		}
		removeCollectedVideo(&payload, awemeID)
	default:
		return CollectPayload{}, fmt.Errorf("unsupported like action %q", action)
	}

	if err := saveCollectPayloadLocked(payload); err != nil {
		return CollectPayload{}, err
	}
	return payload, nil
}

func recommendedHandler(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		return
	}

	var pagedVideos interface{}
	var total int
	
	startStr := r.URL.Query().Get("start")
	pageSizeStr := r.URL.Query().Get("pageSize")
	seed := r.URL.Query().Get("seed")
	start := 0
	pageSize := 10
	if startStr != "" {
		fmt.Sscanf(startStr, "%d", &start)
	}
	if pageSizeStr != "" {
		fmt.Sscanf(pageSizeStr, "%d", &pageSize)
	}
	if start < 0 {
		start = 0
	}
	if pageSize <= 0 || pageSize > 5 {
		pageSize = 5
	}

	videos := getCachedMediaVideos()

	if seed != "" {
		videos = shuffleVideosWithSeed(videos, seed)
	} else {
		rng := rand.New(rand.NewSource(time.Now().UnixNano()))
		videos = shuffleVideos(videos, rng.Shuffle)
	}
	total = len(videos)
	end := start + pageSize
	if end > total {
		end = total
	}
	if start > total {
		start = total
	}
	pagedVideos = videos[start:end]

	resp := ResponseData{
		Total: total,
		List:  pagedVideos,
	}
	w.Header().Set("Content-Type", "application/json")
	
	finalResp := map[string]interface{}{
		"code": 200,
		"data": resp,
		"msg":  "",
	}
	json.NewEncoder(w).Encode(finalResp)
}

func videoLikeHandler(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		return
	}

	if r.Method == http.MethodGet {
		collectPayload, err := loadCollectPayload()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		resp := ResponseData{
			Total: collectPayload.Data.Video.Total,
			List:  collectPayload.Data.Video.List,
		}
		w.Header().Set("Content-Type", "application/json")

		finalResp := map[string]interface{}{
			"code": 200,
			"data": resp,
			"msg":  "",
		}
		json.NewEncoder(w).Encode(finalResp)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	action, awemeID, video, err := parseVideoLikeMutation(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if action == "" {
		http.Error(w, "missing like action", http.StatusBadRequest)
		return
	}

	collectPayload, err := updateCollectPayload(action, awemeID, video)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	resp := ResponseData{
		Total: collectPayload.Data.Video.Total,
		List:  collectPayload.Data.Video.List,
	}
	w.Header().Set("Content-Type", "application/json")
	finalResp := map[string]interface{}{
		"code": 200,
		"data": resp,
		"msg":  "",
	}
	json.NewEncoder(w).Encode(finalResp)
}

func main() {
	var staticPath string
	var indexPath string
	var mediaDirFlag string
	var hostFlag string
	var portFlag string

	flag.StringVar(&staticPath, "static", "dist", "Path to static files directory")
	flag.StringVar(&indexPath, "index", "index.html", "Path to index.html")
	flag.StringVar(&mediaDirFlag, "media", "media", "Path to media directory")
	flag.StringVar(&hostFlag, "host", "127.0.0.1", "Host to bind")
	flag.StringVar(&portFlag, "port", "8080", "Port to listen")
	flag.Parse()

	mediaDir = mediaDirFlag
	host := hostFlag
	port := portFlag

	// Initialize fileSystem
	if _, err := os.Stat(staticPath); err == nil {
		log.Printf("Using local static directory: %s", staticPath)
		fileSystem = os.DirFS(staticPath)
	} else {
		log.Printf("Local directory %s not found, using embedded resources", staticPath)
		var err error
		fileSystem, err = fs.Sub(embedDist, "dist")
		if err != nil {
			log.Fatal("Failed to load embedded dist:", err)
		}
	}

	if _, err := loadCollectPayload(); err != nil {
		log.Printf("Failed to initialize user collect file: %v", err)
	}
	startMediaSnapshotLoop(mediaDir)

	// Serve media files
	http.Handle("/media/", http.StripPrefix("/media/", http.FileServer(http.Dir(mediaDir))))

	// API endpoints
	http.HandleFunc("/video/recommended", recommendedHandler)
	http.HandleFunc("/video/like", videoLikeHandler)

	// SPA handler for frontend
	spa := spaHandler{fileSystem: fileSystem, indexPath: indexPath}
	http.Handle("/", spa)

	log.Printf("Serving SPA on http://%s:%s ...", host, port)
	log.Fatal(http.ListenAndServe(host+":"+port, nil))
}

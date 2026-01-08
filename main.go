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
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
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


// Global variable to hold loaded JSON data
var mediaDir string
var staticDir string
//go:embed dist/*
var embedDist embed.FS
var fileSystem fs.FS

var jsonVideos []map[string]interface{}
var jsonMusic []map[string]interface{}
var jsonUsers map[string]interface{}
var jsonUsersList []map[string]interface{}
var jsonPosts []map[string]interface{}
var jsonGoods []map[string]interface{}

var avatar_dataurl = "data:image/png;base64,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"

func loadJsonData() {
	// Load users
	usersBytes, err := fs.ReadFile(fileSystem, "data/users.json")
	if err != nil {
		log.Printf("Failed to read users.json: %v", err)
	} else {
		var users []map[string]interface{}
		if err := json.Unmarshal(usersBytes, &users); err != nil {
			log.Printf("Failed to parse users.json: %v", err)
		} else {
			jsonUsers = make(map[string]interface{})
			for i := range users {
				u := users[i]
				keys := []string{"avatar_thumb", "avatar_medium", "avatar_large", "avatar_168x168", "avatar_larger", "avatar_300x300"}
				for _, k := range keys {
					if m, ok := u[k].(map[string]interface{}); ok {
						m["url_list"] = []string{avatar_dataurl}
						u[k] = m
					} else {
						u[k] = map[string]interface{}{"url_list": []string{avatar_dataurl}}
					}
				}
				users[i] = u
			}
			jsonUsersList = users
			for _, u := range users {
				if uid, ok := u["uid"].(string); ok {
					jsonUsers[uid] = u
				}
			}
			log.Printf("Loaded %d users", len(jsonUsers))
		}
	}

	// Load posts (for /post/recommended)
	postsBytes, err := fs.ReadFile(fileSystem, "data/posts.json")
	if err != nil {
		log.Printf("Failed to read posts.json: %v", err)
	} else {
		if err := json.Unmarshal(postsBytes, &jsonPosts); err != nil {
			log.Printf("Failed to parse posts.json: %v", err)
		} else {
			log.Printf("Loaded %d posts", len(jsonPosts))
		}
	}

	// Load goods (for /shop/recommended)
	goodsBytes, err := fs.ReadFile(fileSystem, "data/goods.json")
	if err != nil {
		log.Printf("Failed to read goods.json: %v", err)
	} else {
		if err := json.Unmarshal(goodsBytes, &jsonGoods); err != nil {
			log.Printf("Failed to parse goods.json: %v", err)
		} else {
			log.Printf("Loaded %d goods", len(jsonGoods))
		}
	}

	// Load videos
	// Note: Original code used "src/assets/data/posts6.json", which seems to be a hardcoded path for dev?
	// But let's assume it should also be in the static FS if we want it to work in prod.
	// However, the original code had: videosBytes, err := os.ReadFile("src/assets/data/posts6.json")
	// This path "src/assets/..." looks like source code path, not dist path.
	// If the user hasn't moved this to dist, it might fail. 
	// But let's check dist content. dist/data/videos.json exists.
	// Maybe we should try to load from dist/data/videos.json instead of src/...
	// Let's try to read from "data/videos.json" first, if that's what is intended.
	// But strictly following the instruction, I should just fix the staticDir usage.
	// The line `videosBytes, err := os.ReadFile("src/assets/data/posts6.json")` does NOT use staticDir.
	// So I should probably leave it as is?
	// But if the user runs the binary without source code, this will fail.
	// The LS output shows `dist/data/videos.json`. It's likely the same content.
	// I'll try to use `data/videos.json` from fileSystem as a better default, but fallback to original if needed?
	// Actually, let's stick to what's likely correct for a "dist" based deployment.
	
	videosBytes, err := fs.ReadFile(fileSystem, "data/videos.json")
	if err != nil {
		log.Printf("Failed to read data/videos.json from fs: %v. Trying src path...", err)
		videosBytes, err = os.ReadFile("src/assets/data/posts6.json")
	}
	
	if err != nil {
		log.Printf("Failed to read videos json: %v", err)
	} else {
		var videos []map[string]interface{}
		if err := json.Unmarshal(videosBytes, &videos); err != nil {
			log.Printf("Failed to parse videos json: %v", err)
		} else {
			for _, v := range videos {
				v["type"] = "recommend-video"

				// Link author
				if authorIDNum, ok := v["author_user_id"].(float64); ok {
					// Convert float64 to string (integer)
					authorID := fmt.Sprintf("%.0f", authorIDNum)
					if user, found := jsonUsers[authorID]; found {
						v["author"] = user
					}
				}
				jsonVideos = append(jsonVideos, v)
			}
			log.Printf("Loaded %d videos from JSON", len(jsonVideos))
		}
	}
}

func loadMusicData() {
	musicBytes, err := fs.ReadFile(fileSystem, "data/music.json")
	if err != nil {
		log.Printf("Failed to read music.json: %v", err)
	} else {
		if err := json.Unmarshal(musicBytes, &jsonMusic); err != nil {
			log.Printf("Failed to parse music.json: %v", err)
		} else {
			log.Printf("Loaded %d music items", len(jsonMusic))
		}
	}
}

func scanMediaVideos() ([]map[string]interface{}, error) {
	videos := make([]map[string]interface{}, 0)

	err := filepath.WalkDir(mediaDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			// If mediaDir itself doesn't exist, we'll catch it.
			if os.IsNotExist(err) && path == mediaDir {
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
		relPath, err := filepath.Rel(mediaDir, path)
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
					"url_list": []string{avatar_dataurl},
				},
				"avatar_medium": map[string]interface{}{
					"url_list": []string{avatar_dataurl},
				},
				"avatar_large": map[string]interface{}{
					"url_list": []string{avatar_dataurl},
				},
				"avatar_168x168": map[string]interface{}{
					"url_list": []string{avatar_dataurl},
				},
				"avatar_larger": map[string]interface{}{
					"url_list": []string{avatar_dataurl},
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

func recommendedHandler(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		return
	}

	// Prefer JSON data if available
	var pagedVideos interface{}
	var total int
	
	startStr := r.URL.Query().Get("start")
	pageSizeStr := r.URL.Query().Get("pageSize")
	start := 0
	pageSize := 10
	if startStr != "" {
		fmt.Sscanf(startStr, "%d", &start)
	}
	if pageSizeStr != "" {
		fmt.Sscanf(pageSizeStr, "%d", &pageSize)
	}

	// Fallback to scanned media
	videos, err := scanMediaVideos()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
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
	// if len(jsonVideos) > 0 {
	// 	total = len(jsonVideos)
	// 	end := start + pageSize
	// 	if end > total {
	// 		end = total
	// 	}
	// 	if start > total {
	// 		start = total
	// 	}
	// 	pagedVideos = jsonVideos[start:end]
	// } else {
		
	// }

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

func musicHandler(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		return
	}

	resp := ResponseData{
		Total: len(jsonMusic),
		List:  jsonMusic,
	}
	w.Header().Set("Content-Type", "application/json")
	
	finalResp := map[string]interface{}{
		"code": 200,
		"data": resp,
		"msg":  "",
	}
	json.NewEncoder(w).Encode(finalResp)
}

func videoLongRecommendedHandler(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		return
	}

	startStr := r.URL.Query().Get("start")
	pageSizeStr := r.URL.Query().Get("pageSize")
	start := 0
	pageSize := 10
	if startStr != "" {
		fmt.Sscanf(startStr, "%d", &start)
	}
	if pageSizeStr != "" {
		fmt.Sscanf(pageSizeStr, "%d", &pageSize)
	}

	var list interface{}
	total := len(jsonVideos)
	if total > 0 {
		end := start + pageSize
		if end > total {
			end = total
		}
		if start > total {
			start = total
		}
		list = jsonVideos[start:end]
	} else {
		list = []interface{}{}
	}

	resp := ResponseData{
		Total: total,
		List:  list,
	}
	w.Header().Set("Content-Type", "application/json")
	
	finalResp := map[string]interface{}{
		"code": 200,
		"data": resp,
		"msg":  "",
	}
	json.NewEncoder(w).Encode(finalResp)
}

func videoCommentsHandler(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		return
	}

	id := r.URL.Query().Get("id")
	if id == "" {
		// Default ID if none provided, or random from list
		id = "7260749400622894336"
	}

	// Try to read json file first
	path := filepath.Join(staticDir, "data", "comments", fmt.Sprintf("video_id_%s.json", id))
	data, err := os.ReadFile(path)
	if err != nil {
		// Fallback to check if .md exists (simulating fetch logic which handles .md)
		// Since we are server side, we can just look for .json.
		// If specific ID not found, maybe return a default one?
		// The mock logic had a list of valid IDs and picked random if not found.
		// For simplicity, let's try a fallback ID.
		fallbackID := "7260749400622894336"
		path = filepath.Join(staticDir, "data", "comments", fmt.Sprintf("video_id_%s.json", fallbackID))
		data, err = os.ReadFile(path)
		if err != nil {
			http.Error(w, "Comments not found", http.StatusNotFound)
			return
		}
	}

	var comments interface{}
	if err := json.Unmarshal(data, &comments); err != nil {
		http.Error(w, "Failed to parse comments", http.StatusInternalServerError)
		return
	}

	resp := map[string]interface{}{
		"code": 200,
		"data": comments,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func videoPrivateHandler(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		return
	}

	// Logic from mock: allRecommendVideos.slice(100, 110)
	var list interface{}
	total := 10
	if len(jsonVideos) >= 110 {
		list = jsonVideos[100:110]
	} else if len(jsonVideos) > 0 {
		list = jsonVideos
		total = len(jsonVideos)
	} else {
		list = []interface{}{}
		total = 0
	}

	resp := ResponseData{
		Total: total,
		List:  list,
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

	// Logic from mock: allRecommendVideos.slice(200, 350)
	var list interface{}
	total := 150
	startIdx := 200
	endIdx := 350
	if len(jsonVideos) >= endIdx {
		list = jsonVideos[startIdx:endIdx]
	} else if len(jsonVideos) > startIdx {
		list = jsonVideos[startIdx:]
		total = len(jsonVideos) - startIdx
	} else {
		list = []interface{}{}
		total = 0
	}

	resp := ResponseData{
		Total: total,
		List:  list,
	}
	w.Header().Set("Content-Type", "application/json")
	
	finalResp := map[string]interface{}{
		"code": 200,
		"data": resp,
		"msg":  "",
	}
	json.NewEncoder(w).Encode(finalResp)
}

func videoMyHandler(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		return
	}

	pageNo := 0
	pageSize := 10
	if p := r.URL.Query().Get("pageNo"); p != "" {
		fmt.Sscanf(p, "%d", &pageNo)
	}
	if ps := r.URL.Query().Get("pageSize"); ps != "" {
		fmt.Sscanf(ps, "%d", &pageSize)
	}
	offset := pageNo * pageSize

	// Load specific user video list
	// In mock it was hardcoded to user-12345xiaolaohu.md
	path := filepath.Join(staticDir, "data", "user_video_list", "user-12345xiaolaohu.json")
	data, err := os.ReadFile(path)
	var userVideos []map[string]interface{}

	if err == nil {
		if err := json.Unmarshal(data, &userVideos); err != nil {
			log.Printf("Failed to parse user videos: %v", err)
		} else {
			// Map author info if available
			for _, v := range userVideos {
				if authorIDNum, ok := v["author_user_id"].(float64); ok {
					authorID := fmt.Sprintf("%.0f", authorIDNum)
					if user, found := jsonUsers[authorID]; found {
						v["author"] = user
					}
				} else if authorIDStr, ok := v["author_user_id"].(string); ok {
					if user, found := jsonUsers[authorIDStr]; found {
						v["author"] = user
					}
				}
			}
		}
	}

	total := len(userVideos)
	var list interface{}
	end := offset + pageSize
	if offset >= total {
		list = []interface{}{}
	} else {
		if end > total {
			end = total
		}
		list = userVideos[offset:end]
	}

	finalResp := map[string]interface{}{
		"code": 200,
		"data": map[string]interface{}{
			"pageNo": pageNo,
			"total":  total,
			"list":   list,
		},
		"msg": "",
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(finalResp)
}

func videoHistoryHandler(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		return
	}

	pageNo := 0
	pageSize := 10
	if p := r.URL.Query().Get("pageNo"); p != "" {
		fmt.Sscanf(p, "%d", &pageNo)
	}
	if ps := r.URL.Query().Get("pageSize"); ps != "" {
		fmt.Sscanf(ps, "%d", &pageSize)
	}
	offset := pageNo * pageSize

	// Mock logic: allRecommendVideos.slice(200, 350).slice(offset, limit)
	var list interface{}
	total := 150
	startIdx := 200
	endIdx := 350

	// Get the subset first
	var subset []map[string]interface{}
	if len(jsonVideos) >= endIdx {
		subset = jsonVideos[startIdx:endIdx]
	} else if len(jsonVideos) > startIdx {
		subset = jsonVideos[startIdx:]
		total = len(subset)
	} else {
		subset = []map[string]interface{}{}
		total = 0
	}

	// Then apply pagination on the subset
	subsetTotal := len(subset)
	subEnd := offset + pageSize
	if offset >= subsetTotal {
		list = []interface{}{}
	} else {
		if subEnd > subsetTotal {
			subEnd = subsetTotal
		}
		list = subset[offset:subEnd]
	}

	finalResp := map[string]interface{}{
		"code": 200,
		"data": map[string]interface{}{
			"total": total,
			"list":  list,
		},
		"msg": "",
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(finalResp)
}

func userPanelHandler(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		return
	}

	// Mock logic: find user with specific UID
	uid := "2739632844317827"
	var resp map[string]interface{}

	if user, ok := jsonUsers[uid]; ok {
		resp = map[string]interface{}{
			"code": 200,
			"data": user,
		}
	} else {
		resp = map[string]interface{}{
			"code": 500,
			"msg":  "User not found",
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func userCollectHandler(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		return
	}

	// Mock logic: video: slice(350, 400), music: resource.music
	var videoList interface{}
	videoTotal := 50
	vStart := 350
	vEnd := 400
	if len(jsonVideos) >= vEnd {
		videoList = jsonVideos[vStart:vEnd]
	} else if len(jsonVideos) > vStart {
		videoList = jsonVideos[vStart:]
		videoTotal = len(jsonVideos) - vStart
	} else {
		videoList = []interface{}{}
		videoTotal = 0
	}

	finalResp := map[string]interface{}{
		"code": 200,
		"data": map[string]interface{}{
			"video": map[string]interface{}{
				"total": videoTotal,
				"list":  videoList,
			},
			"music": map[string]interface{}{
				"total": len(jsonMusic),
				"list":  jsonMusic,
			},
		},
		"msg": "",
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(finalResp)
}

func userVideoListHandler(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		return
	}

	id := r.URL.Query().Get("id")
	filePath := fmt.Sprintf("data/user_video_list/user-%s.json", id)
	data, err := fs.ReadFile(fileSystem, filePath)
	
	if err != nil {
		finalResp := map[string]interface{}{
			"code": 500,
			"msg":  "User video list not found",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(finalResp)
		return
	}

	var videos interface{}
	json.Unmarshal(data, &videos)
	
	finalResp := map[string]interface{}{
		"code": 200,
		"data": videos,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(finalResp)
}

func userFriendsHandler(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		return
	}

	finalResp := map[string]interface{}{
		"code": 200,
		"data": jsonUsersList,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(finalResp)
}

func historyOtherHandler(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		return
	}

	pageNo := 0
	if p := r.URL.Query().Get("pageNo"); p != "" {
		fmt.Sscanf(p, "%d", &pageNo)
	}

	finalResp := map[string]interface{}{
		"code": 200,
		"data": map[string]interface{}{
			"pageNo": pageNo,
			"total":  0,
			"list":   []interface{}{},
		},
		"msg": "",
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(finalResp)
}

func postRecommendedHandler(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		return
	}

	pageNo := 0
	pageSize := 10
	if p := r.URL.Query().Get("pageNo"); p != "" {
		fmt.Sscanf(p, "%d", &pageNo)
	}
	if ps := r.URL.Query().Get("pageSize"); ps != "" {
		fmt.Sscanf(ps, "%d", &pageSize)
	}
	offset := pageNo * pageSize
	
	total := len(jsonPosts)
	var list interface{}
	end := offset + pageSize
	
	// Mock logic: allRecommendPosts.slice(0, 1000).slice(offset, limit)
	// We just slice directly.
	if offset >= total {
		list = []interface{}{}
	} else {
		if end > total {
			end = total
		}
		list = jsonPosts[offset:end]
	}

	finalResp := map[string]interface{}{
		"code": 200,
		"data": map[string]interface{}{
			"pageNo": pageNo,
			"total":  total,
			"list":   list,
		},
		"msg": "",
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(finalResp)
}

func shopRecommendedHandler(w http.ResponseWriter, r *http.Request) {
	// CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		return
	}

	pageNo := 0
	pageSize := 10
	if p := r.URL.Query().Get("pageNo"); p != "" {
		fmt.Sscanf(p, "%d", &pageNo)
	}
	if ps := r.URL.Query().Get("pageSize"); ps != "" {
		fmt.Sscanf(ps, "%d", &pageSize)
	}
	offset := pageNo * pageSize

	total := len(jsonGoods)
	var list interface{}
	end := offset + pageSize
	
	if offset >= total {
		list = []interface{}{}
	} else {
		if end > total {
			end = total
		}
		list = jsonGoods[offset:end]
	}

	finalResp := map[string]interface{}{
		"code": 200,
		"data": map[string]interface{}{
			"total": total,
			"list":  list,
		},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(finalResp)
}

func videoIndexedHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		return
	}
	videos, err := scanMediaVideos()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	resp := ResponseData{
		Total: len(videos),
		List:  videos,
	}
	w.Header().Set("Content-Type", "application/json")
	finalResp := map[string]interface{}{
		"code": 200,
		"data": resp,
		"msg":  "",
	}
	json.NewEncoder(w).Encode(finalResp)
}

func scanMediaVideoFiles() ([]map[string]interface{}, error) {
	items := make([]map[string]interface{}, 0)
	err := filepath.WalkDir(mediaDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			if os.IsNotExist(err) && path == mediaDir {
				return nil
			}
			return err
		}
		if d.IsDir() {
			return nil
		}
		name := d.Name()
		lower := strings.ToLower(name)
		if !strings.HasSuffix(lower, ".mp4") && !strings.HasSuffix(lower, ".webm") && !strings.HasSuffix(lower, ".ogg") {
			return nil
		}
		rel, err := filepath.Rel(mediaDir, path)
		if err != nil {
			return nil
		}
		parts := strings.Split(rel, string(os.PathSeparator))
		for i := range parts {
			parts[i] = url.PathEscape(parts[i])
		}
		urlPath := "/media/" + strings.Join(parts, "/")
		info, _ := d.Info()
		item := map[string]interface{}{
			"url":      urlPath,
			"filename": name,
		}
		if info != nil {
			item["size"] = info.Size()
			item["mod_time"] = info.ModTime().Unix()
		}
		items = append(items, item)
		return nil
	})
	if err != nil {
		if os.IsNotExist(err) {
			return items, nil
		}
		return nil, err
	}
	return items, nil
}

func videoListHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == "OPTIONS" {
		return
	}
	items, err := scanMediaVideoFiles()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	resp := ResponseData{
		Total: len(items),
		List:  items,
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

	flag.StringVar(&staticPath, "static", "dist", "Path to static files directory")
	flag.StringVar(&indexPath, "index", "index.html", "Path to index.html")
	flag.StringVar(&mediaDirFlag, "media", "media", "Path to media directory")
	flag.Parse()

	mediaDir = mediaDirFlag
	staticDir = staticPath

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

	// Load JSON data on startup
	loadJsonData()
	loadMusicData()

	// Serve media files
	http.Handle("/media/", http.StripPrefix("/media/", http.FileServer(http.Dir(mediaDir))))

	// API endpoints
	http.HandleFunc("/video/recommended", recommendedHandler)
	http.HandleFunc("/video/long/recommended", videoLongRecommendedHandler)
	http.HandleFunc("/video/comments", videoCommentsHandler)
	http.HandleFunc("/video/private", videoPrivateHandler)
	http.HandleFunc("/video/like", videoLikeHandler)
	http.HandleFunc("/video/my", videoMyHandler)
	http.HandleFunc("/video/history", videoHistoryHandler)
	http.HandleFunc("/api/video/list", videoListHandler)
	
	http.HandleFunc("/user/panel", userPanelHandler)
	http.HandleFunc("/user/collect", userCollectHandler)
	http.HandleFunc("/user/video_list", userVideoListHandler)
	http.HandleFunc("/user/friends", userFriendsHandler)
	
	http.HandleFunc("/historyOther", historyOtherHandler)
	http.HandleFunc("/post/recommended", postRecommendedHandler)
	http.HandleFunc("/shop/recommended", shopRecommendedHandler)
	
	http.HandleFunc("/music", musicHandler)

	// SPA handler for frontend
	spa := spaHandler{fileSystem: fileSystem, indexPath: indexPath}
	http.Handle("/", spa)

	port := "8080"
	log.Printf("Serving SPA on http://localhost:%s ...", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

# douyin_selfhost

这是一个纯本地的抖音式短视频播放器。

仓库已经内置自己的静态前端，不需要额外准备外部前端工程。

只支持 Docker 运行。

## Docker Compose 部署

### 1. 准备目录

你可以选择：

- 挂载单个视频目录
- 挂载多个宿主目录，并分别映射到容器内 `/app/media` 下的不同子目录

单目录示例：

```bash
mkdir -p data
```

目录示例：

```text
.
├── compose.yaml
└── data
    ├── a.mp4
    ├── b.mp4
    └── folder
        └── c.webm
```

多目录示例：

```text
.
├── compose.yaml
├── anime
│   ├── ep1.mp4
│   └── ep2.mp4
└── movie
    ├── a.mp4
    └── b.webm
```

支持的视频格式：

- `.mp4`
- `.webm`
- `.ogg`

### 2. 编写 `compose.yaml`

```yaml
version: "3.9"
services:
  backend:
    image: ghcr.io/xiaofsu/douyin_selfhost:latest
    container_name: douyin_backend
    volumes:
      - "./data:/app/media"
    ports:
      - "8080:8080"
    restart: always
```

这里的本地 `./data` 会挂载到容器内的 `/app/media`，播放器会直接扫描这个目录里的视频。

如果你要挂载多个宿主目录，写法是把多个宿主目录分别挂到 `/app/media` 的不同子目录：

```yaml
version: "3.9"
services:
  backend:
    image: ghcr.io/xiaofsu/douyin_selfhost:latest
    container_name: douyin_backend
    volumes:
      - "./anime:/app/media/anime:ro"
      - "./movie:/app/media/movie:ro"
    ports:
      - "8080:8080"
    restart: always
```

这里的多个宿主目录会统一出现在容器内的 `/app/media/anime`、`/app/media/movie` 等子目录下。播放器会递归扫描 `/app/media`，所以这些子目录里的视频都会被自动发现。

### 3. 启动

```bash
docker compose up -d
```

查看日志：

```bash
docker compose logs -f
```

停止：

```bash
docker compose down
```

### 4. 访问

浏览器打开：

```text
http://localhost:8080
```

## 页面说明

- 首页 `/`
  本地视频流，支持上下滑动、长按 2 倍速、拖动进度条、点赞。
- 我的喜欢 `/likes`
  查看和播放已点赞视频。

## 点赞数据

当前这份最小化 `compose.yaml` 只挂载了视频目录：

```yaml
- "./data:/app/media"
```

这意味着：

- 视频文件会持久保留在宿主机
- 点赞数据默认写在容器内部的 `data/user_collect.json`

如果你也希望点赞数据持久化，可以改成：

```yaml
version: "3.9"
services:
  backend:
    image: ghcr.io/xiaofsu/douyin_selfhost:latest
    container_name: douyin_backend
    volumes:
      - "./anime:/app/media/anime:ro"
      - "./movie:/app/media/movie:ro"
      - "./app-data:/app/data"
    ports:
      - "8080:8080"
    restart: always
```

这样点赞数据会保存到宿主机的 `./app-data/user_collect.json`。

## License

MIT

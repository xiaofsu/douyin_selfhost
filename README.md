# douyin_selfhost

这是一个纯本地的抖音式短视频播放器。

仓库已经内置自己的静态前端，不需要额外准备外部前端工程。

只支持 Docker 运行。

## Docker Compose 部署

### 1. 准备目录

在项目目录下创建 `data` 目录，并把视频文件放进去：

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
      - "./data:/app/media"
      - "./app-data:/app/data"
    ports:
      - "8080:8080"
    restart: always
```

这样点赞数据会保存到宿主机的 `./app-data/user_collect.json`。

## License

MIT

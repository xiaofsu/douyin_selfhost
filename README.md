# Douyin Server

这是一个纯本地的抖音式短视频播放器。仓库已经内置自己的静态前端；启动服务后即可在本地浏览器里上下滑动视频、点赞，并查看“我的喜欢”。

## 功能特性

- **本地视频托管**：扫描本地目录中的视频文件（`.mp4`, `.webm`, `.ogg`）并通过 API 提供服务。
- **内置前端**：仓库内自带纯静态单页前端，直接由 Go 服务托管。
- **短视频交互**：支持抖音式上下滑动、长按 2 倍速、进度条拖动定位。
- **本地点赞持久化**：支持点赞/取消点赞，并将“我的喜欢”保存到本地文件。
- **兼容接口**：保留了一组兼容接口，方便继续扩展或接入旧能力。
- **Docker Support**: 使用 Docker 轻松部署，自动构建前端并设置后端环境。

## 前置条件

- **视频文件**：包含你想要展示的视频文件的目录。
- **Docker**：推荐使用 Docker 进行最简单的设置。
- **Go 1.23+**：（如果不使用 Docker 并在本地运行后端）。

## 快速开始 (预编译包)

你可以使用预编译版本快速启动，无需安装环境。支持 Windows, macOS, Linux 等平台。

1. **下载**
   在 GitHub Release 页面下载对应平台的压缩包。

2. **解压与配置**
   - 下载后解压到本地。
   - 在解压后的 `douyin` 可执行文件同级目录下，**新建一个 `media` 文件夹**。
   - 将你的视频文件放入这个 `media` 文件夹中。

3. **启动**
   - **Windows**: 双击 `douyin.exe` 启动服务。
   - **macOS / Linux**: 在终端运行 `./douyin` 启动服务 (需先赋予执行权限: `chmod +x douyin`)。

4. **播放**
   浏览器打开 [http://localhost:8080](http://localhost:8080)，即可播放 `media` 文件夹里的视频。

## Docker 部署

你可以使用提供的脚本快速启动，或者手动运行 Docker 命令。

### 方式一：使用启动脚本（推荐）

项目根目录提供了便捷的启动脚本，会自动挂载 `Downloads` 目录（如果存在）或本地 `media` 目录。

**Linux / macOS:**

```bash
# 默认直接使用 GHCR 镜像运行
./start.sh

# 如果需要构建本地镜像并运行
./start.sh -build
```

**Windows (PowerShell):**

```powershell
# 默认直接使用 GHCR 镜像运行
.\start.ps1

# 如果需要构建本地镜像并运行
.\start.ps1 -Build
```

### 方式二：手动运行

提供的 `Dockerfile` 会直接打包当前仓库内置的前端和后端。

1. **拉取镜像**

   ```bash
   docker pull ghcr.io/ltaoo/douyin_selfhost:latest
   ```

2. **运行容器**

   > 将下面的 `/path/to/your/videos` 替换为你实际的视频文件目录。

   ```bash
   docker run -d \
     -p 8080:8080 \
     -v /path/to/your/videos:/app/media \
     ghcr.io/ltaoo/douyin_selfhost:latest
   ```

3. **访问应用**

   在浏览器中打开 [http://localhost:8080](http://localhost:8080)。

## 本地运行（手动设置）

如果你不想使用 Docker，可以按照以下步骤操作：

### 1. 运行服务器

```bash
go run main.go --static ./dist --media /path/to/your/videos
```

启动后直接访问 [http://localhost:8080](http://localhost:8080)。

只使用当前内置的 `视频播放 / 喜欢 / 我的喜欢` 三个核心功能时，不需要额外准备外部前端工程。

页面行为：

- 首页 `/`：随机竖屏视频流，支持上下滑动、点赞、长按 2 倍速、拖动进度条。
- 我的喜欢 `/likes`：展示喜欢列表，点进任意视频后进入只播放喜欢内容的竖屏信息流。
- 点赞状态持久化到 `data/user_collect.json`，刷新页面或重启服务后仍保留。

### 命令行参数

- `--static`：静态文件目录路径（默认："dist"）。
- `--index`：索引文件路径（默认："index.html"）。
- `--media`：包含视频的媒体目录路径（默认："media"）。

## API 接口

当前内置前端实际使用以下接口：

- `/video/recommended`：返回本地视频列表。
- `/media/*`：提供实际的视频文件流。
- `/video/like`：获取/更新点赞列表。

仓库里还保留了一些兼容接口，但当前内置前端不依赖它们：

- `/user/*`：用户相关接口（面板、收藏、朋友等）。
- `/post/recommended`：推荐帖子。
- `/shop/recommended`：推荐商品。
- `/music`：音乐列表。

## 许可证

MIT

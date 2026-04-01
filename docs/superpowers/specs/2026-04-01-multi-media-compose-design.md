# Docker Compose 多目录挂载设计

## 背景

当前项目文档和启动脚本都以单个媒体目录为例，容易让使用者误以为容器只能挂载一个视频目录。

实际后端行为是递归扫描 `/app/media`，并按相对路径生成视频 URL。因此只要把多个宿主目录分别挂载到 `/app/media` 下的不同子目录，现有后端就可以无感支持多目录视频扫描，无需改 Go 服务逻辑。

## 目标

- 支持在 `docker compose up` 时挂载多个宿主视频目录
- 保持现有镜像、后端参数、前端接口不变
- 让文档直接给出可复制的多目录 `compose.yaml` 示例

## 非目标

- 不新增后端多 `--media` 参数
- 不调整视频扫描逻辑
- 不改变点赞数据持久化方式

## 方案

在 `compose.yaml` 中，把每个宿主目录挂载到容器内 `/app/media` 的不同子目录：

```yaml
services:
  backend:
    image: ghcr.io/xiaofsu/douyin_selfhost:latest
    container_name: douyin_backend
    volumes:
      - "/data/anime:/app/media/anime:ro"
      - "/data/movie:/app/media/movie:ro"
      - "/data/recordings:/app/media/recordings:ro"
      - "./app-data:/app/data"
    ports:
      - "8080:8080"
    restart: always
```

后端仍然只扫描 `/app/media`，但会递归发现 `anime`、`movie`、`recordings` 下的所有视频文件。

## 原因

### 推荐该方案的原因

- 改动最小，只需要更新文档示例
- 不需要重新设计后端路由或媒体根目录配置
- 与当前 `filepath.WalkDir(mediaDir)` 的递归行为完全兼容
- 用户可以继续通过 `docker compose` 原生能力显式控制每个目录的挂载路径和读写权限

### 不选择后端多根目录方案的原因

- 会扩大 Go 代码改动面
- 需要重新定义媒体 URL 与静态文件映射
- 对“Compose 多挂载目录”这个需求来说属于过度设计

## 文档改动

更新 `README.md`：

- 把“准备目录”从单目录示例改为单目录或多目录都可
- 增加多目录 `compose.yaml` 示例
- 明确说明多个宿主目录要挂到 `/app/media` 的不同子目录
- 保留点赞数据持久化说明，并让示例与多目录写法兼容

## 验收标准

- README 中存在可直接复制的多目录 `compose.yaml` 示例
- 文档明确说明多目录挂载到 `/app/media/<子目录>` 的方式
- 方案不要求修改后端代码，现有镜像即可工作

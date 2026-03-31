import { fetchLikedVideos, fetchRecommendedVideos, mutateLikeVideo } from './core/api.mjs';
import { createLikesGridView } from './components/likes-grid.mjs';
import { createPlayerView } from './components/player.mjs';
import { navigate, parseRoute } from './core/router.mjs';
import {
  deriveNextLikedPlayerState,
  normalizeVideo,
  resolvePlayerEntry,
  shouldLoadMoreFeed,
} from './core/state.mjs';

const root = document.querySelector('#app');
const toast = document.querySelector('#toast');
const HOME_BATCH_SIZE = 5;

const state = {
  isLoading: true,
  error: '',
  isReady: false,
  homeFeed: [],
  homeFeedSeed: '',
  homeFeedTotal: 0,
  homeHasMore: false,
  homeIsLoadingMore: false,
  homeActiveIndex: 0,
  likedVideos: [],
  likedIds: new Set(),
  pendingLikes: new Set(),
};

let currentView = null;
let toastTimer = 0;

function routeTab(name) {
  return name === 'home' ? 'home' : 'likes';
}

function likedSetFromRaw(list) {
  const ids = new Set();
  for (const item of list) {
    const awemeId = String(item?.aweme_id ?? item?.awemeId ?? '');
    if (awemeId) {
      ids.add(awemeId);
    }
  }
  return ids;
}

function createNormalizedList(list, likedIds) {
  return list.map((item) => normalizeVideo(item, likedIds));
}

function updatePendingLike(awemeId, pending) {
  const nextPending = new Set(state.pendingLikes);
  if (pending) {
    nextPending.add(awemeId);
  } else {
    nextPending.delete(awemeId);
  }
  state.pendingLikes = nextPending;
}

function syncCollectionsFromLikedRaw(likedRaw) {
  const nextLikedIds = likedSetFromRaw(likedRaw);
  state.likedIds = nextLikedIds;
  state.likedVideos = createNormalizedList(likedRaw, nextLikedIds).map((video) => ({
    ...video,
    liked: true,
  }));
  state.homeFeed = state.homeFeed.map((video) => ({
    ...video,
    liked: nextLikedIds.has(video.awemeId),
  }));
}

function applyOptimisticLike(video, nextLiked) {
  const nextLikedIds = new Set(state.likedIds);
  if (nextLiked) {
    nextLikedIds.add(video.awemeId);
  } else {
    nextLikedIds.delete(video.awemeId);
  }

  state.likedIds = nextLikedIds;
  state.homeFeed = state.homeFeed.map((item) => ({
    ...item,
    liked: nextLikedIds.has(item.awemeId),
  }));

  if (nextLiked) {
    const existingIndex = state.likedVideos.findIndex((item) => item.awemeId === video.awemeId);
    const likedVideo = {
      ...video,
      liked: true,
    };

    if (existingIndex >= 0) {
      const nextList = [...state.likedVideos];
      nextList[existingIndex] = likedVideo;
      state.likedVideos = nextList;
    } else {
      state.likedVideos = [likedVideo, ...state.likedVideos];
    }
    return;
  }

  state.likedVideos = state.likedVideos.filter((item) => item.awemeId !== video.awemeId);
}

function destroyCurrentView() {
  currentView?.destroy?.();
  currentView = null;
  root.innerHTML = '';
}

function mountStatusView(options) {
  destroyCurrentView();

  const {
    eyebrow,
    title,
    copy,
    activeTab,
    actionLabel = '',
    onAction = null,
  } = options;

  root.innerHTML = `
    <div class="app-shell app-shell--status">
      <div class="ambient ambient--left"></div>
      <div class="ambient ambient--right"></div>
      <section class="phone-frame phone-frame--status">
        <div class="status-panel">
          <p class="screen-eyebrow">${eyebrow}</p>
          <h1 class="status-title">${title}</h1>
          <p class="status-copy">${copy}</p>
          ${
            actionLabel
              ? `<button class="primary-button" type="button" data-status-action>${actionLabel}</button>`
              : ''
          }
        </div>

        <nav class="bottom-nav" aria-label="主导航">
          <button class="bottom-nav-item ${activeTab === 'home' ? 'is-active' : ''}" type="button" data-open-home>
            <span>首页</span>
          </button>
          <button class="bottom-nav-item ${activeTab === 'likes' ? 'is-active' : ''}" type="button" data-open-likes-grid>
            <span>我的喜欢</span>
          </button>
        </nav>
      </section>
    </div>
  `;

  const cleanups = [];
  const bind = (selector, handler) => {
    for (const node of root.querySelectorAll(selector)) {
      node.addEventListener('click', handler);
      cleanups.push(() => node.removeEventListener('click', handler));
    }
  };

  bind('[data-open-home]', () => navigate('home'));
  bind('[data-open-likes-grid]', () => navigate('likes-grid'));

  if (onAction) {
    bind('[data-status-action]', () => onAction());
  }

  currentView = {
    destroy() {
      cleanups.splice(0).forEach((dispose) => dispose());
    },
  };
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');

  toastTimer = window.setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2200);
}

function createFeedSeed() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function applyHomeFeedPage(page, likedIds, options = {}) {
  const nextVideos = createNormalizedList(page.list, likedIds);

  if (options.replace) {
    state.homeFeed = nextVideos;
  } else {
    const existingIds = new Set(state.homeFeed.map((video) => video.awemeId));
    const deduped = nextVideos.filter((video) => !existingIds.has(video.awemeId));
    state.homeFeed = [...state.homeFeed, ...deduped];
  }

  state.homeFeedTotal = page.total;
  state.homeHasMore = state.homeFeed.length < page.total;
}

async function loadMoreHomeFeed() {
  if (state.homeIsLoadingMore || !state.homeHasMore || !state.homeFeedSeed) {
    return;
  }

  state.homeIsLoadingMore = true;

  try {
    const page = await fetchRecommendedVideos({
      start: state.homeFeed.length,
      pageSize: HOME_BATCH_SIZE,
      seed: state.homeFeedSeed,
    });

    applyHomeFeedPage(page, state.likedIds);

    if (parseRoute(new URL(window.location.href)).name === 'home') {
      renderCurrentRoute();
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : '继续加载失败');
  } finally {
    state.homeIsLoadingMore = false;
  }
}

async function loadInitialData(options = {}) {
  if (state.isReady && !options.force) {
    return;
  }

  state.isLoading = true;
  state.error = '';
  renderCurrentRoute();

  try {
    const homeFeedSeed = createFeedSeed();
    const [likedRaw, recommendedRaw] = await Promise.all([
      fetchLikedVideos(),
      fetchRecommendedVideos({
        start: 0,
        pageSize: HOME_BATCH_SIZE,
        seed: homeFeedSeed,
      }),
    ]);

    const likedIds = likedSetFromRaw(likedRaw);
    state.likedIds = likedIds;
    state.likedVideos = createNormalizedList(likedRaw, likedIds).map((video) => ({
      ...video,
      liked: true,
    }));
    state.homeFeedSeed = homeFeedSeed;
    state.homeFeedTotal = 0;
    state.homeHasMore = false;
    state.homeIsLoadingMore = false;
    state.homeActiveIndex = 0;
    applyHomeFeedPage(recommendedRaw, likedIds, { replace: true });
    state.isReady = true;
    state.isLoading = false;
    state.error = '';
    renderCurrentRoute();
  } catch (error) {
    state.isLoading = false;
    state.error = error instanceof Error ? error.message : '加载失败';
    renderCurrentRoute();
  }
}

async function handleToggleLike(video, context) {
  if (!video?.awemeId || state.pendingLikes.has(video.awemeId)) {
    return;
  }

  const wasLiked = state.likedIds.has(video.awemeId);
  const nextLiked = !wasLiked;
  let nextLikesRoute = null;

  if (context.activeTab === 'likes' && !nextLiked) {
    const currentIndex = state.likedVideos.findIndex((item) => item.awemeId === video.awemeId);
    if (currentIndex >= 0) {
      const nextState = deriveNextLikedPlayerState(state.likedVideos, currentIndex);
      nextLikesRoute = nextState.isEmpty
        ? { name: 'likes-grid', playId: '' }
        : { name: 'likes-player', playId: nextState.list[nextState.nextIndex].awemeId };
    }
  }

  updatePendingLike(video.awemeId, true);
  applyOptimisticLike(video, nextLiked);
  currentView?.updateLikedState?.(state.likedIds, state.pendingLikes);

  try {
    const likedRaw = await mutateLikeVideo(video.awemeId, nextLiked);
    syncCollectionsFromLikedRaw(likedRaw);
    updatePendingLike(video.awemeId, false);

    if (context.activeTab === 'likes' && !nextLiked) {
      if (!state.likedVideos.length || nextLikesRoute?.name === 'likes-grid') {
        navigate('likes-grid', { replace: true });
        return;
      }

      if (nextLikesRoute?.name === 'likes-player') {
        navigate('likes-player', { playId: nextLikesRoute.playId, replace: true });
        return;
      }
    }

    currentView?.updateLikedState?.(state.likedIds, state.pendingLikes);
    showToast(nextLiked ? '已加入我的喜欢' : '已取消喜欢');
  } catch (error) {
    updatePendingLike(video.awemeId, false);
    applyOptimisticLike(video, wasLiked);
    currentView?.updateLikedState?.(state.likedIds, state.pendingLikes);

    if (context.activeTab === 'likes') {
      renderCurrentRoute();
    }

    showToast(error instanceof Error ? error.message : '操作失败');
  }
}

function renderCurrentRoute() {
  const route = parseRoute(new URL(window.location.href));
  const activeTab = routeTab(route.name);

  if (state.isLoading) {
    mountStatusView({
      eyebrow: 'LOCAL FEED',
      title: '正在载入视频',
      copy: '先拉取本地视频和你的喜欢列表，然后再进入对应页面。',
      activeTab,
    });
    return;
  }

  if (state.error) {
    mountStatusView({
      eyebrow: 'REQUEST FAILED',
      title: '页面没有加载成功',
      copy: state.error,
      activeTab,
      actionLabel: '重新加载',
      onAction: () => loadInitialData({ force: true }),
    });
    return;
  }

  destroyCurrentView();

  if (route.name === 'home') {
    if (!state.homeFeed.length) {
      mountStatusView({
        eyebrow: 'NO MEDIA',
        title: '还没有可播放的视频',
        copy: '把本地 mp4、webm 或 ogg 文件放进 media 目录后刷新页面。',
        activeTab: 'home',
        actionLabel: '刷新列表',
        onAction: () => loadInitialData({ force: true }),
      });
      return;
    }

    currentView = createPlayerView(root, {
      videos: state.homeFeed,
      startIndex: state.homeActiveIndex,
      activeTab: 'home',
      likedIds: state.likedIds,
      pendingLikes: state.pendingLikes,
      onToggleLike: handleToggleLike,
      onOpenHome: () => navigate('home'),
      onOpenLikesGrid: () => navigate('likes-grid'),
      onActiveIndexChange: (index) => {
        state.homeActiveIndex = index;

        if (shouldLoadMoreFeed(index, state.homeFeed.length, state.homeHasMore, state.homeIsLoadingMore)) {
          loadMoreHomeFeed();
        }
      },
    });
    return;
  }

  if (route.name === 'likes-grid') {
    currentView = createLikesGridView(root, {
      videos: state.likedVideos,
      onOpenVideo: (playId) => navigate('likes-player', { playId }),
      onOpenHome: () => navigate('home'),
      onOpenLikesGrid: () => navigate('likes-grid'),
    });
    return;
  }

  const entry = resolvePlayerEntry(state.likedVideos, route.playId);
  if (entry.index < 0 || !entry.video) {
    navigate('likes-grid', { replace: true });
    return;
  }

  if (route.playId !== entry.video.awemeId) {
    navigate('likes-player', { playId: entry.video.awemeId, replace: true });
    return;
  }

  currentView = createPlayerView(root, {
    videos: state.likedVideos,
    startIndex: entry.index,
    activeTab: 'likes',
    likedIds: state.likedIds,
    pendingLikes: state.pendingLikes,
    onToggleLike: handleToggleLike,
    onOpenHome: () => navigate('home'),
    onOpenLikesGrid: () => navigate('likes-grid'),
  });
}

window.addEventListener('popstate', renderCurrentRoute);
window.addEventListener('app:navigate', renderCurrentRoute);

loadInitialData();

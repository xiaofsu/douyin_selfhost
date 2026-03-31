export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function firstUrl(value) {
  if (!value) {
    return '';
  }

  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : '';
  }

  if (Array.isArray(value.url_list)) {
    return typeof value.url_list[0] === 'string' ? value.url_list[0] : '';
  }

  if (typeof value.url === 'string') {
    return value.url;
  }

  return '';
}

export function normalizeVideo(raw, likedIds = new Set()) {
  const awemeId = String(raw.aweme_id ?? raw.id ?? raw.awemeId ?? '');

  return {
    awemeId,
    desc: String(raw.desc ?? raw.title ?? raw.filename ?? '未命名视频'),
    authorName: String(raw.author?.nickname ?? raw.author?.unique_id ?? raw.authorName ?? '本地视频'),
    avatarUrl:
      firstUrl(raw.author?.avatar_thumb) ||
      firstUrl(raw.author?.avatar_medium) ||
      firstUrl(raw.author?.avatar_large),
    src: firstUrl(raw.video?.play_addr) || firstUrl(raw.play_addr) || String(raw.url ?? raw.src ?? ''),
    liked: likedIds.has(awemeId),
    raw,
  };
}

export function createSessionFeed(videos, random = Math.random) {
  const copy = [...videos];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

export function createHomeRefreshState(seed = '') {
  return {
    homeFeed: [],
    homeFeedSeed: seed,
    homeFeedTotal: 0,
    homeHasMore: false,
    homeIsLoadingMore: false,
    homeActiveIndex: 0,
    soundEnabled: false,
  };
}

export function resolvePlayerVideoFit(videoWidth, videoHeight) {
  if (!Number.isFinite(videoWidth) || !Number.isFinite(videoHeight) || videoWidth <= 0 || videoHeight <= 0) {
    return 'contain';
  }

  return videoWidth > videoHeight ? 'contain' : 'cover';
}

export function resolvePlayerVideoObjectPositionY(videoWidth, videoHeight) {
  if (!Number.isFinite(videoWidth) || !Number.isFinite(videoHeight) || videoWidth <= 0 || videoHeight <= 0) {
    return 50;
  }

  if (videoWidth <= videoHeight) {
    return 50;
  }

  const aspectRatio = videoWidth / videoHeight;
  const shifted = clamp(50 - (aspectRatio - 1) * 3.5, 45, 50);
  return Number(shifted.toFixed(1));
}

export function describeVideoPath(video) {
  const fallbackFileName = String(video?.raw?.filename ?? video?.desc ?? '未命名视频');
  const source = String(video?.src ?? video?.raw?.src ?? video?.raw?.url ?? '').trim();
  if (!source) {
    return {
      fileName: fallbackFileName,
      directory: '/',
    };
  }

  let pathname = '';
  try {
    pathname = new URL(source, 'http://localhost').pathname;
  } catch (_error) {
    pathname = source.split('?')[0] || '/';
  }

  const parts = pathname
    .split('/')
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch (_error) {
        return part;
      }
    });

  if (!parts.length) {
    return {
      fileName: fallbackFileName,
      directory: '/',
    };
  }

  const fileName = parts.at(-1) || fallbackFileName;
  const directoryParts = parts.slice(0, -1);

  return {
    fileName,
    directory: directoryParts.length ? `/${directoryParts.join('/')}` : '/',
  };
}

export function seekRatioFromPointer(clientX, left, width) {
  if (!Number.isFinite(width) || width <= 0) {
    return 0;
  }

  return clamp((clientX - left) / width, 0, 1);
}

export function resolveSoundPreference(currentSoundEnabled, action) {
  if (action === 'enable') {
    return true;
  }

  if (action === 'disable') {
    return false;
  }

  if (action === 'playback-error') {
    return currentSoundEnabled;
  }

  return currentSoundEnabled;
}

export function shouldLoadMoreFeed(activeIndex, loadedCount, hasMore = true, isLoadingMore = false) {
  if (!hasMore || isLoadingMore || loadedCount <= 0) {
    return false;
  }

  return activeIndex >= Math.max(0, loadedCount - 3);
}

export function shouldAttachVideoSource(index, activeIndex, radius = 1) {
  return Math.abs(index - activeIndex) <= radius;
}

export function resolvePlayerEntry(videos, awemeId) {
  if (!videos.length) {
    return { index: -1, video: null };
  }

  const index = videos.findIndex((video) => video.awemeId === awemeId);
  if (index >= 0) {
    return { index, video: videos[index] };
  }

  return { index: 0, video: videos[0] };
}

export function deriveNextLikedPlayerState(videos, currentIndex) {
  const list = videos.filter((_, index) => index !== currentIndex);

  if (!list.length) {
    return {
      list,
      nextIndex: -1,
      isEmpty: true,
    };
  }

  const nextIndex = currentIndex >= list.length ? list.length - 1 : currentIndex;
  return {
    list,
    nextIndex,
    isEmpty: false,
  };
}

export function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '00:00';
  }

  const wholeSeconds = Math.floor(totalSeconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function pickVideoById(videos, awemeId) {
  return videos.find((video) => video.awemeId === awemeId) ?? null;
}

import { clamp, formatDuration } from '../core/state.mjs';

const HEART_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 21.35 10.55 20C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A6 6 0 0 1 16.5 3C19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z"></path>
  </svg>
`;

const CHEVRON_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M15.71 6.29a1 1 0 0 1 0 1.41L11.42 12l4.29 4.29a1 1 0 0 1-1.42 1.42l-5-5a1 1 0 0 1 0-1.42l5-5a1 1 0 0 1 1.42 0Z"></path>
  </svg>
`;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function createPlayerView(container, options) {
  const {
    videos,
    startIndex = 0,
    activeTab = 'home',
    likedIds: initialLikedIds = new Set(),
    pendingLikes: initialPendingLikes = new Set(),
    onToggleLike,
    onOpenHome,
    onOpenLikesGrid,
  } = options;

  let likedIds = initialLikedIds;
  let pendingLikes = initialPendingLikes;
  let activeIndex = clamp(startIndex, 0, Math.max(videos.length - 1, 0));
  let pointerState = null;
  let longPressTimer = 0;
  let fastMode = false;
  let isSeeking = false;
  let destroyed = false;
  let wheelLocked = false;
  let wasPlayingBeforeSeek = false;
  const cleanups = [];

  const slides = videos
    .map(
      (video, index) => `
        <article class="player-slide" data-player-slide data-index="${index}">
          <video
            class="player-video"
            src="${escapeHtml(video.src)}"
            playsinline
            muted
            preload="metadata"
            loop
          ></video>

          <div class="player-scrim"></div>

          <div class="player-meta">
            <p class="player-author">@${escapeHtml(video.authorName)}</p>
            <h2 class="player-desc">${escapeHtml(video.desc)}</h2>
            <p class="player-caption">长按 2x 倍速，拖动底部进度条定位播放。</p>
          </div>

          <aside class="player-actions" data-ignore-gesture>
            <span class="player-avatar" aria-hidden="true">
              ${
                video.avatarUrl
                  ? `<img src="${escapeHtml(video.avatarUrl)}" alt="">`
                  : '<span>DY</span>'
              }
            </span>
            <button
              class="action-button"
              data-like-button
              data-aweme-id="${escapeHtml(video.awemeId)}"
              type="button"
              aria-label="切换喜欢"
            >
              <span class="action-icon">${HEART_ICON}</span>
              <span class="action-text" data-like-text>喜欢</span>
            </button>
          </aside>
        </article>
      `,
    )
    .join('');

  container.innerHTML = `
    <div class="app-shell app-shell--player">
      <div class="ambient ambient--left"></div>
      <div class="ambient ambient--right"></div>
      <section class="phone-frame phone-frame--player">
        <header class="player-header">
          ${
            activeTab === 'likes'
              ? `
                <button class="icon-button" type="button" data-open-likes-grid data-ignore-gesture aria-label="返回我的喜欢">
                  ${CHEVRON_ICON}
                </button>
              `
              : '<span class="player-header-spacer"></span>'
          }
          <div class="player-header-copy">
            <p>${activeTab === 'likes' ? 'LIKED FEED' : 'RANDOM FEED'}</p>
            <strong>${activeTab === 'likes' ? '我的喜欢视频流' : '本地抖音首页'}</strong>
          </div>
          <button class="ghost-button ghost-button--small" type="button" data-open-home data-ignore-gesture>
            首页
          </button>
        </header>

        <section class="player-stage" data-player-stage aria-label="视频播放器">
          <div class="player-track" data-player-track>
            ${slides}
          </div>

          <div class="speed-chip" data-speed-chip>按住 2x 倍速</div>

          <div class="player-progress" data-ignore-gesture>
            <div
              class="player-progress-bar"
              data-progress-bar
              role="slider"
              aria-label="播放进度"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow="0"
              tabindex="0"
            >
              <span class="player-progress-fill" data-progress-fill></span>
              <span class="player-progress-handle"></span>
            </div>
            <div class="player-time">
              <span data-current-time>00:00</span>
              <span data-total-time>00:00</span>
            </div>
          </div>
        </section>

        <nav class="bottom-nav" aria-label="主导航" data-ignore-gesture>
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

  const stage = container.querySelector('[data-player-stage]');
  const track = container.querySelector('[data-player-track]');
  const speedChip = container.querySelector('[data-speed-chip]');
  const progressBar = container.querySelector('[data-progress-bar]');
  const progressFill = container.querySelector('[data-progress-fill]');
  const currentTimeNode = container.querySelector('[data-current-time]');
  const totalTimeNode = container.querySelector('[data-total-time]');
  const slideNodes = Array.from(container.querySelectorAll('[data-player-slide]'));
  const videoNodes = slideNodes.map((slide) => slide.querySelector('.player-video'));
  const likeButtons = slideNodes.map((slide) => slide.querySelector('[data-like-button]'));

  function currentVideo() {
    return videoNodes[activeIndex] ?? null;
  }

  function syncLikeButtons() {
    for (const button of likeButtons) {
      const awemeId = button?.getAttribute('data-aweme-id') || '';
      const liked = likedIds.has(awemeId);
      const pending = pendingLikes.has(awemeId);

      if (!button) {
        continue;
      }

      button.classList.toggle('is-liked', liked);
      button.classList.toggle('is-pending', pending);
      button.disabled = pending;
      button.setAttribute('aria-pressed', liked ? 'true' : 'false');

      const textNode = button.querySelector('[data-like-text]');
      if (textNode) {
        textNode.textContent = liked ? '已喜欢' : '喜欢';
      }
    }
  }

  function syncProgress() {
    const video = currentVideo();
    if (!video) {
      progressFill.style.width = '0%';
      progressBar.setAttribute('aria-valuenow', '0');
      currentTimeNode.textContent = '00:00';
      totalTimeNode.textContent = '00:00';
      return;
    }

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const ratio = duration > 0 ? currentTime / duration : 0;

    progressFill.style.width = `${ratio * 100}%`;
    progressBar.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    currentTimeNode.textContent = formatDuration(currentTime);
    totalTimeNode.textContent = formatDuration(duration);
  }

  async function playActiveVideo() {
    const video = currentVideo();
    if (!video) {
      return;
    }

    video.muted = true;
    video.playsInline = true;
    video.playbackRate = fastMode ? 2 : 1;

    try {
      await video.play();
    } catch (_error) {
      // Ignore autoplay restrictions. The user can resume by interacting.
    }
  }

  function pauseInactiveVideos() {
    for (let index = 0; index < videoNodes.length; index += 1) {
      const video = videoNodes[index];
      if (!video) {
        continue;
      }

      video.preload = Math.abs(index - activeIndex) <= 1 ? 'auto' : 'metadata';
      if (index !== activeIndex) {
        video.pause();
        video.playbackRate = 1;
      }
    }
  }

  function writeLikesPlayerUrl() {
    if (activeTab !== 'likes') {
      return;
    }

    const activeVideo = videos[activeIndex];
    if (!activeVideo) {
      return;
    }

    const nextUrl = `/likes?play=${encodeURIComponent(activeVideo.awemeId)}`;
    window.history.replaceState({}, '', nextUrl);
  }

  function syncViewportHeights() {
    const stageHeight = stage.clientHeight;
    if (!stageHeight) {
      return;
    }

    track.style.height = `${stageHeight * videos.length}px`;
    for (const slide of slideNodes) {
      slide.style.height = `${stageHeight}px`;
    }
  }

  function updateTrack(options = {}) {
    syncViewportHeights();
    track.style.transitionDuration = options.immediate ? '0ms' : '320ms';
    track.style.transform = `translate3d(0, ${-activeIndex * stage.clientHeight}px, 0)`;

    for (let index = 0; index < slideNodes.length; index += 1) {
      slideNodes[index]?.classList.toggle('is-active', index === activeIndex);
    }

    pauseInactiveVideos();
    syncLikeButtons();
    syncProgress();
    writeLikesPlayerUrl();
    playActiveVideo();
  }

  function setActiveIndex(nextIndex, options = {}) {
    const clampedIndex = clamp(nextIndex, 0, Math.max(videos.length - 1, 0));
    if (clampedIndex === activeIndex && !options.force) {
      syncProgress();
      playActiveVideo();
      return;
    }

    activeIndex = clampedIndex;
    updateTrack(options);
  }

  function move(delta) {
    setActiveIndex(activeIndex + delta);
  }

  function disableFastMode() {
    window.clearTimeout(longPressTimer);
    longPressTimer = 0;

    if (!fastMode) {
      return;
    }

    fastMode = false;
    speedChip.classList.remove('is-active');

    const video = currentVideo();
    if (video) {
      video.playbackRate = 1;
    }
  }

  function armLongPress() {
    window.clearTimeout(longPressTimer);
    longPressTimer = window.setTimeout(() => {
      if (destroyed || isSeeking) {
        return;
      }

      fastMode = true;
      speedChip.classList.add('is-active');

      const video = currentVideo();
      if (video) {
        video.playbackRate = 2;
      }
    }, 250);
  }

  function resetPointerState() {
    if (!pointerState) {
      return;
    }

    try {
      stage.releasePointerCapture?.(pointerState.id);
    } catch (_error) {
      // Ignore capture release errors.
    }

    pointerState = null;
  }

  function handleStagePointerDown(event) {
    if (event.target.closest('[data-ignore-gesture]')) {
      return;
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    pointerState = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
    };

    stage.setPointerCapture?.(event.pointerId);
    armLongPress();
  }

  function handleStagePointerMove(event) {
    if (!pointerState || event.pointerId !== pointerState.id) {
      return;
    }

    pointerState.lastX = event.clientX;
    pointerState.lastY = event.clientY;

    const deltaY = pointerState.lastY - pointerState.startY;
    const deltaX = pointerState.lastX - pointerState.startX;
    if (Math.abs(deltaY) > 10 || Math.abs(deltaX) > 10) {
      window.clearTimeout(longPressTimer);
      longPressTimer = 0;
    }
  }

  function handleStagePointerEnd(event) {
    if (!pointerState || (event.pointerId !== undefined && event.pointerId !== pointerState.id)) {
      return;
    }

    const deltaY = pointerState.lastY - pointerState.startY;
    const deltaX = pointerState.lastX - pointerState.startX;

    disableFastMode();

    if (!isSeeking && Math.abs(deltaY) > 72 && Math.abs(deltaY) > Math.abs(deltaX)) {
      move(deltaY < 0 ? 1 : -1);
    }

    resetPointerState();
  }

  function handleWheel(event) {
    if (isSeeking || wheelLocked || Math.abs(event.deltaY) < 24) {
      return;
    }

    event.preventDefault();
    wheelLocked = true;
    window.setTimeout(() => {
      wheelLocked = false;
    }, 360);

    move(event.deltaY > 0 ? 1 : -1);
  }

  function handleKeyDown(event) {
    if (isSeeking) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    }
  }

  function updateSeekPosition(clientX) {
    const rect = progressBar.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    progressFill.style.width = `${ratio * 100}%`;
    progressBar.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));

    const video = currentVideo();
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      currentTimeNode.textContent = '00:00';
      return;
    }

    video.currentTime = video.duration * ratio;
    currentTimeNode.textContent = formatDuration(video.currentTime);
    totalTimeNode.textContent = formatDuration(video.duration);
  }

  function handleSeekStart(event) {
    event.preventDefault();
    disableFastMode();
    isSeeking = true;

    const video = currentVideo();
    wasPlayingBeforeSeek = !!video && !video.paused;
    if (video) {
      video.pause();
    }

    updateSeekPosition(event.clientX);

    const moveHandler = (moveEvent) => {
      updateSeekPosition(moveEvent.clientX);
    };

    const endHandler = () => {
      window.removeEventListener('pointermove', moveHandler);
      window.removeEventListener('pointerup', endHandler);
      window.removeEventListener('pointercancel', endHandler);

      isSeeking = false;
      if (wasPlayingBeforeSeek) {
        playActiveVideo();
      }
    };

    window.addEventListener('pointermove', moveHandler);
    window.addEventListener('pointerup', endHandler);
    window.addEventListener('pointercancel', endHandler);

    cleanups.push(() => {
      window.removeEventListener('pointermove', moveHandler);
      window.removeEventListener('pointerup', endHandler);
      window.removeEventListener('pointercancel', endHandler);
    });
  }

  function handleLikeClick(event) {
    const button = event.target.closest('[data-like-button]');
    if (!button) {
      return;
    }

    const awemeId = button.getAttribute('data-aweme-id') || '';
    const index = videos.findIndex((video) => video.awemeId === awemeId);
    if (index < 0) {
      return;
    }

    onToggleLike(videos[index], {
      index,
      activeTab,
    });
  }

  function bindClick(selector, handler) {
    for (const node of container.querySelectorAll(selector)) {
      node.addEventListener('click', handler);
      cleanups.push(() => node.removeEventListener('click', handler));
    }
  }

  bindClick('[data-open-home]', () => onOpenHome());
  bindClick('[data-open-likes-grid]', () => onOpenLikesGrid());

  const resizeHandler = () => updateTrack({ immediate: true, force: true });
  stage.addEventListener('pointerdown', handleStagePointerDown);
  stage.addEventListener('pointermove', handleStagePointerMove);
  stage.addEventListener('pointerup', handleStagePointerEnd);
  stage.addEventListener('pointercancel', handleStagePointerEnd);
  stage.addEventListener('wheel', handleWheel, { passive: false });
  container.addEventListener('click', handleLikeClick);
  progressBar.addEventListener('pointerdown', handleSeekStart);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('resize', resizeHandler);

  cleanups.push(() => stage.removeEventListener('pointerdown', handleStagePointerDown));
  cleanups.push(() => stage.removeEventListener('pointermove', handleStagePointerMove));
  cleanups.push(() => stage.removeEventListener('pointerup', handleStagePointerEnd));
  cleanups.push(() => stage.removeEventListener('pointercancel', handleStagePointerEnd));
  cleanups.push(() => stage.removeEventListener('wheel', handleWheel));
  cleanups.push(() => container.removeEventListener('click', handleLikeClick));
  cleanups.push(() => progressBar.removeEventListener('pointerdown', handleSeekStart));
  cleanups.push(() => window.removeEventListener('keydown', handleKeyDown));
  cleanups.push(() => window.removeEventListener('resize', resizeHandler));

  for (let index = 0; index < videoNodes.length; index += 1) {
    const video = videoNodes[index];
    if (!video) {
      continue;
    }

    const syncIfActive = () => {
      if (index === activeIndex && !isSeeking) {
        syncProgress();
      }
    };

    video.addEventListener('loadedmetadata', syncIfActive);
    video.addEventListener('timeupdate', syncIfActive);

    cleanups.push(() => {
      video.removeEventListener('loadedmetadata', syncIfActive);
      video.removeEventListener('timeupdate', syncIfActive);
      video.pause();
    });
  }

  updateTrack({ immediate: true, force: true });

  return {
    destroy() {
      destroyed = true;
      disableFastMode();
      resetPointerState();
      cleanups.splice(0).forEach((dispose) => dispose());
    },
    updateLikedState(nextLikedIds, nextPendingLikes) {
      likedIds = nextLikedIds;
      pendingLikes = nextPendingLikes;
      syncLikeButtons();
    },
  };
}

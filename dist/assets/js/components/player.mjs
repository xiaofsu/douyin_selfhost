import {
  clamp,
  describeVideoPath,
  formatDuration,
  resolveSoundPreference,
  seekRatioFromPointer,
  shouldAttachVideoSource,
} from '../core/state.mjs';

const HEART_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 21.35 10.55 20C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A6 6 0 0 1 16.5 3C19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z"></path>
  </svg>
`;

const VOLUME_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M14.96 5.46a1 1 0 0 1 1.41 0A9 9 0 0 1 19 12a9 9 0 0 1-2.63 6.54 1 1 0 1 1-1.41-1.41A7 7 0 0 0 17 12a7 7 0 0 0-2.04-5.13 1 1 0 0 1 0-1.41Z"></path>
    <path d="M12.84 7.59a1 1 0 0 1 1.42 0A6 6 0 0 1 16 12a6 6 0 0 1-1.74 4.41 1 1 0 1 1-1.42-1.41A4 4 0 0 0 14 12a4 4 0 0 0-1.16-2.99 1 1 0 0 1 0-1.42Z"></path>
    <path d="M3 10a1 1 0 0 1 1-1h3.38l4.95-3.71A1 1 0 0 1 14 6v12a1 1 0 0 1-1.67.74L7.38 15H4a1 1 0 0 1-1-1v-4Zm2 1v2h2.71a1 1 0 0 1 .6.2l3.69 2.77V8.03L8.31 10.8a1 1 0 0 1-.6.2H5Z"></path>
  </svg>
`;

const SEEK_COMMIT_READY_STATE = 2;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderPlayerSlide(video, index, soundEnabled = false) {
  const { fileName, directory } = describeVideoPath(video);

  return `
    <article class="player-slide" data-player-slide data-index="${index}">
      <video
        class="player-video"
        data-src="${escapeHtml(video.src)}"
        playsinline
        muted
        preload="none"
        loop
      ></video>

      <div class="player-scrim"></div>

      <div class="player-meta">
        <strong class="player-file-name">${escapeHtml(fileName)}</strong>
        <span class="player-directory">${escapeHtml(directory)}</span>
      </div>

      <aside class="player-actions" data-ignore-gesture>
        <button
          class="action-button action-button--icon"
          data-like-button
          data-aweme-id="${escapeHtml(video.awemeId)}"
          type="button"
          aria-label="切换喜欢"
        >
          <span class="action-icon">${HEART_ICON}</span>
          <span class="visually-hidden" data-like-text>喜欢</span>
        </button>
        <button
          class="action-button action-button--mute ${soundEnabled ? 'is-hidden' : ''}"
          data-toggle-mute
          type="button"
          aria-label="解除静音"
        >
          <span class="action-icon">${VOLUME_ICON}</span>
          <span class="visually-hidden">解除静音</span>
        </button>
      </aside>
    </article>
  `;
}

export function renderPlayerMarkup(options) {
  const { videos, activeTab = 'home', soundEnabled = false } = options;
  const slides = videos.map((video, index) => renderPlayerSlide(video, index, soundEnabled)).join('');

  return `
    <div class="app-shell app-shell--player">
      <div class="ambient ambient--left"></div>
      <div class="ambient ambient--right"></div>
      <section class="phone-frame phone-frame--player">
        <section class="player-stage" data-player-stage aria-label="视频播放器">
          <div class="player-track" data-player-track>
            ${slides}
          </div>

          <nav class="floating-nav player-top-nav" data-player-top-nav data-ignore-gesture>
            <button
              class="floating-nav-link ${activeTab === 'home' ? 'is-active' : ''}"
              type="button"
              data-open-home
              data-nav-home
            >首页</button>
            <span class="floating-nav-divider" aria-hidden="true">-</span>
            <button
              class="floating-nav-link ${activeTab === 'likes' ? 'is-active' : ''}"
              type="button"
              data-open-likes-grid
              data-nav-likes
            >我的</button>
          </nav>

          <div class="speed-chip" data-speed-chip aria-live="polite">2 倍速播放中</div>

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
              <span class="player-progress-handle" data-progress-handle></span>
            </div>
            <div class="player-time">
              <span data-current-time>00:00</span>
              <span data-total-time>00:00</span>
            </div>
          </div>
        </section>
      </section>
    </div>
  `;
}

function sanitizeProgressSnapshot(snapshot = {}) {
  const duration = Number.isFinite(snapshot.duration) && snapshot.duration > 0 ? snapshot.duration : 0;
  const currentTime = Number.isFinite(snapshot.currentTime) && snapshot.currentTime >= 0
    ? (duration > 0 ? clamp(snapshot.currentTime, 0, duration) : snapshot.currentTime)
    : 0;
  const fallbackRatio = duration > 0 ? currentTime / duration : 0;
  const ratio = clamp(Number.isFinite(snapshot.ratio) ? snapshot.ratio : fallbackRatio, 0, 1);

  return {
    ratio,
    currentTime,
    duration,
  };
}

function captureProgressSnapshot(video) {
  if (!video) {
    return sanitizeProgressSnapshot();
  }

  return sanitizeProgressSnapshot({
    duration: video.duration,
    currentTime: video.currentTime,
  });
}

export function resolveDisplayedProgressSnapshot(options = {}) {
  const committedSnapshot = sanitizeProgressSnapshot(options.committedSnapshot);
  const liveSnapshot = sanitizeProgressSnapshot(options.liveSnapshot);

  if (!options.awaitingSeekCommit) {
    return liveSnapshot;
  }

  return {
    ratio: clamp(
      Number.isFinite(options.previewRatio) ? options.previewRatio : committedSnapshot.ratio,
      0,
      1,
    ),
    currentTime: committedSnapshot.currentTime,
    duration: liveSnapshot.duration || committedSnapshot.duration,
  };
}

export function canCommitPendingSeek(video) {
  return !!video && !video.seeking && Number(video.readyState ?? 0) >= SEEK_COMMIT_READY_STATE;
}

export function resolveFastModeViewState(isFastMode) {
  return {
    chromeHidden: !!isFastMode,
    speedChipActive: !!isFastMode,
  };
}

export function createPlayerView(container, options) {
  const {
    videos,
    startIndex = 0,
    activeTab = 'home',
    likedIds: initialLikedIds = new Set(),
    pendingLikes: initialPendingLikes = new Set(),
    soundEnabled: initialSoundEnabled = false,
    onToggleLike,
    onOpenHome,
    onOpenLikesGrid,
    onActiveIndexChange,
    onSoundEnabledChange,
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
  let awaitingSeekCommit = false;
  let pendingSeekRatio = null;
  let committedProgress = sanitizeProgressSnapshot();
  let soundEnabled = initialSoundEnabled;
  const cleanups = [];

  container.innerHTML = renderPlayerMarkup({
    videos,
    startIndex,
    activeTab,
    soundEnabled,
  });

  const stage = container.querySelector('[data-player-stage]');
  const track = container.querySelector('[data-player-track]');
  const speedChip = container.querySelector('[data-speed-chip]');
  const progressBar = container.querySelector('[data-progress-bar]');
  const progressFill = container.querySelector('[data-progress-fill]');
  const progressHandle = container.querySelector('[data-progress-handle]');
  const currentTimeNode = container.querySelector('[data-current-time]');
  const totalTimeNode = container.querySelector('[data-total-time]');
  const slideNodes = Array.from(container.querySelectorAll('[data-player-slide]'));
  const videoNodes = slideNodes.map((slide) => slide.querySelector('.player-video'));
  const likeButtons = slideNodes.map((slide) => slide.querySelector('[data-like-button]'));
  const muteButtons = slideNodes.map((slide) => slide.querySelector('[data-toggle-mute]'));

  function currentVideo() {
    return videoNodes[activeIndex] ?? null;
  }

  function attachVideoSource(video, index) {
    const src = video?.dataset.src || videos[index]?.src || '';
    if (!video || !src || video.getAttribute('src') === src) {
      return;
    }

    video.setAttribute('src', src);
    video.load();
  }

  function detachVideoSource(video) {
    if (!video || !video.getAttribute('src')) {
      return;
    }

    video.pause();
    video.removeAttribute('src');
    video.load();
  }

  function syncVideoSources() {
    for (let index = 0; index < videoNodes.length; index += 1) {
      const video = videoNodes[index];
      if (!video) {
        continue;
      }

      const shouldAttach = shouldAttachVideoSource(index, activeIndex);
      video.preload = shouldAttach ? 'auto' : 'none';

      if (shouldAttach) {
        attachVideoSource(video, index);
      } else {
        detachVideoSource(video);
      }
    }
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
      button.setAttribute('aria-label', liked ? '取消喜欢' : '标记喜欢');

      const textNode = button.querySelector('[data-like-text]');
      if (textNode) {
        textNode.textContent = liked ? '已喜欢' : '喜欢';
      }
    }
  }

  function syncMuteButtons() {
    for (const button of muteButtons) {
      if (!button) {
        continue;
      }

      button.classList.toggle('is-hidden', soundEnabled);
      button.tabIndex = soundEnabled ? -1 : 0;
      button.setAttribute('aria-hidden', soundEnabled ? 'true' : 'false');
    }
  }

  function syncProgressUi(ratio) {
    const percentage = `${ratio * 100}%`;
    progressFill.style.width = percentage;
    progressHandle.style.left = percentage;
    progressBar.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
  }

  function clearPendingSeekState() {
    awaitingSeekCommit = false;
    pendingSeekRatio = null;
  }

  function renderProgressSnapshot(snapshot) {
    syncProgressUi(snapshot.ratio);
    currentTimeNode.textContent = formatDuration(snapshot.currentTime);
    totalTimeNode.textContent = formatDuration(snapshot.duration);
  }

  function syncProgress(options = {}) {
    const video = currentVideo();
    if (!video) {
      committedProgress = sanitizeProgressSnapshot();
      clearPendingSeekState();
      renderProgressSnapshot(committedProgress);
      return;
    }

    const liveSnapshot = captureProgressSnapshot(video);
    const commitSeek = options.commitSeek === true;

    if (commitSeek || !awaitingSeekCommit) {
      committedProgress = liveSnapshot;
    } else if (liveSnapshot.duration > 0) {
      committedProgress = {
        ...committedProgress,
        duration: liveSnapshot.duration,
      };
    }

    renderProgressSnapshot(
      resolveDisplayedProgressSnapshot({
        committedSnapshot: committedProgress,
        liveSnapshot,
        previewRatio: pendingSeekRatio,
        awaitingSeekCommit: awaitingSeekCommit && !commitSeek,
      }),
    );

    if (commitSeek) {
      clearPendingSeekState();
    }
  }

  async function playActiveVideo() {
    const video = currentVideo();
    if (!video) {
      return;
    }

    attachVideoSource(video, activeIndex);

    video.muted = !soundEnabled;
    video.playsInline = true;
    video.playbackRate = fastMode ? 2 : 1;

    try {
      await video.play();
    } catch (_error) {
      if (soundEnabled) {
        soundEnabled = resolveSoundPreference(soundEnabled, 'playback-error');
        video.muted = true;
        try {
          await video.play();
        } catch (_nestedError) {
          // Ignore autoplay restrictions. The user can resume by interacting.
        }
        return;
      }
      // Ignore autoplay restrictions. The user can resume by interacting.
    }
  }

  function pauseInactiveVideos() {
    syncVideoSources();

    for (let index = 0; index < videoNodes.length; index += 1) {
      const video = videoNodes[index];
      if (!video) {
        continue;
      }

      if (index !== activeIndex) {
        video.pause();
        video.playbackRate = 1;
        video.muted = true;
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
    syncMuteButtons();
    syncFastModeUi();
    clearPendingSeekState();
    syncProgress();
    writeLikesPlayerUrl();
    playActiveVideo();
    onActiveIndexChange?.(activeIndex);
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

  function syncFastModeUi() {
    const viewState = resolveFastModeViewState(fastMode);
    stage.classList.toggle('is-fast-mode', viewState.chromeHidden);
    speedChip.classList.toggle('is-active', viewState.speedChipActive);
  }

  function disableFastMode() {
    window.clearTimeout(longPressTimer);
    longPressTimer = 0;

    if (!fastMode) {
      return;
    }

    fastMode = false;
    syncFastModeUi();

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
      syncFastModeUi();

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

    event.preventDefault();

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

    event.preventDefault();
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
    const ratio = seekRatioFromPointer(clientX, rect.left, rect.width);
    const video = currentVideo();
    if (!video) {
      committedProgress = sanitizeProgressSnapshot();
      clearPendingSeekState();
      renderProgressSnapshot(committedProgress);
      return;
    }

    const liveSnapshot = captureProgressSnapshot(video);
    if (liveSnapshot.duration <= 0) {
      renderProgressSnapshot(liveSnapshot);
      return;
    }

    awaitingSeekCommit = true;
    pendingSeekRatio = ratio;
    video.currentTime = liveSnapshot.duration * ratio;

    renderProgressSnapshot(
      resolveDisplayedProgressSnapshot({
        committedSnapshot: committedProgress,
        liveSnapshot: captureProgressSnapshot(video),
        previewRatio: ratio,
        awaitingSeekCommit: true,
      }),
    );
  }

  function handleSeekStart(event) {
    event.preventDefault();
    disableFastMode();
    isSeeking = true;

    const video = currentVideo();
    wasPlayingBeforeSeek = !!video && !video.paused;
    if (video) {
      committedProgress = captureProgressSnapshot(video);
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

  function handleMuteClick(event) {
    const button = event.target.closest('[data-toggle-mute]');
    if (!button) {
      return;
    }

    soundEnabled = resolveSoundPreference(soundEnabled, 'enable');
    syncMuteButtons();
    onSoundEnabledChange?.(soundEnabled);
    playActiveVideo();
  }

  function bindClick(selector, handler) {
    for (const node of container.querySelectorAll(selector)) {
      node.addEventListener('click', handler);
      cleanups.push(() => node.removeEventListener('click', handler));
    }
  }

  const suppressDefaultInteraction = (event) => {
    if (event.target.closest('[data-ignore-gesture]')) {
      return;
    }

    event.preventDefault();
  };

  bindClick('[data-open-home]', () => onOpenHome());
  bindClick('[data-open-likes-grid]', () => onOpenLikesGrid());

  const resizeHandler = () => updateTrack({ immediate: true, force: true });
  stage.addEventListener('pointerdown', handleStagePointerDown);
  stage.addEventListener('pointermove', handleStagePointerMove);
  stage.addEventListener('pointerup', handleStagePointerEnd);
  stage.addEventListener('pointercancel', handleStagePointerEnd);
  stage.addEventListener('wheel', handleWheel, { passive: false });
  stage.addEventListener('contextmenu', suppressDefaultInteraction);
  stage.addEventListener('selectstart', suppressDefaultInteraction);
  stage.addEventListener('dragstart', suppressDefaultInteraction);
  container.addEventListener('click', handleLikeClick);
  container.addEventListener('click', handleMuteClick);
  progressBar.addEventListener('pointerdown', handleSeekStart);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('resize', resizeHandler);

  cleanups.push(() => stage.removeEventListener('pointerdown', handleStagePointerDown));
  cleanups.push(() => stage.removeEventListener('pointermove', handleStagePointerMove));
  cleanups.push(() => stage.removeEventListener('pointerup', handleStagePointerEnd));
  cleanups.push(() => stage.removeEventListener('pointercancel', handleStagePointerEnd));
  cleanups.push(() => stage.removeEventListener('wheel', handleWheel));
  cleanups.push(() => stage.removeEventListener('contextmenu', suppressDefaultInteraction));
  cleanups.push(() => stage.removeEventListener('selectstart', suppressDefaultInteraction));
  cleanups.push(() => stage.removeEventListener('dragstart', suppressDefaultInteraction));
  cleanups.push(() => container.removeEventListener('click', handleLikeClick));
  cleanups.push(() => container.removeEventListener('click', handleMuteClick));
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

    const commitSeekIfReady = () => {
      if (index !== activeIndex || isSeeking || !awaitingSeekCommit || !canCommitPendingSeek(video)) {
        return;
      }

      syncProgress({ commitSeek: true });
    };

    video.addEventListener('loadedmetadata', syncIfActive);
    video.addEventListener('loadeddata', commitSeekIfReady);
    video.addEventListener('canplay', commitSeekIfReady);
    video.addEventListener('seeked', commitSeekIfReady);
    video.addEventListener('playing', commitSeekIfReady);
    video.addEventListener('timeupdate', syncIfActive);

    cleanups.push(() => {
      video.removeEventListener('loadedmetadata', syncIfActive);
      video.removeEventListener('loadeddata', commitSeekIfReady);
      video.removeEventListener('canplay', commitSeekIfReady);
      video.removeEventListener('seeked', commitSeekIfReady);
      video.removeEventListener('playing', commitSeekIfReady);
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

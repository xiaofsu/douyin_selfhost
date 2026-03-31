function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function createLikesGridView(container, options) {
  const { videos, onOpenVideo, onOpenHome, onOpenLikesGrid } = options;
  const cleanups = [];

  const cards = videos
    .map(
      (video) => `
        <button class="likes-card" data-open-video="${escapeHtml(video.awemeId)}" type="button">
          <span class="likes-card-media">
            <video
              class="likes-card-video"
              src="${escapeHtml(video.src)}"
              muted
              playsinline
              preload="metadata"
            ></video>
            <span class="likes-card-fallback">LOCAL CLIP</span>
          </span>
          <span class="likes-card-copy">
            <strong>${escapeHtml(video.authorName)}</strong>
            <span>${escapeHtml(video.desc)}</span>
          </span>
        </button>
      `,
    )
    .join('');

  container.innerHTML = `
    <div class="app-shell app-shell--grid">
      <div class="ambient ambient--left"></div>
      <div class="ambient ambient--right"></div>
      <section class="phone-frame phone-frame--grid">
        <header class="screen-header">
          <div>
            <p class="screen-eyebrow">LOCAL FAVORITES</p>
            <h1 class="screen-title">我的喜欢</h1>
          </div>
          <button class="ghost-button" type="button" data-open-home>返回首页</button>
        </header>

        <section class="likes-hero">
          <p class="likes-hero-count">${videos.length}</p>
          <div>
            <p class="likes-hero-label">已喜欢视频</p>
            <p class="likes-hero-copy">点击任意视频，进入只播放喜欢内容的竖屏信息流。</p>
          </div>
        </section>

        <section class="likes-scroll">
          ${
            videos.length
              ? `<div class="likes-grid" data-likes-grid>${cards}</div>`
              : `
                <div class="empty-state empty-state--grid">
                  <p class="empty-state-label">还没有喜欢的视频</p>
                  <h2>先去首页点亮喜欢</h2>
                  <p>你在首页点过喜欢的视频，会立刻出现在这里，并且保存在本地文件里。</p>
                  <button class="primary-button" type="button" data-open-home>去首页看看</button>
                </div>
              `
          }
        </section>

        <nav class="bottom-nav" aria-label="主导航">
          <button class="bottom-nav-item" type="button" data-open-home>
            <span>首页</span>
          </button>
          <button class="bottom-nav-item is-active" type="button" data-open-likes-grid>
            <span>我的喜欢</span>
          </button>
        </nav>
      </section>
    </div>
  `;

  const openHomeButtons = container.querySelectorAll('[data-open-home]');
  const openLikesButtons = container.querySelectorAll('[data-open-likes-grid]');

  for (const button of openHomeButtons) {
    const handler = () => onOpenHome();
    button.addEventListener('click', handler);
    cleanups.push(() => button.removeEventListener('click', handler));
  }

  for (const button of openLikesButtons) {
    const handler = () => onOpenLikesGrid();
    button.addEventListener('click', handler);
    cleanups.push(() => button.removeEventListener('click', handler));
  }

  const cardHandler = (event) => {
    const trigger = event.target.closest('[data-open-video]');
    if (!trigger) {
      return;
    }

    onOpenVideo(trigger.getAttribute('data-open-video') || '');
  };

  container.addEventListener('click', cardHandler);
  cleanups.push(() => container.removeEventListener('click', cardHandler));

  for (const preview of container.querySelectorAll('.likes-card-video')) {
    const loadedHandler = () => {
      const fallback = preview.parentElement?.querySelector('.likes-card-fallback');
      if (fallback) {
        fallback.classList.add('is-hidden');
      }
    };

    const errorHandler = () => {
      const fallback = preview.parentElement?.querySelector('.likes-card-fallback');
      if (fallback) {
        fallback.classList.remove('is-hidden');
      }
    };

    const enterHandler = async () => {
      preview.muted = true;
      preview.loop = true;
      try {
        await preview.play();
      } catch (_error) {
        // Ignore autoplay restrictions for previews.
      }
    };

    const leaveHandler = () => {
      preview.pause();
      preview.currentTime = 0;
    };

    preview.addEventListener('loadeddata', loadedHandler);
    preview.addEventListener('error', errorHandler);
    preview.addEventListener('mouseenter', enterHandler);
    preview.addEventListener('mouseleave', leaveHandler);
    preview.addEventListener('focus', enterHandler);
    preview.addEventListener('blur', leaveHandler);

    cleanups.push(() => {
      preview.removeEventListener('loadeddata', loadedHandler);
      preview.removeEventListener('error', errorHandler);
      preview.removeEventListener('mouseenter', enterHandler);
      preview.removeEventListener('mouseleave', leaveHandler);
      preview.removeEventListener('focus', enterHandler);
      preview.removeEventListener('blur', leaveHandler);
      preview.pause();
    });
  }

  return {
    destroy() {
      cleanups.splice(0).forEach((dispose) => dispose());
    },
  };
}

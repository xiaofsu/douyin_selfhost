import { describeVideoPath } from '../core/state.mjs';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderLikesCard(video) {
  const { fileName } = describeVideoPath(video);

  return `
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
        <strong>${escapeHtml(fileName)}</strong>
      </span>
    </button>
  `;
}

export function renderLikesGridMarkup(options) {
  const { videos } = options;
  const cards = videos.map((video) => renderLikesCard(video)).join('');

  return `
    <div class="app-shell app-shell--grid">
      <div class="ambient ambient--left"></div>
      <div class="ambient ambient--right"></div>
      <section class="phone-frame phone-frame--grid phone-frame--minimal">
        <nav class="floating-nav likes-top-nav" data-likes-top-nav data-ignore-gesture>
          <button class="floating-nav-link" type="button" data-open-home data-nav-home>首页</button>
          <span class="floating-nav-divider" aria-hidden="true">-</span>
          <button class="floating-nav-link is-active" type="button" data-open-likes-grid data-nav-likes>我的</button>
        </nav>

        <section class="likes-scroll likes-scroll--minimal">
          ${
            videos.length
              ? `<div class="likes-grid" data-likes-grid>${cards}</div>`
              : `
                <div class="empty-state empty-state--grid empty-state--minimal">
                  <p class="empty-state-label">我的喜欢为空</p>
                  <h2>先去首页点个喜欢</h2>
                  <button class="primary-button" type="button" data-open-home>首页</button>
                </div>
              `
          }
        </section>
      </section>
    </div>
  `;
}

export function createLikesGridView(container, options) {
  const { videos, onOpenVideo, onOpenHome, onOpenLikesGrid } = options;
  const cleanups = [];

  container.innerHTML = renderLikesGridMarkup({ videos });

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

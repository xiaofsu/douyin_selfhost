export function parseRoute(locationLike = window.location) {
  const pathname = locationLike.pathname || '/';
  const playId = locationLike.searchParams?.get('play')?.trim() ?? '';

  if (pathname === '/likes') {
    return {
      name: playId ? 'likes-player' : 'likes-grid',
      playId,
    };
  }

  return {
    name: 'home',
    playId: '',
  };
}

export function buildRoutePath(name, playId = '') {
  if (name === 'likes-grid') {
    return '/likes';
  }

  if (name === 'likes-player') {
    const params = new URLSearchParams();
    if (playId) {
      params.set('play', playId);
    }
    return `/likes${params.toString() ? `?${params.toString()}` : ''}`;
  }

  return '/';
}

export function navigate(name, options = {}) {
  const path = buildRoutePath(name, options.playId ?? '');
  const method = options.replace ? 'replaceState' : 'pushState';

  window.history[method]({}, '', path);
  window.dispatchEvent(new Event('app:navigate'));
}

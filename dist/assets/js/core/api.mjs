function parseListPayload(payload) {
  if (Array.isArray(payload?.data?.list)) {
    return payload.data.list;
  }

  if (Array.isArray(payload?.data?.video?.list)) {
    return payload.data.video.list;
  }

  return [];
}

function parseTotalPayload(payload) {
  const total = payload?.data?.total ?? payload?.data?.video?.total ?? 0;
  return Number.isFinite(total) ? total : Number(total) || 0;
}

async function requestJSON(url, options = {}) {
  const headers = new Headers(options.headers || {});

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  let payload = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      if (!response.ok) {
        throw new Error(`请求失败（${response.status}）`);
      }
      throw error;
    }
  }

  if (!response.ok) {
    throw new Error(payload?.msg || `请求失败（${response.status}）`);
  }

  return payload;
}

export function buildRecommendedVideosPath(options = {}) {
  const { start = 0, pageSize = 5, seed = '' } =
    typeof options === 'number' ? { pageSize: options } : options;
  const params = new URLSearchParams({
    start: String(start),
    pageSize: String(pageSize),
  });

  if (seed) {
    params.set('seed', seed);
  }

  return `/video/recommended?${params.toString()}`;
}

export async function fetchRecommendedVideos(options = {}) {
  const payload = await requestJSON(buildRecommendedVideosPath(options));
  return {
    list: parseListPayload(payload),
    total: parseTotalPayload(payload),
  };
}

export async function fetchLikedVideos() {
  const payload = await requestJSON('/video/like');
  return parseListPayload(payload);
}

export async function mutateLikeVideo(awemeId, liked) {
  const payload = await requestJSON('/video/like', {
    method: 'POST',
    body: JSON.stringify({
      action: liked ? 'like' : 'unlike',
      aweme_id: awemeId,
    }),
  });

  return parseListPayload(payload);
}

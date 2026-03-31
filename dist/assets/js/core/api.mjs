function parseListPayload(payload) {
  if (Array.isArray(payload?.data?.list)) {
    return payload.data.list;
  }

  if (Array.isArray(payload?.data?.video?.list)) {
    return payload.data.video.list;
  }

  return [];
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

export async function fetchRecommendedVideos(limit = 200) {
  const payload = await requestJSON(`/video/recommended?start=0&pageSize=${limit}`);
  return parseListPayload(payload);
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

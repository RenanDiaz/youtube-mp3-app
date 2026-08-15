/**
 * YouTube URL normalization.
 *
 * yt-dlp picks its extractor/InnerTube client from the host, and `music.youtube.com`
 * URLs go through the YouTube Music client, which YouTube rejects far more often
 * (HTTP 403) than a plain watch URL. Share links also carry tracking params (`si`,
 * `pp`, `feature`, ...) that add nothing to the download.
 *
 * Everything that reaches yt-dlp goes through here first.
 */

// Query params that actually change what gets downloaded. Everything else is dropped.
const MEANINGFUL_PARAMS = new Set(['v', 'list', 'index', 't', 'start', 'end']);

// Hosts that must be rewritten to the canonical watch host.
const HOST_REWRITES = {
  'music.youtube.com': 'www.youtube.com',
  'm.youtube.com': 'www.youtube.com',
  'youtube.com': 'www.youtube.com'
};

const SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be']);

function stripTrackingParams(url) {
  for (const key of [...url.searchParams.keys()]) {
    if (!MEANINGFUL_PARAMS.has(key)) {
      url.searchParams.delete(key);
    }
  }
}

/**
 * Returns a canonical https://www.youtube.com/... URL.
 * Non-parseable input is returned untouched so validation can reject it.
 */
function normalizeYouTubeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return rawUrl;
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
  } catch (err) {
    return rawUrl;
  }

  const hostname = parsed.hostname.toLowerCase();

  // youtu.be/<id> -> www.youtube.com/watch?v=<id>
  if (SHORT_HOSTS.has(hostname)) {
    const videoId = parsed.pathname.replace(/^\/+/, '').split('/')[0];
    if (videoId) {
      const rewritten = new URL('https://www.youtube.com/watch');
      rewritten.searchParams.set('v', videoId);
      for (const key of ['list', 'index', 't']) {
        if (parsed.searchParams.has(key)) {
          rewritten.searchParams.set(key, parsed.searchParams.get(key));
        }
      }
      return rewritten.href;
    }
  }

  parsed.protocol = 'https:';
  parsed.hostname = HOST_REWRITES[hostname] || hostname;
  parsed.hash = '';
  stripTrackingParams(parsed);

  return parsed.href;
}

/**
 * Removes duplicates after normalization (the same track pasted twice, or once as
 * a youtu.be link and once as a music.youtube.com link, is a single download).
 */
function dedupeUrls(urls) {
  const seen = new Set();
  const unique = [];

  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    unique.push(url);
  }

  return unique;
}

module.exports = {
  normalizeYouTubeUrl,
  dedupeUrls,
  MEANINGFUL_PARAMS
};

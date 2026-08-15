/**
 * Shared yt-dlp helpers: argument building, error classification and version checks.
 *
 * The recurring failure mode of this app is YouTube answering `HTTP Error 403:
 * Forbidden` to yt-dlp. That is almost never a bug in our code - it means YouTube
 * refused the request. The knobs that make a difference (client to impersonate,
 * cookies, retries, pacing) live here so every endpoint uses the same ones.
 */

const YtDlpWrap = require('yt-dlp-wrap').default;
const config = require('../config/environment');
const logger = require('./logger');
const { ErrorCodes } = require('./errors');

function createYtDlp() {
  return new YtDlpWrap(config.ytdlp.binary);
}

/**
 * Args added to every yt-dlp invocation (metadata reads included).
 */
function buildCommonArgs() {
  const { retries, socketTimeout, sleepRequests, playerClients, cookiesFromBrowser, cookiesFile, userAgent } = config.ytdlp;

  const args = [
    '--retries', String(retries),
    '--extractor-retries', String(retries),
    '--fragment-retries', String(retries),
    '--socket-timeout', String(socketTimeout)
  ];

  // Pace requests so a batch does not look like a scraper.
  if (sleepRequests > 0) {
    args.push('--sleep-requests', String(sleepRequests));
  }

  // Which InnerTube client yt-dlp impersonates. The default clients are the most
  // common cause of 403s when YouTube changes something on their side.
  if (playerClients) {
    args.push('--extractor-args', `youtube:player_client=${playerClients}`);
  }

  // Cookies are the single most effective fix for 403 / "confirm you're not a bot".
  if (cookiesFromBrowser) {
    args.push('--cookies-from-browser', cookiesFromBrowser);
  } else if (cookiesFile) {
    args.push('--cookies', cookiesFile);
  }

  if (userAgent) {
    args.push('--user-agent', userAgent);
  }

  return args;
}

/**
 * Args for an audio extraction of a single track.
 *
 * `restrictFilenames` is only safe when the output is a template - when the caller
 * passes an exact path it must get that exact filename back (the download token is
 * derived from it).
 */
function buildAudioDownloadArgs(url, outputTemplate, format, options = {}) {
  const { restrictFilenames = true, noOverwrites = true } = options;

  const args = [
    url,
    '-o', outputTemplate,
    '-x',
    '--audio-format', format,
    '--no-playlist', // a watch URL carrying &list= must not pull in a whole radio
    '--newline'
  ];

  if (restrictFilenames) {
    args.push('--restrict-filenames');
  }

  if (noOverwrites) {
    args.push('--no-overwrites', '--continue');
  }

  return [...args, ...buildCommonArgs()];
}

const ERROR_PATTERNS = [
  {
    test: /sign in to confirm (you're|you are) not a bot|confirm your age|cookies are no longer valid/i,
    code: ErrorCodes.BOT_CHECK_REQUIRED,
    message:
      'YouTube asked to confirm the request is not a bot. Configure cookies ' +
      '(YTDLP_COOKIES_FROM_BROWSER or YTDLP_COOKIES_FILE) and try again.'
  },
  {
    test: /HTTP Error 403|403:? Forbidden/i,
    code: ErrorCodes.YOUTUBE_FORBIDDEN,
    message:
      'YouTube rejected the request (HTTP 403). Update yt-dlp, and if it keeps ' +
      'happening add cookies (YTDLP_COOKIES_FROM_BROWSER) or change ' +
      'YTDLP_PLAYER_CLIENTS.'
  },
  {
    test: /HTTP Error 429|too many requests/i,
    code: ErrorCodes.YOUTUBE_RATE_LIMITED,
    message: 'YouTube is rate limiting this IP. Wait a few minutes and download fewer tracks at a time.'
  },
  {
    test: /private video|video unavailable|removed by the uploader|members-only|not available in your country|age-restricted/i,
    code: ErrorCodes.VIDEO_UNAVAILABLE,
    message: 'The video is private, removed or restricted.'
  },
  {
    test: /requested format (is )?not available/i,
    code: ErrorCodes.INVALID_FORMAT,
    message: 'No downloadable audio format was offered for this video.'
  },
  {
    test: /ffmpeg|ffprobe/i,
    code: ErrorCodes.CONVERSION_FAILED,
    message: 'Audio conversion failed. Check that ffmpeg is installed and on PATH.'
  },
  {
    test: /timed out|timeout|getaddrinfo|ENOTFOUND|ECONNRESET|network is unreachable/i,
    code: ErrorCodes.NETWORK_ERROR,
    message: 'Network error while talking to YouTube.'
  },
  {
    test: /ENOENT/i,
    code: ErrorCodes.YTDLP_NOT_FOUND,
    message: 'The yt-dlp binary was not found. Install it or set YTDLP_PATH.'
  }
];

/**
 * Turns a raw yt-dlp failure into a stable { code, message } pair.
 */
function classifyYtDlpError(err) {
  const raw = [err && err.message, err && err.stderr].filter(Boolean).join('\n');

  // execFile kills the process when the timeout option is exceeded
  if (err && err.killed) {
    return {
      code: ErrorCodes.NETWORK_ERROR,
      message: 'The download timed out and was cancelled.',
      raw
    };
  }

  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test.test(raw)) {
      return { code: pattern.code, message: pattern.message, raw };
    }
  }

  // Fall back to the first ERROR: line yt-dlp printed, which is far more useful
  // than the full "Command failed: yt-dlp <200 chars of args>" dump.
  const firstError = raw.split('\n').find(line => line.trim().startsWith('ERROR:'));

  return {
    code: ErrorCodes.DOWNLOAD_FAILED,
    message: (firstError || 'yt-dlp failed').replace(/^ERROR:\s*/, '').trim(),
    raw
  };
}

/**
 * Picks the failure that best explains a batch where nothing succeeded.
 */
function summarizeFailures(failures) {
  const counts = new Map();

  for (const failure of failures) {
    counts.set(failure.code, (counts.get(failure.code) || 0) + 1);
  }

  let dominantCode = null;
  let dominantCount = 0;
  for (const [code, count] of counts) {
    if (count > dominantCount) {
      dominantCode = code;
      dominantCount = count;
    }
  }

  const example = failures.find(failure => failure.code === dominantCode);

  return {
    code: dominantCode || ErrorCodes.DOWNLOAD_FAILED,
    message: example ? example.message : 'yt-dlp failed'
  };
}

const VERSION_PATTERN = /^(\d{4})\.(\d{2})\.(\d{2})/;
const STALE_VERSION_DAYS = 45;

/**
 * yt-dlp versions are release dates, so we can tell how stale the binary is.
 * An outdated binary is the most common reason YouTube starts answering 403.
 */
async function getYtDlpVersion() {
  const ytDlp = createYtDlp();
  const stdout = await ytDlp.execPromise(['--version']);
  const version = stdout.trim().split('\n')[0];

  const match = VERSION_PATTERN.exec(version);
  let ageDays = null;

  if (match) {
    const released = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    ageDays = Math.floor((Date.now() - released) / (24 * 60 * 60 * 1000));
  }

  return { version, ageDays, stale: ageDays !== null && ageDays > STALE_VERSION_DAYS };
}

/**
 * Logs the yt-dlp version at startup; never throws, the server must still boot.
 */
async function logYtDlpVersion() {
  try {
    const { version, ageDays, stale } = await getYtDlpVersion();

    if (stale) {
      logger.warn(
        `yt-dlp ${version} is ${ageDays} days old. YouTube changes often cause HTTP 403 ` +
        'errors with outdated binaries - run "yt-dlp -U" (or upgrade via pip/brew).'
      );
    } else {
      logger.info(`yt-dlp version: ${version}`);
    }

    return version;
  } catch (err) {
    logger.error(
      `Could not run yt-dlp ("${config.ytdlp.binary}"). Downloads will fail until it is installed ` +
      'or YTDLP_PATH points at the binary.',
      { error: err.message }
    );
    return null;
  }
}

module.exports = {
  createYtDlp,
  buildCommonArgs,
  buildAudioDownloadArgs,
  classifyYtDlpError,
  summarizeFailures,
  getYtDlpVersion,
  logYtDlpVersion,
  STALE_VERSION_DAYS
};

/**
 * Error message mapping for user-friendly error display (Phase 1.2)
 */

export interface ErrorInfo {
  title: string;
  message: string;
  suggestion?: string;
  icon?: string;
}

/**
 * Map error codes to user-friendly messages
 */
export const errorMessages: Record<string, ErrorInfo> = {
  // Validation errors
  INVALID_URL: {
    title: 'Invalid URL',
    message: 'The URL you entered is not valid.',
    suggestion: 'Please enter a valid YouTube URL (e.g., https://youtube.com/watch?v=...)',
    icon: '🔗'
  },
  INVALID_FORMAT: {
    title: 'Invalid Format',
    message: 'The audio format you selected is not supported.',
    suggestion: 'Please select MP3, WAV, M4A, or FLAC.',
    icon: '🎵'
  },
  INVALID_FILENAME: {
    title: 'Invalid Filename',
    message: 'The filename contains invalid characters.',
    suggestion: 'Please use only letters, numbers, spaces, hyphens, and underscores.',
    icon: '📝'
  },
  INVALID_REQUEST: {
    title: 'Invalid Request',
    message: 'The request contains invalid data.',
    suggestion: 'Please check your input and try again.',
    icon: '⚠️'
  },

  // Download errors
  DOWNLOAD_FAILED: {
    title: 'Download Failed',
    message: 'Failed to download the video.',
    suggestion: 'Please try again later or check if the video is still available.',
    icon: '❌'
  },
  VIDEO_UNAVAILABLE: {
    title: 'Video Unavailable',
    message: 'This video is unavailable, private, or restricted.',
    suggestion: 'Please check if the video exists and is publicly accessible.',
    icon: '🚫'
  },
  NETWORK_ERROR: {
    title: 'Network Error',
    message: 'A network error occurred during download.',
    suggestion: 'Please check your internet connection and try again.',
    icon: '🌐'
  },
  CONVERSION_FAILED: {
    title: 'Conversion Failed',
    message: 'Failed to convert the audio to the selected format.',
    suggestion: 'Try a different format (MP3 usually works best).',
    icon: '🔄'
  },

  // Auth errors
  UNAUTHORIZED: {
    title: 'Unauthorized',
    message: 'You are not authorized to access this resource.',
    suggestion: 'Please refresh the page and try again.',
    icon: '🔒'
  },
  FORBIDDEN: {
    title: 'Access Denied',
    message: 'You do not have permission to access this resource.',
    suggestion: 'Please contact support if you believe this is an error.',
    icon: '🚷'
  },
  INVALID_TOKEN: {
    title: 'Invalid Download Token',
    message: 'The download link is invalid.',
    suggestion: 'Please start a new download.',
    icon: '🔑'
  },
  TOKEN_EXPIRED: {
    title: 'Download Link Expired',
    message: 'This download link has expired.',
    suggestion: 'Download links are valid for 5 minutes. Please start a new download.',
    icon: '⏰'
  },

  // Rate limiting
  RATE_LIMIT_EXCEEDED: {
    title: 'Too Many Requests',
    message: 'You have exceeded the download limit.',
    suggestion: 'Please wait a few minutes before trying again.',
    icon: '⏸️'
  },

  // Server errors
  INTERNAL_ERROR: {
    title: 'Server Error',
    message: 'An unexpected server error occurred.',
    suggestion: 'Please try again later. If the problem persists, contact support.',
    icon: '⚙️'
  },
  NOT_FOUND: {
    title: 'Not Found',
    message: 'The requested resource was not found.',
    suggestion: 'Please check the URL and try again.',
    icon: '🔍'
  }
};

/**
 * Get user-friendly error information from error code
 */
export function getErrorInfo(code: string, fallbackMessage?: string): ErrorInfo {
  const info = errorMessages[code];

  if (info) {
    return info;
  }

  // Fallback for unknown error codes
  return {
    title: 'Error',
    message: fallbackMessage || 'An error occurred',
    suggestion: 'Please try again or contact support if the problem persists.',
    icon: '⚠️'
  };
}

/**
 * Parse error response from backend
 */
export interface ParsedError {
  code: string;
  message: string;
  statusCode: number;
  timestamp?: string;
  details?: any;
}

export function parseErrorResponse(error: any): ParsedError {
  // Handle Axios error response
  if (error.response?.data?.error) {
    const errorData = error.response.data.error;
    return {
      code: errorData.code || 'INTERNAL_ERROR',
      message: errorData.message || 'An error occurred',
      statusCode: errorData.statusCode || 500,
      timestamp: errorData.timestamp,
      details: errorData.details
    };
  }

  // Handle network errors
  if (error.request && !error.response) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Unable to connect to the server',
      statusCode: 0
    };
  }

  // Fallback for other errors
  return {
    code: 'INTERNAL_ERROR',
    message: error.message || 'An unexpected error occurred',
    statusCode: 500
  };
}

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export interface VideoInfo {
  valid: boolean;
  title: string;
  duration: number;
  thumbnail: string | null;
  uploader: string;
  uploadDate: string | null;
  viewCount: number;
  description: string;
  isPlaylist: boolean;
  playlistCount: number;
}

export interface ValidationState {
  status: 'idle' | 'validating' | 'valid' | 'invalid';
  videoInfo: VideoInfo | null;
  error: string | null;
}

/**
 * Custom hook for URL validation with debouncing (Phase 1.3)
 */
export function useUrlValidation(url: string, debounceMs: number = 500) {
  const [state, setState] = useState<ValidationState>({
    status: 'idle',
    videoInfo: null,
    error: null,
  });

  const validateUrl = useCallback(async (urlToValidate: string) => {
    // Reset if URL is empty
    if (!urlToValidate.trim()) {
      setState({
        status: 'idle',
        videoInfo: null,
        error: null,
      });
      return;
    }

    // Basic YouTube URL check before making API call
    const isYouTubeUrl =
      urlToValidate.includes('youtube.com') ||
      urlToValidate.includes('youtu.be');

    if (!isYouTubeUrl) {
      setState({
        status: 'invalid',
        videoInfo: null,
        error: 'Please enter a valid YouTube URL',
      });
      return;
    }

    // Set validating status
    setState(prev => ({
      ...prev,
      status: 'validating',
      error: null,
    }));

    try {
      const response = await axios.post(`${API_BASE_URL}/validate`, {
        url: urlToValidate,
      });

      if (response.data.success) {
        setState({
          status: 'valid',
          videoInfo: response.data.data,
          error: null,
        });
      } else {
        setState({
          status: 'invalid',
          videoInfo: null,
          error: response.data.error?.message || 'Validation failed',
        });
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error?.message ||
        err.message ||
        'Failed to validate URL';

      setState({
        status: 'invalid',
        videoInfo: null,
        error: errorMessage,
      });
    }
  }, []);

  // Debounce URL validation
  useEffect(() => {
    const handler = setTimeout(() => {
      validateUrl(url);
    }, debounceMs);

    return () => {
      clearTimeout(handler);
    };
  }, [url, debounceMs, validateUrl]);

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      videoInfo: null,
      error: null,
    });
  }, []);

  return { ...state, reset };
}

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format view count to human-readable format
 */
export function formatViews(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M views`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K views`;
  }
  return `${count} views`;
}

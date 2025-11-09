import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config';

export interface ProgressData {
  type: string;
  downloadId: string;
  progress?: number;
  speed?: string;
  eta?: string;
  status?: string;
  message?: string;
  result?: {
    file: string;
    downloadUrl: string;
    message: string;
  };
  error?: string;
}

export interface DownloadProgressState {
  progress: number;
  speed: string;
  eta: string;
  status: 'idle' | 'connecting' | 'fetching_metadata' | 'downloading' | 'completed' | 'failed';
  statusMessage: string;
  result: {
    file: string;
    downloadUrl: string;
    message: string;
  } | null;
  error: string | null;
}

/**
 * Custom hook to track download progress via Server-Sent Events
 */
export function useDownloadProgress(downloadId: string | null) {
  const [state, setState] = useState<DownloadProgressState>({
    progress: 0,
    speed: '0 B/s',
    eta: 'calculating...',
    status: 'idle',
    statusMessage: '',
    result: null,
    error: null,
  });

  const reset = useCallback(() => {
    setState({
      progress: 0,
      speed: '0 B/s',
      eta: 'calculating...',
      status: 'idle',
      statusMessage: '',
      result: null,
      error: null,
    });
  }, []);

  useEffect(() => {
    if (!downloadId) {
      return;
    }

    let eventSource: EventSource;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      const url = `${API_BASE_URL}/download/progress/${downloadId}`;
      eventSource = new EventSource(url);

      setState(prev => ({ ...prev, status: 'connecting' }));

      eventSource.onopen = () => {
        console.log(`SSE connected to download: ${downloadId}`);
      };

      eventSource.onmessage = (event) => {
        try {
          const data: ProgressData = JSON.parse(event.data);
          console.log('Progress update:', data);

          switch (data.type) {
            case 'connected':
              setState(prev => ({
                ...prev,
                status: data.status as DownloadProgressState['status'] || 'connecting',
                progress: data.progress || 0,
              }));
              break;

            case 'status':
              setState(prev => ({
                ...prev,
                status: data.status as DownloadProgressState['status'] || prev.status,
                statusMessage: data.message || '',
              }));
              break;

            case 'progress':
              setState(prev => ({
                ...prev,
                progress: data.progress || prev.progress,
                speed: data.speed || prev.speed,
                eta: data.eta || prev.eta,
                status: data.status as DownloadProgressState['status'] || 'downloading',
              }));
              break;

            case 'complete':
              setState(prev => ({
                ...prev,
                progress: 100,
                status: 'completed',
                statusMessage: 'Download complete!',
                result: data.result || null,
              }));
              break;

            case 'error':
              setState(prev => ({
                ...prev,
                status: 'failed',
                error: data.error || 'Download failed',
              }));
              break;
          }
        } catch (err) {
          console.error('Error parsing SSE data:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE error:', err);
        eventSource.close();

        // Don't reconnect if completed or failed
        if (state.status !== 'completed' && state.status !== 'failed') {
          // Retry connection after 2 seconds
          reconnectTimeout = setTimeout(connect, 2000);
        }
      };
    };

    connect();

    // Cleanup
    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [downloadId]); // Re-run when downloadId changes

  return { ...state, reset };
}

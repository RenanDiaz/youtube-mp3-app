import React from 'react';
import { Progress, Alert } from 'reactstrap';
import { DownloadProgressState } from '../hooks/useDownloadProgress';
import './ProgressTracker.css';

interface ProgressTrackerProps {
  state: DownloadProgressState;
  onComplete?: (result: any) => void;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({ state, onComplete }) => {
  const { progress, speed, eta, status, statusMessage, result, error } = state;

  // Call onComplete callback when download finishes
  React.useEffect(() => {
    if (status === 'completed' && result && onComplete) {
      onComplete(result);
    }
  }, [status, result, onComplete]);

  // Don't render if idle
  if (status === 'idle') {
    return null;
  }

  // Show error state
  if (status === 'failed') {
    return (
      <Alert color="danger" className="mt-3">
        <h6 className="alert-heading">Download Failed</h6>
        <p className="mb-0">{error || 'An error occurred during download'}</p>
      </Alert>
    );
  }

  // Show completed state
  if (status === 'completed') {
    return (
      <Alert color="success" className="mt-3">
        <h6 className="alert-heading">✓ Download Complete!</h6>
        {result && (
          <div className="mt-2">
            <p className="mb-2">{result.message}</p>
            <a
              href={`${import.meta.env.VITE_API_BASE_URL}${result.downloadUrl}`}
              download
              className="btn btn-success btn-sm"
            >
              Download File: {result.file}
            </a>
          </div>
        )}
      </Alert>
    );
  }

  // Get status label
  const getStatusLabel = () => {
    switch (status) {
      case 'connecting':
        return 'Connecting...';
      case 'fetching_metadata':
        return 'Fetching video information...';
      case 'downloading':
        return 'Downloading...';
      default:
        return statusMessage || 'Processing...';
    }
  };

  // Get progress bar color based on status
  const getProgressColor = () => {
    switch (status) {
      case 'downloading':
        return 'primary';
      case 'fetching_metadata':
        return 'info';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="progress-tracker mt-3">
      <div className="progress-header mb-2">
        <div className="status-label">{getStatusLabel()}</div>
        <div className="progress-percentage">{Math.round(progress)}%</div>
      </div>

      <Progress
        value={progress}
        color={getProgressColor()}
        animated={status === 'downloading'}
        className="progress-bar-custom"
      />

      {status === 'downloading' && (
        <div className="progress-details mt-2">
          <div className="progress-info">
            <span className="info-label">Speed:</span>
            <span className="info-value">{speed}</span>
          </div>
          <div className="progress-info">
            <span className="info-label">ETA:</span>
            <span className="info-value">{eta}</span>
          </div>
        </div>
      )}
    </div>
  );
};

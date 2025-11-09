import React from 'react';
import { Card, CardBody, CardImg, Spinner, Badge } from 'reactstrap';
import { VideoInfo, formatDuration, formatViews } from '../hooks/useUrlValidation';
import './VideoPreview.css';

interface VideoPreviewProps {
  status: 'idle' | 'validating' | 'valid' | 'invalid';
  videoInfo: VideoInfo | null;
  error: string | null;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ status, videoInfo, error }) => {
  // Don't render anything if idle
  if (status === 'idle') {
    return null;
  }

  // Show loading state
  if (status === 'validating') {
    return (
      <Card className="video-preview mt-3">
        <CardBody className="text-center py-4">
          <Spinner color="primary" />
          <p className="mt-2 mb-0 text-muted">Validating URL...</p>
        </CardBody>
      </Card>
    );
  }

  // Show error state
  if (status === 'invalid') {
    return (
      <Card className="video-preview video-preview-invalid mt-3">
        <CardBody className="text-center py-3">
          <span className="error-icon">❌</span>
          <p className="mb-0 text-danger">{error || 'Invalid URL'}</p>
        </CardBody>
      </Card>
    );
  }

  // Show video info if valid
  if (status === 'valid' && videoInfo) {
    return (
      <Card className="video-preview video-preview-valid mt-3">
        <div className="video-preview-content">
          {videoInfo.thumbnail && (
            <div className="video-thumbnail-container">
              <CardImg
                top
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                className="video-thumbnail"
              />
              <div className="video-duration">
                {formatDuration(videoInfo.duration)}
              </div>
              {videoInfo.isPlaylist && (
                <Badge color="info" className="playlist-badge">
                  📋 Playlist ({videoInfo.playlistCount} videos)
                </Badge>
              )}
            </div>
          )}
          <CardBody>
            <div className="video-check">✓</div>
            <h6 className="video-title">{videoInfo.title}</h6>
            <div className="video-meta">
              <span className="video-uploader">👤 {videoInfo.uploader}</span>
              {videoInfo.viewCount > 0 && (
                <span className="video-views">👁️ {formatViews(videoInfo.viewCount)}</span>
              )}
            </div>
            {videoInfo.description && (
              <p className="video-description">{videoInfo.description}...</p>
            )}
          </CardBody>
        </div>
      </Card>
    );
  }

  return null;
};

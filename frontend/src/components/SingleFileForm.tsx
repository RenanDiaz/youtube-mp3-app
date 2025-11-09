import React, { useState, FC } from "react";
import { Form, FormGroup, Label, Input, Button } from "reactstrap";
import axios from "axios";
import { API_BASE_URL } from "../config";
import { useDownloadProgress } from "../hooks/useDownloadProgress";
import { useUrlValidation } from "../hooks/useUrlValidation";
import { ProgressTracker } from "./ProgressTracker";
import { ErrorDisplay } from "./ErrorDisplay";
import { VideoPreview } from "./VideoPreview";
import { FormatSelector } from "./FormatSelector";

const SingleFileForm: FC = () => {
  const [url, setUrl] = useState<string>("");
  const [customName, setCustomName] = useState<string>("");
  const [format, setFormat] = useState<string>("mp3");
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [error, setError] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Use URL validation hook (Phase 1.3)
  const validation = useUrlValidation(url, 800);

  // Use progress tracking hook
  const progressState = useDownloadProgress(downloadId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Post to backend to start download
      const response = await axios.post(`${API_BASE_URL}/download`, {
        url,
        customName: customName || undefined,
        format,
      });

      // Get download ID and start tracking progress
      const { downloadId: newDownloadId } = response.data;
      setDownloadId(newDownloadId);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = () => {
    // Reset form after a brief delay
    setTimeout(() => {
      setUrl("");
      setCustomName("");
      setDownloadId(null);
      progressState.reset();
    }, 3000);
  };

  const handleRetry = () => {
    setError(null);
  };

  // Determine if download is in progress
  const isDownloading = progressState.status !== 'idle' && progressState.status !== 'completed' && progressState.status !== 'failed';

  // Check if form can be submitted
  const canSubmit = validation.status === 'valid' && !isDownloading && !isSubmitting;

  return (
    <>
      <Form onSubmit={handleSubmit}>
        <FormGroup>
          <Label for="url">YouTube URL</Label>
          <Input
            type="text"
            id="url"
            placeholder="Enter YouTube URL (e.g., https://youtube.com/watch?v=...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            disabled={isDownloading}
            className={validation.status === 'valid' ? 'is-valid' : validation.status === 'invalid' ? 'is-invalid' : ''}
          />
        </FormGroup>

        {/* Show video preview (Phase 1.3) */}
        <VideoPreview
          status={validation.status}
          videoInfo={validation.videoInfo}
          error={validation.error}
        />
        <FormGroup>
          <Label for="customName">Custom Filename (optional)</Label>
          <Input
            type="text"
            id="customName"
            placeholder={`Enter custom filename (without .${format})`}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            disabled={isDownloading}
          />
        </FormGroup>

        {/* Enhanced Format Selector (Phase 2.2) */}
        <FormatSelector
          value={format}
          onChange={setFormat}
          disabled={isDownloading}
        />
        <Button
          color="primary"
          type="submit"
          disabled={!canSubmit}
        >
          {isDownloading ? 'Downloading...' : validation.status === 'validating' ? 'Validating...' : `Download ${format.toUpperCase()}`}
        </Button>
      </Form>

      {/* Show progress tracker */}
      <ProgressTracker state={progressState} onComplete={handleComplete} />

      {/* Show submission errors */}
      <ErrorDisplay
        error={error}
        onDismiss={() => setError(null)}
        onRetry={handleRetry}
      />
    </>
  );
};

export default SingleFileForm;

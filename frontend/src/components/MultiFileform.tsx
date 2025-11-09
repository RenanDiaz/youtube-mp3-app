import React, { useState, ReactNode, FC } from "react";
import { Form, FormGroup, Label, Input, Button, Alert, Spinner } from "reactstrap";
import axios from "axios";
import { API_BASE_URL } from "../config";
import { FormatSelector } from "./FormatSelector";

const MultiFileForm: FC = () => {
  const [urls, setUrls] = useState<string>("");
  const [format, setFormat] = useState<string>("mp3");
  const [message, setMessage] = useState<ReactNode>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError("");
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/download/list`, {
        urls: urls
          .split("\n")
          .map((url) => url.trim())
          .filter((url) => url),
        format,
      });
      setMessage(
        <span>
          {response.data.message}:{" "}
          <a href={`${API_BASE_URL}${response.data.downloadUrl}`} download>
            {response.data.file}
          </a>
        </span>
      );
    } catch (err: any) {
      setError(err.response?.data?.error || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Form onSubmit={handleSubmit}>
        <FormGroup>
          <Label for="url">YouTube URL</Label>
          <Input
            type="textarea"
            id="urls"
            placeholder="Enter YouTube URLs (one per line)"
            rows={5}
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            required
          />
        </FormGroup>

        {/* Enhanced Format Selector (Phase 2.2) */}
        <FormatSelector
          value={format}
          onChange={setFormat}
          disabled={loading}
        />
        <Button color="primary" type="submit" disabled={loading}>
          {loading ? <Spinner size="sm" /> : `Download ${format.toUpperCase()}`}
        </Button>
      </Form>
      {message && (
        <Alert color="success" className="mt-3">
          {message}
        </Alert>
      )}
      {error && (
        <Alert color="danger" className="mt-3">
          {error}
        </Alert>
      )}
    </>
  );
};

export default MultiFileForm;

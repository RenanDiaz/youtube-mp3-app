import React, { useState, ReactNode, FC } from "react";
import { Form, FormGroup, Label, Input, Button, Alert, Spinner } from "reactstrap";
import axios from "axios";

const SingleFileForm: FC = () => {
  const [url, setUrl] = useState<string>("");
  const [customName, setCustomName] = useState<string>("");
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
      const response = await axios.post("http://localhost:5001/download", {
        url,
        customName: customName || undefined,
        format,
      });
      setMessage(
        <span>
          {response.data.message}:{" "}
          <a href={`http://localhost:5001/downloads/${response.data.file}`} download>
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
            type="text"
            id="url"
            placeholder="Enter YouTube URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </FormGroup>
        <FormGroup>
          <Label for="customName">Custom Filename (optional)</Label>
          <Input
            type="text"
            id="customName"
            placeholder={`Enter custom filename (without .${format})`}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
          />
        </FormGroup>
        <FormGroup>
          <Label for="format">Format</Label>
          <Input
            type="select"
            id="format"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            <option value="mp3">MP3</option>
            <option value="wav">WAV</option>
            <option value="m4a">M4A</option>
            <option value="flac">FLAC</option>
          </Input>
        </FormGroup>
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

export default SingleFileForm;

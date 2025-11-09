import React from 'react';
import { Alert } from 'reactstrap';
import { getErrorInfo, parseErrorResponse, ParsedError } from '../utils/errorMessages';
import './ErrorDisplay.css';

interface ErrorDisplayProps {
  error: any;
  onDismiss?: () => void;
  onRetry?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onDismiss, onRetry }) => {
  if (!error) return null;

  // Parse error response
  const parsedError: ParsedError = parseErrorResponse(error);
  const errorInfo = getErrorInfo(parsedError.code, parsedError.message);

  return (
    <Alert
      color="danger"
      className="error-display mt-3"
      toggle={onDismiss}
      fade
    >
      <div className="error-header">
        {errorInfo.icon && <span className="error-icon">{errorInfo.icon}</span>}
        <h6 className="error-title">{errorInfo.title}</h6>
      </div>

      <p className="error-message">{errorInfo.message}</p>

      {errorInfo.suggestion && (
        <div className="error-suggestion">
          <strong>💡 Suggestion:</strong> {errorInfo.suggestion}
        </div>
      )}

      {parsedError.details && (
        <details className="error-details mt-2">
          <summary>Technical Details</summary>
          <pre className="mt-2">{JSON.stringify(parsedError.details, null, 2)}</pre>
        </details>
      )}

      {onRetry && (
        <button
          className="btn btn-sm btn-outline-light mt-3"
          onClick={onRetry}
        >
          🔄 Try Again
        </button>
      )}

      <div className="error-footer">
        <small>
          Error Code: <code>{parsedError.code}</code>
          {parsedError.timestamp && (
            <> • {new Date(parsedError.timestamp).toLocaleTimeString()}</>
          )}
        </small>
      </div>
    </Alert>
  );
};

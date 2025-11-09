import React from 'react';
import { FaMusic, FaCompactDisc, FaFileAudio, FaGem } from 'react-icons/fa';
import './FormatSelector.css';

export interface FormatOption {
  value: string;
  label: string;
  icon: React.ReactNode;
  quality: string;
  size: string;
  description: string;
  recommended?: boolean;
}

const formatOptions: FormatOption[] = [
  {
    value: 'mp3',
    label: 'MP3',
    icon: <FaMusic />,
    quality: 'Good',
    size: '~3-5 MB',
    description: 'Universal compatibility, small file size',
    recommended: true,
  },
  {
    value: 'm4a',
    label: 'M4A',
    icon: <FaCompactDisc />,
    quality: 'Better',
    size: '~4-6 MB',
    description: 'Better quality than MP3, Apple devices',
  },
  {
    value: 'wav',
    label: 'WAV',
    icon: <FaFileAudio />,
    quality: 'Best',
    size: '~30-50 MB',
    description: 'Lossless audio, professional use',
  },
  {
    value: 'flac',
    label: 'FLAC',
    icon: <FaGem />,
    quality: 'Best',
    size: '~20-30 MB',
    description: 'Lossless compression, audiophile choice',
  },
];

export interface FormatSelectorProps {
  value: string;
  onChange: (format: string) => void;
  disabled?: boolean;
}

export const FormatSelector: React.FC<FormatSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="format-selector">
      <div className="format-selector-label">
        Select Audio Format
      </div>

      <div className="format-options">
        {formatOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`format-option ${value === option.value ? 'active' : ''} ${
              disabled ? 'disabled' : ''
            } ${option.recommended ? 'recommended' : ''}`}
            onClick={() => !disabled && onChange(option.value)}
            disabled={disabled}
          >
            {option.recommended && (
              <div className="recommended-badge">
                <span>⭐ Recommended</span>
              </div>
            )}

            <div className="format-icon">{option.icon}</div>

            <div className="format-info">
              <div className="format-label">{option.label}</div>
              <div className="format-quality">Quality: {option.quality}</div>
            </div>

            <div className="format-details">
              <div className="format-size">{option.size}</div>
              <div className="format-description">{option.description}</div>
            </div>

            <div className="format-checkmark">
              {value === option.value && (
                <div className="checkmark">✓</div>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="format-selector-hint">
        💡 Tip: Choose MP3 for best compatibility or FLAC/WAV for highest quality
      </div>
    </div>
  );
};

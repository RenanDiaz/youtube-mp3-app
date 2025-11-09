import React from 'react';
import { FaYoutube, FaMusic, FaGithub } from 'react-icons/fa';
import './Header.css';

export const Header: React.FC = () => {
  return (
    <header className="app-header">
      <div className="header-container">
        <div className="header-logo">
          <div className="logo-icon">
            <FaYoutube className="logo-youtube" />
            <FaMusic className="logo-music" />
          </div>
          <div className="logo-text">
            <h1 className="logo-title">YouTube Audio</h1>
            <p className="logo-subtitle">Downloader</p>
          </div>
        </div>

        <nav className="header-nav">
          <a
            href="https://github.com/RenanDiaz/youtube-mp3-app"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link-header"
          >
            <FaGithub />
            <span>GitHub</span>
          </a>
        </nav>
      </div>
    </header>
  );
};

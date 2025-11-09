import { useState, FC, useEffect } from "react";
import { Container, Nav, NavItem, NavLink, TabPane, TabContent } from "reactstrap";
import { FaFile, FaList, FaLayerGroup } from "react-icons/fa";
import "./styles/variables.css";
import "./styles/theme.css";
import "./App.css";
import { Header } from "./components/Header";
import SingleFileForm from "./components/SingleFileForm";
import PlaylistForm from "./components/PlaylistForm";
import MultiFileForm from "./components/MultiFileform";
import classNames from "classnames";

enum View {
  Single = "single",
  Playlist = "playlist",
  Multi = "multi",
}

const App: FC = () => {
  const [selectedView, setSelectedView] = useState<View>(View.Single);

  useEffect(() => {
    document.body.setAttribute("data-bs-theme", "dark");
  }, []);

  // Keyboard navigation for tabs (Phase 2.3)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys when not focused on an input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      const views = [View.Single, View.Playlist, View.Multi];
      const currentIndex = views.indexOf(selectedView);

      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        const newView = views[currentIndex - 1];
        if (newView) setSelectedView(newView);
      } else if (e.key === 'ArrowRight' && currentIndex < views.length - 1) {
        e.preventDefault();
        const newView = views[currentIndex + 1];
        if (newView) setSelectedView(newView);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedView]);

  return (
    <div className="app">
      <Header />
      <main className="app-main">
        <Container className="app-container">
          <div className="content-wrapper fade-in">
            <h2 className="page-title">Convert YouTube to Audio</h2>
            <p className="page-subtitle">
              Download high-quality audio from YouTube videos, playlists, or multiple URLs
            </p>

            <Nav tabs className="mb-4 custom-tabs">
              <NavItem>
                <NavLink
                  className={classNames("cursor-pointer", { active: selectedView === View.Single })}
                  onClick={() => setSelectedView(View.Single)}
                  title="Download a single video with real-time progress tracking"
                >
                  <FaFile />
                  <span>Single File</span>
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink
                  className={classNames({ active: selectedView === View.Playlist })}
                  onClick={() => setSelectedView(View.Playlist)}
                  title="Download entire YouTube playlists as a ZIP file"
                >
                  <FaList />
                  <span>Playlist</span>
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink
                  className={classNames({ active: selectedView === View.Multi })}
                  onClick={() => setSelectedView(View.Multi)}
                  title="Download multiple videos at once from different URLs"
                >
                  <FaLayerGroup />
                  <span>Multi File</span>
                </NavLink>
              </NavItem>
            </Nav>

            {/* Tab descriptions (Phase 2.3) */}
            <div className="tab-description">
              {selectedView === View.Single && (
                <p>⚡ Download a single video with real-time progress tracking and instant preview</p>
              )}
              {selectedView === View.Playlist && (
                <p>📋 Download entire YouTube playlists - all videos will be packaged as a ZIP file</p>
              )}
              {selectedView === View.Multi && (
                <p>🔢 Download multiple videos at once by entering URLs (one per line)</p>
              )}
            </div>

            {/* Keyboard navigation hint */}
            <div className="keyboard-hint">
              <span>💡 Tip: Use ← → arrow keys to switch between tabs</span>
            </div>

            <div className="tab-content-wrapper">
              <TabContent activeTab={selectedView}>
                <TabPane tabId={View.Single}>
                  <SingleFileForm />
                </TabPane>
                <TabPane tabId={View.Playlist}>
                  <PlaylistForm />
                </TabPane>
                <TabPane tabId={View.Multi}>
                  <MultiFileForm />
                </TabPane>
              </TabContent>
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
};

export default App;

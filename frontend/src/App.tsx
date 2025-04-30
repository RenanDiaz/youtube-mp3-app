import React, { useState, FC, useEffect } from "react";
import { Container, Nav, NavItem, NavLink, TabPane, TabContent } from "reactstrap";
import "./App.css";
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

  return (
    <Container className="pt-5">
      <h1>YouTube to Audio Downloader</h1>
      <Nav tabs className="mb-4">
        <NavItem>
          <NavLink
            className={classNames("cursor-pointer", { active: selectedView === View.Single })}
            onClick={() => setSelectedView(View.Single)}
          >
            Single File
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink
            className={classNames({ active: selectedView === View.Playlist })}
            onClick={() => setSelectedView(View.Playlist)}
          >
            Playlist
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink
            className={classNames({ active: selectedView === View.Multi })}
            onClick={() => setSelectedView(View.Multi)}
          >
            Multi File
          </NavLink>
        </NavItem>
      </Nav>
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
    </Container>
  );
};

export default App;

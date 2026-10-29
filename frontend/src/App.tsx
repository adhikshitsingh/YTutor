import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import IntroSplash from "./components/IntroSplash";
import ParticlesBackground from "./components/ParticlesBackground";
import HomePage from "./pages/HomePage";
import WorkspacePage from "./pages/WorkspacePage";

export default function App() {
  const [introDone, setIntroDone] = useState(false);

  return (
    <ParticlesBackground>
      {!introDone ? (
        <IntroSplash onComplete={() => setIntroDone(true)} />
      ) : (
        <div className="app-reveal h-full w-full">
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/watch/:videoId" element={<WorkspacePage />} />
            </Routes>
          </BrowserRouter>
        </div>
      )}
    </ParticlesBackground>
  );
}

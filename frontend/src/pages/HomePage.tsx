import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ErrorMessage from "../components/ErrorMessage";
import Hero from "../components/Hero";
import YouTubeUrlInput from "../components/YouTubeUrlInput";
import { looksLikeYouTubeUrl } from "../services/youtube";

export default function HomePage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(url: string) {
    setError(null);

    if (!looksLikeYouTubeUrl(url)) {
      setError("That doesn't look like a valid YouTube URL. Please check the link and try again.");
      return;
    }

    navigate(`/watch/${encodeURIComponent(url)}`);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-transparent">
      <main className="flex flex-1 flex-col items-center justify-center">
        <Hero>
          <div className="flex w-full flex-col items-center">
            <YouTubeUrlInput onSubmit={handleSubmit} />
            {error && <ErrorMessage message={error} />}
          </div>
        </Hero>
      </main>
    </div>
  );
}

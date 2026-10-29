import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ErrorMessage from "../components/ErrorMessage";
import LoadingState from "../components/LoadingState";
import MorphOrb from "../components/ui/ai-thiking-orb-and-input";
import VideoPlayer from "../components/VideoPlayer";
import { useChat } from "../hooks/useChat";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
import { analyzeVideo, ApiError } from "../services/api";
import { AnalysisStage, VideoAnalyzeResponse } from "../types/video";

const PLAYER_CONTAINER_ID = "youtube-player";

export default function WorkspacePage() {
  const { videoId: rawParam } = useParams<{ videoId: string }>();
  const navigate = useNavigate();

  const [stage, setStage] = useState<AnalysisStage>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<VideoAnalyzeResponse | null>(null);

  const runAnalysis = useCallback(async () => {
    if (!rawParam) return;
    const originalUrl = decodeURIComponent(rawParam);

    setErrorMessage(null);
    setVideoData(null);

    try {
      setStage("validating");
      setStage("loading-transcript");
      const result = await analyzeVideo(originalUrl);

      setStage("preparing");
      setVideoData(result);
      setStage("ready");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Something went wrong while loading this video.";
      setErrorMessage(message);
      setStage("error");
    }
  }, [rawParam]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  const { getCurrentTime } = useYouTubePlayer({
    videoId: videoData?.videoId ?? "",
    containerId: PLAYER_CONTAINER_ID,
  });

  const { sendQuestion } = useChat({
    videoId: videoData?.videoId ?? "",
    videoTitle: videoData?.title,
    transcript: videoData?.transcript ?? [],
    getCurrentTime,
  });

  if (stage === "error") {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-transparent">
        <main className="flex flex-1 flex-col items-center justify-center px-6">
          <ErrorMessage
            message={errorMessage ?? "We couldn't load this video."}
            onRetry={() => navigate("/")}
          />
        </main>
      </div>
    );
  }

  if (stage !== "ready" || !videoData) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-transparent">
        <main className="flex flex-1 flex-col items-center justify-center px-6">
          <LoadingState stage={stage} />
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-transparent">
      <Link
        to="/"
        aria-label="Back to home"
        className="fixed left-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </Link>
      <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-3 sm:px-6">
        <div className="w-full shrink-0">
          <VideoPlayer containerId={PLAYER_CONTAINER_ID} title={videoData.title} />
        </div>
        <div
          style={{ width: "min(100%, 900px, max(620px, calc(66vh * 16 / 9)))" }}
          className="mt-4 shrink-0"
        >
          <MorphOrb onSubmit={sendQuestion} />
        </div>
      </main>
    </div>
  );
}

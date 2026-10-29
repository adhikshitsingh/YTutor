interface VideoPlayerProps {
  containerId: string;
  title?: string | null;
}

/**
 * The YouTube IFrame Player API replaces this div's contents with an
 * <iframe> once useYouTubePlayer initializes it. We never build a custom
 * player or host the video ourselves.
 */
export default function VideoPlayer({ containerId, title }: VideoPlayerProps) {
  return (
    <div className="flex w-full flex-col items-center">
      {title && (
        <h2
          className="mb-1.5 max-w-2xl truncate text-center text-xs font-medium text-zinc-400"
          title={title}
        >
          {title}
        </h2>
      )}
      <div
        style={{ width: "min(100%, 900px, calc(66vh * 16 / 9))" }}
        className="relative aspect-video overflow-hidden rounded-xl border border-zinc-800/80 bg-black shadow-lg"
      >
        <div id={containerId} className="absolute inset-0 h-full w-full" />
      </div>
    </div>
  );
}

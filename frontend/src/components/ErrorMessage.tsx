import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className="mt-8 flex w-full max-w-xl flex-col items-center gap-3 rounded-2xl border border-red-500/30 bg-red-950/60 px-5 py-4 text-center backdrop-blur"
    >
      <div className="flex items-center gap-2 text-red-300">
        <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="text-sm font-medium">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-red-200 transition hover:bg-zinc-800"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}

import { Send } from "lucide-react";
import { KeyboardEvent, useState } from "react";

interface ChatInputProps {
  onSend: (question: string) => void;
  disabled?: boolean;
}

const MAX_LENGTH = 500;

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-zinc-800 p-3">
      <label htmlFor="chat-input" className="sr-only">
        Ask a question about the video
      </label>
      <textarea
        id="chat-input"
        rows={1}
        maxLength={MAX_LENGTH}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question..."
        className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:bg-zinc-900 focus:outline-none disabled:opacity-60"
      />
      <button
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label="Send question"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

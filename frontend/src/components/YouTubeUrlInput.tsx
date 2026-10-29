import { Link2 } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

interface YouTubeUrlInputProps {
  onSubmit: (url: string) => void;
  disabled?: boolean;
}

export default function YouTubeUrlInput({ onSubmit, disabled }: YouTubeUrlInputProps) {
  const [value, setValue] = useState("");
  const pillRef = useRef<HTMLDivElement>(null);
  const timers = useRef<{ typing?: number; shake?: number; flash?: number }>({});

  useEffect(() => {
    return () => {
      window.clearTimeout(timers.current.typing);
      window.clearTimeout(timers.current.shake);
      window.clearTimeout(timers.current.flash);
    };
  }, []);

  function shake() {
    const el = pillRef.current;
    if (!el) return;
    el.removeAttribute("data-shake");
    void el.offsetWidth;
    el.setAttribute("data-shake", "");
    el.setAttribute("data-flash", "");
    window.clearTimeout(timers.current.shake);
    window.clearTimeout(timers.current.flash);
    timers.current.shake = window.setTimeout(() => el.removeAttribute("data-shake"), 260);
    timers.current.flash = window.setTimeout(() => el.removeAttribute("data-flash"), 200);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);
    const el = pillRef.current;
    if (!el) return;
    el.setAttribute("data-typing", "");
    window.clearTimeout(timers.current.typing);
    timers.current.typing = window.setTimeout(() => el.removeAttribute("data-typing"), 300);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (disabled) return;
    const trimmed = value.trim();
    if (!trimmed) {
      shake();
      return;
    }
    onSubmit(trimmed);
  }

  const ready = value.trim().length > 0 && !disabled;

  return (
    <div className="mo-root flex justify-center">
      <div className="mo-pill" ref={pillRef}>
        <div className="mo-underglow" aria-hidden="true" />
        <div className="mo-surface" aria-hidden="true">
          <div className="mo-aurora">
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="mo-ring" aria-hidden="true" />

        <form onSubmit={handleSubmit} className="mo-input" autoComplete="off">
          <label htmlFor="youtube-url" className="sr-only">
            YouTube video URL
          </label>
          <Link2 className="mo-spark" aria-hidden="true" />
          <input
            id="youtube-url"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste a YouTube video URL…"
            value={value}
            onChange={handleChange}
            disabled={disabled}
            className="mo-field disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={disabled}
            aria-label="Start Learning"
            data-ready={ready ? "" : undefined}
            className="mo-send"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 19V5" />
              <path d="M5.5 11.5L12 5l6.5 6.5" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

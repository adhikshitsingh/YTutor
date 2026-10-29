import { ReactNode } from "react";

interface HeroProps {
  children: ReactNode;
}

export default function Hero({ children }: HeroProps) {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center px-6 py-4 text-center">
      <span className="hero-step-1 mb-4 inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-950/60 px-3 py-1 text-xs font-medium text-indigo-300 backdrop-blur">
        Watch. Ask. Understand.
      </span>
      <h1 className="hero-step-2 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
        Learn anything from any YouTube video.
      </h1>
      <p className="hero-step-3 mt-4 max-w-lg text-balance text-base leading-relaxed text-zinc-400">
        Watch the video, ask questions at any moment, and get explanations based on exactly
        what is being discussed.
      </p>
      <div className="hero-step-4 mt-8 flex w-full justify-center">{children}</div>
    </section>
  );
}

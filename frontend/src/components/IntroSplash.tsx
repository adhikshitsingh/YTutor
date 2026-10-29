import { useEffect, useRef, useState } from "react";
import AtomLogo from "./AtomLogo";

interface IntroSplashProps {
  onComplete?: () => void;
}

export default function IntroSplash({ onComplete }: IntroSplashProps) {
  const [stage, setStage] = useState<"init" | "visible" | "exit">("init");
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setStage("visible"));
    });

    const exitTimer = window.setTimeout(() => {
      setStage("exit");
    }, 1500);

    const doneTimer = window.setTimeout(() => {
      onCompleteRef.current?.();
    }, 2200);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center transition-all duration-700 ease-out ${
        stage === "init"
          ? "opacity-0 scale-95"
          : stage === "visible"
          ? "opacity-100 scale-100"
          : "opacity-0 scale-105 blur-sm"
      }`}
    >
      <div className="relative flex flex-col items-center">
        <div className="absolute -inset-10 rounded-full bg-indigo-500/10 blur-3xl" />
        <AtomLogo size={160} />
        <span className="mt-2 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          YTutor
        </span>
      </div>
    </div>
  );
}

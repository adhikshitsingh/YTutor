import { Link } from "react-router-dom";
import AtomLogo from "./AtomLogo";

export default function Navbar() {
  return (
    <header className="shrink-0 border-b border-zinc-900/80 bg-zinc-950/50 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2">
        <Link to="/" className="flex items-center gap-2 text-base font-bold tracking-tight text-white">
          <AtomLogo size={26} />
          <span>YTutor</span>
        </Link>
      </div>
    </header>
  );
}

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import "../../index.css";

/* ───────────────────────────── copy ───────────────────────────── */
const COPY = {
  placeholder: "Ask anything about the video…",
  followUpPlaceholder: "Ask another question…",
  labels: ["Thinking", "Searching", "Analyzing", "Composing"],
  done: "Done",
  answerTitle: "Answer",
  answerBody: "The answer goes here",
  dismiss: "Dismiss answer",
  send: "Send",
};

type Phase = "idle" | "assemble" | "think" | "resolve" | "condense" | "unfold" | "answered" | "reset";

export interface MorphOrbProps {
  onSubmit?: (text: string) => Promise<string> | string;
  minThinkMs?: number;
  speed?: number;
}

/* ─────────────────────────── geometry ─────────────────────────── */
const CANVAS = 152;
const ATOM_SCALE = 0.56;
const FOCAL_LENGTH = 320;

/* ───────────────────────── math + easing ───────────────────────── */
type Ease = (t: number) => number;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const fmt = (v: number) => String(Math.round(v * 1e4) / 1e4);
const TAU = Math.PI * 2;

function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-6) return t;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const e = sx(t);
      if (Math.abs(e - x) < 1e-6) break;
      if (x > e) lo = t; else hi = t;
      t = (hi - lo) / 2 + lo;
    }
    return t;
  };
  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)));
}

const E = {
  out: cubicBezier(0.22, 1, 0.36, 1),
  io: cubicBezier(0.65, 0, 0.35, 1),
  in: cubicBezier(0.4, 0, 1, 1),
  vortex: cubicBezier(0.6, 0, 0.2, 1),
  spring: cubicBezier(0.34, 1.4, 0.64, 1),
  lin: (t: number) => t,
};

/* ───────────────────────── timeline data ───────────────────────── */
interface Track { ch: string; from: number; to: number; t0: number; t1: number; ease?: Ease }
const T = (ch: string, from: number, to: number, t0: number, t1: number, ease: Ease = E.io): Track => ({ ch, from, to, t0, t1, ease });

const ASSEMBLE: Track[] = [
  T("orb.k", 0, 1, 0, 620, E.out),
  T("orb.alpha", 0, 1, 0, 520, E.out),
  T("orb.pop", 0.92, 1.04, 0, 360, E.out),
  T("orb.pop", 1.04, 1, 360, 620, E.io),
  T("sOp", 0, 1, 180, 480, E.out),
  T("sTy", 5, 0, 180, 480, E.out),
];

const RESOLVE: Track[] = [
  T("orb.pop", 1, 1.05, 0, 260, E.out),
  T("orb.pop", 1.05, 1, 260, 460, E.out),
];

const CONDENSE: Track[] = [
  T("sOp", 1, 0, 0, 160, E.in),
  T("sTy", 0, -5, 0, 160, E.in),
  T("orb.k", 1, 0, 60, 520, E.vortex),
  T("orb.vortex", 0, 1.5, 60, 520, E.vortex),
  T("pulse", 0, 1, 200, 600, E.out),
  T("orb.alpha", 1, 0, 340, 560, E.out),
];

const unfoldTracks = (tw: number): Track[] => [
  T("oAnswer", 0, 1, 0, 320, E.out),
  T("wp", 0, 1, 60, 60 + tw, E.lin),
];

const FADE = ["oAnswer", "sOp", "orb.alpha"];

const INIT: Record<string, number> = {
  oAnswer: 0, pulse: -1, sOp: 0, sTy: 5, wp: 0,
  "orb.k": 0, "orb.alpha": 0, "orb.pop": 1, "orb.vortex": 0,
};

/* ─────────────────────────── async utils ─────────────────────────── */
const ABORT = Symbol("abort");

function sleep(ms: number, sig: AbortSignal) {
  return new Promise<void>((res) => {
    if (sig.aborted) return res();
    let id = 0;
    const onAbort = () => { window.clearTimeout(id); res(); };
    id = window.setTimeout(() => { sig.removeEventListener("abort", onAbort); res(); }, Math.max(0, ms));
    sig.addEventListener("abort", onAbort, { once: true });
  });
}

function abortable<V>(p: Promise<V>, sig: AbortSignal) {
  return new Promise<V | undefined>((res) => {
    if (sig.aborted) return res(undefined);
    const onAbort = () => res(undefined);
    sig.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => { sig.removeEventListener("abort", onAbort); res(v); },
      () => { sig.removeEventListener("abort", onAbort); res(undefined); }
    );
  });
}

/* ─────────────────────────── 3D atom orb ─────────────────────────── */
interface OrbitPoint {
  a: number;
  rJ: number;
  phase: number;
}

interface OrbitDef {
  r: number;
  tiltX: number;
  tiltY: number;
  tiltZ: number;
  dotCount: number;
  eSpeed: number;
  ePhase: number;
  dotR: number;
  points: OrbitPoint[];
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface RenderItem {
  p3: Vec3;
  baseAlpha: number;
  isElectron: boolean;
  r: number;
}

function rotateX(p: Vec3, ang: number): Vec3 {
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}
function rotateY(p: Vec3, ang: number): Vec3 {
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}
function rotateZ(p: Vec3, ang: number): Vec3 {
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
}

function project3D(p: Vec3, cx: number, cy: number) {
  const scale = FOCAL_LENGTH / (FOCAL_LENGTH + p.z);
  return { x: cx + p.x * scale, y: cy + p.y * scale, scale };
}

interface OrbParams {
  k: number;
  alpha: number;
  pop: number;
  vortex: number;
  prog: number;
}
const ORB_KEYS = ["k", "alpha", "pop", "vortex"] as const;

function createOrb(canvas: HTMLCanvasElement, getSpeed: () => number, isReduced: () => boolean) {
  const P: OrbParams = { k: 0, alpha: 0, pop: 1, vortex: 0, prog: 0 };
  const ctx = canvas.getContext("2d");
  let time = 0, raf = 0, last = 0, dead = false;

  const orbits: OrbitDef[] = [
    { r: 45 * ATOM_SCALE, tiltX: 0.2, tiltY: 0.0, tiltZ: 0.0, dotCount: 70, eSpeed: 1.3, ePhase: 0.2, dotR: 0.72, points: [] },
    { r: 45 * ATOM_SCALE, tiltX: 0.7, tiltY: Math.PI / 2.2, tiltZ: 0.4, dotCount: 70, eSpeed: 1.1, ePhase: 1.8, dotR: 0.72, points: [] },
    { r: 70 * ATOM_SCALE, tiltX: 0.35, tiltY: Math.PI / 4, tiltZ: -0.3, dotCount: 100, eSpeed: 0.85, ePhase: 3.0, dotR: 0.84, points: [] },
    { r: 70 * ATOM_SCALE, tiltX: -0.45, tiltY: -Math.PI / 3, tiltZ: 0.2, dotCount: 100, eSpeed: 0.75, ePhase: 4.6, dotR: 0.84, points: [] },
    { r: 95 * ATOM_SCALE, tiltX: 0.15, tiltY: 0.0, tiltZ: 0.0, dotCount: 130, eSpeed: 0.7, ePhase: 0.3, dotR: 0.96, points: [] },
    { r: 95 * ATOM_SCALE, tiltX: 0.55, tiltY: Math.PI / 3, tiltZ: 0.3, dotCount: 130, eSpeed: 0.55, ePhase: 2.1, dotR: 0.96, points: [] },
    { r: 95 * ATOM_SCALE, tiltX: 0.55, tiltY: -Math.PI / 3, tiltZ: -0.3, dotCount: 130, eSpeed: 0.85, ePhase: 4.0, dotR: 0.96, points: [] },
    { r: 95 * ATOM_SCALE, tiltX: -0.55, tiltY: Math.PI / 1.7, tiltZ: 0.55, dotCount: 130, eSpeed: 0.4, ePhase: 5.5, dotR: 0.96, points: [] },
  ];

  orbits.forEach((orbit) => {
    for (let i = 0; i < orbit.dotCount; i++) {
      const a = (i / orbit.dotCount) * TAU;
      const jitter = (Math.random() - 0.5) * 1.0 * ATOM_SCALE;
      orbit.points.push({ a, rJ: orbit.r + jitter, phase: Math.random() * TAU });
    }
  });

  const reset = () => {
    P.k = 0; P.alpha = 0; P.pop = 1; P.vortex = 0; P.prog = 0;
    time = isReduced() ? 1.2 : 0;
  };
  reset();

  if (!ctx) return { P, ensure() {}, reset, destroy() {} };

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(CANVAS * dpr);
  canvas.height = Math.round(CANVAS * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cx = CANVAS / 2;
  const cy = CANVAS / 2;

  const draw = (dt: number) => {
    ctx.clearRect(0, 0, CANVAS, CANVAS);
    time += dt;

    const expand = E.out(clamp01(P.k)) * P.pop;
    if (expand <= 0.002 || P.alpha <= 0.002) return;

    const spinY = time * 0.35 + P.vortex;
    const spinX = Math.sin(time * 0.22) * 0.22;

    const renderItems: RenderItem[] = [];

    for (let oi = 0; oi < orbits.length; oi++) {
      const orbit = orbits[oi];
      const pts = orbit.points;
      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        const rScaled = pt.rJ * expand;
        let p3: Vec3 = { x: Math.cos(pt.a) * rScaled, y: Math.sin(pt.a) * rScaled, z: 0 };

        p3 = rotateX(p3, orbit.tiltX);
        p3 = rotateY(p3, orbit.tiltY);
        p3 = rotateZ(p3, orbit.tiltZ);
        p3 = rotateX(p3, spinX);
        p3 = rotateY(p3, spinY);

        const tw = (Math.sin(time * 1.5 + pt.phase) + 1) / 2;
        const baseAlpha = 0.28 + tw * 0.45;

        renderItems.push({ p3, baseAlpha, isElectron: false, r: orbit.dotR });
      }

      const ea = time * orbit.eSpeed + orbit.ePhase;
      const eR = orbit.r * expand;
      let eLocal: Vec3 = { x: Math.cos(ea) * eR, y: Math.sin(ea) * eR, z: 0 };
      eLocal = rotateX(eLocal, orbit.tiltX);
      eLocal = rotateY(eLocal, orbit.tiltY);
      eLocal = rotateZ(eLocal, orbit.tiltZ);
      eLocal = rotateX(eLocal, spinX);
      eLocal = rotateY(eLocal, spinY);

      renderItems.push({ p3: eLocal, baseAlpha: 0.95, isElectron: true, r: orbit.dotR * 2.3 });
    }

    const nucleusPulse = (1 + Math.sin(time * 2) * 0.1) * Math.max(0.25, expand);
    for (let n = 0; n < 70; n++) {
      const theta = Math.random() * TAU;
      const phi = Math.acos(Math.random() * 2 - 1);
      const rad = (6 + Math.random() * 2.5) * ATOM_SCALE * nucleusPulse;
      const nx = rad * Math.sin(phi) * Math.cos(theta);
      const ny = rad * Math.sin(phi) * Math.sin(theta);
      const nz = rad * Math.cos(phi);
      let np = rotateX({ x: nx, y: ny, z: nz }, spinX);
      np = rotateY(np, spinY * 0.3);
      renderItems.push({ p3: np, baseAlpha: 0.85, isElectron: false, r: 0.85 });
    }

    renderItems.sort((a, b) => a.p3.z - b.p3.z);

    for (let i = 0; i < renderItems.length; i++) {
      const item = renderItems[i];
      const proj = project3D(item.p3, cx, cy);
      const depthFade = Math.max(0.25, Math.min(1, proj.scale));
      const alpha = item.baseAlpha * depthFade * P.alpha;
      const radius = item.r * proj.scale * (0.4 + 0.6 * clamp01(P.k));

      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.arc(proj.x, proj.y, Math.max(0.38, radius), 0, TAU);
      ctx.fill();

      if (item.isElectron) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255,255,255,${(0.3 * depthFade * P.alpha).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.arc(proj.x, proj.y, 3.8 * proj.scale * Math.max(0.35, clamp01(P.k)), 0, TAU);
        ctx.stroke();
      }
    }
  };

  const frame = (now: number) => {
    raf = 0;
    if (dead) return;
    const dt = isReduced() ? 0 : Math.max(0, Math.min(0.05, (now - last) / 1000)) * getSpeed();
    last = now;
    draw(dt);
    if (P.alpha > 0.002) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, CANVAS, CANVAS);
  };

  const ensure = () => {
    if (raf || dead || P.alpha <= 0.002) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const destroy = () => {
    dead = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  return { P, ensure, reset, destroy };
}

/* ───────────────────────────── runtime ───────────────────────────── */
interface UI {
  setPhase(p: Phase): void;
  swapLabel(name: string): void;
  resetLabel(): void;
  setAnswer(s: string): void;
  clearInput(): void;
  live(s: string): void;
  lock(on: boolean): void;
  idleReady(): void;
}
interface Env {
  side: HTMLElement;
  form: HTMLElement;
  canvas: HTMLCanvasElement;
  pulse: HTMLElement;
  status: HTMLElement;
  getBody: () => HTMLElement | null;
  ui: UI;
  getSpeed: () => number;
  isReduced: () => boolean;
}
interface RunCfg { onSubmit: (text: string) => Promise<string> | string; minThink: number }
interface Runtime {
  start(text: string, cfg: RunCfg): boolean;
  dismiss(): void;
  hard(): void;
  busy(): boolean;
  destroy(): void;
}

function createRuntime(env: Env): Runtime {
  const { side, status, pulse, form } = env;
  const life = new AbortController();
  const orb = createOrb(env.canvas, env.getSpeed, env.isReduced);
  const vals: Record<string, number> = {};
  const dirty = new Set<string>();
  const CH: Record<string, (v: number) => void> = {};

  let current: AbortController | null = null;
  let idleCtl: AbortController | null = null;
  let runningQuery = false, idling = false, epoch = 0;
  let wStagger = 40, wDur = 280;

  const child = () => {
    const ac = new AbortController();
    if (life.signal.aborted) ac.abort();
    else life.signal.addEventListener("abort", () => ac.abort(), { once: true });
    return ac;
  };

  const applyWords = (v: number) => {
    const body = env.getBody();
    if (!body) return;
    const nodes = body.querySelectorAll<HTMLElement>(".mo-w");
    const total = (nodes.length - 1) * wStagger + wDur;
    const time = v * total;
    const reduced = env.isReduced();
    nodes.forEach((el, i) => {
      const p = E.out(clamp01((time - i * wStagger) / wDur));
      el.style.opacity = fmt(p);
      el.style.transform = p >= 0.999 || reduced ? "none" : `translateY(${fmt((1 - p) * 3)}px)`;
      el.style.filter = p >= 0.999 || reduced ? "none" : `blur(${fmt((1 - p) * 3)}px)`;
    });
  };

  CH.oAnswer = (v) => side.style.setProperty("--oAnswer", fmt(v));
  CH.sOp = (v) => status.style.setProperty("--sOp", fmt(v));
  CH.sTy = (v) => status.style.setProperty("--sTy", fmt(v));
  CH.pulse = (v) => {
    if (v < 0) { pulse.style.opacity = "0"; return; }
    pulse.style.opacity = fmt(0.45 * (1 - v));
    pulse.style.transform = `translate(-50%, -50%) scale(${fmt(0.6 + v * 0.8)})`;
  };
  CH.wp = applyWords;
  ORB_KEYS.forEach((name) => {
    CH["orb." + name] = (v) => {
      orb.P[name] = v;
      if (name === "alpha") orb.ensure();
    };
  });

  const set = (ch: string, v: number) => { vals[ch] = v; dirty.add(ch); };
  const flush = () => { dirty.forEach((ch) => CH[ch]?.(vals[ch])); dirty.clear(); };
  const setNow = (ch: string, v: number) => { vals[ch] = v; CH[ch]?.(v); };
  const resetChannels = () => {
    for (const ch of Object.keys(INIT)) setNow(ch, INIT[ch]);
  };

  const play = (tracks: Track[], sig: AbortSignal) =>
    new Promise<void>((res) => {
      if (sig.aborted) return res();
      const end = tracks.reduce((m, k) => Math.max(m, k.t1), 0);
      const done = new Set<Track>();
      let raf = 0, t = 0, last = performance.now();
      const onAbort = () => { cancelAnimationFrame(raf); res(); };
      const finish = () => { sig.removeEventListener("abort", onAbort); res(); };
      const step = (now: number) => {
        const dt = Math.max(0, Math.min(100, now - last));
        last = now;
        t += dt * env.getSpeed();
        for (const k of tracks) {
          if (done.has(k) || t < k.t0) continue;
          const p = Math.min(1, (t - k.t0) / Math.max(1, k.t1 - k.t0));
          set(k.ch, k.from + (k.to - k.from) * (k.ease ?? E.io)(p));
          if (p === 1) done.add(k);
        }
        flush();
        if (t >= end) finish(); else raf = requestAnimationFrame(step);
      };
      sig.addEventListener("abort", onAbort, { once: true });
      raf = requestAnimationFrame(step);
    });

  const labelLoop = async (sig: AbortSignal, ctl: { stop: boolean }) => {
    let i = 0;
    for (;;) {
      await sleep(1150 / env.getSpeed(), sig);
      if (sig.aborted || ctl.stop) return;
      i = (i + 1) % COPY.labels.length;
      orb.P.prog = i % 4;
      env.ui.swapLabel(COPY.labels[i]);
    }
  };

  const run = async (text: string, sig: AbortSignal, cfg: RunCfg) => {
    const reduced = env.isReduced();
    const go = async (tracks: Track[]) => {
      await play(tracks, sig);
      if (sig.aborted) throw ABORT;
    };
    try {
      // Fade out previous answer quickly if asking a follow-up directly
      if ((vals.oAnswer ?? 0) > 0.01) {
        await go([T("oAnswer", vals.oAnswer ?? 1, 0, 0, 160, E.out)]);
        env.ui.setAnswer("");
      }

      env.ui.setPhase("assemble");
      env.ui.resetLabel();
      if (!reduced) {
        await go(ASSEMBLE);
      } else {
        setNow("orb.k", 1);
        setNow("sTy", 0);
        await go([T("orb.alpha", 0, 1, 0, 180, E.out), T("sOp", 0, 1, 0, 180, E.out)]);
      }

      env.ui.setPhase("think");
      env.ui.live(COPY.labels[0]);
      const ctl = { stop: false };
      void labelLoop(sig, ctl);
      const t0 = performance.now();
      const pending = Promise.resolve()
        .then(() => cfg.onSubmit(text))
        .then((b) => (typeof b === "string" && b.trim() ? b : COPY.answerBody), () => COPY.answerBody);
      const got = await abortable(pending, sig);
      if (sig.aborted) throw ABORT;
      const body = got ?? COPY.answerBody;
      await sleep(cfg.minThink / env.getSpeed() - (performance.now() - t0), sig);
      ctl.stop = true;
      if (sig.aborted) throw ABORT;

      const words = body.split(/\s+/).filter(Boolean);
      const n = Math.max(1, words.length);

      env.ui.setPhase("resolve");
      env.ui.swapLabel(COPY.done);
      await go(RESOLVE);

      env.ui.setPhase("condense");
      if (!reduced) {
        await go(CONDENSE);
      } else {
        await go([T("orb.alpha", 1, 0, 0, 200, E.out), T("sOp", 1, 0, 0, 200, E.out)]);
      }

      env.ui.setPhase("unfold");
      wDur = reduced ? 200 : 280;
      wStagger = reduced ? 0 : n > 1 ? Math.min(36, 240 / (n - 1)) : 0;
      env.ui.setAnswer(body);
      await go(unfoldTracks((n - 1) * wStagger + wDur));

      runningQuery = false;
      env.ui.lock(false);
      env.ui.setPhase("answered");
      env.ui.live("Answer ready: " + body);
      env.ui.idleReady();
    } catch (e) {
      if (e === ABORT) return;
      hard();
    }
  };

  const toIdle = async () => {
    if (idling) return;
    idling = true;
    const my = ++epoch;
    current?.abort();
    const ac = child();
    idleCtl = ac;
    const sig = ac.signal;
    env.ui.setPhase("reset");

    const out: Track[] = [];
    for (const ch of FADE) {
      const v = vals[ch] ?? 0;
      if (v > 0.001) out.push(T(ch, v, 0, 0, 200, E.out));
    }
    if (out.length > 0) await play(out, sig);
    if (sig.aborted || my !== epoch) return;

    setNow("pulse", -1);
    env.ui.setAnswer("");
    env.ui.resetLabel();
    orb.reset();
    resetChannels();
    current = null;
    idleCtl = null;
    runningQuery = false;
    idling = false;
    env.ui.lock(false);
    env.ui.setPhase("idle");
    env.ui.idleReady();
  };

  function hard() {
    epoch++;
    current?.abort(); current = null;
    idleCtl?.abort(); idleCtl = null;
    orb.reset();
    env.ui.setAnswer("");
    env.ui.resetLabel();
    resetChannels();
    setNow("pulse", -1);
    runningQuery = false;
    idling = false;
    env.ui.lock(false);
    env.ui.setPhase("idle");
    env.ui.idleReady();
  }

  resetChannels();

  return {
    start(text, cfg) {
      if (runningQuery || idling) return false;
      runningQuery = true;
      orb.reset();
      const ac = child();
      current = ac;
      env.ui.clearInput();
      env.ui.lock(true);
      void run(text, ac.signal, cfg);
      return true;
    },
    dismiss() {
      if (idling) return;
      void toIdle();
    },
    hard,
    busy: () => runningQuery,
    destroy() {
      life.abort();
      orb.destroy();
    },
  };
}

/* ───────────────────── inline markdown word helper ───────────────────── */
function renderFormattedWords(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split(/\n+/).filter((l) => l.trim().length > 0);
  let keyIdx = 0;

  const renderWords = (segment: string) =>
    segment
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => (
        <React.Fragment key={keyIdx++}>
          <span className="mo-w">{w}</span>{" "}
        </React.Fragment>
      ));

  return lines.map((rawLine, li) => {
    const line = rawLine.replace(/^#{1,6}\s+/, "");
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return (
      <span key={`line-${li}`} className={li > 0 ? "mt-2 block" : "block"}>
        {parts.map((part, pi) => {
          if (!part) return null;
          if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
            return (
              <strong key={`b-${li}-${pi}`} className="font-semibold text-white">
                {renderWords(part.slice(2, -2))}
              </strong>
            );
          }
          if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
            return (
              <em key={`i-${li}-${pi}`} className="italic text-zinc-200">
                {renderWords(part.slice(1, -1))}
              </em>
            );
          }
          if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
            return (
              <code key={`c-${li}-${pi}`} className="rounded bg-white/10 px-1 py-0.5 text-xs text-zinc-200">
                {renderWords(part.slice(1, -1))}
              </code>
            );
          }
          return <React.Fragment key={`t-${li}-${pi}`}>{renderWords(part)}</React.Fragment>;
        })}
      </span>
    );
  });
}

/* ───────────────────────────── component ───────────────────────────── */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function MorphOrb(props: MorphOrbProps) {
  const [phase, setPhaseState] = useState<Phase>("idle");
  const [value, setValue] = useState("");
  const [lbl, setLbl] = useState<{ cur: string; prev: string | null; n: number }>({ cur: COPY.labels[0], prev: null, n: 0 });
  const [answer, setAnswer] = useState("");
  const [dbgSpeed, setDbgSpeed] = useState(1);
  const [debug] = useState(() => typeof window !== "undefined" && /[?&]debug(?:[=&]|$)/.test(window.location.search));

  const pillRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pulseRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  const propsRef = useRef(props);
  propsRef.current = props;
  const speedRef = useRef(1);
  speedRef.current = Math.max(0.05, (props.speed ?? 1) * dbgSpeed);
  const phaseRef = useRef<Phase>("idle");
  const reducedRef = useRef(false);
  const rtRef = useRef<Runtime | null>(null);
  const lastTextRef = useRef("");
  const timers = useRef<{ typing?: number; shake?: number; flash?: number }>({});

  useIsoLayoutEffect(() => {
    const side = sideRef.current, canvas = canvasRef.current;
    const pulse = pulseRef.current, status = statusRef.current, form = formRef.current;
    if (!side || !canvas || !pulse || !status || !form) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onMq = (e: MediaQueryListEvent) => { reducedRef.current = e.matches; };
    mq.addEventListener("change", onMq);

    const rt = createRuntime({
      side, form, canvas, pulse, status,
      getBody: () => bodyRef.current,
      getSpeed: () => speedRef.current,
      isReduced: () => reducedRef.current,
      ui: {
        setPhase: (p) => { phaseRef.current = p; setPhaseState(p); },
        swapLabel: (name) => setLbl((l) => (l.cur === name ? l : { cur: name, prev: l.cur, n: l.n + 1 })),
        resetLabel: () => setLbl((l) => ({ cur: COPY.labels[0], prev: null, n: l.n + 1 })),
        setAnswer: (s) => setAnswer(s),
        clearInput: () => setValue(""),
        live: (s) => { if (liveRef.current) liveRef.current.textContent = s; },
        lock: (on) => { form.toggleAttribute("inert", on); },
        idleReady: () => { inputRef.current?.focus({ preventScroll: true }); },
      },
    });
    rtRef.current = rt;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phaseRef.current !== "idle" && phaseRef.current !== "reset") {
        e.preventDefault();
        rt.dismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    inputRef.current?.focus({ preventScroll: true });

    return () => {
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
      window.clearTimeout(timers.current.typing);
      window.clearTimeout(timers.current.shake);
      window.clearTimeout(timers.current.flash);
      rt.destroy();
      rtRef.current = null;
    };
  }, []);

  const defaultSubmit = () =>
    new Promise<string>((res) => {
      window.setTimeout(() => res(COPY.answerBody), 3200 / speedRef.current);
    });
  const makeCfg = (): RunCfg => ({
    onSubmit: propsRef.current.onSubmit ?? defaultSubmit,
    minThink: propsRef.current.minThinkMs ?? 2400,
  });

  const shake = () => {
    const a = pillRef.current;
    if (!a) return;
    a.removeAttribute("data-shake");
    void a.offsetWidth;
    a.setAttribute("data-shake", "");
    a.setAttribute("data-flash", "");
    window.clearTimeout(timers.current.shake);
    window.clearTimeout(timers.current.flash);
    timers.current.shake = window.setTimeout(() => a.removeAttribute("data-shake"), 260);
    timers.current.flash = window.setTimeout(() => a.removeAttribute("data-flash"), 200);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    const a = pillRef.current;
    if (!a) return;
    a.setAttribute("data-typing", "");
    window.clearTimeout(timers.current.typing);
    timers.current.typing = window.setTimeout(() => a.removeAttribute("data-typing"), 300);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && (e.shiftKey || e.nativeEvent.isComposing)) e.preventDefault();
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rt = rtRef.current;
    if (!rt || rt.busy()) return;
    if (phaseRef.current !== "idle" && phaseRef.current !== "answered") return;
    const text = value.trim();
    if (!text) { shake(); return; }
    lastTextRef.current = text;
    rt.start(text, makeCfg());
  };

  const onDismiss = () => {
    rtRef.current?.dismiss();
  };

  const replay = () => {
    const rt = rtRef.current;
    if (!rt) return;
    const text = lastTextRef.current || "hello";
    lastTextRef.current = text;
    rt.hard();
    window.requestAnimationFrame(() => { rt.start(text, makeCfg()); });
  };

  const ready = value.trim().length > 0;
  const sideOpen = phase !== "idle";
  const isLoading = phase === "assemble" || phase === "think" || phase === "resolve" || phase === "condense";

  const labelInner = (name: string) =>
    name === COPY.done ? (
      <span className="mo-lab-done">{name}</span>
    ) : (
      <>
        <span className="mo-lab-t">{name}</span>
        <span className="mo-dots" aria-hidden="true"><i /><i /><i /></span>
      </>
    );

  return (
    <div
      className="mo-root"
      data-phase={phase}
      data-open={sideOpen ? "" : undefined}
      data-loading={isLoading ? "" : undefined}
    >
      <div className="mo-row">
        {/* Message Input Pill */}
        <div className="mo-pill" ref={pillRef}>
          <div className="mo-underglow" aria-hidden="true" />
          <div className="mo-surface" aria-hidden="true">
            <div className="mo-aurora"><i /><i /><i /><i /></div>
          </div>
          <div className="mo-ring" aria-hidden="true" />

          <form className="mo-input" ref={formRef} onSubmit={onFormSubmit} autoComplete="off">
            <svg className="mo-spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 3.5l1.7 4.8 4.8 1.7-4.8 1.7L10 16.5l-1.7-4.8L3.5 10l4.8-1.7L10 3.5z" />
              <path d="M18 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
            </svg>
            <input
              ref={inputRef}
              className="mo-field"
              type="text"
              value={value}
              maxLength={500}
              placeholder={phase === "answered" ? COPY.followUpPlaceholder : COPY.placeholder}
              aria-label="Ask anything"
              spellCheck={false}
              onChange={onChange}
              onKeyDown={onKeyDown}
            />
            <button type="submit" className="mo-send" aria-label={COPY.send} data-ready={ready ? "" : undefined}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5" />
                <path d="M5.5 11.5L12 5l6.5 6.5" />
              </svg>
            </button>
          </form>
        </div>

        {/* Companion Side Area: 3D Atom Thinking + Borderless Answer */}
        <div className="mo-side" ref={sideRef}>
          <div className="mo-think-stage" aria-hidden="true">
            <div className="mo-orb-box">
              <canvas className="mo-orb" ref={canvasRef} />
              <div className="mo-pulse" ref={pulseRef} />
            </div>
            <div className="mo-status" ref={statusRef}>
              {lbl.prev !== null && (
                <span key={"p" + lbl.n} className="mo-lab mo-out">{labelInner(lbl.prev)}</span>
              )}
              <span key={"c" + lbl.n} className="mo-lab mo-in">{labelInner(lbl.cur)}</span>
            </div>
          </div>

          <div className="mo-answer-wrap">
            <div className="mo-answer" ref={answerRef} tabIndex={-1} role="group" aria-label={COPY.answerTitle}>
              <div className="mo-a-body" ref={bodyRef}>
                {renderFormattedWords(answer)}
              </div>
            </div>
            {phase === "answered" && (
              <button type="button" className="mo-dismiss" onClick={onDismiss} aria-label={COPY.dismiss} title={COPY.dismiss}>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mo-live" ref={liveRef} role="status" aria-live="polite" />

      {debug && (
        <div className="mo-debug">
          <span className="mo-chip">{phase}</span>
          <label>
            <span>{dbgSpeed.toFixed(2)}×</span>
            <input
              type="range"
              min={0.25}
              max={2}
              step={0.05}
              value={dbgSpeed}
              aria-label="Speed"
              onChange={(e) => setDbgSpeed(parseFloat(e.target.value))}
            />
          </label>
          <button type="button" onClick={replay}>Replay</button>
        </div>
      )}
    </div>
  );
}

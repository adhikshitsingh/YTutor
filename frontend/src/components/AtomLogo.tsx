import { useEffect, useRef } from "react";

interface AtomLogoProps {
  size?: number;
  className?: string;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function rotX(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}
function rotY(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}
function rotZ(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
}

export default function AtomLogo({ size = 118, className = "" }: AtomLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const scaleK = size / 245;
    const focal = 380 * scaleK;
    const cx = size / 2;
    const cy = size / 2;
    const fullDetail = size >= 60;
    const dotMult = fullDetail ? 1 : 0.35;

    const orbits = [
      { r: 45 * scaleK, tiltX: 0.2, tiltY: 0.0, tiltZ: 0.0, dotCount: Math.round(70 * dotMult), eSpeed: 1.3, ePhase: 0.2, dotR: 0.8 * scaleK * 1.4 },
      { r: 45 * scaleK, tiltX: 0.7, tiltY: Math.PI / 2.2, tiltZ: 0.4, dotCount: Math.round(70 * dotMult), eSpeed: 1.1, ePhase: 1.8, dotR: 0.8 * scaleK * 1.4 },
      { r: 70 * scaleK, tiltX: 0.35, tiltY: Math.PI / 4, tiltZ: -0.3, dotCount: Math.round(100 * dotMult), eSpeed: 0.85, ePhase: 3.0, dotR: 0.95 * scaleK * 1.4 },
      { r: 70 * scaleK, tiltX: -0.45, tiltY: -Math.PI / 3, tiltZ: 0.2, dotCount: Math.round(100 * dotMult), eSpeed: 0.75, ePhase: 4.6, dotR: 0.95 * scaleK * 1.4 },
      { r: 95 * scaleK, tiltX: 0.15, tiltY: 0.0, tiltZ: 0.0, dotCount: Math.round(130 * dotMult), eSpeed: 0.7, ePhase: 0.3, dotR: 1.1 * scaleK * 1.4 },
      { r: 95 * scaleK, tiltX: 0.55, tiltY: Math.PI / 3, tiltZ: 0.3, dotCount: Math.round(130 * dotMult), eSpeed: 0.55, ePhase: 2.1, dotR: 1.1 * scaleK * 1.4 },
      { r: 95 * scaleK, tiltX: 0.55, tiltY: -Math.PI / 3, tiltZ: -0.3, dotCount: Math.round(130 * dotMult), eSpeed: 0.85, ePhase: 4.0, dotR: 1.1 * scaleK * 1.4 },
      { r: 95 * scaleK, tiltX: -0.55, tiltY: Math.PI / 1.7, tiltZ: 0.55, dotCount: Math.round(130 * dotMult), eSpeed: 0.4, ePhase: 5.5, dotR: 1.1 * scaleK * 1.4 },
    ].map((o) => ({
      ...o,
      points: Array.from({ length: o.dotCount }, (_, i) => ({
        a: (i / o.dotCount) * Math.PI * 2,
        rJ: o.r + (Math.random() - 0.5) * scaleK,
        phase: Math.random() * Math.PI * 2,
      })),
    }));

    let raf = 0;
    const t0 = performance.now();

    const draw = (now: number) => {
      ctx.clearRect(0, 0, size, size);
      const t = (now - t0) / 1000;
      const spinY = t * 0.42;
      const spinX = Math.sin(t * 0.25) * 0.22;

      const items: { p3: Vec3; alpha: number; r: number; isE: boolean }[] = [];

      for (const orb of orbits) {
        for (const pt of orb.points) {
          let p3: Vec3 = { x: Math.cos(pt.a) * pt.rJ, y: Math.sin(pt.a) * pt.rJ, z: 0 };
          p3 = rotX(p3, orb.tiltX);
          p3 = rotY(p3, orb.tiltY);
          p3 = rotZ(p3, orb.tiltZ);
          p3 = rotX(p3, spinX);
          p3 = rotY(p3, spinY);
          const tw = (Math.sin(t * 1.5 + pt.phase) + 1) / 2;
          items.push({ p3, alpha: 0.28 + tw * 0.45, r: orb.dotR, isE: false });
        }

        const ea = t * orb.eSpeed + orb.ePhase;
        let ep: Vec3 = { x: Math.cos(ea) * orb.r, y: Math.sin(ea) * orb.r, z: 0 };
        ep = rotX(ep, orb.tiltX);
        ep = rotY(ep, orb.tiltY);
        ep = rotZ(ep, orb.tiltZ);
        ep = rotX(ep, spinX);
        ep = rotY(ep, spinY);
        items.push({ p3: ep, alpha: 0.95, r: orb.dotR * 2.3, isE: true });
      }

      const nucleusPulse = 1 + Math.sin(t * 2) * 0.1;
      const nucleusCount = fullDetail ? 65 : 12;
      for (let n = 0; n < nucleusCount; n++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const rad = (6 + Math.random() * 2.5) * scaleK * nucleusPulse;
        let np: Vec3 = {
          x: rad * Math.sin(phi) * Math.cos(theta),
          y: rad * Math.sin(phi) * Math.sin(theta),
          z: rad * Math.cos(phi),
        };
        np = rotX(np, spinX);
        np = rotY(np, spinY * 0.3);
        items.push({ p3: np, alpha: 0.85, r: 0.9 * scaleK * 1.3, isE: false });
      }

      items.sort((a, b) => a.p3.z - b.p3.z);

      for (const it of items) {
        const sc = focal / (focal + it.p3.z);
        const px = cx + it.p3.x * sc;
        const py = cy + it.p3.y * sc;
        const depthFade = Math.max(0.25, Math.min(1, sc));
        const a = it.alpha * depthFade;

        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        ctx.arc(px, py, Math.max(0.38, it.r * sc), 0, Math.PI * 2);
        ctx.fill();

        if (it.isE && fullDetail) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(255,255,255,${(0.3 * depthFade).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.arc(px, py, 5 * scaleK * sc, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    />
  );
}

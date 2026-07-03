"use client";

import { useEffect, useRef } from "react";

// Live community space rendered from REAL member embeddings. Fetches /api/space
// (data-derived 3-d coords + hue per member, plus the current member and their
// nearest neighbors) and draws a glowing, draggable, slowly auto-rotating point
// cloud with depth cueing, additive glow sprites, a nearest-neighbor lattice, and
// labels for self, neighbors, and the highest-karma members.

interface SpacePoint {
  id: string;
  name: string;
  headline: string;
  karma: number;
  x: number;
  y: number;
  z: number;
  hue: number;
}

interface SpaceData {
  points: SpacePoint[];
  self?: string;
  neighbors?: string[];
}

interface DrawPt {
  p: SpacePoint;
  sx: number;
  sy: number;
  depth: number;
  scale: number;
}

export default function LiveSpace({ height = 520 }: { height?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<SpaceData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let ro: ResizeObserver | null = null;

    let W = 0;
    let H = height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      W = wrap.clientWidth;
      H = height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    ro = new ResizeObserver(() => {
      resize();
      if (reduce && dataRef.current) frame();
    });
    ro.observe(wrap);

    let ay = 0;
    let ax = -0.32;
    let vy = 0.0016;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      vy = 0;
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      ay += (e.clientX - lastX) * 0.005;
      ax += (e.clientY - lastY) * 0.005;
      lastX = e.clientX;
      lastY = e.clientY;
      if (reduce) frame();
    };
    const up = () => {
      dragging = false;
      vy = 0.0016;
    };
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);

    // Pre-rendered radial-gradient glow sprites, cached per hue.
    const spriteCache = new Map<number, HTMLCanvasElement>();
    const makeSprite = (stops: [number, string][], size: number) => {
      const s = document.createElement("canvas");
      s.width = s.height = size;
      const g = s.getContext("2d")!;
      const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      stops.forEach(([o, col]) => grad.addColorStop(o, col));
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      return s;
    };
    const spriteFor = (hue: number) => {
      const key = Math.round(hue);
      let sp = spriteCache.get(key);
      if (!sp) {
        sp = makeSprite(
          [
            [0, `hsla(${key},78%,52%,0.95)`],
            [0.42, `hsla(${key},78%,55%,0.28)`],
            [1, `hsla(${key},78%,55%,0)`],
          ],
          64,
        );
        spriteCache.set(key, sp);
      }
      return sp;
    };
    const whiteSprite = makeSprite(
      [
        [0, "rgba(70,55,200,0.98)"],
        [0.35, "rgba(91,75,219,0.4)"],
        [1, "rgba(91,75,219,0)"],
      ],
      120,
    );

    const focal = 3;
    const project = (x: number, y: number, z: number) => {
      const cy = Math.cos(ay);
      const sy = Math.sin(ay);
      const X = x * cy - z * sy;
      const Z = x * sy + z * cy;
      const cx = Math.cos(ax);
      const sx = Math.sin(ax);
      const Y2 = y * cx - Z * sx;
      const Z2 = y * sx + Z * cx;
      const scale = focal / (focal - Z2);
      const spread = Math.min(W, H) * 0.36;
      return { sx: W / 2 + X * scale * spread, sy: H / 2 + Y2 * scale * spread, depth: Z2, scale };
    };

    // Derived render state, computed once data arrives.
    let nearestEdges: [number, number][] = [];
    let selfIdx = -1;
    let neighborIdx: number[] = [];
    let labelIdx: number[] = [];
    let radius = 1;

    const prepare = (data: SpaceData) => {
      const pts = data.points;
      const idxById = new Map(pts.map((p, i) => [p.id, i]));

      // Normalize the standardized coords into a tidy unit-ish ball.
      let maxR = 0;
      for (const p of pts) maxR = Math.max(maxR, Math.hypot(p.x, p.y, p.z));
      radius = maxR || 1;

      // Each point to its 2-3 nearest neighbors (by returned coords) for a lattice.
      nearestEdges = [];
      for (let i = 0; i < pts.length; i++) {
        const near = pts
          .map((q, j) =>
            j !== i
              ? [j, (q.x - pts[i].x) ** 2 + (q.y - pts[i].y) ** 2 + (q.z - pts[i].z) ** 2]
              : [j, Infinity],
          )
          .sort((a, b) => a[1] - b[1]);
        const k = pts.length > 60 ? 2 : 3;
        for (let n = 0; n < k; n++) {
          if (near[n] && near[n][0] > i) nearestEdges.push([i, near[n][0]]);
        }
      }

      selfIdx = data.self !== undefined ? idxById.get(data.self) ?? -1 : -1;
      neighborIdx = (data.neighbors ?? [])
        .map((id) => idxById.get(id))
        .filter((v): v is number => v !== undefined);

      // Labels: self, neighbors, and the few highest-karma members.
      const topKarma = pts
        .map((p, i) => [i, p.karma] as [number, number])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([i]) => i);
      const labelSet = new Set<number>();
      if (selfIdx >= 0) labelSet.add(selfIdx);
      for (const i of neighborIdx) labelSet.add(i);
      for (const i of topKarma) labelSet.add(i);
      labelIdx = Array.from(labelSet);
    };

    let t = 0;
    function frame() {
      const data = dataRef.current;
      if (!data) {
        if (!reduce) raf = requestAnimationFrame(frame);
        return;
      }
      const pts = data.points;
      t += 1;
      if (!dragging && !reduce) ay += vy;
      ctx.clearRect(0, 0, W, H);

      const drawn: DrawPt[] = pts.map((p) => {
        const pr = project(p.x / radius, p.y / radius, p.z / radius);
        return { p, sx: pr.sx, sy: pr.sy, depth: pr.depth, scale: pr.scale };
      });

      // Lattice edges.
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 1;
      for (const [a, b] of nearestEdges) {
        const pa = drawn[a];
        const pb = drawn[b];
        const d = (pa.depth + pb.depth) / 2;
        const alpha = Math.max(0, Math.min(0.5, (d + 1.2) / 3)) * 0.4;
        ctx.strokeStyle = `hsla(${pa.p.hue},55%,50%,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.stroke();
      }

      // Beams from self to its neighbors.
      if (selfIdx >= 0) {
        const self = drawn[selfIdx];
        for (const ni of neighborIdx) {
          const nb = drawn[ni];
          ctx.strokeStyle = "rgba(70,55,200,0.45)";
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(self.sx, self.sy);
          ctx.lineTo(nb.sx, nb.sy);
          ctx.stroke();
        }
      }

      // Points, back to front.
      const order = drawn
        .map((d, i) => [i, d.depth] as [number, number])
        .sort((a, b) => a[1] - b[1]);
      for (const [i] of order) {
        const d = drawn[i];
        const isSelf = i === selfIdx;
        const size = Math.max(3, 8 * d.scale) * (isSelf ? 1.8 : 1);
        ctx.globalAlpha = Math.max(0.3, Math.min(1, (d.depth + 1.4) / 2.6)) * (isSelf ? 1 : 0.85);
        ctx.drawImage(
          isSelf ? whiteSprite : spriteFor(d.p.hue),
          d.sx - size,
          d.sy - size,
          size * 2,
          size * 2,
        );
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      // Labels.
      ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
      ctx.textBaseline = "middle";
      for (const i of labelIdx) {
        const d = drawn[i];
        if (d.depth < -0.9) continue;
        const isSelf = i === selfIdx;
        ctx.fillStyle = isSelf ? "rgba(40,30,90,0.95)" : "rgba(28,26,38,0.6)";
        const dot = Math.max(3, 8 * d.scale) * (isSelf ? 1.8 : 1);
        ctx.fillText(d.p.name, d.sx + dot + 4, d.sy);
      }

      if (!reduce) raf = requestAnimationFrame(frame);
    }

    fetch("/api/space")
      .then((r) => r.json())
      .then((data: SpaceData) => {
        if (cancelled) return;
        dataRef.current = data;
        prepare(data);
        if (reduce) {
          ay = 0.6;
          frame();
        }
      })
      .catch(() => {
        // leave the cloud empty on failure
      });

    if (!reduce) raf = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [height]);

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height }}>
      <canvas ref={canvasRef} className="block w-full cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-3 right-4 text-[11px] text-[var(--muted-foreground)] pointer-events-none">
        drag to rotate
      </div>
    </div>
  );
}
